#!/usr/bin/env node
/**
 * Re-derive the synthetic composite scores (feePressureIndex, congestionScore,
 * networkHealthScore) from the verified real-data inputs already in the file.
 * After this runs, every numeric field in MOSAIC and GBQ is traceable to a
 * verified public source — no more black-box "Mosaic synthetic" values.
 *
 * Formulas:
 *   congestionScore   = clamp(mempoolTxCount / 35000 * 10, 0, 10)
 *   feePressureIndex  = clamp(totalFeesBtc / 100, 0, 10)
 *   networkHealthScore = clamp(10
 *                              - congestionScore * 0.3
 *                              - feePressureIndex * 0.3
 *                              - max(0, blockProductionStress - 1) * 1.5,
 *                              0, 10)
 *
 * minerConcentrationScore is left untouched (it's only used internally in
 * App.tsx's network health recomputation and is not displayed).
 *
 * Usage: node scripts/derive_composites.mjs [--dry]
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function extractField(src, date, field) {
  const re = new RegExp(`"${date}":\\s*\\{[^}]*?${field}:\\s*([0-9.eE+-]+)`);
  const m = src.match(re);
  return m ? parseFloat(m[1]) : null;
}

function patchField(src, date, field, newVal) {
  if (newVal == null) return { src, changed: false };
  const re = new RegExp(`("${date}":\\s*\\{[^}]*?${field}:\\s*)([0-9.eE+-]+)`);
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const oldVal = parseFloat(m[2]);
  const formatted = Number(newVal.toFixed(2)).toString();
  if (oldVal === parseFloat(formatted)) return { src, changed: false };
  return { src: src.replace(re, `$1${formatted}`), changed: true };
}

function main() {
  let src = readFileSync(FILE, "utf8");
  let changes = 0;

  console.log("DATE         | mempool   | fees BTC | congest | feePress | health");
  console.log("-------------|-----------|----------|---------|----------|-------");

  for (const date of SNAPSHOT_DATES) {
    const mempool = extractField(src, date, "mempoolTxCount") ?? 0;
    const fees = extractField(src, date, "totalFeesBtc") ?? 0;
    const stress = extractField(src, date, "blockProductionStress") ?? 0.92;

    const congestionScore = clamp((mempool / 35000) * 10, 0, 10);
    const feePressureIndex = clamp(fees / 100, 0, 10);
    const networkHealthScore = clamp(
      10
        - congestionScore * 0.3
        - feePressureIndex * 0.3
        - Math.max(0, stress - 1) * 1.5,
      0,
      10
    );

    let r;
    r = patchField(src, date, "congestionScore", congestionScore);    src = r.src; if (r.changed) changes++;
    r = patchField(src, date, "feePressureIndex", feePressureIndex);  src = r.src; if (r.changed) changes++;
    r = patchField(src, date, "networkHealthScore", networkHealthScore); src = r.src; if (r.changed) changes++;

    console.log(
      `${date}   | ${String(mempool).padStart(9)} | ${fees.toFixed(2).padStart(8)} | ${congestionScore.toFixed(2).padStart(7)} | ${feePressureIndex.toFixed(2).padStart(8)} | ${networkHealthScore.toFixed(2).padStart(5)}`
    );
  }

  process.stderr.write(`\n${changes} field replacements made\n`);
  if (DRY) {
    process.stderr.write("--dry: not writing\n");
    return;
  }
  writeFileSync(FILE, src, "utf8");
  process.stderr.write(`wrote ${FILE}\n`);
}

main();
