#!/usr/bin/env node
/**
 * Fetches CoinMetrics community-tier asset metrics for all curated dates
 * and upserts them into the coinmetrics_raw DuckDB table.
 *
 * Community API: no auth required.
 * Metrics: AdrActCnt, TxCnt, FeeTotNtv, HashRate, BlkCnt
 *
 * HashRate is in TH/s — divide by 1e6 for EH/s.
 * FeeTotNtv is in native BTC.
 * Dates outside CoinMetrics coverage (pre-2010) may return 0/null.
 */
import Database from "duckdb";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dir, "config.json"), "utf8"));

const DATES = config.snapshots.map((s) => s.date).sort();
const START = DATES[0];
const END   = DATES[DATES.length - 1];

const METRICS = ["AdrActCnt", "TxCnt", "FeeTotNtv", "HashRate", "BlkCnt"].join(",");
const URL = `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics`
          + `?assets=btc&metrics=${METRICS}`
          + `&start_time=${START}&end_time=${END}`
          + `&page_size=10000`;

async function main() {
  console.log("Fetching CoinMetrics community data…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`CoinMetrics HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();

  const dateSet = new Set(DATES);
  const rows = json.data.filter((r) => dateSet.has(r.time.slice(0, 10)));

  const db = new Database.Database(join(__dir, "bitcoin.duckdb"));
  const conn = db.connect();

  conn.run(`
    CREATE TABLE IF NOT EXISTS coinmetrics_raw (
      date            DATE PRIMARY KEY,
      active_addresses INTEGER,
      tx_count        INTEGER,
      total_fees_btc  DOUBLE,
      hashrate_th     DOUBLE,
      blk_count       INTEGER
    )
  `);

  const stmt = conn.prepare(`
    INSERT OR REPLACE INTO coinmetrics_raw
      (date, active_addresses, tx_count, total_fees_btc, hashrate_th, blk_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const r of rows) {
    stmt.run(
      r.time.slice(0, 10),
      r.AdrActCnt  != null ? parseInt(r.AdrActCnt, 10)  : null,
      r.TxCnt      != null ? parseInt(r.TxCnt, 10)      : null,
      r.FeeTotNtv  != null ? parseFloat(r.FeeTotNtv)    : null,
      r.HashRate   != null ? parseFloat(r.HashRate)     : null,
      r.BlkCnt     != null ? parseInt(r.BlkCnt, 10)     : null
    );
  }

  stmt.finalize();
  conn.close();
  db.close();
  console.log(`Upserted ${rows.length} rows into coinmetrics_raw.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
