# Bitcoin Network Digital Twin

## Visual-to-Data Mapping

## Goal

This document defines the rule that every meaningful visual element in the scene should map to real or real-shaped data.

For V1 mocks, the scene uses application-shaped mock data that mirrors the future Snowflake/Mosaic model. When real data is wired in, the same visual contracts should remain intact.

## Mapping Rules

- blockchain spine cubes map to confirmed block progression
- mempool particle/ring density maps to mempool depth and transaction share
- radial ring segments map to aggregated fee buckets or congestion bands
- miner nodes map to mining pool share snapshots
- HUD metrics map directly to snapshot-level measures
- simulation mode manipulates the same baseline measures rather than inventing a separate visual layer

## Current V1 Mock Contracts

### `feeBuckets`

Each fee bucket represents an aggregated share of unconfirmed transactions by fee-rate class.

Visual effect:

- segment count
- segment brightness
- ring activation arc

Future source candidates:

- mempool snapshot bucketing pipeline
- Bitcoin Core mempool classification
- mempool.space-like recent snapshot series persisted into Snowflake

### `ringBands`

Each ring band represents a semantic layer of activity or congestion in the mempool/network field.

Visual effect:

- ring radius
- number of lit segments
- intensity of active arcs

Future source candidates:

- derived measures from `CURATED.MEMPOOL_SNAPSHOT`
- derived measures from `CURATED.NETWORK_SNAPSHOT`

### `miningPools`

Each node represents a mining pool share snapshot.

Visual effect:

- node size
- node position emphasis
- pool labels

Future source candidates:

- `CURATED.MINING_POOL_SNAPSHOT`

## Simulation Rule

A simulation should never create purely decorative changes. It must transform:

- block cadence values
- mempool values
- fee bucket distribution
- mining pool shares
- derived stress/health scores

The scene should then re-render from those changed values.
