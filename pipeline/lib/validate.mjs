import { validDate, validateBlocks, day } from './data.mjs';
export function auditDataset(snapshots, blocks) {
  if (!Array.isArray(snapshots) || !snapshots.length) throw new Error('No snapshots');
  const ids=new Set(),dates=new Set(),heights=new Set();
  for(const s of snapshots){
    if(s.schemaVersion!==2 || !validDate(s.date) || ids.has(s.id) || dates.has(s.date))throw new Error(`Invalid snapshot ${s.id}`);
    ids.add(s.id);dates.add(s.date);
    for(const [key,v] of Object.entries(s))if(typeof v==='number'&&(!Number.isFinite(v)||v<0))throw new Error(`Invalid ${s.date} ${key}`);
    const rows=blocks[s.date];validateBlocks(rows,s.date);
    if(rows.length!==s.blockCount)throw new Error(`Block count mismatch ${s.date}`);
    if(rows.some((b,i)=>i>0&&b[0]<=rows[i-1][0]))throw new Error(`Unordered blocks ${s.date}`);
    const transactions=rows.reduce((sum,b)=>sum+b[3]-1,0);
    const meanWeight=rows.length?rows.reduce((sum,b)=>sum+b[2],0)/rows.length:null;
    if(s.transactionCount!==transactions)throw new Error(`Transaction aggregate mismatch ${s.date}`);
    if(s.meanBlockWeight!==meanWeight)throw new Error(`Weight aggregate mismatch ${s.date}`);
    for(const [scale,metric] of [['dailyTransactions','transactionCount'],['feesBtc','totalFeesBtc'],['difficulty','difficulty'],['hashrateEh','networkHashrateEh']]){
      const maximum=Math.max(1,...snapshots.map(row=>row[metric]??0));
      if(s.scales?.[scale]!==maximum)throw new Error(`Shared scale mismatch ${s.date} ${scale}`);
    }
    if(s.scales.blockWeight!==4000000||s.scales.detailAddressesPerParticle!==1000||s.scales.gridAddressesPerParticle!==8000)throw new Error(`Invalid geometry units ${s.date}`);
    if(rows.at(-1)?.[0]!==s.blockHeight)throw new Error(`End height mismatch ${s.date}`);
    for(const b of rows){if(heights.has(b[0]))throw new Error(`Block appears on two dates ${b[0]}`);heights.add(b[0]);}
    if(s.blockCount && Math.abs(s.avgBlockIntervalSeconds-86400/s.blockCount)>1e-8)throw new Error(`Invalid effective interval ${s.date}`);
    if(s.networkHealthScore!==null||s.minerConcentrationScore!==null||s.blockProductionStress!==null)throw new Error(`Unsupported score ${s.date}`);
    if((s.mempoolTxCount==null)!==(s.congestionScore==null))throw new Error(`Missingness mismatch ${s.date}`);
    if(s.feeBuckets.length && Math.abs(s.feeBuckets.reduce((n,b)=>n+b.txShare,0)-1)>1e-10)throw new Error(`Fee shares ${s.date}`);
    if(!s.coverage.feeHistogram||s.coverage.feeHistogram==='unavailable'){if(s.feeBuckets.length)throw new Error(`Invented histogram ${s.date}`);}
  }
  for(const date of Object.keys(blocks))if(!dates.has(date))throw new Error(`Orphan block date ${date}`);
  return {snapshots:snapshots.length,blocks:heights.size};
}
export function validateBlockDay(date, blockDay){
  if(!blockDay.complete)throw new Error(`Incomplete ${date}`);
  for(const b of blockDay.records){
    if(!Number.isSafeInteger(b.timestamp)||day(b.timestamp)!==date)throw new Error(`Wrong UTC day ${b.height}`);
    if(!/^[a-f0-9]{64}$/.test(b.hash)||!Number.isFinite(b.difficulty)||b.difficulty<1)throw new Error(`Invalid block header ${b.height}`);
    if(b.totalFeesSat!==null&&(!Number.isSafeInteger(b.totalFeesSat)||b.totalFeesSat<0))throw new Error(`Invalid block fee ${b.height}`);
  }
}
