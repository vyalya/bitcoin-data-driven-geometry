# The Bitcoin Network as Data Driven Geometry

An interactive 3D visualization of the Bitcoin network across 105 historically significant dates — from Genesis (January 2009) through 2026. Every shape, ring, particle, and block maps to real on-chain data. Nothing is decorative.

**Real on-chain data · CoinMetrics + blockchain.com + mempool.space + BigQuery**

## What You're Looking At

### Center Spine — Blocks
Each cuboid is one real Bitcoin block mined that day. Width = block weight (wider = fuller block, up to 4 MWU). Brightness = transaction count. Hover to highlight individual blocks; click to pin and inspect.

### Horizontal Rings — Transaction Metrics
- **Fee Tiers** (r=2.2) — Four arc segments showing fee distribution across sat/vB tiers. Thickness scales with fee pressure.
- **Settlement** (r=2.8) — Arc length represents block production health. Full circle = on schedule. Shrinks under stress.
- **Congestion** (r=3.3) — Arc length and intensity scale with mempool congestion. Barely visible when clear, expands under load.
- **BTC Volume** (r=3.8) — Gold arc proportional to daily BTC transferred.

### Vertical Rings — Security Metrics
- **Hashrate** (YZ plane, r=2.5) — Arc proportional to network hashrate vs ~1,000 EH/s peak.
- **Difficulty** (XZ plane, r=3.0) — Log-scaled arc representing mining difficulty.

### Floating Particles — Active Addresses
Each particle represents roughly 1,000 unique active addresses that day. Larger particles indicate whale activity.

## Data Sources

All verified public, no-auth-required sources:

| Field | Source |
|---|---|
| Hashrate, active addresses, total fees, blocks per day | CoinMetrics community API |
| Difficulty, mempool count, mempool size, BTC transferred | blockchain.com Charts API |
| Miner concentration (HHI, 2021-04 onward) | mempool.space pools API |
| Block heights, per-block spine | Google BigQuery `bigquery-public-data.crypto_bitcoin.blocks` |

Every derived score (fee pressure, congestion, block production stress, network health) is computed from the fields above with transparent piecewise formulas in `pipeline/build_db.mjs`.

### Why Hashrate Varies Across Sources

Bitcoin hashrate cannot be measured directly — it's always estimated from observed block production and difficulty. Different providers publish different values for the same day depending on smoothing window. Day-to-day "instantaneous" hashrate can swing ±15% from block-timing variance. We use CoinMetrics' published value.

## Tech Stack

- **React 19** + **TypeScript 5.9**
- **React Three Fiber 9** (declarative Three.js)
- **drei 10** (TrackballControls for 360° orbit)
- **postprocessing** (Bloom, Vignette, ChromaticAberration)
- **DuckDB-WASM** (reads Parquet directly in the browser via HTTP range requests)
- **Vite 7**, **Cloudflare Pages**

## Run Locally

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=bitcoin-data-driven-geometry
```

## Refresh Data

```bash
npm run pipeline        # fetch everything and rebuild parquet
```

This runs CoinMetrics → blockchain.com → mempool.space → BigQuery ingest → build → parquet export, producing `public/data/{snapshots,blocks}.parquet`. See `pipeline/README.md` for details.

CI runs this weekly via `.github/workflows/refresh-data.yml`.

## Design Principles

1. **Every shape = real data.** No decorative geometry.
2. **Honest granularity.** Don't interpolate where values don't exist.
3. **Source transparency.** Every field has a documented source listed in the Info modal.
4. **Bitcoin gold palette only.** Consistent visual language.

## Project Structure

```
src/
  App.tsx                  — Application entry, 3D scene, UI panels, narration
  db.ts                    — DuckDB-WASM layer; loads parquet at runtime
  types.ts                 — NetworkSnapshot type
  styles.css               — Styling + mobile breakpoints
  data/
    blockData.ts           — Per-block fallback tuples
    staticSnapshots.ts     — 25-snapshot fallback used when parquet isn't present
pipeline/
  config.json              — 105 curated dates with narration
  fetch_coinmetrics.mjs    — CoinMetrics fetch
  fetch_blockchain.mjs     — blockchain.com charts fetch
  fetch_mempool.mjs        — mempool.space HHI
  ingest_bigquery.mjs      — Ingest BQ CSV exports
  build_db.mjs             — Derived metrics + orchestration
  export_parquet.mjs       — Export to public/data/*.parquet
public/data/
  snapshots.parquet        — Full 105-snapshot dataset
  blocks.parquet           — Per-block spine
```
