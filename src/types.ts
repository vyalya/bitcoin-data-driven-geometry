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

/** Per-block data: [height, sizeBytes, weight, txCount] */
export type BlockTuple = [number, number, number, number];

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
  difficulty: number;
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
  miningPools: MiningPoolSnapshot[];
  feeBuckets: FeeBucket[];
  ringBands: RingBand[];
  notes: string[];
  blocks?: BlockTuple[];
};
