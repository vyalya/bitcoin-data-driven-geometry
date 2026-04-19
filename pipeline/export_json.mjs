#!/usr/bin/env node
/**
 * Exports snapshots and blocks from bitcoin.duckdb to JSON files that the
 * frontend reads via plain fetch() — no runtime database, no WASM.
 *
 * Output:
 *   public/data/snapshots.json   — all snapshot rows as an array
 *   public/data/blocks.json      — { "YYYY-MM-DD": [[height, size, weight, txCount], …] }
 *
 * For ~200 KB of total data read once per visit, plain JSON is the right
 * transport: no worker, no blob URL, no CSP edge cases. Gzipped over the
 * wire by Cloudflare, it ends up ~50 KB on the network.
 */
import Database from "duckdb";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir   = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "bitcoin.duckdb");
const OUT_DIR = join(__dir, "..", "public", "data");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const dbAll = (conn, sql, ...args) => new Promise((res, rej) =>
  conn.all(sql, ...args, (err, rows) => err ? rej(err) : res(rows ?? [])));

const toISODate = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

const toNum = (v) => {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  return Number(v);
};

async function main() {
  const db   = new Database.Database(DB_PATH);
  const conn = db.connect();

  // ─── snapshots.json ──────────────────────────────────────────────────────
  const snapRows = await dbAll(conn, "SELECT * FROM snapshots ORDER BY date");
  const snapshots = snapRows.map((row) => ({
    id:                      String(row.id),
    label:                   String(row.label),
    date:                    toISODate(row.date),
    narration:               row.narration != null ? String(row.narration) : null,
    notes:                   typeof row.notes === "string" ? JSON.parse(row.notes || "[]") : (row.notes ?? []),
    blockHeight:             toNum(row.block_height),
    avgBlockIntervalSeconds: toNum(row.avg_block_interval_secs),
    networkHashrateEh:       toNum(row.network_hashrate_eh),
    mempoolTxCount:          toNum(row.mempool_tx_count),
    mempoolSizeMb:           toNum(row.mempool_size_mb),
    feePressureIndex:        toNum(row.fee_pressure_index),
    congestionScore:         toNum(row.congestion_score),
    blockProductionStress:   toNum(row.block_production_stress),
    minerConcentrationScore: row.miner_concentration_score != null ? toNum(row.miner_concentration_score) : null,
    networkHealthScore:      toNum(row.network_health_score),
    difficulty:              toNum(row.difficulty),
    activeAddresses:         toNum(row.active_addresses),
    btcTransferred:          toNum(row.btc_transferred),
    totalFeesBtc:            toNum(row.total_fees_btc),
    totalOutputs:            toNum(row.total_outputs),
    whaleOutputs1000:        toNum(row.whale_outputs_1000),
    whaleOutputs100:         toNum(row.whale_outputs_100),
    midOutputs10:            toNum(row.mid_outputs_10),
    retailOutputs:           toNum(row.retail_outputs),
  }));
  writeFileSync(join(OUT_DIR, "snapshots.json"), JSON.stringify(snapshots));
  console.log(`Wrote ${snapshots.length} snapshots → snapshots.json`);

  // ─── blocks.json (indexed by date) ───────────────────────────────────────
  const blockRows = await dbAll(conn,
    "SELECT block_height, date, size_bytes, weight, tx_count FROM bq_blocks ORDER BY date, block_height"
  );
  const blocksByDate = {};
  for (const r of blockRows) {
    const date = toISODate(r.date);
    (blocksByDate[date] ||= []).push([
      toNum(r.block_height),
      toNum(r.size_bytes),
      toNum(r.weight),
      toNum(r.tx_count),
    ]);
  }
  writeFileSync(join(OUT_DIR, "blocks.json"), JSON.stringify(blocksByDate));
  console.log(`Wrote ${blockRows.length} blocks across ${Object.keys(blocksByDate).length} dates → blocks.json`);

  conn.close();
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
