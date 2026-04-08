# Bitcoin Network Digital Twin — Data Architecture & Geometric Mapping

## 1. The Elegant System: How Data Becomes Geometry

The Prime Radiant visualization follows a single organizing principle:

**From center outward, you move from consensus reality → economic dynamics → infrastructure.**

This mirrors the Bitcoin network's own architecture: the protocol enforces consensus (blocks), the market expresses demand (fees/mempool), and miners provide security (hashrate). Each ring of the Prime Radiant represents one layer of this stack, and every visual property — size, brightness, rotation speed, color temperature — is driven by a specific metric.

### 1.1 Ring Architecture

| Ring | Name | Data Entity | What It Reveals |
|------|------|-------------|-----------------|
| **Core** | Protocol Nexus | Network aggregate | Overall health, difficulty, halving era — the fundamental heartbeat |
| **Ring 1** | Settlement Band | Block production | Block cadence, fullness, fee revenue — are blocks being produced healthily? |
| **Ring 2** | Fee Market Band | Fee distribution | Fee tier volumes, price pressure — what does demand look like? |
| **Ring 3** | Mempool Band | Pending transactions | Depth, growth rate, urgency — how much is queued? |
| **Ring 4** | Mining Band | Mining pools | Hashrate distribution, concentration — who secures the network? |

### 1.2 Geometric Property Mapping — "The Rhyme"

Every visual property is driven by exactly one metric. No decoration without data.

| Visual Element | Property | Metric Driver | How to Read It |
|---|---|---|---|
| Core | **Size** | Network Health Score (0-10) | Larger = healthier overall network |
| Core | **Pulse speed** | Block interval coefficient of variation | Faster pulse = more irregular block timing |
| Core | **Color temp** | Network stress composite | Orange = healthy, red-orange = stressed |
| Ring 1 segments | **Height** | Avg fees per block (BTC) | Taller marks = higher fee revenue per block |
| Ring 1 | **Active share** | Avg block weight / max weight | More lit segments = fuller blocks |
| Ring 1 | **Rotation speed** | Blocks per hour | Faster = blocks arriving quickly |
| Ring 2 segments | **Height** | Fee tier transaction share | Taller = more transactions at that fee level |
| Ring 2 | **Active share** | High-fee tier share (>30 sat/vB) | More lit = more transactions paying premium fees |
| Ring 2 | **Brightness** | Fee Pressure Index (0-10) | Brighter = more competitive fee market |
| Ring 3 | **Particle count** | Mempool transaction count | More particles = deeper mempool |
| Ring 3 | **Particle size** | Mempool growth rate (txs/min) | Larger = mempool growing fast |
| Ring 3 | **Opacity** | Fee pressure index | More opaque = higher urgency |
| Ring 4 nodes | **Size** | Pool hashrate share (%) | Larger node = bigger mining pool |
| Ring 4 nodes | **Glow intensity** | Pool blocks mined per day | Brighter = actively producing blocks |
| Ring 4 connectors | **Opacity** | Pool share change (30d) | More visible = gaining or losing share rapidly |
| All rings | **Overall brightness** | Network Health Score | Brighter scene = healthier network |

### 1.3 Reading the Instrument

- **Healthy network**: Large bright core, moderate ring activity, evenly distributed mining nodes, sparse particle field
- **Fee spike**: Small/dim core, Ring 2 very bright with tall segments, dense particle cloud, Ring 1 segments tall (high fee revenue)
- **Hashrate shock**: Core turns red-orange, Ring 4 nodes become uneven (some large, some gone), Ring 1 rotation slows, particle cloud grows
- **Halving event**: Core may shrink initially (miner stress), Ring 4 redistributes, Ring 1 fee dynamics shift

---

## 2. Data Model for Snowflake / Strategy Mosaic

### 2.1 Design Principles

1. **Single-table grain**: Daily network snapshot — one row per day
2. **10+ year coverage**: From 2014-01-01 through present (~3,800 rows)
3. **Denormalized**: All metrics in one flat table for simple Mosaic modeling
4. **Derived scores included**: Pre-computed health/stress indices alongside raw measures
5. **Mining pool data as separate table**: Joins on snapshot_date for relational analysis

### 2.2 Table 1: `BTC_DAILY_NETWORK_SNAPSHOT`

This is the primary fact table. One row per calendar day.

#### Attributes (Dimensions)

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `snapshot_date` | DATE | Calendar date (UTC) | Derived |
| `halving_era` | INT | Halving period (1=pre-2012, 2=2012-2016, 3=2016-2020, 4=2020-2024, 5=2024+) | Derived from block_height |
| `difficulty_epoch` | INT | Difficulty adjustment epoch number | Derived from block_height |
| `day_of_week` | VARCHAR | Mon-Sun | Derived |
| `month` | VARCHAR | YYYY-MM | Derived |
| `quarter` | VARCHAR | YYYY-Q# | Derived |

#### Measures (Metrics) — Block Production

| Column | Type | Description | Source | Visual Mapping |
|--------|------|-------------|--------|----------------|
| `block_height_start` | INT | First block of the day | BigQuery blocks | Block labels |
| `block_height_end` | INT | Last block of the day | BigQuery blocks | Block labels |
| `blocks_mined` | INT | Number of blocks mined that day | BigQuery blocks | Ring 1 rotation speed |
| `avg_block_interval_sec` | FLOAT | Average seconds between blocks | BigQuery blocks | Core pulse rate |
| `block_interval_cv` | FLOAT | Coefficient of variation of block intervals | BigQuery blocks | Core pulse irregularity |
| `avg_block_size_bytes` | FLOAT | Average block size in bytes | BigQuery blocks | — |
| `avg_block_weight` | FLOAT | Average block weight (WU) | BigQuery blocks | Ring 1 active share |
| `max_block_weight` | INT | Maximum theoretical block weight (4,000,000) | Constant | Ring 1 active share denominator |

#### Measures — Transaction & Fee Economics

| Column | Type | Description | Source | Visual Mapping |
|--------|------|-------------|--------|----------------|
| `total_tx_count` | INT | Total transactions confirmed that day | BigQuery transactions | — |
| `avg_tx_per_block` | FLOAT | Average transactions per block | Derived | — |
| `total_fees_btc` | FLOAT | Total fees collected (BTC) | BigQuery transactions | Ring 1 segment height |
| `avg_fee_per_tx_sat` | FLOAT | Average fee per transaction (satoshis) | BigQuery transactions | — |
| `median_fee_rate_sat_vb` | FLOAT | Median fee rate (sat/vB) | mempool.space or derived | Ring 2 brightness baseline |
| `fee_pct_0_10` | FLOAT | % of transactions at 0-10 sat/vB | Derived from transactions | Ring 2 segment 1 height |
| `fee_pct_10_30` | FLOAT | % of transactions at 10-30 sat/vB | Derived from transactions | Ring 2 segment 2 height |
| `fee_pct_30_80` | FLOAT | % of transactions at 30-80 sat/vB | Derived from transactions | Ring 2 segment 3 height |
| `fee_pct_80_plus` | FLOAT | % of transactions at 80+ sat/vB | Derived from transactions | Ring 2 segment 4 height |

#### Measures — Mempool State (End-of-Day Snapshot)

| Column | Type | Description | Source | Visual Mapping |
|--------|------|-------------|--------|----------------|
| `mempool_tx_count` | INT | Pending transactions at end of day | mempool.space API | Ring 3 particle count |
| `mempool_size_mb` | FLOAT | Mempool size in MB at end of day | mempool.space API | Data inscription |
| `mempool_growth_rate` | FLOAT | Net change in mempool txs vs prior day | Derived | Ring 3 particle size |

#### Measures — Network Infrastructure

| Column | Type | Description | Source | Visual Mapping |
|--------|------|-------------|--------|----------------|
| `network_hashrate_eh` | FLOAT | Estimated network hashrate (EH/s) | Derived from difficulty + block time | Data inscription, HUD |
| `difficulty` | FLOAT | Current network difficulty | BigQuery blocks | — |
| `difficulty_change_pct` | FLOAT | % change from prior difficulty epoch | Derived | — |

#### Measures — Derived Composite Scores (0-10 Scale)

| Column | Type | Formula Concept | Visual Mapping |
|--------|------|----------------|----------------|
| `fee_pressure_index` | FLOAT | Weighted score of median fee rate + high-fee tier share + mempool depth | Ring 2 brightness, particle opacity |
| `congestion_score` | FLOAT | Mempool depth relative to historical norms + fee tier skew | Ring 3 density |
| `block_production_stress` | FLOAT | Block interval variance + deviation from 10min target | Core color temperature |
| `miner_concentration_hhi` | FLOAT | Herfindahl-Hirschman Index of pool shares × 10 | Ring 4 distribution |
| `network_health_score` | FLOAT | Inverse composite of stress metrics | Core size, overall brightness |

### 2.3 Table 2: `BTC_DAILY_MINING_POOLS`

One row per day per mining pool. Joins to Table 1 on `snapshot_date`.

#### Attributes

| Column | Type | Description |
|--------|------|-------------|
| `snapshot_date` | DATE | Calendar date |
| `pool_name` | VARCHAR | Mining pool name (Foundry, AntPool, F2Pool, etc.) |
| `pool_rank` | INT | Rank by hashrate share that day |

#### Measures

| Column | Type | Description | Visual Mapping |
|--------|------|-------------|----------------|
| `hashrate_share_pct` | FLOAT | Pool's share of total hashrate | Ring 4 node size |
| `hashrate_eh` | FLOAT | Pool's estimated hashrate (EH/s) | Node label |
| `blocks_mined` | INT | Blocks mined by this pool that day | Node glow intensity |
| `share_change_7d` | FLOAT | 7-day rolling change in share | Node connector opacity |
| `share_change_30d` | FLOAT | 30-day rolling change in share | Node connector opacity |
| `total_fees_earned_btc` | FLOAT | Fees earned by this pool that day | — |

### 2.4 Mosaic Semantic Model Structure

When loaded into Snowflake and modeled in Mosaic, the semantic layer would look like:

**Model: Bitcoin Network Intelligence**

**Attributes (Dimensions):**
- `snapshot_date` — time axis for all analysis
- `halving_era` — segment by Bitcoin monetary policy phase
- `difficulty_epoch` — segment by difficulty adjustment period
- `pool_name` — segment by mining entity (from joined table)
- `day_of_week`, `month`, `quarter` — standard time dimensions

**Metrics (Measures):**
- All numeric columns from both tables, with appropriate aggregations (SUM for counts/totals, AVG for rates/averages, MAX/MIN for extremes)

**Key Analysis Questions This Model Answers:**
1. "How has fee pressure evolved across halving eras?"
2. "Which mining pools are gaining/losing share over the last 6 months?"
3. "Show me periods where block production stress exceeded 7.0"
4. "Compare mempool congestion during the 2024 halving vs the 2020 halving"
5. "What does the network health trajectory look like year over year?"

---

## 3. Data Sourcing Strategy

### 3.1 Source 1: Google BigQuery (Free Tier — 10+ Years of Block Data)

The `bigquery-public-data.crypto_bitcoin` dataset contains the complete Bitcoin blockchain.

**Tables available:**
- `blocks` — every block since genesis (block 0, Jan 2009)
- `transactions` — every transaction with inputs, outputs, fees

**SQL to extract daily network snapshot:**

```sql
WITH daily_blocks AS (
  SELECT
    DATE(block_timestamp) AS snapshot_date,
    MIN(number) AS block_height_start,
    MAX(number) AS block_height_end,
    COUNT(*) AS blocks_mined,
    AVG(size) AS avg_block_size_bytes,
    AVG(weight) AS avg_block_weight,
    SUM(transaction_count) AS total_tx_count,
    AVG(transaction_count) AS avg_tx_per_block
  FROM `bigquery-public-data.crypto_bitcoin.blocks`
  WHERE block_timestamp >= '2014-01-01'
  GROUP BY DATE(block_timestamp)
),

block_intervals AS (
  SELECT
    DATE(block_timestamp) AS snapshot_date,
    AVG(
      TIMESTAMP_DIFF(
        block_timestamp,
        LAG(block_timestamp) OVER (ORDER BY number),
        SECOND
      )
    ) AS avg_block_interval_sec,
    STDDEV(
      TIMESTAMP_DIFF(
        block_timestamp,
        LAG(block_timestamp) OVER (ORDER BY number),
        SECOND
      )
    ) / NULLIF(AVG(
      TIMESTAMP_DIFF(
        block_timestamp,
        LAG(block_timestamp) OVER (ORDER BY number),
        SECOND
      )
    ), 0) AS block_interval_cv
  FROM `bigquery-public-data.crypto_bitcoin.blocks`
  WHERE block_timestamp >= '2014-01-01'
  GROUP BY DATE(block_timestamp)
),

daily_fees AS (
  SELECT
    DATE(block_timestamp) AS snapshot_date,
    SUM(fee) / 1e8 AS total_fees_btc,
    AVG(fee) AS avg_fee_per_tx_sat
  FROM `bigquery-public-data.crypto_bitcoin.transactions`
  WHERE block_timestamp >= '2014-01-01'
  GROUP BY DATE(block_timestamp)
)

SELECT
  b.snapshot_date,
  b.block_height_start,
  b.block_height_end,
  b.blocks_mined,
  i.avg_block_interval_sec,
  i.block_interval_cv,
  b.avg_block_size_bytes,
  b.avg_block_weight,
  b.total_tx_count,
  b.avg_tx_per_block,
  f.total_fees_btc,
  f.avg_fee_per_tx_sat
FROM daily_blocks b
JOIN block_intervals i ON b.snapshot_date = i.snapshot_date
LEFT JOIN daily_fees f ON b.snapshot_date = f.snapshot_date
ORDER BY b.snapshot_date
```

**Export:** Save results as CSV (~3,800 rows, ~15 columns). Free within BigQuery's 1TB/month query limit.

### 3.2 Source 2: mempool.space API (Recent Mempool + Fee Data)

The mempool.space API provides current and recent mempool state. For historical data, they also offer bulk exports.

**Endpoints:**
- `GET /api/v1/fees/mempool-blocks` — current fee estimates
- `GET /api/v1/mining/pools/{timeperiod}` — mining pool rankings
- `GET /api/v1/mining/hashrate/{timeperiod}` — historical hashrate

**For daily snapshots (recent 1-2 years):**
```bash
# Mining pool data for the last year
curl https://mempool.space/api/v1/mining/pools/1y

# Hashrate over the last year
curl https://mempool.space/api/v1/mining/hashrate/1y
```

**Note:** Mempool data is inherently ephemeral — true historical mempool snapshots are not available from any source beyond ~1-2 years. For the older portion of our 10-year dataset, mempool columns will be NULL and the visualization should handle this gracefully (e.g., show the rings without Ring 3 particle data).

### 3.3 Source 3: Blockchain.com / Clark Moody / Coin Metrics (Enrichment)

For pre-computed metrics like network hashrate estimates, difficulty history, and mining pool attribution going back further:

- **Blockchain.com Charts API**: `https://api.blockchain.info/charts/{chart-type}?timespan=10years&format=json`
  - `hash-rate`, `difficulty`, `mempool-size`, `avg-block-size`, `miners-revenue`
- **Coin Metrics** (community tier): Historical mining pool data, fee metrics

### 3.4 Recommended Data Assembly Pipeline

```
Phase 1: BigQuery Extract
  └── Export daily block + transaction metrics (2014-present) → CSV

Phase 2: API Enrichment
  ├── mempool.space → mining pool rankings, hashrate history → CSV
  └── blockchain.com → hashrate, difficulty, mempool size → CSV

Phase 3: Join & Derive
  ├── Join all sources on snapshot_date in Python/SQL
  ├── Compute derived scores (fee_pressure_index, etc.)
  ├── Compute halving_era, difficulty_epoch from block_height
  └── Export final tables → CSV

Phase 4: Snowflake Load
  ├── CREATE TABLE BTC_DAILY_NETWORK_SNAPSHOT (...)
  ├── CREATE TABLE BTC_DAILY_MINING_POOLS (...)
  ├── COPY INTO ... FROM @stage
  └── Build Mosaic semantic model on top

Phase 5: Mosaic Model
  ├── Define attributes (snapshot_date, halving_era, pool_name, etc.)
  ├── Define metrics (all numeric measures)
  └── Connect to Prime Radiant front-end via Mosaic API
```

---

## 4. Derived Score Formulas

### 4.1 Fee Pressure Index (0-10)

```
fee_pressure_index = (
  0.3 × normalize(median_fee_rate_sat_vb, 1, 500) +
  0.3 × normalize(fee_pct_80_plus, 0, 0.6) +
  0.2 × normalize(mempool_tx_count, 5000, 300000) +
  0.2 × normalize(total_fees_btc / blocks_mined, 0.01, 2.0)
) × 10

where normalize(value, min, max) = clamp((value - min) / (max - min), 0, 1)
```

### 4.2 Congestion Score (0-10)

```
congestion_score = (
  0.4 × normalize(mempool_tx_count, 5000, 300000) +
  0.3 × normalize(mempool_size_mb, 10, 400) +
  0.3 × normalize(avg_block_weight / 4000000, 0.5, 0.99)
) × 10
```

### 4.3 Block Production Stress (0-10)

```
block_production_stress = (
  0.4 × normalize(block_interval_cv, 0.15, 0.8) +
  0.3 × normalize(abs(avg_block_interval_sec - 600), 0, 300) +
  0.3 × normalize(144 - blocks_mined, 0, 40)
) × 10
```

### 4.4 Miner Concentration (HHI-based, 0-10)

```
hhi = sum(pool_share_pct^2) for top N pools
miner_concentration = normalize(hhi, 0.05, 0.35) × 10
```

### 4.5 Network Health Score (0-10)

```
network_health_score = 10 - (
  0.25 × fee_pressure_index +
  0.25 × congestion_score +
  0.25 × block_production_stress +
  0.25 × miner_concentration
) / 10 × 10

Simplified: network_health_score = 10 - avg(other four scores)
```

---

## 5. Snowflake DDL

```sql
-- Table 1: Daily Network Snapshots
CREATE TABLE BTC_DAILY_NETWORK_SNAPSHOT (
  snapshot_date          DATE          NOT NULL,
  halving_era            INT,
  difficulty_epoch       INT,
  day_of_week            VARCHAR(3),
  month                  VARCHAR(7),
  quarter                VARCHAR(7),

  -- Block Production
  block_height_start     INT,
  block_height_end       INT,
  blocks_mined           INT,
  avg_block_interval_sec FLOAT,
  block_interval_cv      FLOAT,
  avg_block_size_bytes   FLOAT,
  avg_block_weight       FLOAT,

  -- Transaction & Fees
  total_tx_count         INT,
  avg_tx_per_block       FLOAT,
  total_fees_btc         FLOAT,
  avg_fee_per_tx_sat     FLOAT,
  median_fee_rate_sat_vb FLOAT,
  fee_pct_0_10           FLOAT,
  fee_pct_10_30          FLOAT,
  fee_pct_30_80          FLOAT,
  fee_pct_80_plus        FLOAT,

  -- Mempool (NULL for dates before mempool tracking)
  mempool_tx_count       INT,
  mempool_size_mb        FLOAT,
  mempool_growth_rate    FLOAT,

  -- Network Infrastructure
  network_hashrate_eh    FLOAT,
  difficulty             FLOAT,
  difficulty_change_pct  FLOAT,

  -- Derived Composite Scores
  fee_pressure_index     FLOAT,
  congestion_score       FLOAT,
  block_production_stress FLOAT,
  miner_concentration_hhi FLOAT,
  network_health_score   FLOAT,

  PRIMARY KEY (snapshot_date)
);

-- Table 2: Daily Mining Pool Snapshots
CREATE TABLE BTC_DAILY_MINING_POOLS (
  snapshot_date          DATE          NOT NULL,
  pool_name              VARCHAR(100)  NOT NULL,
  pool_rank              INT,
  hashrate_share_pct     FLOAT,
  hashrate_eh            FLOAT,
  blocks_mined           INT,
  share_change_7d        FLOAT,
  share_change_30d       FLOAT,
  total_fees_earned_btc  FLOAT,

  PRIMARY KEY (snapshot_date, pool_name),
  FOREIGN KEY (snapshot_date) REFERENCES BTC_DAILY_NETWORK_SNAPSHOT(snapshot_date)
);
```

---

## 6. How AI Orchestration Drives the Visualization

The orchestration layer (future) acts as the intelligence bridge between Mosaic data and the Prime Radiant geometry:

```
User: "Show me the network state during the 2024 halving"

Orchestrator:
  1. Parse intent → historical query, date range around April 2024
  2. Query Mosaic → fetch BTC_DAILY_NETWORK_SNAPSHOT WHERE snapshot_date BETWEEN '2024-04-15' AND '2024-04-25'
  3. Also fetch BTC_DAILY_MINING_POOLS for same date range
  4. Map data to geometry using the rules in Section 1.2:
     - network_health_score → core size
     - block_interval_cv → core pulse rate
     - total_fees_btc / blocks_mined → Ring 1 segment height
     - fee_pct_* → Ring 2 segment distribution
     - mempool_tx_count → Ring 3 particle count
     - pool hashrate shares → Ring 4 node sizes
  5. Return scene state to front-end
  6. Front-end renders the Prime Radiant with those exact parameters
```

The AI orchestrator's job is to:
- **Translate natural language** → Mosaic SQL queries
- **Apply the geometric mapping rules** → convert metric values to visual parameters
- **Explain what the visualization shows** → generate analysis text
- **Run simulations** → modify baseline metrics with bounded assumptions

This ensures every geometric element in the Prime Radiant is traceable back to a real data value in Snowflake, governed by the Mosaic semantic layer.
