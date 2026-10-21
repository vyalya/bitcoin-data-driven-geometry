# Bitcoin / A network in time

An interactive sculpture of Bitcoin across **150 curated dates and 22,374 blocks**, from genesis through **2026-10-19 UTC**. Atom and Classic show the same seven measurements in two arrangements.

[Audit report](audit/REPORT.md) · [Pipeline](pipeline/README.md) · [Design notes](audit/UI-UX.md) · [Website](https://bitcoin-geometry.com/)

## Run and validate

Use Node.js 22.18 or later.

```sh
npm ci
npm run dev
npm run pipeline:build-only
npm test
npm run audit:data
npm run build
```

The browser uses validated static JSON. No runtime database is needed. Missing or inconsistent files produce an explicit error, never substitute measurements.

## Seven signals

| Measurement | Geometry | Definition |
| --- | --- | --- |
| Blocks | Center tooth count | One tooth for every block on the header-timestamp UTC date; ordered by height. |
| Transactions | Ring 1 | Sum of transaction counts, excluding one coinbase per block; linear release-wide scale. |
| Block weight | Each tooth’s length | `0.12 + 1.35 × weight / 4,000,000 WU`; fixed width. The 4 MWU reference is a modern comparison scale, not an early-era consensus claim. |
| Fees | Ring 2 | Integer block fees summed in satoshis, converted to BTC; linear release-wide scale. |
| Difficulty | Ring 3 | Arithmetic mean block difficulty; `log10(mean) / log10(release maximum)`. Difficulty 1 has no arc. |
| Hashrate | Ring 4 | CoinMetrics daily estimate in EH/s; linear release-wide scale. |
| Active addresses | Dots | Floor(addresses / 1,000) in detail, / 8,000 in grid; caps 1,500 / 180. Addresses are not people. |

Atom arranges the teeth around a spherical nucleus with four crossing orange orbits. Classic keeps the circular gear and crossed outer rings. Layout, color, lighting and animation are presentation choices. No additional quantities are encoded by tooth thickness or brightness. Zero and missing values produce no arc; the numeric panel distinguishes them. Small positive values can be imperceptible. Maxima are shared across this release and may change in later releases.

Hover a tooth for its exact block figures, or tap to pin it; Previous / Next supports inspection without precise pointer targeting. The inspector shows height, size, weight, transactions, fees, difficulty and header time, with a block-explorer link. Additional records load only for the active day. Grid, Play, Orbit, Reset view and Hide panels control navigation. Mobile uses a responsive grid, top timeline strip, pinch zoom and a collapsible bottom inspector.

## Sources and dates

Blocks use miner-supplied header timestamps in `[00:00, next 00:00)` UTC. Blockchain.com and mempool.space hashes/timestamps are matched; gaps and 30 heights outside each endpoint receive additional checks, with Blockstream matching for recovered records. Fees come from mempool.space block records. These are explorer cross-checks, not full-node consensus replay.

CoinMetrics hashrate and active addresses use [normalized Median-Time-Past dates](https://gitbook-docs.coinmetrics.io/network-data/methodologies/normalizing-block-times), a different daily window from the block geometry. Hashrate is an estimate; genesis has no estimate. There are two retained block-count disagreements with CoinMetrics: genesis and January 9, 2009.

The selection retains 103 of the prior 129 dates, adds 47 event dates, and removes 26 routine or superseded choices. Every event has a label, category, context and source link. It is an editorial selection, not an objective ranking or evidence of causation. See [the complete selection](audit/curated-150-events.json) and [selection changes](audit/curation-150.json).

## Reproduce or extend

```sh
npm run pipeline        # refresh public series and fetch missing block days
npm run pipeline:blocks # missing configured block days only
npm run pipeline:plan   # future candidate dates; does not edit config
```

Raw extracts preserve source URLs, response hashes and fetch times. Routine refreshes reuse completed historical block days; use `node pipeline/fetch_blocks.mjs --force` for a deliberate full refetch. Publish all artifacts together.

BigQuery has **not** been used in this release. Optional 150-date and 47-date transaction queries are prepared for independent fee/count checks and possible research. Fee histograms, mempool, transfer estimates, output bands and unsupported scores are absent from the core UI. Legacy extracts/fields remain as audit evidence. No paid query is needed to reproduce the seven signals.

## Project map

- `src/App.tsx`: scene, timeline, compact guide and block inspector.
- `src/geometry.ts`, `src/camera.ts`: shared block transforms, hit targets and responsive camera framing.
- `src/db.ts`: validated static-data loading.
- `pipeline/config.json`: current 150 dates and sourced event context.
- `pipeline/raw/`: reproducible source extracts.
- `public/data/`: schema-2 snapshots, block tuples, per-date block details and provenance.
- `audit/`: baseline comparisons, current report, curation and validation evidence.
- `tests/`: data, units, selection, raycasting and camera regressions.

The existing weekly workflow refreshes configured dates and validates tests/build. Historical CHANGELOG entries describe earlier implementations. See the audit report for current deployment and browser-validation limitations.

## Cloudflare deployment

Existing Pages project: `bitcoin-data-driven-geometry`; production branch: `main`; domain: `bitcoin-geometry.com`. This is a direct-upload project, with no Git provider linked. Build with `npm run build`. Verify the active account with `npm exec -- wrangler whoami` before uploading.

```sh
npm exec -- wrangler pages deploy dist --project-name bitcoin-data-driven-geometry --branch codex/data-integrity-audit --commit-dirty=true
# After validating the preview:
npm exec -- wrangler pages deploy dist --project-name bitcoin-data-driven-geometry --branch main --commit-dirty=true
```

Use `node pipeline/verify_deployment.mjs https://DEPLOYMENT.bitcoin-data-driven-geometry.pages.dev` to compare served files to the validated local build. The verification script does not render the page. Deployment receipts and the previous production ID are kept in `audit/deployment.json`. Renew expired login with `npm exec -- wrangler login`; use the browser approval flow rather than pasting credentials into chat.
