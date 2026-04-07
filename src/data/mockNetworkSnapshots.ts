import type { NetworkSnapshot } from "../types";

export const mockNetworkSnapshots: NetworkSnapshot[] = [
  {
    id: "baseline",
    label: "Baseline",
    snapshotTime: "2024-04-20T12:00:00Z",
    mode: "historical",
    blockHeight: 840021,
    avgBlockIntervalSeconds: 612,
    networkHashrateEh: 615,
    mempoolTxCount: 142000,
    mempoolSizeMb: 182,
    feePressureIndex: 6.2,
    congestionScore: 5.8,
    blockProductionStress: 4.1,
    minerConcentrationScore: 5.4,
    networkHealthScore: 7.8,
    miningPools: [
      { id: "foundry", name: "Foundry", sharePct: 0.29, hashRateEh: 178, shareChange30d: 0.02 },
      { id: "antpool", name: "AntPool", sharePct: 0.24, hashRateEh: 148, shareChange30d: -0.01 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.13, hashRateEh: 80, shareChange30d: 0.01 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.11, hashRateEh: 68, shareChange30d: 0.0 },
      { id: "luxor", name: "Luxor", sharePct: 0.07, hashRateEh: 43, shareChange30d: 0.01 }
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.26, intensity: 0.35 },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.31, intensity: 0.48 },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.24, intensity: 0.63 },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.19, intensity: 0.76 }
    ],
    ringBands: [
      { id: "rb-1", label: "Inner fee band", radius: 2.0, density: 0.58, intensity: 0.65, activeShare: 0.62 },
      { id: "rb-2", label: "Settlement band", radius: 2.85, density: 0.63, intensity: 0.56, activeShare: 0.67 },
      { id: "rb-3", label: "Congestion band", radius: 3.75, density: 0.71, intensity: 0.52, activeShare: 0.74 },
      { id: "rb-4", label: "Outer mempool band", radius: 4.85, density: 0.78, intensity: 0.46, activeShare: 0.8 }
    ],
    notes: [
      "Healthy baseline near halving-era block production.",
      "Mempool elevated but not in a critical runaway regime."
    ]
  },
  {
    id: "fee-spike",
    label: "Fee Spike",
    snapshotTime: "2024-04-20T18:00:00Z",
    mode: "simulation",
    blockHeight: 840034,
    avgBlockIntervalSeconds: 649,
    networkHashrateEh: 608,
    mempoolTxCount: 318000,
    mempoolSizeMb: 331,
    feePressureIndex: 9.1,
    congestionScore: 9.4,
    blockProductionStress: 6.0,
    minerConcentrationScore: 5.5,
    networkHealthScore: 5.3,
    miningPools: [
      { id: "foundry", name: "Foundry", sharePct: 0.29, hashRateEh: 176, shareChange30d: 0.02 },
      { id: "antpool", name: "AntPool", sharePct: 0.24, hashRateEh: 146, shareChange30d: -0.01 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.13, hashRateEh: 79, shareChange30d: 0.01 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.11, hashRateEh: 67, shareChange30d: 0.0 },
      { id: "luxor", name: "Luxor", sharePct: 0.07, hashRateEh: 42, shareChange30d: 0.01 }
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.12, intensity: 0.2 },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.17, intensity: 0.34 },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.29, intensity: 0.76 },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.42, intensity: 0.96 }
    ],
    ringBands: [
      { id: "rb-1", label: "Inner fee band", radius: 2.0, density: 0.69, intensity: 0.88, activeShare: 0.84 },
      { id: "rb-2", label: "Settlement band", radius: 2.85, density: 0.78, intensity: 0.82, activeShare: 0.87 },
      { id: "rb-3", label: "Congestion band", radius: 3.75, density: 0.88, intensity: 0.94, activeShare: 0.92 },
      { id: "rb-4", label: "Outer mempool band", radius: 4.85, density: 0.95, intensity: 0.9, activeShare: 0.97 }
    ],
    notes: [
      "Simulated fee pressure surge drives a dense mempool storm.",
      "Health score falls primarily because congestion and block stress rise together."
    ]
  },
  {
    id: "hashrate-drop",
    label: "Hashrate Shock",
    snapshotTime: "2024-04-22T12:00:00Z",
    mode: "simulation",
    blockHeight: 840245,
    avgBlockIntervalSeconds: 748,
    networkHashrateEh: 468,
    mempoolTxCount: 244000,
    mempoolSizeMb: 265,
    feePressureIndex: 7.2,
    congestionScore: 7.1,
    blockProductionStress: 8.8,
    minerConcentrationScore: 6.6,
    networkHealthScore: 4.9,
    miningPools: [
      { id: "foundry", name: "Foundry", sharePct: 0.34, hashRateEh: 159, shareChange30d: 0.05 },
      { id: "antpool", name: "AntPool", sharePct: 0.28, hashRateEh: 131, shareChange30d: 0.03 },
      { id: "f2pool", name: "F2Pool", sharePct: 0.11, hashRateEh: 51, shareChange30d: -0.02 },
      { id: "viabtc", name: "ViaBTC", sharePct: 0.09, hashRateEh: 42, shareChange30d: -0.01 },
      { id: "luxor", name: "Luxor", sharePct: 0.06, hashRateEh: 28, shareChange30d: -0.01 }
    ],
    feeBuckets: [
      { id: "low", feeRateLabel: "1-10 sat/vB", txShare: 0.19, intensity: 0.28 },
      { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: 0.24, intensity: 0.42 },
      { id: "high", feeRateLabel: "31-80 sat/vB", txShare: 0.31, intensity: 0.68 },
      { id: "priority", feeRateLabel: "81+ sat/vB", txShare: 0.26, intensity: 0.8 }
    ],
    ringBands: [
      { id: "rb-1", label: "Inner fee band", radius: 2.0, density: 0.52, intensity: 0.74, activeShare: 0.6 },
      { id: "rb-2", label: "Settlement band", radius: 2.85, density: 0.61, intensity: 0.67, activeShare: 0.65 },
      { id: "rb-3", label: "Congestion band", radius: 3.75, density: 0.74, intensity: 0.7, activeShare: 0.78 },
      { id: "rb-4", label: "Outer mempool band", radius: 4.85, density: 0.8, intensity: 0.72, activeShare: 0.83 }
    ],
    notes: [
      "Simulated pool outage lowers hashrate and slows block production.",
      "Concentration risk rises because the surviving top pools capture a larger share."
    ]
  }
];
