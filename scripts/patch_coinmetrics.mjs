#!/usr/bin/env node
/**
 * Definitive patcher: rebuilds the MOSAIC and GBQ tables using a hybrid
 * source-of-truth model with CoinMetrics as the primary on-chain authority.
 *
 * Source matrix:
 *   activeAddresses          → CoinMetrics AdrActCnt
 *   totalFeesBtc             → CoinMetrics FeeTotNtv
 *   networkHashrateEh        → CoinMetrics HashRate (already in EH/s)
 *   avgBlockIntervalSeconds  → derived from CoinMetrics BlkCnt
 *   blockProductionStress    → derived from interval (relative to 600s)
 *   difficulty               → blockchain.com /charts/difficulty
 *                              (CoinMetrics DiffMean is gated)
 *   btcTransferred           → original Mosaic values from git history
 *                              (matches Glassnode Transfer Volume; CoinMetrics
 *                               community doesn't expose TxTfrValAdj*)
 *   mempoolTxCount           → blockchain.com /charts/mempool-count
 *   mempoolSizeMb            → blockchain.com /charts/mempool-size
 *
 * Usage: node scripts/patch_coinmetrics.mjs [--dry]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

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

const CM_BASE = "https://community-api.coinmetrics.io/v4";
const BC_BASE = "https://api.blockchain.info/charts";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function fetchCoinMetrics(dates) {
  // Fetch a wide window once and slice — single API call.
  const start = dates[0];
  const end = dates[dates.length - 1];
  process.stderr.write(`fetching CoinMetrics ${start} → ${end}...\n`);
  const url = `${CM_BASE}/timeseries/asset-metrics?assets=btc&metrics=AdrActCnt,FeeTotNtv,HashRate,BlkCnt,TxCnt&start_time=${start}&end_time=${end}&page_size=10000`;
  const json = await fetchJson(url);
  // Index by ISO date
  const byDate = new Map();
  for (const row of json.data) {
    const dateKey = row.time.slice(0, 10);
    byDate.set(dateKey, row);
  }
  return byDate;
}

async function fetchBlockchainChart(name) {
  process.stderr.write(`fetching blockchain.com/${name}...\n`);
  const url = `${BC_BASE}/${name}?timespan=all&format=json&sampled=false&cors=true`;
  const json = await fetchJson(url);
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
  return best && bestDiff < 4 * 86400 ? best.y : null;
}

function stressFromInterval(intervalSec) {
  const ratio = intervalSec / 600;
  if (ratio < 0.7) return Math.max(0.5, 0.5 + ratio * 0.6);
  if (ratio <= 1.2) return 0.7 + (ratio - 0.7) * 0.4;
  if (ratio <= 1.5) return 0.9 + (ratio - 1.2) * 1.5;
  if (ratio <= 2.5) return 1.35 + (ratio - 1.5) * 1.0;
  return Math.min(2.35 + (ratio - 2.5) * 0.6, 4);
}

// Pull the original Mosaic btcTransferred values from git history (commit
// 8dc4ad6, the last "100% Mosaic-sourced" version before any of our patches).
function getOriginalMosaicBtcTransferred() {
  const cmd = `git -C "${resolve(__dirname, "..")}" show 8dc4ad6:src/data/mosaicSnapshots.ts`;
  const src = execSync(cmd, { encoding: "utf8" });
  const map = new Map();
  for (const date of SNAPSHOT_DATES) {
    const re = new RegExp(`"${date}":\\s*\\{[^}]*?btcTransferred:\\s*([0-9.eE+-]+)`);
    const m = src.match(re);
    if (m) map.set(date, parseFloat(m[1]));
  }
  return map;
}

function patchField(src, date, field, newVal, isFloat = false) {
  if (newVal == null) return { src, changed: false };
  const re = new RegExp(`("${date}":\\s*\\{[^}]*?${field}:\\s*)([0-9.eE+-]+)`);
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const oldVal = parseFloat(m[2]);
  const formatted = isFloat ? Number(newVal.toFixed(3)).toString() : Math.round(newVal).toString();
  if (oldVal === parseFloat(formatted)) return { src, changed: false };
  return { src: src.replace(re, `$1${formatted}`), changed: true };
}

async function main() {
  const cm = await fetchCoinMetrics(SNAPSHOT_DATES);
  const [difficultySeries, mempoolCountSeries, mempoolSizeSeries] = await Promise.all([
    fetchBlockchainChart("difficulty"),
    fetchBlockchainChart("mempool-count"),
    fetchBlockchainChart("mempool-size"),
  ]);
  const originalBtcTransferred = getOriginalMosaicBtcTransferred();

  // Compute hashrate ATH from CoinMetrics for the normaliser. CoinMetrics
  // returns hashrate in TH/s like blockchain.com, divide by 1e6 for EH/s.
  let hashrateAthEh = 0;
  for (const row of cm.values()) {
    if (row.HashRate) {
      const eh = parseFloat(row.HashRate) / 1e6;
      if (eh > hashrateAthEh) hashrateAthEh = eh;
    }
  }
  // We need the all-time hashrate ATH, not just within our 25 dates. Fetch
  // the full timeseries with monthly frequency to find the global max.
  const fullHashrateUrl = `${CM_BASE}/timeseries/asset-metrics?assets=btc&metrics=HashRate&start_time=2024-01-01&end_time=2026-01-01&page_size=10000`;
  try {
    const full = await fetchJson(fullHashrateUrl);
    for (const row of full.data) {
      if (row.HashRate) {
        const eh = parseFloat(row.HashRate) / 1e6;
        if (eh > hashrateAthEh) hashrateAthEh = eh;
      }
    }
  } catch {
    /* ignore */
  }
  process.stderr.write(`\nhashrate ATH (CoinMetrics): ${hashrateAthEh.toFixed(2)} EH/s\n`);

  // Find max btcTransferred across our 25 snapshots for the BTC volume
  // normaliser. Using original Mosaic raw transfer values (matches Glassnode).
  let maxBtcTransferred = 0;
  for (const v of originalBtcTransferred.values()) {
    if (v > maxBtcTransferred) maxBtcTransferred = v;
  }
  process.stderr.write(`btcTransferred max across 25 snapshots: ${maxBtcTransferred.toLocaleString()}\n\n`);

  let src = readFileSync(FILE, "utf8");
  let changes = 0;

  for (const date of SNAPSHOT_DATES) {
    const cmRow = cm.get(date);
    let r;

    // activeAddresses ← CoinMetrics
    if (cmRow?.AdrActCnt) {
      r = patchField(src, date, "activeAddresses", parseFloat(cmRow.AdrActCnt));
      src = r.src; if (r.changed) changes++;
    }

    // totalFeesBtc ← CoinMetrics
    if (cmRow?.FeeTotNtv) {
      r = patchField(src, date, "totalFeesBtc", parseFloat(cmRow.FeeTotNtv), true);
      src = r.src; if (r.changed) changes++;
    }

    // networkHashrateEh ← CoinMetrics (TH/s ÷ 1e6)
    if (cmRow?.HashRate) {
      const eh = parseFloat(cmRow.HashRate) / 1e6;
      r = patchField(src, date, "networkHashrateEh", eh, true);
      src = r.src; if (r.changed) changes++;
    }

    // avgBlockIntervalSeconds ← derived from CoinMetrics BlkCnt
    let intervalSec = null;
    if (cmRow?.BlkCnt) {
      const blocks = parseInt(cmRow.BlkCnt, 10);
      if (blocks > 0) {
        intervalSec = 86400 / blocks;
        r = patchField(src, date, "avgBlockIntervalSeconds", intervalSec, true);
        src = r.src; if (r.changed) changes++;
      }
    }

    // blockProductionStress ← derived from interval
    if (intervalSec != null) {
      const stress = stressFromInterval(intervalSec);
      r = patchField(src, date, "blockProductionStress", stress, true);
      src = r.src; if (r.changed) changes++;
    }

    // difficulty ← blockchain.com (CoinMetrics gated)
    const diff = nearestValue(difficultySeries, date);
    if (diff != null) {
      r = patchField(src, date, "difficulty", diff, true);
      src = r.src; if (r.changed) changes++;
    }

    // btcTransferred ← restored from original Mosaic git history
    const origVol = originalBtcTransferred.get(date);
    if (origVol != null) {
      r = patchField(src, date, "btcTransferred", origVol);
      src = r.src; if (r.changed) changes++;
    }

    // mempoolTxCount ← blockchain.com
    const mpCount = nearestValue(mempoolCountSeries, date);
    if (mpCount != null) {
      r = patchField(src, date, "mempoolTxCount", mpCount);
      src = r.src; if (r.changed) changes++;
    }

    // mempoolSizeMb ← blockchain.com (bytes → MB)
    const mpBytes = nearestValue(mempoolSizeSeries, date);
    if (mpBytes != null) {
      r = patchField(src, date, "mempoolSizeMb", mpBytes / (1024 * 1024), true);
      src = r.src; if (r.changed) changes++;
    }
  }

  process.stderr.write(`\n${changes} field replacements made\n`);

  if (DRY) {
    process.stderr.write("--dry: not writing\n");
    return;
  }
  writeFileSync(FILE, src, "utf8");
  process.stderr.write(`wrote ${FILE}\n`);
  process.stderr.write(`\nNEXT in src/App.tsx:\n`);
  process.stderr.write(`  - maxHashrate  → ${hashrateAthEh.toFixed(1)} EH/s\n`);
  process.stderr.write(`  - maxBtcVolume → ${Math.round(maxBtcTransferred / 100000) * 100000}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
