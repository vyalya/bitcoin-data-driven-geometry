import { readFileSync } from 'node:fs';
import { optionalJSON, readJSON, writeJSON, number, validDate, sha256 } from './lib/data.mjs';
import { feeBuckets, blockFeeSatoshis } from './lib/metrics.mjs';
const path=process.argv[2];
const jobId=process.argv.find(a=>a.startsWith('--job-id='))?.slice(9);
if(!path || !jobId)throw new Error('Usage: node pipeline/ingest_bigquery.mjs export.json --job-id=PROJECT:LOCATION.JOB_ID');
const text=readFileSync(path,'utf8');const rows=JSON.parse(text);
if(!Array.isArray(rows)||!rows.length)throw new Error('Expected nonempty BigQuery JSON array');
const blocks=readJSON('pipeline/raw/block-days.json');
const staged=optionalJSON('pipeline/raw/bq-transactions.json',{days:{},imports:[]});
const seen=new Set();
for(const raw of rows){
  if(!validDate(raw.date)||seen.has(raw.date))throw new Error('Invalid/duplicate date');
  seen.add(raw.date);
  const row={date:raw.date};
  for(const key of ['transactionCount','uniqueTransactionCount','invalidFeeTransactions','totalFeesSat','totalOutputs','invalidOutputs','outputsGte1000','outputs100To1000','outputs10To100','outputsLt10']){
    row[key]=number(raw[key]);if(!Number.isSafeInteger(row[key]))throw new Error(`Invalid exact integer: ${key}`);
  }
  if(!/^[0-9]+$/.test(String(raw.rawOutputValueSat)))throw new Error('Invalid raw output value');
  row.rawOutputValueSat=BigInt(raw.rawOutputValueSat).toString();
  row.feeBucketCounts=raw.feeBucketCounts?.map(number);feeBuckets(row.feeBucketCounts);
  if(!blocks[row.date]?.complete)throw new Error(`Missing verified blocks: ${row.date}`);
  const expected=blocks[row.date].records.reduce((n,b)=>n+b.txCount-1,0);
  const expectedFees=blockFeeSatoshis(blocks[row.date].records);
  if(expectedFees!==null && row.totalFeesSat!==expectedFees)throw new Error(`Fee total disagrees with independent block data: ${row.date}`);
  if(row.transactionCount!==expected || row.uniqueTransactionCount!==expected || row.invalidFeeTransactions || row.invalidOutputs)throw new Error(`Incomplete or invalid transaction data: ${row.date}`);
  if(row.feeBucketCounts.reduce((a,b)=>a+b,0)!==expected)throw new Error('Histogram does not partition the transactions');
  if(row.outputsGte1000+row.outputs100To1000+row.outputs10To100+row.outputsLt10!==row.totalOutputs)throw new Error('Output buckets do not partition the outputs');
  staged.days[row.date]=row;
}
staged.imports.push({jobId,importedAt:new Date().toISOString(),sha256:sha256(text),querySha256:sha256(readFileSync('pipeline/queries/transaction_metrics.sql')),dates:[...seen]});
writeJSON('pipeline/raw/bq-transactions.json',staged);
console.log(`Validated ${seen.size} complete transaction-day extracts`);
