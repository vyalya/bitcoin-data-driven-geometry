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
    notes: [
      "Simulated pool outage lowers hashrate and slows block production.",
      "Concentration risk rises because the surviving top pools capture a larger share."
    ]
  }
];
