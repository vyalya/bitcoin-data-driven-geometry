#!/usr/bin/env node
/**
 * Patch mosaicSnapshots.ts in-place: pulls fresh hashrate, difficulty, and
 * median-confirmation-time from blockchain.com's public charts API and
 * rewrites the per-date numbers in the MOSAIC table.
 *
 * Usage: node scripts/patch_mosaic.mjs
 *        node scripts/patch_mosaic.mjs --dry  # print diff, don't write
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src", "data", "mosaicSnapshots.ts");
const DRY = process.argv.includes("--dry");

const SNAPSHOT_DATES = [
  "2009-01-09", "2010-05-22", "2011-06-19", "2013-04-10", "2014-02-24",
  "2015-01-14", "2016-07-09", "2017-12-20", "2018-12-15", "2019-06-26",
  "2020-03-12", "2020-05-11", "2021-04-14", "2021-06-28", "2021-11-10",
  "2022-02-24", "2022-11-11", "2023-01-14", "2023-12-16", "2024-01-11",
  "2024-03-14", "2024-04-20", "2024-11-10", "2025-01-20", "2025-10-10",
];

async function fetchChart(name) {
  const url = `https://api.blockchain.info/charts/${name}?timespan=all&format=json&sampled=false&cors=true`;
  process.stderr.write(`fetching ${name}...\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  return json.values;
}

function nearestValue(series, dateStr) {
  const target = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
  let best = null;
  let bestDiff = Infinity;
  for (const pt of series) {
    const diff = Math.abs(pt.x - target);
    if (diff < bestDiff) {
      best = pt;
      bestDiff = diff;
    }
  }
  // Reject if more than 4 days away (data point doesn't exist for that date)
  return best && bestDiff < 4 * 86400 ? best.y : null;
}

/**
 * Centered N-day moving average around a target date. This matches the
 * methodology that CoinWarz, Hashrate Index, and most "headline" sources use
 * for hashrate, smoothing out the day-to-day random block-timing noise that
 * makes raw 1-day estimates swing ±15-20%.
 */
function movingAverage(series, dateStr, windowDays = 7) {
  const target = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
  const halfWindowSec = (windowDays / 2) * 86400;
  let sum = 0;
  let count = 0;
  for (const pt of series) {
    if (Math.abs(pt.x - target) <= halfWindowSec) {
      sum += pt.y;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Maximum of an N-day moving average across the entire series. Used as the
 * ATH reference value so the ring-fill normaliser is consistent with the
 * smoothed daily numbers we display.
 */
function maxMovingAverage(series, windowDays = 7) {
  if (series.length === 0) return 0;
  // Sort by x just in case
  const sorted = [...series].sort((a, b) => a.x - b.x);
  const halfWindowSec = (windowDays / 2) * 86400;
  let max = 0;
  // Sample at each data point
  for (let i = 0; i < sorted.length; i++) {
    const target = sorted[i].x;
    let sum = 0;
    let count = 0;
    // Walk outwards from i until we exit the window
    for (let j = i; j >= 0 && target - sorted[j].x <= halfWindowSec; j--) {
      sum += sorted[j].y;
      count++;
    }
    for (let j = i + 1; j < sorted.length && sorted[j].x - target <= halfWindowSec; j++) {
      sum += sorted[j].y;
      count++;
    }
    if (count > 0) {
      const avg = sum / count;
      if (avg > max) max = avg;
    }
  }
  return max;
}

// Map confirmation time → blockProductionStress score (1.0 = healthy 10min)
function stressFromMedianMin(min) {
  if (min == null || min === 0) return 0.92;
  const ratio = min / 10;
  if (ratio < 0.7) return Math.max(0.5, 0.5 + ratio * 0.6);
  if (ratio <= 1.2) return 0.7 + (ratio - 0.7) * 0.4;
  if (ratio <= 1.5) return 0.9 + (ratio - 1.2) * 1.5;
  if (ratio <= 2.5) return 1.35 + (ratio - 1.5) * 1.0;
  return Math.min(2.35 + (ratio - 2.5) * 0.6, 4);
}

async function main() {
  const [hashRateRaw, difficultyRaw, medianConfirmRaw] = await Promise.all([
    fetchChart("hash-rate"),
    fetchChart("difficulty"),
    fetchChart("median-confirmation-time"),
  ]);

  // ATH for the maxHashrate normaliser. We use a 7-day moving average for
  // both per-date values and the ATH so they're consistent. blockchain.com
  // returns hashrate in TH/s — divide by 1e6 for EH/s.
  const WINDOW_DAYS = 7;
  const athTh = maxMovingAverage(hashRateRaw, WINDOW_DAYS);
  const athEh = athTh / 1e6;
  process.stderr.write(`hashrate ${WINDOW_DAYS}-day MA ATH: ${athEh.toFixed(2)} EH/s\n`);

  // Build per-date corrections using a 7-day MA for hashrate and difficulty
  // (smoother, matches CoinWarz/Hashrate Index conventions). Median confirm
  // time stays as nearest-day since it's less noisy.
  const corrections = new Map();
  for (const date of SNAPSHOT_DATES) {
    const hrTh = movingAverage(hashRateRaw, date, WINDOW_DAYS);
    const diff = movingAverage(difficultyRaw, date, WINDOW_DAYS);
    const medMin = nearestValue(medianConfirmRaw, date);

    corrections.set(date, {
      networkHashrateEh: hrTh != null ? +(hrTh / 1e6).toFixed(3) : null,
      difficulty: diff != null ? +diff.toFixed(2) : null,
      avgBlockIntervalSeconds: medMin != null && medMin > 0 ? +(medMin * 60).toFixed(1) : null,
      blockProductionStress: +stressFromMedianMin(medMin).toFixed(2),
    });
  }

  // Read the current file
  let src = readFileSync(FILE, "utf8");

  // For each date in MOSAIC table, replace the relevant numeric fields.
  // Each MOSAIC entry looks like:
  //   "YYYY-MM-DD": { blockHeight: N, avgBlockIntervalSeconds: N, networkHashrateEh: N, ..., blockProductionStress: N, ..., difficulty: N },
  let changes = 0;
  for (const date of SNAPSHOT_DATES) {
    const c = corrections.get(date);
    if (!c || c.networkHashrateEh == null) {
      process.stderr.write(`  skip ${date} — no data\n`);
      continue;
    }
    // Replace networkHashrateEh
    {
      const re = new RegExp(`("${date}": \\{[^}]*?networkHashrateEh:\\s*)([0-9.eE+-]+)`);
      const m = src.match(re);
      if (m && parseFloat(m[2]) !== c.networkHashrateEh) {
        src = src.replace(re, `$1${c.networkHashrateEh}`);
        changes++;
      }
    }
    // Replace difficulty
    if (c.difficulty != null) {
      const re = new RegExp(`("${date}": \\{[^}]*?difficulty:\\s*)([0-9.eE+-]+)`);
      const m = src.match(re);
      if (m && parseFloat(m[2]) !== c.difficulty) {
        src = src.replace(re, `$1${c.difficulty}`);
        changes++;
      }
    }
    // Replace avgBlockIntervalSeconds (only if we have real data)
    if (c.avgBlockIntervalSeconds != null) {
      const re = new RegExp(`("${date}": \\{[^}]*?avgBlockIntervalSeconds:\\s*)([0-9.eE+-]+)`);
      const m = src.match(re);
      if (m && parseFloat(m[2]) !== c.avgBlockIntervalSeconds) {
        src = src.replace(re, `$1${c.avgBlockIntervalSeconds}`);
        changes++;
      }
    }
    // Replace blockProductionStress
    {
      const re = new RegExp(`("${date}": \\{[^}]*?blockProductionStress:\\s*)([0-9.eE+-]+)`);
      const m = src.match(re);
      if (m && parseFloat(m[2]) !== c.blockProductionStress) {
        src = src.replace(re, `$1${c.blockProductionStress}`);
        changes++;
      }
    }
  }

  process.stderr.write(`\n${changes} field replacements made\n`);

  if (DRY) {
    process.stderr.write("--dry: not writing\n");
    return;
  }
  writeFileSync(FILE, src, "utf8");
  process.stderr.write(`wrote ${FILE}\n`);
  process.stderr.write(`\nNEXT: set maxHashrate in src/App.tsx to ${athEh.toFixed(1)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
