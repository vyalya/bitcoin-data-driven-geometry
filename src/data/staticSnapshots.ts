/**
 * Static fallback snapshots (25 historically significant events) used only when
 * /data/snapshots.parquet isn't available. The full 105-snapshot dataset lives
 * in the parquet file and is loaded at runtime via src/db.ts.
 */
import type { NetworkSnapshot } from "../types";
import { blockData } from "./blockData";

/* ─── Ring band derivation from metrics ─── */

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
    { id: "rb-1", label: "Inner fee band", radius: 2.0, density: 0.4 + fp * 0.5, intensity: 0.3 + fp * 0.6, activeShare: 0.4 + fp * 0.5 },
    { id: "rb-2", label: "Settlement band", radius: 2.85, density: 0.5 + (1 - bs) * 0.4, intensity: 0.4 + health * 0.4, activeShare: 0.5 + health * 0.35 },
    { id: "rb-3", label: "Congestion band", radius: 3.75, density: 0.35 + cg * 0.55, intensity: 0.3 + cg * 0.6, activeShare: 0.3 + mp * 0.6 },
    { id: "rb-4", label: "Outer mempool band", radius: 4.85, density: 0.3 + mp * 0.6, intensity: 0.25 + cg * 0.5, activeShare: 0.35 + mp * 0.5 },
  ];
}

/* ─── Helpers ─── */

function bkt(s0: number, s1: number, s2: number, s3: number) {
  return [
    { id: "low", feeRateLabel: "1-10 sat/vB", txShare: s0, intensity: Math.min(s0 / 0.25, 1) },
    { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: s1, intensity: Math.min(s1 / 0.3, 1) },
    { id: "high", feeRateLabel: "31-80 sat/vB", txShare: s2, intensity: Math.min(s2 / 0.25, 1) },
    { id: "priority", feeRateLabel: "81+ sat/vB", txShare: s3, intensity: Math.min(s3 / 0.2, 1) },
  ];
}

/**
 * Derive a 4-tier fee distribution from the pipeline feePressureIndex (0–10).
 * Real per-tier breakdowns aren't in the pipeline snapshot model — they live in
 * BigQuery and would require a separate extract. This synthesizes a plausible
 * distribution that's directionally correct: low pressure → most txs in the
 * cheap tier, high pressure → majority shifts into higher-fee tiers.
 *
 * Anchor distributions by pressure regime:
 *   FPI ≈ 0   → calm:       [0.78, 0.16, 0.05, 0.01]
 *   FPI ≈ 1   → light:      [0.62, 0.24, 0.10, 0.04]
 *   FPI ≈ 2   → busy:       [0.42, 0.30, 0.20, 0.08]
 *   FPI ≈ 3   → congested:  [0.26, 0.32, 0.27, 0.15]
 *   FPI ≈ 5+  → extreme:    [0.12, 0.24, 0.34, 0.30]
 * Linearly interpolated between anchors so each snapshot's percentages move.
 */
function deriveFeeBucketsFromPressure(feePressureIndex: number) {
  const anchors: Array<[number, [number, number, number, number]]> = [
    [0, [0.78, 0.16, 0.05, 0.01]],
    [1, [0.62, 0.24, 0.10, 0.04]],
    [2, [0.42, 0.30, 0.20, 0.08]],
    [3, [0.26, 0.32, 0.27, 0.15]],
    [5, [0.12, 0.24, 0.34, 0.30]],
  ];
  const fpi = Math.max(0, Math.min(feePressureIndex, 5));
  // Find bracketing anchors
  let lo = anchors[0];
  let hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (fpi >= anchors[i][0] && fpi <= anchors[i + 1][0]) {
      lo = anchors[i];
      hi = anchors[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const t = (fpi - lo[0]) / span;
  const out = lo[1].map((v, i) => v + (hi[1][i] - v) * t) as [number, number, number, number];
  // Renormalize to handle any floating-point drift
  const sum = out[0] + out[1] + out[2] + out[3];
  return bkt(out[0] / sum, out[1] / sum, out[2] / sum, out[3] / sum);
}

/* ═══════════════════════════════════════════════════════════════════
   STATIC FALLBACK — 25-snapshot dataset used when parquet isn't loaded.
   Runtime data comes from public/data/snapshots.parquet via src/db.ts.
   ═══════════════════════════════════════════════════════════════════ */

interface StaticMetrics {
  blockHeight: number;
  avgBlockIntervalSeconds: number;
  networkHashrateEh: number;
  mempoolTxCount: number;
  mempoolSizeMb: number;
  feePressureIndex: number;
  congestionScore: number;
  blockProductionStress: number;
  minerConcentrationScore: number;
  networkHealthScore: number;
  difficulty: number;
}

/* Network metrics keyed by date — all from pipeline */
const METRICS: Record<string, StaticMetrics> = {
  "2009-01-09": { blockHeight: 14, avgBlockIntervalSeconds: 4547.368, networkHashrateEh: 0, mempoolTxCount: 0, mempoolSizeMb: 0, feePressureIndex: 0, congestionScore: 0, blockProductionStress: 4, minerConcentrationScore: 4.007, networkHealthScore: 5.5, difficulty: 1 },
  "2010-05-22": { blockHeight: 57093, avgBlockIntervalSeconds: 443.077, networkHashrateEh: 0, mempoolTxCount: 0, mempoolSizeMb: 0, feePressureIndex: 0.01, congestionScore: 0, blockProductionStress: 0.715, minerConcentrationScore: 4.007, networkHealthScore: 10, difficulty: 11.846 },
  "2011-06-19": { blockHeight: 131934, avgBlockIntervalSeconds: 387.444, networkHashrateEh: 0, mempoolTxCount: 0, mempoolSizeMb: 0, feePressureIndex: 0.25, congestionScore: 0, blockProductionStress: 0.887, minerConcentrationScore: 4.007, networkHealthScore: 9.92, difficulty: 876954.494 },
  "2013-04-10": { blockHeight: 230722, avgBlockIntervalSeconds: 452.356, networkHashrateEh: 0, mempoolTxCount: 0, mempoolSizeMb: 0, feePressureIndex: 0.65, congestionScore: 0, blockProductionStress: 0.722, minerConcentrationScore: 4.007, networkHealthScore: 9.81, difficulty: 7672999.92 },
  "2014-02-24": { blockHeight: 287655, avgBlockIntervalSeconds: 452.356, networkHashrateEh: 0.03, mempoolTxCount: 0, mempoolSizeMb: 0, feePressureIndex: 0.15, congestionScore: 0, blockProductionStress: 0.722, minerConcentrationScore: 4.007, networkHealthScore: 9.95, difficulty: 3129573174.522 },
  "2015-01-14": { blockHeight: 338981, avgBlockIntervalSeconds: 595.862, networkHashrateEh: 0.317, mempoolTxCount: 0, mempoolSizeMb: 0, feePressureIndex: 0.16, congestionScore: 0, blockProductionStress: 0.817, minerConcentrationScore: 4.007, networkHealthScore: 9.95, difficulty: 43971662056.09 },
  "2016-07-09": { blockHeight: 420047, avgBlockIntervalSeconds: 579.866, networkHashrateEh: 1.581, mempoolTxCount: 3599, mempoolSizeMb: 2.160, feePressureIndex: 0.47, congestionScore: 1.03, blockProductionStress: 0.807, minerConcentrationScore: 4.007, networkHealthScore: 9.55, difficulty: 213398925331 },
  "2017-12-20": { blockHeight: 500325, avgBlockIntervalSeconds: 635.294, networkHashrateEh: 12.663, mempoolTxCount: 128796, mempoolSizeMb: 98.037, feePressureIndex: 9.21, congestionScore: 10, blockProductionStress: 0.844, minerConcentrationScore: 4.007, networkHealthScore: 4.24, difficulty: 1873105475221 },
  "2018-12-15": { blockHeight: 554002, avgBlockIntervalSeconds: 579.866, networkHashrateEh: 41.822, mempoolTxCount: 2152, mempoolSizeMb: 1.236, feePressureIndex: 0.18, congestionScore: 0.61, blockProductionStress: 0.807, minerConcentrationScore: 4.007, networkHealthScore: 9.76, difficulty: 5646403851535 },
  "2019-06-26": { blockHeight: 582605, avgBlockIntervalSeconds: 523.636, networkHashrateEh: 60.773, mempoolTxCount: 27833, mempoolSizeMb: 15.829, feePressureIndex: 1.87, congestionScore: 7.95, blockProductionStress: 0.769, minerConcentrationScore: 4.007, networkHealthScore: 7.05, difficulty: 7409399249090 },
  "2020-03-12": { blockHeight: 621412, avgBlockIntervalSeconds: 572.185, networkHashrateEh: 124.25, mempoolTxCount: 34946, mempoolSizeMb: 18.870, feePressureIndex: 0.6, congestionScore: 9.98, blockProductionStress: 0.801, minerConcentrationScore: 4.007, networkHealthScore: 6.82, difficulty: 16552923967337 },
  "2020-05-11": { blockHeight: 630023, avgBlockIntervalSeconds: 550.318, networkHashrateEh: 125.69, mempoolTxCount: 6296, mempoolSizeMb: 18.044, feePressureIndex: 0.92, congestionScore: 1.8, blockProductionStress: 0.787, minerConcentrationScore: 4.007, networkHealthScore: 9.18, difficulty: 16104807485529 },
  "2021-04-14": { blockHeight: 679250, avgBlockIntervalSeconds: 640, networkHashrateEh: 155.273, mempoolTxCount: 62636, mempoolSizeMb: 75.704, feePressureIndex: 1.36, congestionScore: 10, blockProductionStress: 0.847, minerConcentrationScore: 4.007, networkHealthScore: 6.59, difficulty: 23137439666472 },
  "2021-06-28": { blockHeight: 689078, avgBlockIntervalSeconds: 981.818, networkHashrateEh: 87.196, mempoolTxCount: 48014, mempoolSizeMb: 28.828, feePressureIndex: 0.52, congestionScore: 10, blockProductionStress: 1.486, minerConcentrationScore: 4.007, networkHealthScore: 6.12, difficulty: 19932791027263 },
  "2021-11-10": { blockHeight: 709141, avgBlockIntervalSeconds: 579.866, networkHashrateEh: 160.427, mempoolTxCount: 6100, mempoolSizeMb: 13.283, feePressureIndex: 0.18, congestionScore: 1.74, blockProductionStress: 0.807, minerConcentrationScore: 4.007, networkHealthScore: 9.42, difficulty: 21659344833265 },
  "2022-02-24": { blockHeight: 724805, avgBlockIntervalSeconds: 654.545, networkHashrateEh: 183.514, mempoolTxCount: 2603, mempoolSizeMb: 1.993, feePressureIndex: 0.1, congestionScore: 0.74, blockProductionStress: 0.856, minerConcentrationScore: 4.007, networkHealthScore: 9.75, difficulty: 27967152532434 },
  "2022-11-11": { blockHeight: 762775, avgBlockIntervalSeconds: 644.776, networkHashrateEh: 244.879, mempoolTxCount: 5780, mempoolSizeMb: 3.341, feePressureIndex: 0.21, congestionScore: 1.65, blockProductionStress: 0.85, minerConcentrationScore: 4.007, networkHealthScore: 9.44, difficulty: 36762198818467 },
  "2023-01-14": { blockHeight: 771987, avgBlockIntervalSeconds: 505.263, networkHashrateEh: 289.811, mempoolTxCount: 3831, mempoolSizeMb: 3.190, feePressureIndex: 0.14, congestionScore: 1.09, blockProductionStress: 0.757, minerConcentrationScore: 4.007, networkHealthScore: 9.63, difficulty: 34093570325204 },
  "2023-12-16": { blockHeight: 821535, avgBlockIntervalSeconds: 568.421, networkHashrateEh: 508.561, mempoolTxCount: 156980, mempoolSizeMb: 138.266, feePressureIndex: 5.69, congestionScore: 10, blockProductionStress: 0.799, minerConcentrationScore: 4.007, networkHealthScore: 5.29, difficulty: 67305906902031.1 },
  "2024-01-11": { blockHeight: 825376, avgBlockIntervalSeconds: 499.422, networkHashrateEh: 629.491, mempoolTxCount: 82745, mempoolSizeMb: 318.183, feePressureIndex: 1.02, congestionScore: 10, blockProductionStress: 0.753, minerConcentrationScore: 4.007, networkHealthScore: 6.69, difficulty: 73197634206448 },
  "2024-03-14": { blockHeight: 834726, avgBlockIntervalSeconds: 612.766, networkHashrateEh: 580.863, mempoolTxCount: 77874, mempoolSizeMb: 109.045, feePressureIndex: 0.34, congestionScore: 10, blockProductionStress: 0.829, minerConcentrationScore: 4.007, networkHealthScore: 6.9, difficulty: 82709090260024.77 },
  "2024-04-20": { blockHeight: 840128, avgBlockIntervalSeconds: 664.615, networkHashrateEh: 558.272, mempoolTxCount: 140888, mempoolSizeMb: 154.424, feePressureIndex: 10, congestionScore: 10, blockProductionStress: 0.863, minerConcentrationScore: 3.899, networkHealthScore: 4, difficulty: 86388558925171.2 },
  "2024-11-10": { blockHeight: 869780, avgBlockIntervalSeconds: 583.784, networkHashrateEh: 747.828, mempoolTxCount: 163146, mempoolSizeMb: 78.858, feePressureIndex: 0.1, congestionScore: 10, blockProductionStress: 0.809, minerConcentrationScore: 3.899, networkHealthScore: 6.97, difficulty: 101646843652784.6 },
  "2025-01-20": { blockHeight: 880139, avgBlockIntervalSeconds: 568.421, networkHashrateEh: 834.57, mempoolTxCount: 105191, mempoolSizeMb: 49.257, feePressureIndex: 0.13, congestionScore: 10, blockProductionStress: 0.799, minerConcentrationScore: 3.899, networkHealthScore: 6.96, difficulty: 110451907374650 },
  "2025-10-10": { blockHeight: 918497, avgBlockIntervalSeconds: 654.545, networkHashrateEh: 989.772, mempoolTxCount: 15220, mempoolSizeMb: 3.527, feePressureIndex: 0.04, congestionScore: 4.35, blockProductionStress: 0.856, minerConcentrationScore: 3.577, networkHealthScore: 8.68, difficulty: 150839487445891.53 },
};

/* GBQ address/value data per snapshot — from BigQuery crypto_bitcoin via pipeline */
interface GbqData {
  activeAddresses: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  btcTransferred: number;
  totalFeesBtc: number;
  totalOutputs: number;
  whaleOutputs1000: number;
  whaleOutputs100: number;
  midOutputs10: number;
  retailOutputs: number;
}

const GBQ: Record<string, GbqData> = {
  "2009-01-09": { activeAddresses: 19, uniqueSenders: 0, uniqueReceivers: 0, btcTransferred: 0, totalFeesBtc: 0, totalOutputs: 0, whaleOutputs1000: 0, whaleOutputs100: 0, midOutputs10: 0, retailOutputs: 0 },
  "2010-05-22": { activeAddresses: 349, uniqueSenders: 137, uniqueReceivers: 28, btcTransferred: 54428, totalFeesBtc: 0.990, totalOutputs: 233, whaleOutputs1000: 7, whaleOutputs100: 9, midOutputs10: 210, retailOutputs: 7 },
  "2011-06-19": { activeAddresses: 27866, uniqueSenders: 16175, uniqueReceivers: 23494, btcTransferred: 4573896, totalFeesBtc: 25.342, totalOutputs: 29666, whaleOutputs1000: 107, whaleOutputs100: 1956, midOutputs10: 5017, retailOutputs: 22586 },
  "2013-04-10": { activeAddresses: 132897, uniqueSenders: 79368, uniqueReceivers: 106591, btcTransferred: 2880396, totalFeesBtc: 64.842, totalOutputs: 169321, whaleOutputs1000: 380, whaleOutputs100: 4326, midOutputs10: 17447, retailOutputs: 147168 },
  "2014-02-24": { activeAddresses: 217723, uniqueSenders: 134120, uniqueReceivers: 190963, btcTransferred: 776198, totalFeesBtc: 15.406, totalOutputs: 256989, whaleOutputs1000: 108, whaleOutputs100: 898, midOutputs10: 7541, retailOutputs: 248442 },
  "2015-01-14": { activeAddresses: 257446, uniqueSenders: 179860, uniqueReceivers: 216534, btcTransferred: 2405987, totalFeesBtc: 15.623, totalOutputs: 307313, whaleOutputs1000: 396, whaleOutputs100: 2554, midOutputs10: 18120, retailOutputs: 286243 },
  "2016-07-09": { activeAddresses: 434260, uniqueSenders: 257213, uniqueReceivers: 358389, btcTransferred: 1891223, totalFeesBtc: 46.634, totalOutputs: 509494, whaleOutputs1000: 46, whaleOutputs100: 3630, midOutputs10: 21407, retailOutputs: 484411 },
  "2017-12-20": { activeAddresses: 1027644, uniqueSenders: 547079, uniqueReceivers: 858717, btcTransferred: 2227875, totalFeesBtc: 920.785, totalOutputs: 994169, whaleOutputs1000: 107, whaleOutputs100: 2589, midOutputs10: 27739, retailOutputs: 963734 },
  "2018-12-15": { activeAddresses: 594065, uniqueSenders: 429866, uniqueReceivers: 428574, btcTransferred: 813096, totalFeesBtc: 18.267, totalOutputs: 632386, whaleOutputs1000: 89, whaleOutputs100: 992, midOutputs10: 8641, retailOutputs: 622664 },
  "2019-06-26": { activeAddresses: 1035885, uniqueSenders: 640343, uniqueReceivers: 797374, btcTransferred: 1866108, totalFeesBtc: 187.187, totalOutputs: 1096503, whaleOutputs1000: 139, whaleOutputs100: 2847, midOutputs10: 23612, retailOutputs: 1069905 },
  "2020-03-12": { activeAddresses: 909601, uniqueSenders: 604780, uniqueReceivers: 663626, btcTransferred: 2351187, totalFeesBtc: 60.273, totalOutputs: 892697, whaleOutputs1000: 194, whaleOutputs100: 2879, midOutputs10: 21882, retailOutputs: 867742 },
  "2020-05-11": { activeAddresses: 999192, uniqueSenders: 653335, uniqueReceivers: 655174, btcTransferred: 1165275, totalFeesBtc: 92.138, totalOutputs: 849885, whaleOutputs1000: 78, whaleOutputs100: 1507, midOutputs10: 13155, retailOutputs: 835145 },
  "2021-04-14": { activeAddresses: 1149773, uniqueSenders: 622746, uniqueReceivers: 858095, btcTransferred: 1825475, totalFeesBtc: 136.064, totalOutputs: 1055366, whaleOutputs1000: 101, whaleOutputs100: 2396, midOutputs10: 9360, retailOutputs: 1043509 },
  "2021-06-28": { activeAddresses: 776365, uniqueSenders: 422188, uniqueReceivers: 589075, btcTransferred: 1666846, totalFeesBtc: 51.906, totalOutputs: 726578, whaleOutputs1000: 156, whaleOutputs100: 1376, midOutputs10: 6857, retailOutputs: 718189 },
  "2021-11-10": { activeAddresses: 1022756, uniqueSenders: 638693, uniqueReceivers: 749046, btcTransferred: 4611902, totalFeesBtc: 18.412, totalOutputs: 937868, whaleOutputs1000: 560, whaleOutputs100: 2276, midOutputs10: 9850, retailOutputs: 925182 },
  "2022-02-24": { activeAddresses: 958866, uniqueSenders: 604349, uniqueReceivers: 681651, btcTransferred: 4283224, totalFeesBtc: 10.42, totalOutputs: 865268, whaleOutputs1000: 270, whaleOutputs100: 2453, midOutputs10: 9180, retailOutputs: 853365 },
  "2022-11-11": { activeAddresses: 964454, uniqueSenders: 600475, uniqueReceivers: 751493, btcTransferred: 4083748, totalFeesBtc: 21.32, totalOutputs: 981757, whaleOutputs1000: 577, whaleOutputs100: 2995, midOutputs10: 12842, retailOutputs: 965343 },
  "2023-01-14": { activeAddresses: 965948, uniqueSenders: 654758, uniqueReceivers: 728978, btcTransferred: 923781, totalFeesBtc: 13.582, totalOutputs: 945895, whaleOutputs1000: 27, whaleOutputs100: 2019, midOutputs10: 6999, retailOutputs: 936850 },
  "2023-12-16": { activeAddresses: 724669, uniqueSenders: 431640, uniqueReceivers: 645641, btcTransferred: 562624, totalFeesBtc: 568.946, totalOutputs: 1679829, whaleOutputs1000: 31, whaleOutputs100: 784, midOutputs10: 3608, retailOutputs: 1675406 },
  "2024-01-11": { activeAddresses: 960999, uniqueSenders: 642997, uniqueReceivers: 671257, btcTransferred: 1151913, totalFeesBtc: 102.194, totalOutputs: 1261057, whaleOutputs1000: 188, whaleOutputs100: 1421, midOutputs10: 7676, retailOutputs: 1251772 },
  "2024-03-14": { activeAddresses: 1000634, uniqueSenders: 634100, uniqueReceivers: 673018, btcTransferred: 1276450, totalFeesBtc: 34.484, totalOutputs: 1091219, whaleOutputs1000: 149, whaleOutputs100: 1553, midOutputs10: 6797, retailOutputs: 1082720 },
  "2024-04-20": { activeAddresses: 509709, uniqueSenders: 269653, uniqueReceivers: 461883, btcTransferred: 385320, totalFeesBtc: 1206.467, totalOutputs: 1907729, whaleOutputs1000: 34, whaleOutputs100: 190, midOutputs10: 3272, retailOutputs: 1904233 },
  "2024-11-10": { activeAddresses: 793243, uniqueSenders: 503522, uniqueReceivers: 574344, btcTransferred: 808961, totalFeesBtc: 10.403, totalOutputs: 1394994, whaleOutputs1000: 96, whaleOutputs100: 1377, midOutputs10: 5925, retailOutputs: 1387596 },
  "2025-01-20": { activeAddresses: 852334, uniqueSenders: 513504, uniqueReceivers: 619216, btcTransferred: 961130, totalFeesBtc: 12.747, totalOutputs: 968086, whaleOutputs1000: 138, whaleOutputs100: 1354, midOutputs10: 8290, retailOutputs: 958304 },
  "2025-10-10": { activeAddresses: 745662, uniqueSenders: 479699, uniqueReceivers: 595709, btcTransferred: 750439, totalFeesBtc: 4.089, totalOutputs: 1100889, whaleOutputs1000: 38, whaleOutputs100: 911, midOutputs10: 8010, retailOutputs: 1091930 },
};

function mk(id: string, label: string, date: string, notes: string[]): NetworkSnapshot {
  const m = METRICS[date];
  const g = GBQ[date] ?? GBQ["2009-01-09"];
  if (!m) throw new Error(`Missing pipeline metrics for ${date}`);
  const s = { feePressureIndex: m.feePressureIndex, congestionScore: m.congestionScore, blockProductionStress: m.blockProductionStress, mempoolTxCount: m.mempoolTxCount, networkHealthScore: m.networkHealthScore };
  return {
    id, label,
    snapshotTime: `${date}T00:00:00Z`,
    mode: "historical" as const,
    ...m,
    ...g,
    feeBuckets: deriveFeeBucketsFromPressure(m.feePressureIndex),
    ringBands: deriveRingBands(s),
    notes,
    blocks: blockData[date] ?? [],
  };
}

/* ═══════════════════════════════════════════════════════════════════
   25 EVENTS — chronological, all from pipeline
   ═══════════════════════════════════════════════════════════════════ */

export const staticSnapshots: NetworkSnapshot[] = [
  mk("genesis", "Genesis Era", "2009-01-09",
    ["6 days after genesis block. Satoshi mining alone on a CPU.", "14 blocks mined. One node, one miner, zero real transactions."]),
  mk("pizza", "Pizza Day", "2010-05-22",
    ["10,000 BTC for two pizzas — first real-world Bitcoin purchase.", "Block ~57K. Worth ~$40 at the time. Worth ~$700M in 2024."]),
  mk("bubble-2011", "2011 Bubble Burst", "2011-06-19",
    ["First major bubble — BTC hit $31 then crashed to $2.", "Mt. Gox hacked for the first time. Early chaos."]),
  mk("bubble-2013", "2013 Bubble Pop", "2013-04-10",
    ["BTC fell from $266 to $50 in hours.", "Fast blocks (452s) — ASICs arriving, hashrate surging."]),
  mk("mtgox", "Mt. Gox Collapse", "2014-02-24",
    ["Mt. Gox declared bankruptcy. 850,000 BTC lost.", "Hashrate barely 0.026 EH/s. Dark day for Bitcoin trust."]),
  mk("bear-2015", "2015 Bear Bottom", "2015-01-14",
    ["BTC ~$200. Deepest bear market despair.", "Network quietly building — 0.36 EH/s, steady blocks."]),
  mk("halving-2016", "2016 Halving", "2016-07-09",
    ["2nd halving — subsidy 25 → 12.5 BTC per block.", "1.6 EH/s. Calm before the 2017 storm. Block 420,000 mined this day."]),
  mk("bull-2017", "2017 Bull Run Peak", "2017-12-20",
    ["BTC near $20K. 343K mempool transactions.", "13 EH/s hashrate. Congestion score 4.7 — network stressed. Block 500K."]),
  mk("bear-2018", "2018 Capitulation", "2018-12-15",
    ["BTC bottomed near $3,200. Blood in the streets.", "Network: 41 EH/s, empty mempool, perfectly healthy."]),
  mk("rally-2019", "2019 Mini Rally", "2019-06-26",
    ["BTC briefly hit $13K. 76K mempool building.", "Fast blocks (524s) — hashrate surging to 65 EH/s."]),
  mk("covid", "COVID Black Thursday", "2020-03-12",
    ["Global pandemic panic. BTC dropped 50% in 24 hours.", "Mempool spiked to 27K. Blocks fast at 572s."]),
  mk("halving-2020", "2020 Halving", "2020-05-11",
    ["3rd halving — subsidy 12.5 → 6.25 BTC.", "109 EH/s, clear mempool. Block 630,000 mined this day."]),
  mk("coinbase", "Coinbase IPO", "2021-04-14",
    ["Coinbase went public on NASDAQ. BTC at $64K.", "257K mempool — heavy institutional-driven congestion."]),
  mk("china-ban", "China Mining Ban", "2021-06-28",
    ["China banned mining. Hashrate crashed from 180→109 EH/s.", "Paradoxically healthy — low fees, clear mempool."]),
  mk("ath-2021", "2021 ATH $69K", "2021-11-10",
    ["Bitcoin hit $69K all-time high.", "Fast blocks (580s), moderate mempool. Bull market peak."]),
  mk("ukraine", "Ukraine War Begins", "2022-02-24",
    ["Russia invaded Ukraine. BTC used for cross-border aid.", "Network unfazed — 184 EH/s, perfect block intervals."]),
  mk("ftx", "FTX Collapse", "2022-11-11",
    ["FTX and Alameda collapsed. Contagion spread across crypto.", "Bitcoin network: 245 EH/s, normal blocks. Unfazed."]),
  mk("recovery-2023", "2023 Recovery", "2023-01-14",
    ["Bear market ending. BTC climbing from $16K.", "290 EH/s — hashrate grew through the entire bear."]),
  mk("inscriptions", "Inscription Surge", "2023-12-16",
    ["Ordinals inscriptions flood the network. 346K mempool.", "528 EH/s. Congestion 4.7 — similar to 2017 peak."]),
  mk("etf", "BTC ETF Approved", "2024-01-11",
    ["SEC approved spot Bitcoin ETFs. Institutional era begins.", "Fast blocks (499s) — miners racing. 482 EH/s."]),
  mk("ath-2024", "2024 ATH $73K", "2024-03-14",
    ["New ATH ~$73K driven by ETF inflows.", "380K mempool — highest congestion in dataset. Health: 6.9."]),
  mk("halving-2024", "2024 Halving", "2024-04-20",
    ["4th halving — subsidy 6.25 → 3.125 BTC. Block 840,000 mined this day.", "642 EH/s. Slower blocks (665s). Mempool cleared."]),
  mk("election", "Post-Election Rally", "2024-11-10",
    ["US election rally toward $90K. Pro-crypto sentiment.", "243K mempool. 701 EH/s — network handling demand."]),
  mk("trump", "Trump Inauguration", "2025-01-20",
    ["Pro-crypto president inaugurated.", "719 EH/s. Network calm and extremely healthy."]),
  mk("correction", "2025 Correction", "2025-10-10",
    ["Market correction — prices declining.", "907 EH/s all-time high hashrate. Network doesn't care about price."]),

];
