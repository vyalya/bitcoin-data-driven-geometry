# Bitcoin Network Digital Twin

## Data Source Strategy

## 1. Goal

This document recommends likely source systems for the first Bitcoin network dataset loads that will eventually land in Snowflake and power Strategy Mosaic.

The priority is:

- reliable historical network data
- practical ingestion for Snowflake
- enough fidelity for network technical analysis and simulation

## 2. Recommended Source Mix

No single source is perfect for every metric. The best approach is a layered source strategy.

## 2.1 Historical Backbone

Recommended first choice:

- Google BigQuery Bitcoin public blockchain dataset or Google Blockchain Analytics where suitable

Why:

- very strong fit for long historical block and transaction-derived aggregates
- SQL-friendly extraction
- practical for exporting block-level or aggregated datasets into Snowflake

Use it for:

- blocks
- block timestamps
- transaction counts
- block size and weight
- fee totals
- subsidy/reward context

## 2.2 Interval-Current and Mempool Signals

Recommended first choice:

- mempool.space API

Why:

- strong for current mempool state, fees, recent blocks, and mining views
- useful for recent snapshots and for shaping the UI before your own node pipeline exists

Use it for:

- mempool snapshots
- recommended fee levels
- recent block metadata
- recent mining pool attribution

Important note:

- mempool.space is excellent for the shape of the product and for current/recent network intelligence
- for this project, we should treat it as a model for the experience and as a recent-state source, not as the only historical backbone

In practice, the product should use mempool.space-like metrics from a historical perspective by:

- backfilling block-derived history from BigQuery and other historical sources
- periodically snapshotting mempool-style current fields into Snowflake for future history
- normalizing those fields into our curated schema so the app can replay them over time

This is an inference from the currently visible mempool.space product and public documentation posture: it presents rich live/recent network information, but for a long-horizon semantic model we should assume we will need to build our own historical archive layer.

## 2.3 Network-Native Validation and Optional Self-Hosted Source

Recommended first choice:

- Bitcoin Core RPC

Why:

- canonical network-native source
- useful for validating block, mempool, and chain state directly
- best long-term option if you want tighter control over freshness and provenance

Use it for:

- current chain state
- mempool state
- block stats
- difficulty and network hash rate proxies

## 2.4 Higher-Level Metrics and Enrichment

Recommended optional source:

- Coin Metrics

Why:

- broad historical coverage
- export-friendly metric API
- useful if you want curated, higher-level network metrics without building every derived measure yourself

Use it for:

- network metrics enrichment
- cross-checking derived values
- faster bootstrapping of curated time series

## 3. What Should Be Loaded First

If you want the smallest practical path to a real dataset:

### Phase A

- block-level history
- daily network snapshots
- daily mining pool share snapshots

### Phase B

- hourly recent network snapshots
- hourly recent mempool snapshots
- timeline event markers

This is the phase where the product starts to feel most like a historical version of mempool.space:

- fee recommendation bands over time
- mempool size and tx count over time
- block cadence and difficulty regime over time
- recent mining concentration snapshots over time

### Phase C

- optional self-hosted Bitcoin Core snapshots
- optional Coin Metrics enrichment

## 4. Best Format for Snowflake Loads

Recommended:

- CSV or CSV.GZ for small curated seed files
- Parquet for larger historical extracts

Best practice:

- extract from source into files
- load to `RAW`
- transform inside Snowflake into `CURATED`

## 5. Source-to-Table Mapping

### 5.1 `CURATED.BLOCK`

Best sources:

- BigQuery historical exports
- Bitcoin Core validation for recent windows

### 5.2 `CURATED.NETWORK_SNAPSHOT`

Best sources:

- derived from `BLOCK`
- enriched with mempool.space recent snapshots
- optionally enriched with Coin Metrics

### 5.3 `CURATED.MEMPOOL_SNAPSHOT`

Best sources:

- mempool.space
- Bitcoin Core RPC

Recommended strategy:

- use mempool.space for immediate mock shaping and near-current snapshots
- persist periodic snapshots into Snowflake so you own the historical replay layer
- optionally validate or supplement with Bitcoin Core over time

### 5.4 `CURATED.MINING_POOL_DIM` and `CURATED.MINING_POOL_SNAPSHOT`

Best sources:

- mempool.space mining views
- historical pool attribution datasets you normalize into your own dimension

## 6. Immediate Recommendation

The cleanest initial route is:

1. Build the schema now
2. Mock the app against the future semantic model now
3. Source real historical backbone data from BigQuery first
4. Source recent mempool/mining snapshots from mempool.space or Bitcoin Core and store them as your own historical snapshot series
5. Load Snowflake and build Mosaic after the schema is stable

## 6.1 Product-Led Data Direction

If the experience benchmark is "mempool.space, but semantic, historical, and simulation-aware," then the data program should explicitly target these replayable measures:

- mempool tx count
- mempool memory/vbytes
- fee recommendation tiers
- block interval behavior
- difficulty adjustment state
- recent block throughput
- mining pool share snapshots

That gives the application the right visual vocabulary from day one.

## 7. Source References

- [Google BigQuery public datasets](https://cloud.google.com/bigquery/public-data)
- [Google Blockchain Analytics overview](https://docs.cloud.google.com/blockchain-analytics/docs/overview)
- [Bitcoin in BigQuery public dataset announcement](https://cloud.google.com/blog/topics/public-datasets/bitcoin-in-bigquery-blockchain-analytics-on-public-data)
- [mempool.space](https://mempool.space/)
- [Bitcoin Core RPC reference](https://developer.bitcoin.org/reference/rpc/)
- [Coin Metrics API v4](https://docs.coinmetrics.io/api/v4/)
- [Coin Metrics getting started](https://docs.coinmetrics.io/getting-started)
