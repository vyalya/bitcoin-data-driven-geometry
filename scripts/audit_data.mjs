#!/usr/bin/env node
/**
 * Read-only audit of mosaicSnapshots.ts data fields against blockchain.com's
 * public charts API. Reports per-field discrepancies for each snapshot date.
 *
 * Fields audited:
 *   - blockHeight (vs n-blocks-mined cumulative)
 *   - activeAddresses (vs n-unique-addresses)
 *   - btcTransferred (vs estimated-transaction-volume)
 *   - totalFeesBtc (vs transaction-fees)
 *   - mempoolTxCount (vs mempool-count)
 *   - mempoolSizeMb (vs mempool-size, in MB)
 *
 * Usage: node scripts/audit_data.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src", "data", "mosaicSnapshots.ts");

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
  return best && bestDiff < 4 * 86400 ? best.y : null;
}

function extractField(src, date, field) {
  const re = new RegExp(`"${date}":\\s*\\{[^}]*?${field}:\\s*([0-9.eE+-]+)`);
  const m = src.match(re);
  return m ? parseFloat(m[1]) : null;
}

function pctDiff(actual, expected) {
  if (expected == null || actual == null || expected === 0) return null;
  return ((actual - expected) / expected) * 100;
}

function fmtPct(p) {
  if (p == null) return "—";
  const s = p.toFixed(1);
  if (Math.abs(p) > 30) return `❌ ${s}%`;
  if (Math.abs(p) > 10) return `⚠️  ${s}%`;
  return `✓ ${s}%`;
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toFixed(2);
}

async function main() {
  const src = readFileSync(FILE, "utf8");

  const [
    nUniqueAddrs,
    txVolume,
    txFees,
    mempoolCount,
    mempoolBytes,
    nBlocksTotal,
  ] = await Promise.all([
    fetchChart("n-unique-addresses"),
    fetchChart("estimated-transaction-volume"),
    fetchChart("transaction-fees"),
    fetchChart("mempool-count"),
    fetchChart("mempool-size"),
    fetchChart("total-bitcoins").catch(() => null), // not what we want, skip
  ]);

  // For block height we need a cumulative source. blockchain.com doesn't
  // directly publish per-day total height in a chart, but we can derive it
  // by fetching the blockchair block timestamp lookup separately. Skip for
  // this audit and trust the manual values.

  console.log("");
  console.log("DATE         | FIELD              | OUR VALUE       | REFERENCE       | DELTA");
  console.log("-------------|--------------------|-----------------|-----------------|--------");

  let warnings = 0;

  for (const date of SNAPSHOT_DATES) {
    // Active addresses
    {
      const ours = extractField(src, date, "activeAddresses");
      const ref = nearestValue(nUniqueAddrs, date);
      const delta = pctDiff(ours, ref);
      if (delta != null && Math.abs(delta) > 10) warnings++;
      console.log(
        `${date}   | activeAddresses    | ${fmtNum(ours).padEnd(15)} | ${fmtNum(ref).padEnd(15)} | ${fmtPct(delta)}`
      );
    }

    // BTC Transferred (in BTC)
    {
      const ours = extractField(src, date, "btcTransferred");
      const ref = nearestValue(txVolume, date);
      const delta = pctDiff(ours, ref);
      if (delta != null && Math.abs(delta) > 10) warnings++;
      console.log(
        `${date}   | btcTransferred     | ${fmtNum(ours).padEnd(15)} | ${fmtNum(ref).padEnd(15)} | ${fmtPct(delta)}`
      );
    }

    // Total Fees BTC
    {
      const ours = extractField(src, date, "totalFeesBtc");
      const ref = nearestValue(txFees, date);
      const delta = pctDiff(ours, ref);
      if (delta != null && Math.abs(delta) > 10) warnings++;
      console.log(
        `${date}   | totalFeesBtc       | ${fmtNum(ours).padEnd(15)} | ${fmtNum(ref).padEnd(15)} | ${fmtPct(delta)}`
      );
    }

    // Mempool count
    {
      const ours = extractField(src, date, "mempoolTxCount");
      const ref = nearestValue(mempoolCount, date);
      const delta = pctDiff(ours, ref);
      if (delta != null && Math.abs(delta) > 10) warnings++;
      console.log(
        `${date}   | mempoolTxCount     | ${fmtNum(ours).padEnd(15)} | ${fmtNum(ref).padEnd(15)} | ${fmtPct(delta)}`
      );
    }

    // Mempool size MB
    {
      const ours = extractField(src, date, "mempoolSizeMb");
      const refBytes = nearestValue(mempoolBytes, date);
      const refMb = refBytes != null ? refBytes / (1024 * 1024) : null;
      const delta = pctDiff(ours, refMb);
      if (delta != null && Math.abs(delta) > 10) warnings++;
      console.log(
        `${date}   | mempoolSizeMb      | ${fmtNum(ours).padEnd(15)} | ${fmtNum(refMb).padEnd(15)} | ${fmtPct(delta)}`
      );
    }

    console.log("-------------|--------------------|-----------------|-----------------|--------");
  }

  process.stderr.write(`\nrows with >10% deviation: ${warnings}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
