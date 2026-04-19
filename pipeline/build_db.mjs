#!/usr/bin/env node
/**
 * Pipeline orchestrator: builds bitcoin.duckdb from all raw sources and
 * populates the derived `snapshots` table.
 *
 * Run order:
 *   1. node pipeline/fetch_coinmetrics.mjs
 *   2. node pipeline/fetch_blockchain.mjs
 *   3. node pipeline/fetch_mempool.mjs
 *   4. node pipeline/ingest_bigquery.mjs   (requires pipeline/raw/bq_*.csv)
 *   5. node pipeline/build_db.mjs          ← this file (derives + merges)
 *   6. node pipeline/export_parquet.mjs
 *
 * Or run everything via: npm run pipeline
 */
import Database from "duckdb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dir, "config.json"), "utf8"));

// ─── Promisified helpers ───────────────────────────────────────────────────────
const dbExec = (conn, sql) => new Promise((res, rej) =>
  conn.exec(sql, (err) => err ? rej(err) : res()));
const dbAll = (conn, sql, ...args) => new Promise((res, rej) =>
  conn.all(sql, ...args, (err, rows) => err ? rej(err) : res(rows ?? [])));

// ─── Derived metric formulas (mirrors the logic from old patch scripts) ────

// Fee pressure = total daily fees normalized to the historical peak. Using
// satPerTx looked reasonable in theory but gets dominated by outliers on
// low-tx days (e.g. Pizza Day: one enormous fee ÷ a few hundred txs pegged
// the metric at max, which misrepresents network-wide fee demand that day).
// Total daily BTC in fees is a direct, honest measure: when the fee market
// is actually competitive, daily totals climb; when it's calm, they don't.
// Peak: 2024-04-20 (~1206 BTC, halving + Runes launch).
function feePressureIndex(totalFeesBtc) {
  if (totalFeesBtc == null || totalFeesBtc <= 0) return 0;
  const PEAK_DAILY_FEES_BTC = 1300;
  return Math.min(10, (totalFeesBtc / PEAK_DAILY_FEES_BTC) * 10);
}

function congestionScore(mempoolTxCount) {
  if (mempoolTxCount == null || mempoolTxCount === 0) return 0;
  // 0 → 0, 10K → 2, 50K → 5, 150K → 8, 300K+ → 10
  if (mempoolTxCount <= 0)      return 0;
  if (mempoolTxCount <= 10000)  return (mempoolTxCount / 10000) * 2;
  if (mempoolTxCount <= 50000)  return 2 + ((mempoolTxCount - 10000) / 40000) * 3;
  if (mempoolTxCount <= 150000) return 5 + ((mempoolTxCount - 50000) / 100000) * 3;
  if (mempoolTxCount <= 300000) return 8 + ((mempoolTxCount - 150000) / 150000) * 2;
  return 10;
}

function stressFromInterval(avgIntervalSecs) {
  if (avgIntervalSecs == null || avgIntervalSecs <= 0) return 1;
  const ratio = avgIntervalSecs / 600;
  if (ratio < 0.5)  return 2.0;
  if (ratio < 0.8)  return 1.5;
  if (ratio < 1.2)  return ratio;
  if (ratio < 1.6)  return 1.2 + (ratio - 1.2) * 0.5;
  return Math.min(3.0, 1.4 + (ratio - 1.6) * 0.4);
}

function networkHealthScore(congScore, feeScore, stress) {
  return Math.max(0, Math.min(10,
    10
    - congScore * 0.3
    - feeScore  * 0.3
    - Math.max(0, stress - 1) * 1.5
  ));
}

function hhiNormalized(hhiRaw) {
  if (hhiRaw == null) return null;
  const MIN_HHI = 0.05;
  const MAX_HHI = 0.35;
  return Math.max(0, Math.min(10, ((hhiRaw - MIN_HHI) / (MAX_HHI - MIN_HHI)) * 10));
}

async function main() {
  const db = new Database.Database(join(__dir, "bitcoin.duckdb"));
  const conn = db.connect();

  // Ensure schema exists
  await dbExec(conn, readFileSync(join(__dir, "schema.sql"), "utf8"));

  console.log("Building derived snapshots table…");

  // ── Pre-fetch all raw rows keyed by date ──────────────────────────────────
  const toDateKey = (v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  };
  const toMap = (rows, field = "date") => {
    const m = {};
    for (const r of rows) m[toDateKey(r[field] ?? r.date)] = r;
    return m;
  };

  const [cmRows, bcRows, mpRows, bqRows] = await Promise.all([
    dbAll(conn, "SELECT * FROM coinmetrics_raw"),
    dbAll(conn, "SELECT * FROM blockchain_raw"),
    dbAll(conn, "SELECT * FROM mempool_raw"),
    dbAll(conn, "SELECT * FROM bq_daily_agg"),
  ]);

  const cmMap = toMap(cmRows);
  const bcMap = toMap(bcRows);
  const mpMap = toMap(mpRows);
  const bqMap = toMap(bqRows);

  // ── Build the INSERT statement once ──────────────────────────────────────
  const insertStmt = conn.prepare(`
    INSERT OR REPLACE INTO snapshots (
      date, id, label,
      block_height, avg_block_interval_secs, network_hashrate_eh,
      mempool_tx_count, mempool_size_mb,
      fee_pressure_index, congestion_score, block_production_stress,
      miner_concentration_score, network_health_score,
      difficulty, active_addresses,
      unique_senders, unique_receivers,
      btc_transferred, total_fees_btc, total_outputs,
      whale_outputs_1000, whale_outputs_100, mid_outputs_10, retail_outputs,
      narration, notes, mode
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      NULL, NULL,
      ?, ?, NULL,
      NULL, NULL, NULL, NULL,
      ?, ?, 'historical'
    )
  `);

  for (const snap of config.snapshots) {
    const { id, date, label, narration, notes } = snap;

    const cm = cmMap[date] ?? {};
    const bc = bcMap[date] ?? {};
    const mp = mpMap[date] ?? {};
    const bq = bqMap[date] ?? {};

    // Block height: BQ
    const blockHeight = bq.block_height ?? null;

    // Avg interval: derive from block_count (avoids contaminated LAG values
    // from non-consecutive curated dates where the first block's LAG reaches
    // back to a previous curated date weeks/months earlier).
    let avgIntervalSecs = null;
    if (bq.block_count > 1) {
      avgIntervalSecs = 86400 / bq.block_count;
    } else if (cm.blk_count > 0) {
      avgIntervalSecs = 86400 / cm.blk_count;
    }

    // Hashrate: CoinMetrics (TH/s ÷ 1e6 = EH/s)
    const networkHashrateEh = cm.hashrate_th != null ? cm.hashrate_th / 1e6 : null;

    // Mempool: blockchain.com
    const mempoolTxCount = bc.mempool_tx_count ?? null;
    const mempoolSizeMb  = bc.mempool_size_mb  ?? null;

    // Fees: CoinMetrics
    const totalFeesBtc = cm.total_fees_btc ?? null;

    // BTC transferred: blockchain.com
    const btcTransferred = bc.btc_transferred ?? null;

    // Difficulty: blockchain.com
    const difficulty = bc.difficulty ?? null;

    // Active addresses: CoinMetrics
    const activeAddresses = cm.active_addresses ?? null;

    // Miner concentration: mempool.space HHI (NULL before ~2021)
    const minerConcentrationScore = hhiNormalized(mp.hhi_raw ?? null);

    // ── Derived scores ───────────────────────────────────────────────────
    const txCount4fee = cm.tx_count ?? bq.tx_count ?? null;
    const fpi    = feePressureIndex(totalFeesBtc);
    const cong   = congestionScore(mempoolTxCount);
    const stress = stressFromInterval(avgIntervalSecs);
    const health = networkHealthScore(cong, fpi, stress);

    insertStmt.run(
      date, id, label,
      blockHeight, avgIntervalSecs, networkHashrateEh,
      mempoolTxCount, mempoolSizeMb,
      fpi, cong, stress,
      minerConcentrationScore, health,
      difficulty, activeAddresses,
      btcTransferred, totalFeesBtc,
      narration, JSON.stringify(notes)
    );
  }

  insertStmt.finalize();

  const [{ n: count }] = await dbAll(conn, "SELECT COUNT(*) AS n FROM snapshots");
  console.log(`snapshots table has ${count} rows.`);

  conn.close();
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
