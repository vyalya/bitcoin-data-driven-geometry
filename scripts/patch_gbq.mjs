#!/usr/bin/env node
/**
 * Patch the GBQ table in mosaicSnapshots.ts with corrected on-chain values
 * pulled from blockchain.com's public charts API. Fields updated:
 *
 *   - activeAddresses     (n-unique-addresses)
 *   - btcTransferred      (estimated-transaction-volume — economic transfer
 *                          estimate, excludes change outputs)
 *   - totalFeesBtc        (transaction-fees)
 *   - mempoolTxCount      (mempool-count)
 *   - mempoolSizeMb       (mempool-size, converted from bytes)
 *
 * Fields left untouched (BigQuery-only, no public chart equivalent):
 *   - uniqueSenders, uniqueReceivers, totalOutputs, whaleOutputs1000,
 *     whaleOutputs100, midOutputs10, retailOutputs
 *
 * Usage: node scripts/patch_gbq.mjs [--dry]
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
  return best && bestDiff < 4 * 86400 ? best.y : null;
}

function patchField(src, date, field, newVal, isFloat = false) {
  if (newVal == null) return { src, changed: false };
  const re = new RegExp(`("${date}":\\s*\\{[^}]*?${field}:\\s*)([0-9.eE+-]+)`);
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const oldVal = parseFloat(m[2]);
  const formatted = isFloat ? newVal.toFixed(3) : Math.round(newVal).toString();
  if (oldVal === parseFloat(formatted)) return { src, changed: false };
  return { src: src.replace(re, `$1${formatted}`), changed: true };
}

async function main() {
  const [
    nUniqueAddrs,
    txVolume,
    txFees,
    mempoolCount,
    mempoolBytes,
  ] = await Promise.all([
    fetchChart("n-unique-addresses"),
    fetchChart("estimated-transaction-volume"),
    fetchChart("transaction-fees"),
    fetchChart("mempool-count"),
    fetchChart("mempool-size"),
  ]);

  // Compute true ATH for btcTransferred so the ring-fill normaliser is right.
  const allTxVolumes = txVolume.map((p) => p.y);
  const txVolumeAth = Math.max(...allTxVolumes);
  process.stderr.write(`btcTransferred ATH per blockchain.com: ${Math.round(txVolumeAth).toLocaleString()} BTC/day\n`);

  let src = readFileSync(FILE, "utf8");
  let changes = 0;

  for (const date of SNAPSHOT_DATES) {
    const addrs = nearestValue(nUniqueAddrs, date);
    const vol = nearestValue(txVolume, date);
    const fees = nearestValue(txFees, date);
    const mpCount = nearestValue(mempoolCount, date);
    const mpBytes = nearestValue(mempoolBytes, date);
    const mpMb = mpBytes != null ? mpBytes / (1024 * 1024) : null;

    let r;
    r = patchField(src, date, "activeAddresses", addrs); src = r.src; if (r.changed) changes++;
    r = patchField(src, date, "btcTransferred", vol); src = r.src; if (r.changed) changes++;
    r = patchField(src, date, "totalFeesBtc", fees, true); src = r.src; if (r.changed) changes++;
    r = patchField(src, date, "mempoolTxCount", mpCount); src = r.src; if (r.changed) changes++;
    r = patchField(src, date, "mempoolSizeMb", mpMb, true); src = r.src; if (r.changed) changes++;
  }

  process.stderr.write(`\n${changes} field replacements made\n`);

  if (DRY) {
    process.stderr.write("--dry: not writing\n");
    return;
  }
  writeFileSync(FILE, src, "utf8");
  process.stderr.write(`wrote ${FILE}\n`);
  process.stderr.write(`\nNEXT: bump maxBtcVolume in src/App.tsx to ${Math.round(txVolumeAth)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
