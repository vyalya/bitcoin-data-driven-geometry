#!/usr/bin/env node
/**
 * Ingests manually-exported BigQuery CSVs into DuckDB.
 *
 * Expected input files (export from BQ console after running the two queries):
 *   pipeline/raw/bq_daily_agg.csv   — daily block aggregates
 *   pipeline/raw/bq_blocks.csv      — per-block spine data
 */
import duckdb from "duckdb";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir   = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "bitcoin.duckdb");
const RAW_DIR = join(__dir, "raw");
const AGG_CSV = join(RAW_DIR, "bq_daily_agg.csv");
const BLK_CSV = join(RAW_DIR, "bq_blocks.csv");

// ─── Promisified helpers ───────────────────────────────────────────────────
const dbExec = (conn, sql) => new Promise((res, rej) =>
  conn.exec(sql, (err) => err ? rej(err) : res()));
const dbAll  = (conn, sql, ...args) => new Promise((res, rej) =>
  conn.all(sql, ...args, (err, rows) => err ? rej(err) : res(rows ?? [])));

function checkFile(path, name) {
  if (!existsSync(path)) {
    console.error(`Missing: ${path}`);
    console.error(`Run the BigQuery query and export as CSV to pipeline/raw/${name}`);
    process.exit(1);
  }
}

async function main() {
  checkFile(AGG_CSV, "bq_daily_agg.csv");
  checkFile(BLK_CSV, "bq_blocks.csv");

  const db   = new duckdb.Database(DB_PATH);
  const conn = db.connect();

  // ─── Daily aggregates ────────────────────────────────────────────────────
  await dbExec(conn, `
    CREATE TABLE IF NOT EXISTS bq_daily_agg (
      date              DATE PRIMARY KEY,
      block_height      INTEGER,
      block_count       INTEGER,
      avg_interval_secs DOUBLE,
      tx_count          INTEGER,
      avg_block_bytes   DOUBLE,
      max_block_bytes   INTEGER
    )
  `);

  await dbExec(conn, `
    INSERT OR REPLACE INTO bq_daily_agg
    SELECT
      TRY_CAST(day AS DATE)                  AS date,
      TRY_CAST(block_height AS INTEGER)      AS block_height,
      TRY_CAST(block_count AS INTEGER)       AS block_count,
      TRY_CAST(avg_interval_secs AS DOUBLE)  AS avg_interval_secs,
      TRY_CAST(tx_count AS INTEGER)          AS tx_count,
      TRY_CAST(avg_block_bytes AS DOUBLE)    AS avg_block_bytes,
      TRY_CAST(max_block_bytes AS INTEGER)   AS max_block_bytes
    FROM read_csv_auto('${AGG_CSV.replace(/\\/g, "/")}', header=true, ignore_errors=true)
    WHERE day IS NOT NULL
  `);

  const [{ n: aggCount }] = await dbAll(conn, "SELECT COUNT(*) AS n FROM bq_daily_agg");
  console.log(`Upserted ${aggCount} rows into bq_daily_agg.`);

  // ─── Per-block spine ─────────────────────────────────────────────────────
  await dbExec(conn, `
    CREATE TABLE IF NOT EXISTS bq_blocks (
      block_height INTEGER PRIMARY KEY,
      date         DATE,
      size_bytes   INTEGER,
      weight       INTEGER,
      tx_count     INTEGER
    )
  `);

  await dbExec(conn, `
    INSERT OR REPLACE INTO bq_blocks
    SELECT
      TRY_CAST(block_height AS INTEGER) AS block_height,
      TRY_CAST(day AS DATE)             AS date,
      TRY_CAST(size_bytes AS INTEGER)   AS size_bytes,
      TRY_CAST(weight AS INTEGER)       AS weight,
      TRY_CAST(tx_count AS INTEGER)     AS tx_count
    FROM read_csv_auto('${BLK_CSV.replace(/\\/g, "/")}', header=true, ignore_errors=true)
    WHERE block_height IS NOT NULL
  `);

  const [{ n: blkCount }] = await dbAll(conn, "SELECT COUNT(*) AS n FROM bq_blocks");
  console.log(`Upserted ${blkCount} rows into bq_blocks.`);

  conn.close();
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
