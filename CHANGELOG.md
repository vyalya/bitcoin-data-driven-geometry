# Changelog

All notable changes to this project. Dates are local.

## 2026-04

### Data pipeline + architecture overhaul
- **Expanded from 25 to 105 historically significant dates** — Genesis (2009) → April 2026. Added ~80 new snapshots spanning every halving, bubble, hack, bear, exchange collapse, ETF, ATH, correction.
- **New data pipeline** at `pipeline/*.mjs`:
  - `fetch_coinmetrics.mjs` — hashrate, active addresses, total fees, block count
  - `fetch_blockchain.mjs` — difficulty, mempool, BTC transferred
  - `fetch_mempool.mjs` — HHI miner concentration (2021+)
  - `ingest_bigquery.mjs` — per-block spine (height, size, weight, tx count) from BigQuery `bigquery-public-data.crypto_bitcoin`
  - `build_db.mjs` — joins sources, derives scores
  - `export_parquet.mjs` — DuckDB → `public/data/*.parquet`
- **Introduced DuckDB + Apache Parquet** as the data layer:
  - Offline: `pipeline/bitcoin.duckdb` (gitignored, local intermediate) stages raw metrics
  - Runtime: `@duckdb/duckdb-wasm` loads `public/data/snapshots.parquet` and `public/data/blocks.parquet` directly in every visitor's browser via HTTP range requests
  - Zero backend, zero shared state, unlimited concurrency
- **Fee pressure formula fixed** — was `totalFeesBtc × 1e8 / txCount` which got dominated by outlier fees on low-tx days (Pizza Day showed max fee pressure due to Laszlo's one massive fee). Replaced with `totalFeesBtc / peakDailyFees × 10` — direct network-wide measure of fee demand.
- **Honest missing data** — hashrate / difficulty rings now *hide* when the source doesn't cover a date (pre-2011 hashrate, pre-2013 difficulty, pre-2021 HHI). Context panel reads `— (no data)` with a provenance note.

### Visual redesign
- **Switched from Strategy Mosaic orange to Bitcoin gold** (`#F7931A` + tints). Every orange hex and rgba swapped; title, favicon, every arc.
- **Block spine restructured** from a vertical beam into a **radial block crown** — blocks arranged as XY-plane spikes radiating from center. Legible from any camera angle. Same shape in grid-view mini cells and detail-view.
- **Orthogonal ring hierarchy** — block crown (XY) + horizontal economic rings (XZ, fee-tier / settlement / congestion / volume) + vertical security rings (YZ / XZ, hashrate / difficulty). Three orthogonal planes, one "gyroscope".
- **Grid view expanded to 21×5** (was 5×5) with wheel + touch scroll, snap-to-row.
- **Timeline ↔ grid two-way pairing** — timeline hover drives camera scroll; grid cell hover drives timeline scroll (with viewport guard so adjacent hovers don't re-trigger).

### Search + filter
- **Multi-qualifier search bar** on the timeline. Supports:
  - `halving` — name substring
  - `2024` — single year
  - `2020-2023` — year range
  - `2020-03` — month
  - `2020-03-12` — single date
  - `2020-03-01..2020-06-30` — precise date range
  - `today`, `X to Y` (e.g. `2025-11 to today`)
  - combinations (text AND'd, dates OR'd): `halving 2024 to today`
- **Inline `?` help popover** with syntax examples. Mobile: full-width overlay below the input.

### Guide modal
- Four tabs: **About / Legend / How to Read / Sources** — all using a shared `guide-section` + `guide-card` + `guide-map` visual system.
- **Legend** cards now include a "meta" line explicitly mapping each shape's inputs ("Arc length ← hashrate, normalized to 1,305 EH/s peak").
- **How to Read** has a **Data → Geometry** map table and a full **How to Interact** map (hover, click, drag, scroll, pan, grid toggle, etc.).
- **Sources** tab cleanly separates raw sources, derived values, and hashrate variance note. Previously had a "Visual-Only Fields" section — removed as misleading; nothing is decorative.
- Font sizes scaled up ~20% across all tabs for readability.

### Interaction UX
- **Single-click** in grid view enters detail. **Mobile**: two-tap pattern (first tap selects and previews, second tap on same cell enters detail). Grid subtitle teaches this.
- **Play from grid** always starts from Genesis and switches to detail.
- **Detail transition** is a hard cut (no camera lerp) — previous versions had a visible "snap" because lerping from any grid pose to `(0, 1.5, 11)` produced an inevitable discontinuity.
- **Detail-view orbit** via TrackballControls retained.
- **Grid-view orbit removed** after several attempts — TrackballControls over a 21-row scrollable grid never produced a usable view.

### Mobile polish
- Search input `font-size: 16px` to prevent iOS Safari auto-zoom on focus.
- Enlarged tap targets on clear + help buttons.
- Mobile sheet handle de-crowded when expanded — no duplicate title text.
- Grid subtitle teaches the two-tap pattern.
- Hints popover repositioned as a proper sheet with shadow and scroll.

### Deploy + security
- **Direct deploy via `wrangler pages deploy`** — no GitHub Actions / CI dependency. Every push is manual and traceable.
- **DuckDB-WASM 1.32.0** pinned (stable release). Dev builds had worker/WASM signature drift.
- **Self-hosted DuckDB worker** (in `dist/assets/`); WASM binary still from jsDelivr (34 MB > Pages' 25 MiB per-file limit).
- **CSP intentionally omitted** — every combination tried silently broke the blob-Worker + importScripts chain DuckDB-WASM uses. Other hardening headers all retained:
  - `Strict-Transport-Security` (HSTS, 1-year + preload)
  - `X-Frame-Options: DENY` (anti-clickjacking)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (all powerful features denied)
  - `X-Permitted-Cross-Domain-Policies: none`
- XSS surface is nil (static site, no user input, no cookies, no storage).

### Cleanup
- Deleted entire `scripts/` dir of dead patch scripts (replaced by `pipeline/`).
- Deleted stale `docs/` and `specs/` planning dirs.
- Removed What-If simulation UI and all slider state/CSS (~260 lines).
- PII / secrets / npm audit — all clean.
- Renamed `src/data/mosaicSnapshots.ts` → `staticSnapshots.ts`; removed all references to Strategy Mosaic.

## Pre-2026-04 baseline
The repo started as a 25-snapshot static TypeScript array with Strategy Mosaic branding. Everything above is the evolution from that starting point.
