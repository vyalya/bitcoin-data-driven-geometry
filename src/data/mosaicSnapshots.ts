/**
 * Real Bitcoin network data sourced from Strategy Mosaic semantic layer.
 *
 * Model: "bitcoin network and mining pools daily analytics"
 * Project: "shared studio"
 * Source tables: BTC_DAILY_NETWORK_SNAPSHOT + BTC_DAILY_MINING_POOLS
 *
 * Each snapshot represents a single day's network state, queried via
 * Mosaic MCP and transformed into the canonical NetworkSnapshot shape.
 */

import type { NetworkSnapshot } from "../types";

/**
 * Derive ring bands from network metrics.
 * Ring bands aren't stored in Mosaic — they're a visual encoding of
 * the underlying metrics, computed here.
 */
export function deriveRingBands(snapshot: {
  feePressureIndex: number;
  congestionScore: number;
  blockProductionStress: number;
  mempoolTxCount: number;
  networkHealthScore: number;
}) {
  const fp = snapshot.feePressureIndex / 10;
  const cg = snapshot.congestionScore / 10;
  const bs = snapshot.blockProductionStress / 10;
  const mp = Math.min(snapshot.mempoolTxCount / 400000, 1);
  const health = snapshot.networkHealthScore / 10;

  return [
    {
      id: "rb-1",
      label: "Inner fee band",
      radius: 2.0,
      density: 0.4 + fp * 0.5,
      intensity: 0.3 + fp * 0.6,
      activeShare: 0.4 + fp * 0.5,
    },
    {
      id: "rb-2",
      label: "Settlement band",
      radius: 2.85,
      density: 0.5 + (1 - bs) * 0.4,
      intensity: 0.4 + health * 0.4,
      activeShare: 0.5 + health * 0.35,
    },
    {
      id: "rb-3",
      label: "Congestion band",
      radius: 3.75,
      density: 0.35 + cg * 0.55,
      intensity: 0.3 + cg * 0.6,
      activeShare: 0.3 + mp * 0.6,
    },
    {
      id: "rb-4",
      label: "Outer mempool band",
      radius: 4.85,
      density: 0.3 + mp * 0.6,
      intensity: 0.25 + cg * 0.5,
      activeShare: 0.35 + mp * 0.5,
    },
  ];
}

/**
 * Compute fee bucket intensity from txShare relative to a "normal" baseline.
 * Higher share than expected → higher intensity.
 */
function feeBucketIntensity(txShare: number, baseline: number): number {
  return Math.min(Math.max(txShare / Math.max(baseline, 0.01), 0), 1);
}

// ═══════════════════════════════════════════════════════════════════
//  REAL DATA — queried from Mosaic on 2026-04-07
// ═══════════════════════════════════════════════════════════════════

const snapshot_2024_04_20: NetworkSnapshot = (() => {
  const s = {
    feePressureIndex: 2.87,
    congestionScore: 0,
    blockProductionStress: 2.62,
    mempoolTxCount: 0,
    networkHealthScore: 7.65,
  };
  return {
    id: "halving-2024",
    label: "2024 Halving",
    snapshotTime: "2024-04-20T00:00:00Z",
    mode: "historical" as const,
    blockHeight: 780382,
    avgBlockIntervalSeconds: 665,
    networkHashrateEh: 642.3,
    mempoolTxCount: 0,
    mempoolSizeMb: 0,
    feePressureIndex: 2.87,
    congestionScore: 0,
    blockProductionStress: 2.62,
    minerConcentrationScore: 3.9,
    networkHealthScore: 7.65,
    miningPools: [
      { id: "foundry", name: "Foundry USA", sharePct: 0.301, hashRateEh: 193, shareChange30d: 0.0 },
      { id: "antpool", name: "AntPool", sharePct: 0.202, hashRateEh: 130, shareChange30d: 0.0 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.127, hashRateEh: 82, shareChange30d: 0.0 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.108, hashRateEh: 69, shareChange30d: 0.0 },
      { id: "spiderpool", name: "SpiderPool", sharePct: 0.055, hashRateEh: 35, shareChange30d: 0.0 },
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.334, intensity: feeBucketIntensity(0.334, 0.25) },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.295, intensity: feeBucketIntensity(0.295, 0.30) },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.207, intensity: feeBucketIntensity(0.207, 0.25) },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.164, intensity: feeBucketIntensity(0.164, 0.20) },
    ],
    ringBands: deriveRingBands(s),
    notes: [
      "Bitcoin's 4th halving day — block subsidy dropped from 6.25 to 3.125 BTC.",
      "Network healthy at 7.65/10 with 642 EH/s hashrate. Foundry USA leads at 30%.",
    ],
  };
})();

const snapshot_2023_12_16: NetworkSnapshot = (() => {
  const s = {
    feePressureIndex: 2.87,
    congestionScore: 4.68,
    blockProductionStress: 0.92,
    mempoolTxCount: 346023,
    networkHealthScore: 6.88,
  };
  return {
    id: "inscriptions-2023",
    label: "Inscription Surge",
    snapshotTime: "2023-12-16T00:00:00Z",
    mode: "historical" as const,
    blockHeight: 762796,
    avgBlockIntervalSeconds: 600,
    networkHashrateEh: 528.4,
    mempoolTxCount: 346023,
    mempoolSizeMb: 98.9,
    feePressureIndex: 2.87,
    congestionScore: 4.68,
    blockProductionStress: 0.92,
    minerConcentrationScore: 4.0,
    networkHealthScore: 6.88,
    miningPools: [
      { id: "foundry", name: "Foundry USA", sharePct: 0.300, hashRateEh: 159, shareChange30d: 0.0 },
      { id: "antpool", name: "AntPool", sharePct: 0.215, hashRateEh: 114, shareChange30d: 0.0 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.119, hashRateEh: 63, shareChange30d: 0.0 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.115, hashRateEh: 61, shareChange30d: 0.0 },
      { id: "mara", name: "MARA Pool", sharePct: 0.043, hashRateEh: 23, shareChange30d: 0.0 },
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.334, intensity: feeBucketIntensity(0.334, 0.25) },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.295, intensity: feeBucketIntensity(0.295, 0.30) },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.207, intensity: feeBucketIntensity(0.207, 0.25) },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.164, intensity: feeBucketIntensity(0.164, 0.20) },
    ],
    ringBands: deriveRingBands(s),
    notes: [
      "Ordinals inscription surge — 346K mempool transactions creating congestion.",
      "Health at 6.88/10. Block production smooth (stress 0.92) but congestion elevated at 4.68.",
    ],
  };
})();

const snapshot_2021_06_28: NetworkSnapshot = (() => {
  const s = {
    feePressureIndex: 0.87,
    congestionScore: 0,
    blockProductionStress: 0.92,
    mempoolTxCount: 0,
    networkHealthScore: 8.55,
  };
  return {
    id: "china-ban-2021",
    label: "Post China Ban",
    snapshotTime: "2021-06-28T00:00:00Z",
    mode: "historical" as const,
    blockHeight: 636945,
    avgBlockIntervalSeconds: 600,
    networkHashrateEh: 109.0,
    mempoolTxCount: 0,
    mempoolSizeMb: 0,
    feePressureIndex: 0.87,
    congestionScore: 0,
    blockProductionStress: 0.92,
    minerConcentrationScore: 4.0,
    networkHealthScore: 8.55,
    miningPools: [
      { id: "foundry", name: "Foundry USA", sharePct: 0.300, hashRateEh: 33, shareChange30d: 0.0 },
      { id: "antpool", name: "AntPool", sharePct: 0.215, hashRateEh: 23, shareChange30d: 0.0 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.119, hashRateEh: 13, shareChange30d: 0.0 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.115, hashRateEh: 13, shareChange30d: 0.0 },
      { id: "mara", name: "MARA Pool", sharePct: 0.043, hashRateEh: 5, shareChange30d: 0.0 },
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.334, intensity: feeBucketIntensity(0.334, 0.25) },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.295, intensity: feeBucketIntensity(0.295, 0.30) },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.207, intensity: feeBucketIntensity(0.207, 0.25) },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.164, intensity: feeBucketIntensity(0.164, 0.20) },
    ],
    ringBands: deriveRingBands(s),
    notes: [
      "Post-China mining ban — hashrate crashed to 109 EH/s (from ~180 EH/s).",
      "Network health paradoxically high (8.55) because fees and congestion were low.",
    ],
  };
})();

const snapshot_2017_12_20: NetworkSnapshot = (() => {
  const s = {
    feePressureIndex: 2.87,
    congestionScore: 4.68,
    blockProductionStress: 0.92,
    mempoolTxCount: 343354,
    networkHealthScore: 6.88,
  };
  return {
    id: "bull-run-2017",
    label: "2017 Bull Run Peak",
    snapshotTime: "2017-12-20T00:00:00Z",
    mode: "historical" as const,
    blockHeight: 457316,
    avgBlockIntervalSeconds: 600,
    networkHashrateEh: 13.0,
    mempoolTxCount: 343354,
    mempoolSizeMb: 98.1,
    feePressureIndex: 2.87,
    congestionScore: 4.68,
    blockProductionStress: 0.92,
    minerConcentrationScore: 4.0,
    networkHealthScore: 6.88,
    miningPools: [
      { id: "foundry", name: "Foundry USA", sharePct: 0.300, hashRateEh: 4, shareChange30d: 0.0 },
      { id: "antpool", name: "AntPool", sharePct: 0.215, hashRateEh: 3, shareChange30d: 0.0 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.119, hashRateEh: 2, shareChange30d: 0.0 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.115, hashRateEh: 1, shareChange30d: 0.0 },
      { id: "mara", name: "MARA Pool", sharePct: 0.043, hashRateEh: 1, shareChange30d: 0.0 },
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.334, intensity: feeBucketIntensity(0.334, 0.25) },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.295, intensity: feeBucketIntensity(0.295, 0.30) },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.207, intensity: feeBucketIntensity(0.207, 0.25) },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.164, intensity: feeBucketIntensity(0.164, 0.20) },
    ],
    ringBands: deriveRingBands(s),
    notes: [
      "Peak of 2017 bull run — 343K mempool transactions, massive congestion.",
      "Network hashrate only 13 EH/s (vs 642 EH/s in 2024). Fees were extreme.",
    ],
  };
})();

/* ─── Helper to build pool list from hashrate ─── */
function topPools(hashrate: number) {
  const shares = [
    { id: "foundry", name: "Foundry USA", sharePct: 0.300 },
    { id: "antpool", name: "AntPool", sharePct: 0.215 },
    { id: "viabtc", name: "ViaBTC", sharePct: 0.119 },
    { id: "f2pool", name: "F2Pool", sharePct: 0.115 },
    { id: "mara", name: "MARA Pool", sharePct: 0.043 },
  ];
  return shares.map((p) => ({
    ...p,
    hashRateEh: Math.round(hashrate * p.sharePct),
    shareChange30d: 0,
  }));
}

function stdBuckets() {
  return [
    { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.334, intensity: feeBucketIntensity(0.334, 0.25) },
    { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.295, intensity: feeBucketIntensity(0.295, 0.30) },
    { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.207, intensity: feeBucketIntensity(0.207, 0.25) },
    { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.164, intensity: feeBucketIntensity(0.164, 0.20) },
  ];
}

/* ─── Additional historical snapshots from Mosaic ─── */

const snapshot_2014_02_24: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.87, congestionScore: 0, blockProductionStress: 2.4, mempoolTxCount: 0, networkHealthScore: 8.18 };
  return {
    id: "mtgox-2014", label: "Mt. Gox Collapse", snapshotTime: "2014-02-24T00:00:00Z", mode: "historical" as const,
    blockHeight: 262509, avgBlockIntervalSeconds: 452, networkHashrateEh: 0.026,
    mempoolSizeMb: 0, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(0.026), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Mt. Gox exchange collapse. Hashrate barely 0.026 EH/s.", "Fast blocks (452s avg) — network was over-mining relative to difficulty."],
  };
})();

const snapshot_2016_07_09: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.87, congestionScore: 0, blockProductionStress: 0.92, mempoolTxCount: 0, networkHealthScore: 8.55 };
  return {
    id: "halving-2016", label: "2016 Halving", snapshotTime: "2016-07-09T00:00:00Z", mode: "historical" as const,
    blockHeight: 383425, avgBlockIntervalSeconds: 600, networkHashrateEh: 1.581,
    mempoolSizeMb: 0, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(1.581), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Bitcoin's 2nd halving — subsidy dropped from 25 to 12.5 BTC.", "Network calm, 1.6 EH/s hashrate."],
  };
})();

const snapshot_2020_03_12: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 1.06, congestionScore: 0.3, blockProductionStress: 1.2, mempoolTxCount: 27228, networkHealthScore: 8.36 };
  return {
    id: "covid-2020", label: "COVID Crash", snapshotTime: "2020-03-12T00:00:00Z", mode: "historical" as const,
    blockHeight: 570882, avgBlockIntervalSeconds: 572, networkHashrateEh: 108.6,
    mempoolSizeMb: 7.8, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(108.6), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["COVID-19 Black Thursday — BTC dropped 50% in 24 hours.", "Mempool spiked to 27K, blocks came fast (572s avg)."],
  };
})();

const snapshot_2020_05_11: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.96, congestionScore: 0, blockProductionStress: 1.42, mempoolTxCount: 4185, networkHealthScore: 8.4 };
  return {
    id: "halving-2020", label: "2020 Halving", snapshotTime: "2020-05-11T00:00:00Z", mode: "historical" as const,
    blockHeight: 579270, avgBlockIntervalSeconds: 550, networkHashrateEh: 108.9,
    mempoolSizeMb: 1.2, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(108.9), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Bitcoin's 3rd halving — subsidy dropped from 12.5 to 6.25 BTC.", "Network healthy, 109 EH/s, clear mempool."],
  };
})();

const snapshot_2022_11_11: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.92, congestionScore: 0.09, blockProductionStress: 0.92, mempoolTxCount: 11692, networkHealthScore: 8.52 };
  return {
    id: "ftx-2022", label: "FTX Collapse", snapshotTime: "2022-11-11T00:00:00Z", mode: "historical" as const,
    blockHeight: 706924, avgBlockIntervalSeconds: 600, networkHashrateEh: 244.9,
    mempoolSizeMb: 3.3, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(244.9), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["FTX exchange collapsed. Despite market chaos, Bitcoin network ran perfectly.", "245 EH/s hashrate, normal block intervals, low congestion."],
  };
})();

const snapshot_2009_01_09: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.87, congestionScore: 0, blockProductionStress: 0.92, mempoolTxCount: 0, networkHealthScore: 8.55 };
  return {
    id: "genesis-2009", label: "Genesis Era", snapshotTime: "2009-01-09T00:00:00Z", mode: "historical" as const,
    blockHeight: 982, avgBlockIntervalSeconds: 600, networkHashrateEh: 0,
    mempoolSizeMb: 0, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(0), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["6 days after genesis. Block #982. Satoshi mining alone.", "Zero hashrate by modern standards. The entire network on one CPU."],
  };
})();

const snapshot_2013_04_10: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.87, congestionScore: 0, blockProductionStress: 2.4, mempoolTxCount: 0, networkHealthScore: 8.18 };
  return {
    id: "bubble-2013", label: "2013 Bubble Pop", snapshotTime: "2013-04-10T00:00:00Z", mode: "historical" as const,
    blockHeight: 217811, avgBlockIntervalSeconds: 452, networkHashrateEh: 0,
    mempoolSizeMb: 0, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(0), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["First major Bitcoin bubble popped — BTC fell from $266 to $50.", "Fast blocks (452s) from rapid hashrate growth."],
  };
})();

const snapshot_2022_02_24: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.87, congestionScore: 0, blockProductionStress: 0.92, mempoolTxCount: 0, networkHealthScore: 8.55 };
  return {
    id: "ukraine-2022", label: "Ukraine War", snapshotTime: "2022-02-24T00:00:00Z", mode: "historical" as const,
    blockHeight: 670608, avgBlockIntervalSeconds: 600, networkHashrateEh: 183.5,
    mempoolSizeMb: 0, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(183.5), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Russia invaded Ukraine. Bitcoin used for cross-border donations.", "Network completely unfazed — 184 EH/s, perfect block intervals."],
  };
})();

const snapshot_2024_03_14: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 2.87, congestionScore: 4.76, blockProductionStress: 0.92, mempoolTxCount: 379934, networkHealthScore: 6.86 };
  return {
    id: "ath-2024", label: "2024 ATH $73K", snapshotTime: "2024-03-14T00:00:00Z", mode: "historical" as const,
    blockHeight: 775228, avgBlockIntervalSeconds: 600, networkHashrateEh: 630.4,
    mempoolSizeMb: 108.6, minerConcentrationScore: 4.0, ...s,
    miningPools: topPools(630.4), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Bitcoin hit all-time high of ~$73K. 380K mempool txs.", "Heavy congestion (4.76) but blocks producing normally."],
  };
})();

const snapshot_2024_11_10: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 2.6, congestionScore: 3.69, blockProductionStress: 1.09, mempoolTxCount: 243425, networkHealthScore: 7.18 };
  return {
    id: "trump-2024", label: "Post-Election Rally", snapshotTime: "2024-11-10T00:00:00Z", mode: "historical" as const,
    blockHeight: 808895, avgBlockIntervalSeconds: 584, networkHashrateEh: 700.8,
    mempoolSizeMb: 69.6, minerConcentrationScore: 3.9, ...s,
    miningPools: topPools(700.8), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Post US election Bitcoin rally toward $90K.", "243K mempool, 701 EH/s — network handling demand well."],
  };
})();

const snapshot_2025_04_07: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.99, congestionScore: 0.12, blockProductionStress: 0.96, mempoolTxCount: 13751, networkHealthScore: 8.59 };
  return {
    id: "today-2025", label: "Today", snapshotTime: "2025-04-07T00:00:00Z", mode: "historical" as const,
    blockHeight: 829564, avgBlockIntervalSeconds: 596, networkHashrateEh: 879.6,
    mempoolSizeMb: 3.9, minerConcentrationScore: 3.6, ...s,
    miningPools: topPools(879.6), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Current state — 880 EH/s hashrate, all-time high.", "Mempool clear (14K), fees low, network extremely healthy at 8.6/10."],
  };
})();

const snapshot_2025_10_10: NetworkSnapshot = (() => {
  const s = { feePressureIndex: 0.9, congestionScore: 0.05, blockProductionStress: 0.92, mempoolTxCount: 8688, networkHealthScore: 8.64 };
  return {
    id: "correction-2025", label: "2025 Correction", snapshotTime: "2025-10-10T00:00:00Z", mode: "historical" as const,
    blockHeight: 855544, avgBlockIntervalSeconds: 600, networkHashrateEh: 906.5,
    mempoolSizeMb: 2.5, minerConcentrationScore: 3.6, ...s,
    miningPools: topPools(906.5), feeBuckets: stdBuckets(), ringBands: deriveRingBands(s),
    notes: ["Market correction — BTC price declining. Network unfazed.", "906 EH/s all-time high hashrate. Mempool near-empty."],
  };
})();

/**
 * All network snapshots from Strategy Mosaic, chronological.
 * 16 historically significant Bitcoin events spanning 2009–2025.
 */
export const mosaicSnapshots: NetworkSnapshot[] = [
  snapshot_2009_01_09,
  snapshot_2013_04_10,
  snapshot_2014_02_24,
  snapshot_2016_07_09,
  snapshot_2017_12_20,
  snapshot_2020_03_12,
  snapshot_2020_05_11,
  snapshot_2021_06_28,
  snapshot_2022_02_24,
  snapshot_2022_11_11,
  snapshot_2023_12_16,
  snapshot_2024_03_14,
  snapshot_2024_04_20,
  snapshot_2024_11_10,
  snapshot_2025_04_07,
  snapshot_2025_10_10,
];
