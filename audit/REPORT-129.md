# Bitcoin geometry accuracy audit

Audit baseline: commit `dc2fa3bd12e1a2847c0ea72054f32da9b40e9f01` from `vyalya/bitcoin-data-driven-geometry`. Working branch: `codex/data-integrity-audit`. Source collection: October 20–21, 2026; selected-data cutoff: **October 19, 2026 UTC**.

## Result and scope

The local code, data pipeline, public data, geometry mappings, descriptions, metadata, dependencies and refresh workflow were audited and corrected. The dataset grew from **105 dates / 15,960 block records** to **129 dates / 19,215 block records**. All original 15,960 block tuples matched the fresh explorer records exactly. The principal defects were interpretation, missingness, units, derived distributions and presentation—not corruption of the original block tuples.

The repository has not been pushed or deployed. This is not a claim that all upstream data has been independently recomputed from a full node. Transaction-level distributions and browser interaction testing remain incomplete for the reasons below.

## Findings and corrections

| Severity | Original issue | Correction |
| --- | --- | --- |
| High | Fee tiers inferred from aggregate daily fees were presented as sat/vB distributions. | Removed synthetic distributions. A separate total-fee arc uses actual per-block fee sums. Histograms require complete transaction-level extracts. |
| High | Unknown SQL values became zeros, including unqueried large-output counts. | Missing measurements remain null; unavailable glyphs are absent and the inspector explains coverage. |
| High | Mempool bytes were stored/displayed as MB. | Convert bytes / 1,000,000. Also replace the last daily sample with the explicitly defined arithmetic sample mean. |
| High | Current/rolling mining-pool concentration was assigned to historical dates. | Removed backdated HHI and unsupported network-health/stress scores. |
| High | Daily fee and transaction totals were combined with block geometries without distinguishing timestamp conventions. | Geometry, transaction count and fee totals use the same block-header UTC day. CoinMetrics normalized daily figures remain labeled comparators/estimates. |
| High | Failed data loads could silently show stale/fabricated fallback snapshots. | Show a visible load error; retain only an empty loading placeholder. |
| Medium | `86400 / blockCount` was described as a measured mean block interval and settlement-health signal. | Label as effective spacing; production arc is count / 144, capped only visually. |
| Medium | Estimated transferred BTC was described as raw output value from different sources. | Label Blockchain.com's change-adjusted estimate correctly. |
| Medium | Hardcoded “all-time” maxima and per-date brightness scaling distorted comparisons. | Use shared dataset scales saved with each release; disclose logarithmic difficulty and display caps. |
| Medium | Minimum arc lengths made zero/very small values look positive. | Zero/null yields no arc. Tiny positive values can be imperceptible; the numeric panel preserves the value. |
| Medium | Particles implied users or whales; their purported size encoding was not implemented. | Equal-sized particles represent approximate active-address counts; seeded positions and motion are explicitly decorative. |
| Medium | Hardcoded narration and event labels included unsupported causal, date and record claims. | Replace with measured narration and sourced context. Preserve 97 unverified original entries in the audit archive and withhold their context from the UI. This does not mean all 97 claims are false. |
| Medium | Date changes could leave an inspector showing a block selected on a previous date; pinning did not preserve panel context consistently. | Clear context on date changes and retain a separate pinned context. Browser verification remains pending. |
| Medium | Refresh workflow called a nonexistent Parquet exporter; source extracts were not reproducible from the checkout. | Replace DuckDB staging with checked-in JSON extracts, correct workflow scripts, validate before export and retain provenance. |
| Medium | Metadata/documentation described nonexistent controls, outdated sources and an unsupported blanket CC0 license. | Rewrite README, pipeline docs, page metadata, noscript content and llms.txt. Preserve historical changelog as history. |
| Dependency | Initial npm audit reported 14 vulnerabilities, including 10 high. | Apply compatible dependency updates and remove unused native DuckDB. Final npm audit: zero reported vulnerabilities. |

### Concrete examples

- **2017-12-20 mempool:** the old value was `107199193 MB` (actually a byte observation). The corrected daily sample mean is **105.40170978645833 MB**. The two changes are both unit conversion and sample aggregation.
- **2010-05-22 mempool:** old `0`; corrected `null`, because the source does not cover that date.
- **2024-04-20 fees:** CoinMetrics reports **1,206.46658440 BTC**, while the displayed header-day blocks sum to **1,257.71544525 BTC**. The ring now uses the latter, retaining the former as a comparator.
- **2009-01-09 blocks:** 14 header-day blocks versus CoinMetrics' 19. The actual genesis block, on **2009-01-03**, is now its own snapshot. Genesis has one header record versus the provider's zero count.
- The old “first 1 ZH/s” context for January 3, 2026 was not supported: the fetched CoinMetrics daily series already exceeds 1,000 EH/s on April 4, 2025. This is a daily estimator threshold, not a universal claim across all averaging windows.
- ETF approval on January 10, 2024 is distinct from January 11 trading. Both dates now have their own entries.

## Time, completeness and validation

[CoinMetrics documents Median-Time-Past normalization](https://gitbook-docs.coinmetrics.io/network-data/methodologies/normalizing-block-times), while this project's block sets use raw miner-supplied header timestamps. That documented difference explains why day totals need not agree; it is not proof that every individual discrepancy has been fully reconciled. The cross-check records fee differences on 118 of 129 dates. Fee geometries now sum the fees attached to exactly the displayed blocks, without implying that CoinMetrics is wrong. Hashrate and active addresses retain the provider's explicitly labeled normalized windows.

Daily explorer listings initially missed three boundary records, recovered for April 8, 2020; October 5 and 6, 2026. All 129 days subsequently received a scan of 30 neighboring heights outside each endpoint plus internal height gaps; that additional pass found no more omissions. Explorer hashes/timestamps are matched; added records also require agreement from Blockstream. This is a bounded explorer cross-check, not a complete replay of Bitcoin consensus rules.

Per-block fee totals are from mempool.space and have not yet been independently checked against the prepared BigQuery transaction sums. The importer will reject mismatched fee totals or incomplete non-coinbase transaction counts. It aggregates fees before unnesting outputs to prevent duplication.

Mempool observations are provider-specific, with explicit intraday coverage checks. **33 dates** have unavailable mempool data. On October 19, 2026 the mempool and estimated-transfer feeds did not yet cover the date; these values remain null rather than carrying forward an old observation. There are no transaction-level fee histograms or output-size distributions for any of the 129 dates yet.

## The 24 added dates

| Dates | Selection reason |
| --- | --- |
| 2009-01-03 | Actual genesis block. |
| 2017-08-24 | SegWit activation anchor. |
| 2021-11-14 | Taproot activation anchor. |
| 2024-01-10 | US spot Bitcoin ETP approval, distinct from trading the following day. |
| 2026-04-15, 05-15, 06-15, 07-15, 08-15, 09-15, 10-15 | Fixed monthly baselines. |
| 2026-05-08, 05-09, 05-10 | Maximum CoinMetrics FeeTotNtv in the expansion window and adjacent-day controls. |
| 2026-06-02, 06-03, 06-04 | Minimum CoinMetrics block count and adjacent controls. |
| 2026-07-21, 07-22, 07-23 | Minimum CoinMetrics estimated hashrate and adjacent controls. |
| 2026-10-04, 10-05, 10-06 | Maximum CoinMetrics transaction count/hashrate and adjacent controls. |
| 2026-10-19 | Latest selected completed day. |

The expansion window is April 10–October 19, 2026. These are source-specific extrema, not news/price explanations or universal historical records. Daily metrics and block geometry data for this entire batch have been pulled. Selection reasons are machine-readable in `selected-dates-2026-10-19.json`.

The next transaction query should cover **all 129 dates**, because the original histograms were also inferred. A smaller 24-date query is prepared for a first batch; estimate both before choosing. The pipeline instructions include both literal SQL files and import commands.

## Follow-up UI correction

The user supplied a live-preview screenshot showing legend descriptions squeezed into the old 36-pixel icon column. The legend now uses full-width text cards, styled headings/descriptions, and mobile tab sizing. The development preview updates in place. Automated browser confirmation remains unavailable.

## Verification and outstanding work

Completed locally:

- 14 regression tests pass, covering null/zero semantics, units, intraday coverage, fee partitions, shared scales, valid dates/blocks, all published block sets and visible loader failure.
- TypeScript check and Vite production build pass.
- Data audit validates 129 snapshots and 19,215 unique block heights.
- Original block comparison: 105 dates, 15,960 tuples, zero mismatches.
- Dependency audit: zero reported vulnerabilities after updates.

Outstanding:

1. **BigQuery access:** project number `952270481208` is recorded, but its ID, IAM access, billing, table freshness and query scan size remain unverified. A saved browser permission setting blocked Google Cloud Console after chat authorization. No dry run, billed query or transaction import occurred.
2. **Browser verification:** local-preview access was denied. Visual inspection of the rebuilt page, WebGL behavior, mobile layout, keyboard paths and end-to-end interaction checks have not run. Static review and compilation do not replace these checks.
3. **Editorial verification:** 97 original contexts remain archived and withheld. Restore each only with supporting evidence; do not reintroduce causal market narratives solely because a date coincides with an event.
4. **Performance:** production JS is approximately 1.19 MB minified / 328 KB gzip and triggers Vite's chunk-size warning. The 3D renderer still warrants profiling and splitting; see the UI/UX proposals.
5. **Publication:** review the local changes and complete the outstanding data/visual checks before release. Nothing has been pushed or deployed in this audit.

## Evidence files and definitions

- `baseline-snapshots.json`, `baseline-blocks.json`: original committed data.
- `original-editorial.json`: original labels and prose.
- `data-audit.json`: field-by-field changes and unavailable dates.
- `block-comparison.json`: original block tuple cross-check.
- `fee-cross-check.json`: CoinMetrics versus header-day block fees; differing time conventions apply.
- `npm-audit-before.json`, `npm-audit-after.json`: dependency evidence.
- `../pipeline/raw/`: normalized extracts with request provenance.
- `source-responses/`: local original responses (ignored by Git).
- `../public/data/provenance.json`: published definitions, request metadata, scales and limitations.

Primary definitions: [CoinMetrics hashrate](https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/mining/hash-rate), [active addresses](https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/addresses/active-addresses), [Blockchain.com mempool bytes](https://www.blockchain.com/explorer/charts/mempool-size), [estimated transaction value](https://www.blockchain.com/explorer/charts/estimated-transaction-volume), [BIP141 weight and virtual size](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki), [Esplora API](https://github.com/Blockstream/esplora/blob/master/API.md), [Bitcoin ETL schema/units](https://github.com/blockchain-etl/bitcoin-etl), [SEC approval statement](https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023).
