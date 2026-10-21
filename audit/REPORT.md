# Bitcoin geometry audit — current release

Baseline commit: `dc2fa3bd12e1a2847c0ea72054f32da9b40e9f01`. Working branch: `codex/data-integrity-audit`. Source collection: October 20–21, 2026. Selected-data cutoff: **October 19, 2026 UTC**. This report supersedes the archived [129-date phase](REPORT-129.md).

## Data result

The current release contains **150 unique dates and 22,374 unique block heights**. It retains 103 of the preceding 129 dates, adds 47 dates, and removes 26 routine or superseded selections. Each entry has a historical label, category, context and source link. The selection spans Bitcoin milestones, markets, policy, wars, elections, COVID, AI, quantum developments and gold milestones, plus a latest-day comparison. It is editorial rather than an objective top-150 ranking.

All 47 additions have full block extracts. The date for surveillance disclosures was aligned to the cited source’s June 6, 2013 publication date and queried again. CoinMetrics daily data was refreshed. Completed historical explorer extracts are reused; a forced full refetch is available. Removed dates remain in the raw archive.

## Accuracy corrections

- Removed synthetic fee distributions, unsupported health/concentration/stress scores, and fictional data fallbacks.
- Preserved unknown values as null, distinguished provider estimates, and corrected historical mempool units and aggregation in retained audit fields.
- Counted transactions as the sum of each block’s transaction count minus one coinbase per block.
- Summed block fees in integer satoshis before conversion to BTC. Fee totals refer to exactly the blocks used by the geometry.
- Computed mean weight from individual weights. Every tooth uses its own weight rather than the daily average.
- Stabilized mean difficulty by subtracting a reference before averaging; identical large values no longer accumulate floating-point drift.
- Used shared release-wide scales and documented logarithmic difficulty, minimum tooth stem and particle rounding/caps.
- Removed non-core metrics from the UI. Seven measurements now map to seven aspects of the geometry, with no hidden byte-width or transaction-brightness encoding.
- Replaced generic labels and incorrect date/record claims with sourced context. Event coincidence is explicitly not treated as causation.

At the original audit phase, all 15,960 original block tuples matched fresh explorer records exactly. The principal issues were interpretation, derived values and presentation. That original comparison remains archived; the current curated release intentionally excludes some original dates.

## Seven-signal reconciliation

| Quantity | Checked against |
| --- | --- |
| Block count | Number of unique raw block records on the UTC header day. |
| Transactions | Raw transaction counts minus coinbase count. |
| Mean / individual weight | Raw block WU values; shared 4,000,000-WU visual reference. |
| Fees | Exact integer-satoshi sum from mempool.space block extras. |
| Difficulty | Independent weighted average over unique difficulty values; constant days retain the exact provider value. |
| Hashrate | CoinMetrics HashRate in TH/s divided by 1,000,000 for EH/s. |
| Active addresses | CoinMetrics AdrActCnt, with floor/cap particle encoding. |

All seven reconcile to their saved sources on all dates. The only missing core quantity is the genesis hashrate estimate. The largest address count in this selection is 1,344,921, so neither particle cap truncates a current snapshot. Whole-satoshi precision is retained in block fees; panel formatting rounds some daily overview numbers for readability.

## Sources, windows and completeness

Block data uses raw miner-supplied header timestamps in `[00:00, next 00:00)` UTC. Blockchain.com and mempool.space hashes/timestamps are matched. Internal gaps and 30 neighboring heights outside each endpoint are checked; recovered boundary blocks additionally require Blockstream agreement. The first audit recovered omissions on April 8, 2020 and October 5–6, 2026. These bounded checks are not a full Bitcoin consensus replay.

CoinMetrics hashrate and active addresses use normalized Median-Time-Past dates, a different time window. Two source-count disagreements remain visible in provenance: genesis (1 header record versus CoinMetrics 0) and January 9, 2009 (14 versus 19). These are not silently replaced.

Per-block fees are from mempool.space. They have not been independently recomputed from transactions in BigQuery. The prepared 150-date and 47-date SQL batches are optional cross-check/research tools. Google Cloud project number 952270481208 is recorded, but its project ID, IAM/billing access and query costs remain unverified because Console browser access was blocked. No BigQuery dry run, billed query or import occurred. Mempool/transfer/histogram/output-band fields remain audit evidence and are not visible core signals.

## UI and interaction changes

Atom and Classic remain switchable. Both use the same values; Atom distributes teeth around a nucleus and tilts four orange orbits. The side panes share neutral styling. The default opens the Atom grid with panels hidden; each grid sculpture has a UTC date/event caption, and focused views retain the selected day at the lower left. The legend renders the actual fourth-halving measurements with the same scene code and overlaid labels. About, Legend, Guide and Sources use compact topic selection instead of scrolling pages.

Block inspection now appears at the top of the side pane and includes actual height, size, weight, transaction counts, fees, difficulty, UTC header time and explorer link. Wider invisible hit targets preserve the drawn dimensions. Point selection no longer uses Three.js’s excessively broad default tolerance. Instance bounds refresh after date/style changes; different teeth have distinct pin identities.

Grid/detail switches remount the canvas to clear stale scene objects and controls; style changes rebuild the sculpture. Camera reset restores position, up vector, orientation, zoom and projection. Smooth close zoom is restored. The scene has its own responsive viewport and 2/3/5-column grid. Mobile has safe-area spacing, touch navigation and a collapsible inspector. Hide panels retains the left Grid/Play/Orbit controls.

## Validation and remaining limits

- **23 tests pass**, including all-date arithmetic reconciliation, missingness, source time windows, invalid-data rejection, complete published block sets/details, curated-date coverage, both layouts’ raycasts, pin identity, instance-bound updates, repeated camera resets and mobile/tablet/desktop grid projection.
- TypeScript and Vite production build pass. Data audit validates 150 snapshots / 22,374 blocks.
- Earlier dependency remediation reduced npm’s report from 14 vulnerabilities (10 high) to zero; receipts are retained.
- The user manually tested the preceding release and explicitly approved its publication. The later default-view/caption update passes initial server-render checks, all 150 UTC captions in both variants, and caption projection checks at eight viewport sizes. Assistant browser visual/end-to-end verification remains unavailable because of a saved permission denial. User screenshots informed the scene and layout fixes. These checks do not establish that every rendered device layout is correct.
- Vite warns about the approximately 1.22 MB minified / 337 KB gzip JS bundle. Real-device GPU/loading profiling and a full keyboard/focus audit remain worthwhile.
- Published the current default-view/caption release to Cloudflare Pages production branch `main`: https://bitcoin-geometry.com (deployment https://54ea6d96.bitcoin-data-driven-geometry.pages.dev). All 162 served files match the validated local build byte-for-byte, with zero verification errors. See `deployment.json`, `caption-release-validation.json` and `deployment-verification-production.json`.

Evidence: `curated-150-events.json`, `curation-150.json`, `data-audit.json`, `block-comparison.json`, `fee-cross-check.json`, `npm-audit-before.json`, `npm-audit-after.json`, `pipeline/raw/`, `public/data/provenance.json`, and per-date `public/data/block-details/`. Earlier findings and the first expansion batch are preserved in `REPORT-129.md` and `selected-dates-2026-10-19.json`.
