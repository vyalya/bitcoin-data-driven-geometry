# Bitcoin Network Digital Twin

## Data Design

## 1. Goal

This design defines the first Snowflake-oriented data model for the Bitcoin Network Digital Twin.

It is optimized for:

- Strategy Mosaic semantic modeling
- historical and interval-based network technical analysis
- simulation baselines and scenario comparisons
- a mocked-data-first application phase with a clean path to real data later

It is not optimized for:

- raw transaction-level replay of the entire chain in the browser
- trading analytics
- price prediction

## 2. Data Design Principles

- Model the network at analysis-friendly grains first
- Keep raw ingestion separate from curated semantic tables
- Preserve provenance and refresh metadata on all facts
- Prefer additive snapshot facts for UI playback
- Use dimensions for stable identities like mining pools, eras, and events
- Keep canonical derived metrics stable so Mosaic and the app use the same definitions

## 3. Recommended Snowflake Layers

Use a 3-layer structure in Snowflake:

### 3.1 `RAW`

Landing zone for ingested source extracts.

Examples:

- raw block exports
- raw mempool snapshots
- raw mining pool attribution files
- raw API pulls

Purpose:

- preserve source fidelity
- simplify reprocessing

### 3.2 `CURATED`

Normalized and cleaned relational tables.

Examples:

- `CURATED.BLOCK`
- `CURATED.MEMPOOL_SNAPSHOT`
- `CURATED.MINING_POOL_SNAPSHOT`
- `CURATED.NETWORK_SNAPSHOT`

Purpose:

- provide stable analytic structures
- decouple Mosaic from source-specific quirks

### 3.3 `SEMANTIC`

Consumer-facing views or tables used by Mosaic and the application API.

Examples:

- `SEMANTIC.V_NETWORK_STATE_DAILY`
- `SEMANTIC.V_NETWORK_STATE_HOURLY`
- `SEMANTIC.V_MINER_CONCENTRATION`
- `SEMANTIC.V_NETWORK_MILESTONES`

Purpose:

- present governed business logic cleanly
- minimize direct coupling to raw/curated schema changes

## 4. Recommended Grains

To keep V1 tractable, use a small set of intentional grains.

### 4.1 Block Grain

One row per confirmed block.

Use for:

- spine rendering
- fee analysis
- block cadence analysis
- mining pool attribution

### 4.2 Interval Snapshot Grain

One row per network snapshot at a fixed interval such as hourly or daily.

Use for:

- playback
- scene state loading
- compare mode
- simulation baselines

### 4.3 Mining Pool Snapshot Grain

One row per pool per interval.

Use for:

- miner constellation
- concentration analysis
- resilience analysis

### 4.4 Event Grain

One row per notable network event or milestone.

Use for:

- timeline markers
- guided narrative states
- compare presets

## 5. Core Tables

## 5.1 `CURATED.BLOCK`

One row per block.

Suggested columns:

```sql
create or replace table CURATED.BLOCK (
  BLOCK_HEIGHT number(38,0) not null,
  BLOCK_HASH string not null,
  BLOCK_TIMESTAMP timestamp_ntz not null,
  BLOCK_DATE date not null,
  BLOCK_VERSION string,
  PREVIOUS_BLOCK_HASH string,
  MINER_POOL_KEY string,
  TX_COUNT number(38,0),
  BLOCK_SIZE_BYTES number(38,0),
  BLOCK_WEIGHT number(38,0),
  STRIPPED_SIZE_BYTES number(38,0),
  TOTAL_FEES_BTC number(38,12),
  TOTAL_FEES_SATS number(38,0),
  SUBSIDY_BTC number(38,12),
  TOTAL_REWARD_BTC number(38,12),
  MEDIAN_FEE_RATE_SAT_VB number(18,4),
  AVG_FEE_RATE_SAT_VB number(18,4),
  MIN_FEE_RATE_SAT_VB number(18,4),
  MAX_FEE_RATE_SAT_VB number(18,4),
  DIFFICULTY number(38,8),
  EST_NETWORK_HASHRATE_EH number(18,6),
  BLOCK_INTERVAL_SECONDS number(18,2),
  HALVING_EPOCH number(9,0),
  SOURCE_NAME string not null,
  SOURCE_REFRESHED_AT timestamp_ntz,
  INGESTED_AT timestamp_ntz default current_timestamp(),
  primary key (BLOCK_HEIGHT)
);
```

Notes:

- `MINER_POOL_KEY` should join to a pool dimension even if attribution is incomplete
- block-level facts are the historical backbone of the twin

## 5.2 `CURATED.MEMPOOL_SNAPSHOT`

One row per snapshot interval.

Suggested columns:

```sql
create or replace table CURATED.MEMPOOL_SNAPSHOT (
  SNAPSHOT_TS timestamp_ntz not null,
  SNAPSHOT_DATE date not null,
  SNAPSHOT_GRAIN string not null,
  MEMPOOL_TX_COUNT number(38,0),
  MEMPOOL_VBYTES number(38,0),
  MEMPOOL_SIZE_MB number(18,4),
  MEMPOOL_TOTAL_FEES_BTC number(38,12),
  MIN_RELAY_FEE_SAT_VB number(18,4),
  RECOMMENDED_FEE_LOW_SAT_VB number(18,4),
  RECOMMENDED_FEE_MEDIUM_SAT_VB number(18,4),
  RECOMMENDED_FEE_HIGH_SAT_VB number(18,4),
  UNCONFIRMED_TX_COUNT number(38,0),
  CONGESTION_SCORE number(9,4),
  FEE_PRESSURE_INDEX number(9,4),
  MEMPOOL_ACCELERATION_SCORE number(9,4),
  SOURCE_NAME string not null,
  SOURCE_REFRESHED_AT timestamp_ntz,
  INGESTED_AT timestamp_ntz default current_timestamp(),
  primary key (SNAPSHOT_TS, SNAPSHOT_GRAIN)
);
```

Notes:

- This table supports the mempool storm layer
- `SNAPSHOT_GRAIN` should be values like `1h`, `1d`, `15m`

## 5.3 `CURATED.MINING_POOL_DIM`

Stable dimension for pool identity.

Suggested columns:

```sql
create or replace table CURATED.MINING_POOL_DIM (
  MINER_POOL_KEY string not null,
  POOL_NAME string not null,
  DISPLAY_NAME string,
  ACTIVE_FLAG boolean default true,
  COUNTRY_CODE string,
  REGION_NAME string,
  ATTRIBUTION_SOURCE string,
  FIRST_SEEN_AT timestamp_ntz,
  LAST_SEEN_AT timestamp_ntz,
  primary key (MINER_POOL_KEY)
);
```

## 5.4 `CURATED.MINING_POOL_SNAPSHOT`

One row per pool per interval.

Suggested columns:

```sql
create or replace table CURATED.MINING_POOL_SNAPSHOT (
  SNAPSHOT_TS timestamp_ntz not null,
  SNAPSHOT_DATE date not null,
  SNAPSHOT_GRAIN string not null,
  MINER_POOL_KEY string not null,
  BLOCK_COUNT number(38,0),
  BLOCK_SHARE_PCT number(9,6),
  EST_HASHRATE_EH number(18,6),
  CONCENTRATION_RANK number(9,0),
  SHARE_CHANGE_7D number(9,6),
  SHARE_CHANGE_30D number(9,6),
  ACTIVE_FLAG boolean default true,
  SOURCE_NAME string not null,
  SOURCE_REFRESHED_AT timestamp_ntz,
  INGESTED_AT timestamp_ntz default current_timestamp(),
  primary key (SNAPSHOT_TS, SNAPSHOT_GRAIN, MINER_POOL_KEY),
  foreign key (MINER_POOL_KEY) references CURATED.MINING_POOL_DIM(MINER_POOL_KEY)
);
```

## 5.5 `CURATED.NETWORK_SNAPSHOT`

One row per interval with high-signal network metrics for fast playback and compare mode.

Suggested columns:

```sql
create or replace table CURATED.NETWORK_SNAPSHOT (
  SNAPSHOT_TS timestamp_ntz not null,
  SNAPSHOT_DATE date not null,
  SNAPSHOT_GRAIN string not null,
  BLOCK_HEIGHT number(38,0),
  DIFFICULTY number(38,8),
  EST_NETWORK_HASHRATE_EH number(18,6),
  AVG_BLOCK_INTERVAL_SECONDS number(18,4),
  AVG_TX_COUNT_PER_BLOCK number(18,4),
  AVG_BLOCK_SIZE_MB number(18,6),
  AVG_TOTAL_FEES_BTC_PER_BLOCK number(38,12),
  AVG_FEE_RATE_SAT_VB number(18,4),
  MEDIAN_FEE_RATE_SAT_VB number(18,4),
  MEMPOOL_TX_COUNT number(38,0),
  MEMPOOL_SIZE_MB number(18,4),
  FEE_PRESSURE_INDEX number(9,4),
  CONGESTION_SCORE number(9,4),
  BLOCK_PRODUCTION_STRESS_SCORE number(9,4),
  MINER_CONCENTRATION_SCORE number(9,4),
  NETWORK_HEALTH_SCORE number(9,4),
  ABNORMAL_BLOCK_INTERVAL_SCORE number(9,4),
  RESILIENCE_UNDER_SHOCK_SCORE number(9,4),
  SOURCE_NAME string not null,
  SOURCE_REFRESHED_AT timestamp_ntz,
  INGESTED_AT timestamp_ntz default current_timestamp(),
  primary key (SNAPSHOT_TS, SNAPSHOT_GRAIN)
);
```

Notes:

- This is the most important table for V1
- The app can run almost entirely off this plus blocks and pool snapshots

## 5.6 `CURATED.NETWORK_EVENT_DIM`

Milestones and major events.

Suggested columns:

```sql
create or replace table CURATED.NETWORK_EVENT_DIM (
  EVENT_KEY string not null,
  EVENT_NAME string not null,
  EVENT_TYPE string not null,
  EVENT_START_TS timestamp_ntz not null,
  EVENT_END_TS timestamp_ntz,
  EVENT_DESCRIPTION string,
  DEFAULT_COMPARE_WINDOW_DAYS number(9,0),
  primary key (EVENT_KEY)
);
```

Suggested event types:

- `halving`
- `fee_spike`
- `difficulty_adjustment_regime`
- `miner_migration`
- `network_congestion`

## 5.7 `CURATED.SCENARIO_TEMPLATE_DIM`

Defines supported simulation families for the app.

Suggested columns:

```sql
create or replace table CURATED.SCENARIO_TEMPLATE_DIM (
  SCENARIO_TEMPLATE_KEY string not null,
  SCENARIO_NAME string not null,
  SCENARIO_TYPE string not null,
  VARIABLE_NAME string not null,
  VARIABLE_UNIT string,
  MIN_SUPPORTED_VALUE number(18,6),
  MAX_SUPPORTED_VALUE number(18,6),
  DEFAULT_VALUE number(18,6),
  HEURISTIC_MODEL_NAME string,
  ACTIVE_FLAG boolean default true,
  primary key (SCENARIO_TEMPLATE_KEY)
);
```

Examples:

- `HASHRATE_DROP`
- `MEMPOOL_GROWTH`
- `FEE_PRESSURE_INCREASE`
- `BLOCK_CADENCE_SLOWDOWN`
- `MINER_CONCENTRATION_CHANGE`

## 6. Semantic Views for Mosaic

These should be the first views modeled in Strategy Mosaic.

### 6.1 `SEMANTIC.V_NETWORK_STATE_DAILY`

Daily network technical analysis view.

Should expose:

- date
- block progression
- difficulty
- hashrate
- fee pressure
- congestion
- health scores

### 6.2 `SEMANTIC.V_NETWORK_STATE_HOURLY`

Hourly recent-state and event view.

Should expose:

- hourly metrics for recent playback
- mempool and fee behavior
- block cadence stress

### 6.3 `SEMANTIC.V_MINER_CONCENTRATION`

Mining pool and concentration analysis view.

Should expose:

- pool share
- estimated hashrate
- share change windows
- concentration ranking

### 6.4 `SEMANTIC.V_NETWORK_EVENTS`

Milestone/event view for timeline markers.

### 6.5 `SEMANTIC.V_SCENARIO_BASELINES`

Baseline snapshots used to seed simulation workflows.

## 7. Derived Metric Definitions

These can begin in Python and later move into Mosaic.

## 7.1 Fee Pressure Index

Purpose:

- summarize fee-market stress into a single analysis-friendly metric

Inputs:

- average fee rate
- median fee rate
- mempool size
- recommended high-priority fee rate

## 7.2 Congestion Score

Purpose:

- capture queue pressure in the mempool

Inputs:

- unconfirmed tx count
- mempool vbytes
- recent block throughput

## 7.3 Block Production Stress Score

Purpose:

- detect unusual slowdown or instability in block production

Inputs:

- rolling block interval
- difficulty regime
- recent hashrate estimate

## 7.4 Miner Concentration Score

Purpose:

- summarize concentration risk among top pools

Inputs:

- top N pool share
- HHI-style concentration math

## 7.5 Network Health Score

Purpose:

- single high-level score for the app HUD

Inputs:

- weighted combination of congestion, block stress, hashrate stability, and concentration

## 8. CSV vs Parquet Guidance

For your question about CSV:

- 10 years of daily or hourly aggregate data absolutely fits in CSV
- 10 years of block-level data can still fit in compressed CSVs, but Parquet is better
- full transaction-level history is not a good fit for CSV as a working format

Recommendation:

- Use CSV or CSV.GZ for initial seed loads if that is easiest
- Use Parquet for larger historical extracts and repeatable ingestion
- Land both into `RAW`, then transform into `CURATED`

## 9. Recommended Minimum V1 Dataset

If we want to move quickly, we do not need the entire chain at every raw detail level.

Minimum useful V1 dataset:

- block-level history for at least 10 years
- daily network snapshots for full history
- hourly snapshots for the last 12-24 months
- mining pool snapshots daily for full history if available
- event table with major milestones

That is enough to support:

- historical playback
- compare mode
- analysis overlays
- bounded simulation

## 10. Mock-First Build Strategy

Before Mosaic is wired in, use application-shaped mock files that mirror the future semantic model.

The mocked app should behave as if it is consuming:

- `NetworkSnapshot`
- `BlockSeries`
- `MiningPoolSnapshot`
- `NetworkEvent`

This keeps front-end contracts stable while data engineering catches up.

## 11. Recommended Initial Load Order

1. Load `MINING_POOL_DIM`
2. Load `BLOCK`
3. Load `NETWORK_SNAPSHOT`
4. Load `MEMPOOL_SNAPSHOT`
5. Load `MINING_POOL_SNAPSHOT`
6. Load `NETWORK_EVENT_DIM`
7. Publish semantic views in `SEMANTIC`

## 12. Immediate Recommendation

For the next implementation step, treat these as the V1 core:

- `CURATED.BLOCK`
- `CURATED.NETWORK_SNAPSHOT`
- `CURATED.MINING_POOL_DIM`
- `CURATED.MINING_POOL_SNAPSHOT`
- `CURATED.NETWORK_EVENT_DIM`

That gives Mosaic enough structure to model the network, and it gives the app enough structure to proceed with mocks now and real data later.
