export type FeeBucket = { id:string; feeRateLabel:string; txShare:number; intensity:number };
export type BlockTuple = [number,number,number,number];
export type BlockRecord = {height:number;hash:string;timestamp:number;size:number;weight:number;txCount:number;difficulty:number;totalFeesSat:number|null};
export type Scales = { dailyTransactions:number; feesBtc:number; hashrateEh:number; difficulty:number; estimatedVolumeBtc:number; blockTxCount:number; blockSizeBytes:number; blockWeight:number; detailAddressesPerParticle:number; gridAddressesPerParticle:number };
export type NetworkSnapshot = {
  id:string; label:string; snapshotTime:string; mode:'historical';
  blockHeight:number|null; blockCount:number|null; coinmetricsBlockCount:number|null;
  meanBlockWeight:number|null; category?:string; transactionCount:number|null; avgBlockIntervalSeconds:number|null; blockPace:number|null;
  networkHashrateEh:number|null; mempoolTxCount:number|null; mempoolSizeMb:number|null;
  feeTotalIndex:number|null; congestionScore:number|null; blockProductionStress:number|null;
  minerConcentrationScore:number|null; networkHealthScore:number|null; difficulty:number|null;
  activeAddresses:number|null; uniqueSenders:number|null; uniqueReceivers:number|null;
  btcTransferred:number|null; totalFeesBtc:number|null; coinmetricsFeesBtc:number|null; coinmetricsTransactionCount:number|null; totalOutputs:number|null;
  whaleOutputs1000:number|null; whaleOutputs100:number|null; midOutputs10:number|null; retailOutputs:number|null;
  coverage:{feeHistogram:'complete'|'unavailable'}; feeBuckets:FeeBucket[]; notes:string[]; narration?:string; blocks?:BlockTuple[];
  context?:string|null; contextSources?:string[]; provenance:Record<string,string>; scales:Scales;
};
