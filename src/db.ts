import type { NetworkSnapshot, BlockTuple, BlockRecord } from './types';
type SnapshotRow=Omit<NetworkSnapshot,'snapshotTime'|'mode'> & {date:string;schemaVersion:number};
export async function loadSnapshots():Promise<NetworkSnapshot[]> {
  const response=await fetch('/data/snapshots.json');
  if(!response.ok)throw new Error(`Snapshots unavailable (HTTP ${response.status})`);
  const rows:SnapshotRow[]=await response.json();
  if(!Array.isArray(rows)||!rows.length||rows.some(r=>r.schemaVersion!==2||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!r.scales||!['complete','unavailable'].includes(r.coverage?.feeHistogram)||!Array.isArray(r.feeBuckets)))throw new Error('Invalid snapshot data; run the validated pipeline');
  const metrics=['blockHeight','blockCount','transactionCount','meanBlockWeight','avgBlockIntervalSeconds','networkHashrateEh','mempoolTxCount','mempoolSizeMb','feeTotalIndex','congestionScore','difficulty','activeAddresses','btcTransferred','totalFeesBtc'] as const;
  for(const row of rows){
    for(const key of metrics){const value=row[key];if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0))throw new Error(`Invalid metric: ${key}`);}
    if(['dailyTransactions','feesBtc','hashrateEh','difficulty','blockWeight','detailAddressesPerParticle','gridAddressesPerParticle'].some(key=>!Number.isFinite(row.scales[key as keyof typeof row.scales])||row.scales[key as keyof typeof row.scales]<=0))throw new Error('Invalid visual scale');
  }
  return rows.map(row=>({...row,snapshotTime:`${row.date}T00:00:00Z`,mode:'historical',blocks:[]}));
}
let blocksPromise:Promise<Record<string,BlockTuple[]>>|null=null;
export function loadAllBlocks():Promise<Record<string,BlockTuple[]>> {
  blocksPromise??=fetch('/data/blocks.json').then(async response=>{
    if(!response.ok)throw new Error(`Block data unavailable (HTTP ${response.status})`);
    const rows=await response.json();
    if(!rows||typeof rows!=='object'||Array.isArray(rows))throw new Error('Invalid block map');
    for(const tuples of Object.values(rows))if(!Array.isArray(tuples)||tuples.some(b=>!Array.isArray(b)||b.length!==4||!b.every(Number.isSafeInteger)))throw new Error('Invalid block tuple');
    return rows;
  }).catch(error=>{blocksPromise=null;throw error;});
  return blocksPromise;
}
export async function loadBlocksForDate(date:string):Promise<BlockTuple[]> {
  const all=await loadAllBlocks();return all[date]??[];
}
const blockDetailCache=new Map<string,Promise<BlockRecord[]>>();
export function loadBlockDetailsForDate(date:string):Promise<BlockRecord[]> {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return Promise.reject(new Error('Invalid block date'));
  if(!blockDetailCache.has(date))blockDetailCache.set(date,fetch(`/data/block-details/${date}.json`).then(async response=>{
    if(!response.ok)throw new Error(`Block details unavailable (HTTP ${response.status})`);
    const records:BlockRecord[]=await response.json();
    if(!Array.isArray(records)||records.some(b=>!Number.isSafeInteger(b.height)||!Number.isSafeInteger(b.timestamp)||new Date(b.timestamp*1000).toISOString().slice(0,10)!==date||!Number.isFinite(b.difficulty)||b.difficulty<1||![b.size,b.weight,b.txCount].every(Number.isSafeInteger)||(b.totalFeesSat!==null&&(!Number.isSafeInteger(b.totalFeesSat)||b.totalFeesSat<0))||!/^[a-f0-9]{64}$/.test(b.hash)))throw new Error('Invalid block details');
    const blocks=(await loadAllBlocks())[date];
    if(!blocks||records.length!==blocks.length||records.some((b,i)=>[b.height,b.size,b.weight,b.txCount].some((v,j)=>v!==blocks[i][j])))throw new Error('Block detail release mismatch');
    return records;
  }).catch(error=>{blockDetailCache.delete(date);throw error;}));
  return blockDetailCache.get(date)!;
}
