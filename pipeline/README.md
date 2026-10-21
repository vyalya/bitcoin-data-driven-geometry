# Bitcoin data pipeline

Run from the repository root with Node.js >=22.18. Public APIs feed checked-in JSON extracts, which are validated and exported to `public/data/`. The historical filename `build_db.mjs` now stages JSON; DuckDB and Parquet are not required.

## Commands

```sh
npm ci
npm run pipeline                    # public APIs + cached blocks + build/export
npm run pipeline:build-only         # reproduce using existing extracts
npm run pipeline:blocks             # fetch missing configured block days
node pipeline/check_boundaries.mjs  # complete cached boundary checks
npm test
npm run audit:data
npm run build
```

Use `node pipeline/fetch_blocks.mjs --force` for an intentional full historical refresh. Header pages are matched to a second explorer. Gaps and 30 neighboring heights on each side are inspected for non-monotonic timestamps; additional records require another explorer match. This bounded check is not full-node consensus validation. Routine refreshes reuse complete cached days.

All artifacts are validated before export begins. Files use individual atomic renames; publish them together as one site release. The client detects count disagreements between snapshot and block files. Per-date `/data/block-details/YYYY-MM-DD.json` files contain the actual records for the hover inspector; the loader matches their height, size, weight and transaction count against the published tuples. The existing workflow includes these files.

## Metric definitions

The UI uses only blocks, transactions, mean/individual weight, fees, difficulty, hashrate and active addresses. Other fields below are retained audit evidence, not current geometry inputs.

| Field | Definition |
| --- | --- |
| `blockCount`, `blockHeight` | Count and highest height of header-day records. |
| `meanBlockWeight` | Arithmetic mean of individual block weights, in WU; each tooth still uses its individual weight. |
| `transactionCount` | Sum of transaction counts minus one coinbase per block. |
| `totalFeesBtc` | Sum of integer mempool.space `extras.totalFees` / 1e8 for these blocks; missing block fees propagate to a missing day. |
| `coinmetricsFeesBtc`, `coinmetricsTransactionCount`, `coinmetricsBlockCount` | Provider comparators. CoinMetrics documents normalized Median-Time-Past daily windows. |
| `avgBlockIntervalSeconds` | Legacy key for **effective spacing**, `86400 / blockCount`; not measured mean inter-block gaps. |
| `blockPace` | Legacy audit-only `blockCount / 144`; no production arc in the current UI. |
| `difficulty` | Arithmetic mean across the header-day blocks. |
| `networkHashrateEh` | CoinMetrics `HashRate` in TH/s / 1e6; normalized-day estimate. |
| `activeAddresses` | CoinMetrics `AdrActCnt`, not unique people. |
| `mempoolTxCount` | Arithmetic mean of Blockchain.com pending-count samples. |
| `mempoolSizeMb` | Sample-mean bytes / 1e6. |
| `btcTransferred` | Blockchain.com estimated transaction value excluding estimated change. |
| `congestionScore` | Display-only interpolation: counts 0, 10K, 50K, 150K, 300K map to 0, 2, 5, 8, 10. |
| `feeTotalIndex` | Legacy display scalar `min(10, totalFeesBtc / 1300 * 10)`; not used for the fee arc or histograms. |
| Health, concentration, stress scores | Unavailable; unsupported proxies are not measurements. |

Fee bands are `[0,10]`, `(10,30]`, `(30,80]`, `(80,infinity)` sat/vB. This includes zero-fee and fractional rates without gaps. `virtual_size` follows BIP141's rounded-up weight/4 definition.

Mempool coverage requires >=24 samples, endpoints within one hour of day boundaries and no gap over one hour. Daily series require one point per date. Samples are not time weighted; partial/missing days stay null. Coverage metadata is retained.

## Select dates

```sh
node pipeline/plan_dates.mjs --as-of=2026-10-19 --after=2026-04-09
```

Defaults: after the last configured date through the last complete UTC day. Proposals include missing protocol anchors, monthly 15th baselines, available CoinMetrics extrema and adjacent controls, and the end date. Existing dates are excluded. No price/news cause is inferred. The planner does not edit config or query paid services.

The first 24-date batch is archived at `audit/selected-dates-2026-10-19.json`. The current 150-date curation and its 47 additions are in `audit/curated-150-events.json` and `audit/curation-150.json`. `pipeline/next-dates.json` records those completed additions until a future planning run replaces it.

## Transaction-level BigQuery data

Optional research/cross-check only: none of the seven current UI signals requires this query. No fee histogram or output-band geometry is displayed.

Supplied Google Cloud **project number: 952270481208**. The project ID, access, billing, table availability and scan cost are not yet verified. Saved browser permissions blocked Console access; no dry run or query has occurred.

`transaction_metrics.sql` uses `@dates` (ARRAY<DATE>) against `bigquery-public-data.crypto_bitcoin.transactions`. It aggregates fees before unnesting outputs, preventing fee multiplication by output count. Coinbase transactions are excluded. Disjoint output bands are >=1,000 BTC, 100–<1,000, 10–<100 and 0–<10; they include change and do not identify owners.

- `next-dates-parameter.json`: 47 newly curated dates.
- `all-dates-parameter.json`: all 150 dates.
- `transaction_metrics_next.sql` / `transaction_metrics_all.sql`: Console-ready literal-date variants, generated by `node pipeline/prepare_queries.mjs`.

Resolve the number to the actual project ID in the authorized account, inspect the live schema and date availability, then dry-run both batches. Choose a batch and maximum bytes billed based on that estimate. Do not infer cost from result row counts or assume the query is free. See Google's [query documentation](https://cloud.google.com/bigquery/docs/running-queries) and [cost controls](https://cloud.google.com/bigquery/docs/best-practices-costs).

Example once access and the project ID are available:

```sh
bq --project_id=YOUR_PROJECT_ID query --use_legacy_sql=false --dry_run < pipeline/queries/transaction_metrics_next.sql
```

After a bounded query succeeds, export a JSON array and retain its job ID:

```sh
node pipeline/ingest_bigquery.mjs /absolute/path/results.json --job-id=PROJECT:LOCATION.JOB_ID
npm run pipeline:build-only
npm test
npm run audit:data
npm run build
```

Import checks reject duplicate days/transactions, invalid values, incomplete transaction counts, incomplete bucket partitions, and fees inconsistent with independent block sums. Genuine zero-transaction days are accepted. Job/query/result hashes are saved. Raw output-value totals use decimal strings to preserve exact satoshi integers.

## Evidence and operations

Keep source extracts and exported JSON together. The local `audit/source-responses/` folder contains larger original responses and is ignored by Git. Tracked extracts retain request hashes/times. `pipeline/generated/` is disposable staging.

The existing weekly workflow uses valid scripts, reproducible dependencies, data tests and a production build. BigQuery ingestion is separate; public refreshes retain validated transaction extracts. A disagreement between block data and an imported extract must be resolved before publication.
