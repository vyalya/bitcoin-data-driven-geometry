// Derive one set of per-block scales from the same published 150-day release.
// No requests, credentials or additional data source are needed.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const snapshots=read('public/data/snapshots.json');
let maxNonCoinbase=0,maxBlockFeesSat=0,maxBlocks=0,totalBlocks=0;
const digest=createHash('sha256');
for(const day of snapshots){
  const records=read(`public/data/block-details/${day.date}.json`);
  if(records.length!==day.blockCount)throw Error(`Block count mismatch: ${day.date}`);
  let tx=0,fee=0,complete=true;
  for(const b of records){
    if(!Number.isSafeInteger(b.txCount)||b.txCount<1)throw Error(`Invalid transaction count: ${b.height}`);
    tx+=b.txCount-1;maxNonCoinbase=Math.max(maxNonCoinbase,b.txCount-1);
    if(b.totalFeesSat===null)complete=false;
    else{if(!Number.isSafeInteger(b.totalFeesSat)||b.totalFeesSat<0)throw Error(`Invalid fees: ${b.height}`);fee+=b.totalFeesSat;maxBlockFeesSat=Math.max(maxBlockFeesSat,b.totalFeesSat);}
  }
  if(tx!==day.transactionCount||complete!==(day.totalFeesBtc!==null)||!Number.isSafeInteger(fee)||complete&&fee!==Math.round(day.totalFeesBtc*1e8))throw Error(`Daily totals mismatch: ${day.date}`);
  maxBlocks=Math.max(maxBlocks,records.length);totalBlocks+=records.length;
  digest.update(JSON.stringify(records));
}
const result={maxNonCoinbase,maxBlockFeesSat,maxBlocks,days:snapshots.length,totalBlocks,release:snapshots.at(-1).date,sourceSha256:digest.digest('hex')};
writeFileSync(new URL('public/data/timechain-scales.json',root),JSON.stringify(result,null,2)+'\n');
console.log(`Timechain scales: ${result.days} days, ${totalBlocks} blocks; ${maxNonCoinbase} transactions and ${maxBlockFeesSat} sat maximum per block.`);
