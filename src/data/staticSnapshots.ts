// Loading placeholder only. No fabricated or stale data is used on fetch failure.
import type { NetworkSnapshot } from '../types';
export const staticSnapshots:NetworkSnapshot[]=[{
  id:'loading',label:'Loading verified snapshots…',snapshotTime:'',mode:'historical',
  blockHeight:null,blockCount:null,coinmetricsBlockCount:null,meanBlockWeight:null,transactionCount:null,avgBlockIntervalSeconds:null,blockPace:null,
  networkHashrateEh:null,mempoolTxCount:null,mempoolSizeMb:null,feeTotalIndex:null,congestionScore:null,
  blockProductionStress:null,minerConcentrationScore:null,networkHealthScore:null,difficulty:null,activeAddresses:null,
  uniqueSenders:null,uniqueReceivers:null,btcTransferred:null,totalFeesBtc:null,coinmetricsFeesBtc:null,coinmetricsTransactionCount:null,totalOutputs:null,whaleOutputs1000:null,
  whaleOutputs100:null,midOutputs10:null,retailOutputs:null,coverage:{feeHistogram:'unavailable'},feeBuckets:[],notes:[],blocks:[],provenance:{},
  scales:{dailyTransactions:1,feesBtc:1,hashrateEh:1,difficulty:1,estimatedVolumeBtc:1,blockTxCount:1,blockSizeBytes:4000000,blockWeight:4000000,detailAddressesPerParticle:1000,gridAddressesPerParticle:8000},
}];
