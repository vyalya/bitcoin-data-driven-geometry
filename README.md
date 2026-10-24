# Bitcoin / A network in time

An interactive sculpture of Bitcoin across **150 curated dates and 22,374 blocks**, from genesis through **2026-10-19 UTC**. Gear, Atom and Classic show the same seven measurements in three arrangements. Gear is the default opening view.

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

The table below describes Atom and Classic. Gear’s per-block bars, open chain and rim scales are documented in the Connected gear section below.

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

The default view is the Gear grid with side panels hidden. Hover a geometry in either view to show its UTC date and event at the lower left, whether playback is running or paused. The caption disappears when the pointer leaves the geometry or the panels open. In orbit view, hovering with panels open highlights the corresponding metric; clicking a tooth, ring or dot opens the panels and pins its figures. Hover can preview another signal without losing that pin. Use Show side panels to reveal the timeline, search and inspector.

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

## Connected gear design study

Run `npm run dev` and open [Connected gear](http://localhost:5173/timechain.html). The study uses the original left timeline, right inspector and full 360-degree Trackball controls, with the quieter panel formatting from the earlier experiment. It opens in the Gear grid with side panels hidden, matching the main entry point. The Gear release is published on bitcoin-geometry.com; Atom and Classic remain available.

The connected gear brings all seven signals into one form. Flat-ended block teeth follow an open 330-degree path around the central address field, with first/last-height text labels and a fixed 30-degree opening. The opening and marker sizes are layout choices, not additional data. Each block has paired inner transaction and fee bars; filled portions of two polygonal guard rims surround the ledger. Hovering or selecting a block with at least one visible transaction or fee bar reveals a thin connector to those bars. That connector is illustrative, not an additional measurement or observed payment connection.

| Measurement | Connected gear encoding |
| --- | --- |
| Blocks | One rectangular tooth per block, clockwise by height along an open 330-degree path with start/end height markers. The chain track joins consecutive heights only; missing heights and the last-to-first join remain open. Directions are layout. |
| Block weight | Tooth length = `0.12 + 0.75 × weight / 4,000,000 WU`, extending from radius 1.5. Width is fixed. The modern 4 MWU reference compares eras; it does not assert an early-era consensus limit. |
| Transactions | Left ivory bar on each block’s inner spoke: length = `0.58 × non-coinbase transactions / 7,928`, using the shared release maximum. |
| Fees | Right copper bar on the same spoke: length = `0.58 × log1p(block fees in BTC) / log1p(37.62561499 BTC)`. Logarithmic lengths are not additive; daily totals still sum exact satoshis. |
| Difficulty | Single inner 64-sided guard rim: filled fraction = `log10(mean block difficulty) / log10(release maximum)`. Difficulty 1 has no filled portion. |
| Estimated hashrate | Single outer 64-sided guard rim: filled fraction = daily EH/s / release maximum. Missing estimates have no filled portion. |
| Active addresses | Central dots: `floor(addresses / 1,000)` in detail or `/ 8,000` in the grid, capped at 1,500 / 180. Positions are deterministic layout, not people, peer locations or payment topology. |

Zero or missing measurements have no filled bar or rim; the numeric inspector distinguishes them. Small positive values can be imperceptible. Empty spoke rails, rim backings, fixed radial supports and the dark hub disk are omitted. Filled measurements and their scales are unchanged. Panel rows retain daily totals, while hovering or selecting a block, transaction bar or fee bar reveals that particular block’s figures. Selecting a component highlights related components and explains their role.

The guard rims evoke proof of work making ledger history costly to rewrite. They are not independent security scores: estimated hashrate is inferred from difficulty and block production. Fees contribute to mining incentives alongside the block subsidy. Address activity is daily context, not an inferred set of address-to-block edges. Full nodes independently validate blocks; the visualization does not measure that validation or attack probability.

The study reuses all 150 dates and 22,374 verified block records. `public/data/block-fees.json` is generated by `pipeline/block_fees.mjs` from the existing release and contains block heights and exact integer-satoshi fees. Generation checks block identities, UTC dates and daily transaction/fee totals before emitting shared scale maxima. No new provider, retrieval or BigQuery query is required. The existing distinction between block-header UTC days and CoinMetrics normalized days remains explicit.

Optional next steps are verified predecessor hashes for genuine cryptographic chain links, and sampled transaction Merkle proofs against verified headers, fetched only when a block is inspected. Until those checks are complete, the chain track indicates consecutive heights only. The detailed retrieval plan below remains applicable; a sampled proof can avoid downloading an entire large block’s transaction-ID list.

## Earlier ledger study

The original Timechain, Ribbon and Tapestry experiment is preserved at [`/timechain.html?study=ledger`](http://localhost:5173/timechain.html?study=ledger). It uses its own layout and stylesheet, loaded only for that URL.

Three arrangements use identical records and scales: **Timechain** is an open spiral, **Ribbon** is a serpentine sequence, and **Tapestry** is a softly curved field. Each tile is one actual block. Hover or click a tile or inscription for its figures, select a signal to inspect its encoding, and compare any of the 150 existing days. Layout changes do not change the data.

| Measurement | Study encoding |
| --- | --- |
| Blocks | One tile per block, ordered by height. Thin connectors join consecutive heights only; omitted heights remain unlinked. These links do not independently validate previous-block hashes. |
| Block weight | Tile height = `0.06 + 0.70 × weight / 4,000,000 WU`. The fixed base preserves visibility. The reference is modern block weight, not an early consensus limit. |
| Transactions | Ivory inscription length is linear in the block's non-coinbase count, divided by the release maximum of 7,928. |
| Fees | Copper inscription length = `log1p(block fees in BTC) / log1p(37.62561499 BTC)`. Bar lengths are not additive; daily fees still sum exact integer satoshis. |
| Difficulty | Inner foundation rail uses the existing `log10(mean difficulty) / log10(release maximum)` scale. |
| Estimated hashrate | Outer foundation rail uses the existing linear EH/s release scale. |
| Active addresses | `floor(addresses / 1,000)` stipples, capped at 1,500. These are not people or peer locations. |

The dim foundation rails show full-scale references. Zero or missing values have no filled mark; the inspector distinguishes them. Tile width/depth, layout, spacing, material, light, dot positions and camera motion are presentation choices, not additional measurements. Header UTC dates and CoinMetrics normalized days retain their existing distinction. Header-time differences are not measured mining intervals and can be negative.

### Optional data extensions

1. **Derive meaningful additions from the current records first.** A witness strand can use `baseBytes = (weight - size) / 3` and `extraBytes = size - baseBytes`, following [BIP141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki). These extra serialization bytes include witness-format overhead; they are not signature counts or adoption percentages. A scheduled-subsidy strand can use block height and Bitcoin Core's integer halving rule, with the [210,000-block mainnet interval](https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp) and [subsidy implementation](https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp). Scheduled subsidy is not actual claimed reward, circulating supply or spendable supply; genesis and unclaimed rewards need explicit treatment.
2. **Retrieve and verify actual headers.** Extend the cached block records with previous-block hash, Merkle root, version, nonce, target bits and median time past through [Esplora's block/header endpoints](https://github.com/Blockstream/esplora/blob/master/API.md). The 22,374 raw 80-byte headers total approximately 1.79 MB before metadata. Match existing hashes, recompute header hashes, check target and predecessor links, and retain request provenance. This would support genuine chain links and exact work; it would not constitute full transaction/consensus replay or measure energy consumption.
3. **Unfold one real Merkle tree on demand.** Retrieve the selected block's ordered transaction IDs and verify the computed tree root against its header. Preserve Bitcoin's transaction order and odd-leaf handling from the [block reference](https://developer.bitcoin.org/reference/block_chain.html). Lazy loading avoids shipping all 39,806,678 transaction IDs across the selected days—about 2.55 GB of hexadecimal characters alone. A Merkle tree depicts transaction commitment, not a peer or payment-flow network.
4. **Add distributions only when the design calls for them.** [Bitcoin Core `getblockstats`](https://bitcoincore.org/en/doc/30.0.0/rpc/blockchain/getblockstats/) can provide per-block fee statistics from an appropriately retained node; its fee-rate percentiles are weighted by weight units, not transaction counts. For exact daily transaction bands, follow the existing [BigQuery preparation and ingestion plan](pipeline/README.md#transaction-level-bigquery-data): verify project ID, access, live schema and coverage; dry-run a small pilot; set a maximum billed-byte limit; then reconcile transaction counts and satoshi sums before expanding. No BigQuery query or additional data download has been run for this study.

Grid view hides annotations and the Labels switch. In an individual day, the **Labels** switch beside Reset view toggles detail annotations in Gear, Atom and Classic together, including Start / End captions and signal labels. Labels are available with the side panes open or hidden, including the full-screen presentation. The switch controls both signal and Start / End captions, and the preference is saved in local browser storage. Each style uses its own drawn teeth and ring planes as label anchors. Atom and Classic address captions follow an actual moving dot. Signal captions remain close to their projected geometry with short leaders and local spacing as the camera rotates or zooms. Empty geometry has no signal caption. Endpoint diamond markers have been removed; only optional height captions remain.

In an individual day, the Previous/Next arrows beside the Labels switch step through curated snapshot dates. They pause playback, clear the previous block inspection and disable at the first/last date. The arrows remain available when labels are disabled; grid view shows neither.
