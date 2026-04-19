#!/usr/bin/env node
/**
 * Exports snapshots and blocks from bitcoin.duckdb to Parquet files
 * that the frontend reads via DuckDB-WASM.
 *
 * Output:
 *   public/data/snapshots.parquet   — all snapshot rows (~30-60 KB)
 *   public/data/blocks.parquet      — per-block spine data (~500 KB-1 MB)
 *
 * Parquet is ~3-5x smaller than JSON and supports HTTP range requests,
 * which lets DuckDB-WASM fetch only the columns it needs.
 */
import Database from "duckdb";
import { mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir   = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "bitcoin.duckdb");
const OUT_DIR = join(__dir, "..", "public", "data");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const dbExec = (conn, sql) => new Promise((res, rej) =>
  conn.exec(sql, (err) => err ? rej(err) : res()));
const dbAll = (conn, sql, ...args) => new Promise((res, rej) =>
  conn.all(sql, ...args, (err, rows) => err ? rej(err) : res(rows ?? [])));

async function main() {
  const db   = new Database.Database(DB_PATH);
  const conn = db.connect();

  const [{ n: snapCount }] = await dbAll(conn, "SELECT COUNT(*) AS n FROM snapshots");
  const [{ n: blkCount  }] = await dbAll(conn, "SELECT COUNT(*) AS n FROM bq_blocks");

  console.log(`Exporting ${snapCount} snapshots and ${blkCount} block rows to Parquet…`);

  const snapOut = join(OUT_DIR, "snapshots.parquet").replace(/\\/g, "/");
  await dbExec(conn, `
    COPY (
      SELECT * FROM snapshots ORDER BY date
    ) TO '${snapOut}' (FORMAT PARQUET, COMPRESSION ZSTD)
  `);

  if (blkCount > 0) {
    const blkOut = join(OUT_DIR, "blocks.parquet").replace(/\\/g, "/");
    await dbExec(conn, `
      COPY (
        SELECT block_height, date, size_bytes, weight, tx_count
        FROM bq_blocks
        ORDER BY block_height
      ) TO '${blkOut}' (FORMAT PARQUET, COMPRESSION ZSTD)
    `);
  }

  conn.close();
  db.close();

  console.log(`Written to ${OUT_DIR}/`);
  console.log("  snapshots.parquet");
  if (blkCount > 0) console.log("  blocks.parquet");
}

main().catch((e) => { console.error(e); process.exit(1); });
