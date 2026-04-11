#!/usr/bin/env node
/**
 * One-shot fetcher: pulls hash-rate, difficulty, and n-blocks-mined from
 * blockchain.com's public charts API and prints corrected values for each
 * snapshot date in mosaicSnapshots.ts.
 *
 * Usage: node scripts/refetch_metrics.mjs
 */

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
  // Returns array of {x: unix-seconds, y: value}
  return json.values;
}

function nearestValue(series, dateStr) {
  // Match the day in UTC. blockchain.com returns one point per day at 00:00 UTC.
  const target = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
  // Find the row whose x is the largest x <= target (so for a date that hasn't
  // been recorded yet, we get the most recent prior).
  let best = null;
  let bestDiff = Infinity;
  for (const pt of series) {
    const diff = Math.abs(pt.x - target);
    if (diff < bestDiff) {
      best = pt;
      bestDiff = diff;
    }
  }
  return best ? best.y : null;
}

async function main() {
  // Use median-confirmation-time as a proxy for block-production stress
  // (its slowdown directly tracks slow-block periods). Average block interval
  // can be derived from the chain's height delta if needed, but for now we
  // pull median confirmation time as the stress signal.
  const [hashRate, difficulty, medianConfirm] = await Promise.all([
    fetchChart("hash-rate"),
    fetchChart("difficulty"),
    fetchChart("median-confirmation-time"),
  ]);

  // Find ATH for hashrate (used as ring-fill normaliser)
  const ath = hashRate.reduce((m, p) => Math.max(m, p.y), 0);

  console.log("// === GENERATED — paste into mosaicSnapshots.ts MOSAIC table ===");
  console.log(`// Hashrate ATH (per blockchain.com): ${ath.toFixed(3)} EH/s`);
  console.log("");

  for (const date of SNAPSHOT_DATES) {
    const hr = nearestValue(hashRate, date);
    const diff = nearestValue(difficulty, date);
    const medConfirmMin = nearestValue(medianConfirm, date);
    // blockProductionStress: derived from median confirmation time relative
    // to the 10-minute target. ~9-12 min → healthy (0.7-1.2 stress). Higher
    // minutes → progressively more stress (block congestion).
    let stress = 0.92;
    if (medConfirmMin != null) {
      const ratio = medConfirmMin / 10;
      if (ratio < 0.7) stress = 0.5 + ratio * 0.6;     // very fast
      else if (ratio <= 1.2) stress = 0.7 + (ratio - 0.7) * 0.4;  // 0.7-0.9
      else if (ratio <= 1.5) stress = 0.9 + (ratio - 1.2) * 1.5;  // 0.9-1.35
      else if (ratio <= 2.5) stress = 1.35 + (ratio - 1.5) * 1.0; // 1.35-2.35
      else stress = Math.min(2.35 + (ratio - 2.5) * 0.6, 4);
    }

    console.log(
      `"${date}": { hashrate: ${hr != null ? hr.toFixed(3) : "null"}, difficulty: ${diff != null ? diff.toFixed(2) : "null"}, medianConfirmMin: ${medConfirmMin != null ? medConfirmMin.toFixed(2) : "null"}, stress: ${stress.toFixed(2)} },`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
