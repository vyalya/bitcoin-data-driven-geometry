-- DuckDB schema for Bitcoin network snapshot pipeline.
-- Run by build_db.mjs via: duckdb bitcoin.duckdb < schema.sql
-- All tables use INSERT OR REPLACE so fetchers are idempotent.

-- ─── Raw landing tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coinmetrics_raw (
  date            DATE PRIMARY KEY,
  active_addresses INTEGER,
  tx_count        INTEGER,
  total_fees_btc  DOUBLE,
  hashrate_th     DOUBLE,   -- TH/s from CoinMetrics (divide by 1e6 for EH/s)
  blk_count       INTEGER
);

CREATE TABLE IF NOT EXISTS blockchain_raw (
  date              DATE PRIMARY KEY,
  difficulty        DOUBLE,
  mempool_tx_count  INTEGER,
  mempool_size_mb   DOUBLE,
  btc_transferred   DOUBLE
);

CREATE TABLE IF NOT EXISTS mempool_raw (
  date        DATE PRIMARY KEY,
  hhi_raw     DOUBLE,   -- Herfindahl-Hirschman Index 0–1 (NULL before 2021)
  pool_count  INTEGER
);

CREATE TABLE IF NOT EXISTS bq_daily_agg (
  date              DATE PRIMARY KEY,
  block_height      INTEGER,
  block_count       INTEGER,
  avg_interval_secs DOUBLE,
  tx_count          INTEGER,
  avg_block_bytes   DOUBLE,
  max_block_bytes   INTEGER
);

CREATE TABLE IF NOT EXISTS bq_blocks (
  block_height INTEGER PRIMARY KEY,
  date         DATE,
  size_bytes   INTEGER,
  weight       INTEGER,
  tx_count     INTEGER
);

-- ─── Derived snapshots table ───────────────────────────────────────────────
-- Populated by build_db.mjs after all raw tables are loaded.

CREATE TABLE IF NOT EXISTS snapshots (
  date                     DATE PRIMARY KEY,
  id                       TEXT    NOT NULL,
  label                    TEXT    NOT NULL,
  block_height             INTEGER,
  avg_block_interval_secs  DOUBLE,
  network_hashrate_eh      DOUBLE,
  mempool_tx_count         INTEGER,
  mempool_size_mb          DOUBLE,
  fee_pressure_index       DOUBLE,
  congestion_score         DOUBLE,
  block_production_stress  DOUBLE,
  miner_concentration_score DOUBLE,  -- NULL when real HHI unavailable
  network_health_score     DOUBLE,
  difficulty               DOUBLE,
  active_addresses         INTEGER,
  unique_senders           INTEGER,
  unique_receivers         INTEGER,
  btc_transferred          DOUBLE,
  total_fees_btc           DOUBLE,
  total_outputs            INTEGER,
  whale_outputs_1000       INTEGER,
  whale_outputs_100        INTEGER,
  mid_outputs_10           INTEGER,
  retail_outputs           INTEGER,
  narration                TEXT,
  notes                    TEXT,    -- JSON array e.g. '["note1","note2"]'
  mode                     TEXT    DEFAULT 'historical'
);
