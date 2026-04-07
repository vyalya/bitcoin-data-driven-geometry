export type MiningPoolSnapshot = {
  id: string;
  name: string;
  sharePct: number;
  hashRateEh: number;
  shareChange30d: number;
};

export type FeeBucket = {
  id: string;
  feeRateLabel: string;
  txShare: number;
  intensity: number;
};

export type RingBand = {
  id: string;
  label: string;
  radius: number;
  density: number;
  intensity: number;
  activeShare: number;
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
  feeBuckets: FeeBucket[];
  ringBands: RingBand[];
  notes: string[];
};
