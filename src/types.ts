export type MiningPoolSnapshot = {
  id: string;
  name: string;
  sharePct: number;
  hashRateEh: number;
  shareChange30d: number;
};

export type NetworkSnapshot = {
  id: string;
  label: string;
  snapshotTime: string;
  mode: "historical" | "simulation";
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
  miningPools: MiningPoolSnapshot[];
  notes: string[];
};
