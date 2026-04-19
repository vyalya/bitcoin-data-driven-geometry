# The Bitcoin Network as Data Driven Geometry

An interactive 3D visualization of the Bitcoin network across **105 historically significant dates** — from Genesis (January 2009) through 2026. Every shape, ring, particle, and block maps to real on-chain data. Nothing is decorative.

> **Live:** [bitcoin-data-driven-geometry.pages.dev](https://bitcoin-data-driven-geometry.pages.dev/)

## What you're looking at

Each snapshot shows one day of Bitcoin network state as a 3D "gyroscope":

| Shape | Data |
|---|---|
| **Block Crown** (radial spikes at center) | 1 spike per block · length = weight · brightness = tx count |
| **Fee-tier arcs** (4 horizontal arcs, r=2.2) | 4 fee buckets · thickness = fee pressure · segment share = distribution |
| **Settlement arc** (horizontal, r=2.8) | arc length = average block interval vs. the 600 s target |
| **Congestion arc** (horizontal, r=3.3) | thickness + intensity = mempool transaction count |
| **BTC Volume arc** (horizontal, r=3.8) | arc length = daily BTC transferred vs. the 4.6M BTC peak |
| **Hashrate ring** (vertical, YZ plane, r=2.5) | arc length = hashrate vs. the ~1,305 EH/s peak |
| **Difficulty ring** (vertical, XZ plane, r=3.0) | arc length = log₁₀(difficulty), 1 → 150 trillion |
| **Address particles** (floating cloud) | count = active addresses ÷ 1000 · size = whale activity |

## Data sources

All free, public, no-auth:

| Field | Source |
|---|---|
| Hashrate, active addresses, total fees, block count | CoinMetrics community API |
| Difficulty, mempool count/size, BTC transferred | blockchain.com Charts API |
| Miner concentration (HHI, 2021 onward) | mempool.space mining pools API |
| Per-block spine (height, size, weight, tx count) | Google BigQuery `bigquery-public-data.crypto_bitcoin` |

Derived scores (fee pressure, congestion, block stress, network health) are computed from the raw fields above with transparent piecewise formulas in `pipeline/build_db.mjs`.

## Architecture

```
┌─ Offline (your machine or CI) ───────────────────────────────────┐
│                                                                   │
│   CoinMetrics API      ─┐                                         │
│   blockchain.com API   ─┼─►  Node scripts  ─►  DuckDB (.duckdb)   │
│   mempool.space API    ─┤                       (staging)         │
│   BigQuery CSVs        ─┘                          │              │
│                                                    ▼              │
│                                          public/data/*.parquet    │
│                                          (committed to git)       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌─ Deploy ─────────────────────────────────────────────────────────┐
│   npm run build &&                                                │
│   npx wrangler pages deploy dist …                                │
│                                                                   │
│   Static files → Cloudflare Pages edge network                   │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌─ Browser runtime (every visitor, isolated) ──────────────────────┐
│                                                                   │
│   Page loads → DuckDB-WASM Worker runs locally                   │
│               → reads parquet via HTTP range requests             │
│               → queries + renders 3D scene in Three.js            │
│                                                                   │
│   Zero backend. Zero shared state. Unlimited concurrency.        │
└───────────────────────────────────────────────────────────────────┘
```

The `.duckdb` file is a local intermediate — never deployed, never served. Parquet files are the only data shipped to browsers.

## Tech stack

- **React 19** + **TypeScript 5.9**
- **React Three Fiber 9** / **drei 10** / **postprocessing** for the 3D scene
- **DuckDB-WASM 1.32.0** — runs entirely in a Web Worker in each visitor's browser
- **Apache Parquet** — single-file columnar data, HTTP-range-request-scannable by DuckDB-WASM
- **Vite 7** build, **Cloudflare Pages** deploy, `wrangler` CLI for direct pushes

## Run locally

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build && npx wrangler pages deploy dist --project-name=bitcoin-data-driven-geometry --branch=main
```

Direct deploy, no CI dependency.

## Refresh data

```bash
npm run pipeline     # fetch everything fresh + rebuild parquet
```

Runs CoinMetrics → blockchain.com → mempool.space → BigQuery CSV ingest → build → parquet export. BigQuery step reads CSVs from `pipeline/raw/` (export manually via `bq` CLI).

## Design principles

1. **Every shape = real data.** No decoration. If it renders, it traces to a specific metric.
2. **Honest granularity.** When a source doesn't cover a date (pre-2011 hashrate, pre-2021 HHI), the ring hides and the panel shows "— (no data)" with an explanation. No fake zeros.
3. **Layered derivation.** Raw fields → derived scores → shape projections. Every layer is documented in the "Sources" tab.
4. **Bitcoin gold palette only** (`#F7931A` + tints).

## See the full history

For the evolution of the design and architecture decisions, see [CHANGELOG.md](./CHANGELOG.md).

## Project structure

```
src/
  App.tsx                  3D scene, HUD panels, narration, search
  db.ts                    DuckDB-WASM layer; loads parquet at runtime
  types.ts                 NetworkSnapshot type
  styles.css               All CSS, mobile breakpoints
  data/
    blockData.ts           Per-block fallback tuples
    staticSnapshots.ts     25-snapshot fallback when parquet isn't present
pipeline/
  config.json              105 curated dates + narration
  fetch_*.mjs              Per-source fetchers
  ingest_bigquery.mjs      BQ CSV → DuckDB
  build_db.mjs             Derive metrics + join sources
  export_parquet.mjs       DuckDB → parquet
public/
  data/snapshots.parquet   Full 105-snapshot dataset (committed)
  data/blocks.parquet      Per-block spine (committed)
  _headers                 Cloudflare Pages security headers
```
