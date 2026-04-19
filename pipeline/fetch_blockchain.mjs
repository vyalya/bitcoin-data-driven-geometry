#!/usr/bin/env node
/**
 * Fetches blockchain.com Charts API data for all curated dates and upserts
 * into the blockchain_raw DuckDB table.
 *
 * Charts used (all free, no auth):
 *   difficulty                 → difficulty
 *   mempool-count              → mempool_tx_count
 *   mempool-size               → mempool_size_mb
 *   estimated-transaction-volume → btc_transferred
 *
 * The API returns full chart history; we filter to our curated dates.
 * Granularity: daily (timespan=all).
 */
import Database from "duckdb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dir, "config.json"), "utf8"));
const DATE_SET = new Set(config.snapshots.map((s) => s.date));

const CHARTS = {
  difficulty:                    "difficulty",
  "mempool-count":               "mempool_tx_count",
  "mempool-size":                "mempool_size_mb",
  "estimated-transaction-volume": "btc_transferred",
};

async function fetchChart(name) {
  const url = `https://api.blockchain.info/charts/${name}?timespan=all&format=json&sampled=false`;
  console.log(`  GET ${name}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blockchain.com ${name} HTTP ${res.status}`);
  const json = await res.json();
  const out = {};
  for (const point of json.values) {
    const day = new Date(point.x * 1000).toISOString().slice(0, 10);
    if (DATE_SET.has(day)) out[day] = point.y;
  }
  return out;
}

async function main() {
  console.log("Fetching blockchain.com charts…");
  const results = {};
  for (const [chart, field] of Object.entries(CHARTS)) {
    results[field] = await fetchChart(chart);
  }

  const db = new Database.Database(join(__dir, "bitcoin.duckdb"));
  const conn = db.connect();

  conn.run(`
    CREATE TABLE IF NOT EXISTS blockchain_raw (
      date              DATE PRIMARY KEY,
      difficulty        DOUBLE,
      mempool_tx_count  INTEGER,
      mempool_size_mb   DOUBLE,
      btc_transferred   DOUBLE
    )
  `);

  const stmt = conn.prepare(`
    INSERT OR REPLACE INTO blockchain_raw
      (date, difficulty, mempool_tx_count, mempool_size_mb, btc_transferred)
    VALUES (?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const date of DATE_SET) {
    const diff   = results.difficulty?.[date] ?? null;
    const mcount = results.mempool_tx_count?.[date] ?? null;
    const msize  = results.mempool_size_mb?.[date] ?? null;
    const btc    = results.btc_transferred?.[date] ?? null;
    if (diff != null || mcount != null || msize != null || btc != null) {
      stmt.run(date, diff, mcount ? Math.round(mcount) : null, msize, btc);
      count++;
    }
  }

  stmt.finalize();
  conn.close();
  db.close();
  console.log(`Upserted ${count} rows into blockchain_raw.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
