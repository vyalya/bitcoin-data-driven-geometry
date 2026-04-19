# Bitcoin Network Pipeline

Builds `public/data/snapshots.parquet` and `public/data/blocks.parquet` from
real data sources. The Parquet files are served statically from Cloudflare Pages
and read by DuckDB-WASM in the browser.

## Architecture

```
CoinMetrics API ──────────┐
blockchain.com API ───────┼──→ bitcoin.duckdb ──→ public/data/snapshots.parquet
mempool.space API ────────┤                   └──→ public/data/blocks.parquet
BigQuery CSV exports ─────┘
```

## Quick start (no BigQuery credentials)

The CoinMetrics, blockchain.com, and mempool.space fetchers work without any
credentials. BigQuery is optional — if you skip it, block height and per-block
spine data will be NULL for dates without BQ data.

```bash
npm install duckdb          # one-time, add to devDependencies
cd pipeline
mkdir -p raw

# Fetch from free APIs
node fetch_coinmetrics.mjs
node fetch_blockchain.mjs
node fetch_mempool.mjs

# Derive composite metrics and populate snapshots table
node build_db.mjs

# Export Parquet to public/data/
node export_parquet.mjs
```

## With BigQuery (full data)

1. Get credentials:
   ```bash
   gcloud auth application-default login
   ```

2. Run both queries from the project README or the BigQuery console.
   Export each result as CSV to `pipeline/raw/`:
   - Query 1 → `pipeline/raw/bq_daily_agg.csv`
   - Query 2 → `pipeline/raw/bq_blocks.csv`

3. Ingest:
   ```bash
   node ingest_bigquery.mjs
   ```

4. Then run `build_db.mjs` and `export_parquet.mjs` as above.

## npm scripts

```bash
npm run pipeline        # full pipeline (API fetchers + BQ ingest + build + export)
npm run pipeline:apis   # only free API fetchers (no BQ)
npm run pipeline:build  # only build + export (assumes raw tables are populated)
```

## Adding a new snapshot date

1. Edit `pipeline/config.json` — add a new entry to the `snapshots` array.
2. Run `npm run pipeline` to regenerate the Parquet files.
3. Commit `public/data/snapshots.parquet` and `public/data/blocks.parquet`.
4. Push → Cloudflare Pages redeploys automatically.

## Data sources

| Field | Source | Notes |
|-------|--------|-------|
| `blockHeight` | BigQuery `crypto_bitcoin.blocks.number` | NULL without BQ |
| `avgBlockIntervalSeconds` | BigQuery LAG, fallback: 86400/BlkCnt | |
| `networkHashrateEh` | CoinMetrics `HashRate` ÷ 1e6 | Free community tier |
| `mempoolTxCount` | blockchain.com `mempool-count` | |
| `mempoolSizeMb` | blockchain.com `mempool-size` | |
| `difficulty` | BigQuery preferred, blockchain.com fallback | |
| `activeAddresses` | CoinMetrics `AdrActCnt` | |
| `totalFeesBtc` | CoinMetrics `FeeTotNtv` | |
| `btcTransferred` | blockchain.com `estimated-transaction-volume` | |
| `minerConcentrationScore` | mempool.space HHI → normalized 0–10 | **NULL before ~2021** |
| `feePressureIndex` | Derived: sat/tx piecewise | |
| `congestionScore` | Derived: mempool depth piecewise | |
| `blockProductionStress` | Derived: interval/600 piecewise | |
| `networkHealthScore` | Derived: 10 - cong×0.3 - fee×0.3 - stress×1.5 | |

## Gitignore

The following are gitignored (large/local/sensitive):
```
pipeline/bitcoin.duckdb
pipeline/raw/
public/data/*.parquet
```

The Parquet files are committed only after pipeline runs. They are the
build artifact — small enough to commit (~1 MB total).
