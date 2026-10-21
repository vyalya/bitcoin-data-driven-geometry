import test from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, number, chartDaily, validateBlocks, validDate } from '../pipeline/lib/data.mjs';
import { feeBuckets, feeTotalIndex, congestionScore, blockFeeSatoshis } from '../pipeline/lib/metrics.mjs';
import { auditDataset, validateBlockDay } from '../pipeline/lib/validate.mjs';
import { normalized, difficultyFill, paceFill, formatMetric } from '../src/metrics.ts';

test('missing data remains missing; measured zero remains zero',()=>{
  assert.equal(number(null),null);assert.equal(number(''),null);assert.equal(number('0'),0);
  assert.equal(feeTotalIndex(null),null);assert.equal(congestionScore(null),null);
  assert.equal(congestionScore(0),0);assert.equal(formatMetric(null),'— unavailable');
  assert.equal(formatMetric(0),'0');assert.throws(()=>number('not a number'));assert.throws(()=>number(-1));
});
test('mempool sample means use all UTC readings, preserve zeros and reject partial days',()=>{
  const start=Date.parse('2024-04-20')/1000;
  const values=Array.from({length:96},(_,i)=>({x:start+i*900,y:i===95?96:0}));
  const mean=chartDaily({status:'ok',period:'minute',values});
  assert.equal(mean['2024-04-20'].value,1);assert.equal(mean['2024-04-20'].samples,96);
  const partial=chartDaily({status:'ok',period:'minute',values:values.slice(0,20)});
  assert.equal(partial['2024-04-20'].value,null);
  const zero=chartDaily({status:'ok',period:'day',values:[{x:start,y:0}]});assert.equal(zero['2024-04-20'].value,0);
  assert.throws(()=>chartDaily({status:'ok',period:'minute',values:[...values,values[0]]}));
});
test('sample gaps and next-day timestamps do not silently contaminate a day',()=>{
  const start=Date.parse('2024-04-20')/1000;
  const values=Array.from({length:97},(_,i)=>({x:start+i*900,y:i===96?1000000:12}));
  const days=chartDaily({status:'ok',period:'minute',values});assert.equal(days['2024-04-20'].value,12);assert.equal(days['2024-04-21'].value,null);
  const gap=chartDaily({status:'ok',period:'minute',values:values.filter((_,i)=>i<20||i>40)});assert.equal(gap['2024-04-20'].value,null);
});
test('fee histograms require observed counts, not a scalar fee total',()=>{
  assert.deepEqual(feeBuckets(null),[]);assert.throws(()=>feeBuckets(5));assert.deepEqual(feeBuckets([0,0,0,0]),[]);
  const buckets=feeBuckets([1,2,3,4]);assert.deepEqual(buckets.map(b=>b.txShare),[.1,.2,.3,.4]);
  assert.throws(()=>feeBuckets([1,-1,0,0]));assert.throws(()=>feeBuckets([.5,1,0,0]));
});
test('block fee totals keep integer units and propagate missing blocks',()=>{
  assert.equal(blockFeeSatoshis([{totalFeesSat:1},{totalFeesSat:2}]),3);
  assert.equal(blockFeeSatoshis([{totalFeesSat:0}]),0);
  assert.equal(blockFeeSatoshis([{totalFeesSat:100},{totalFeesSat:null}]),null);
  assert.throws(()=>blockFeeSatoshis([{totalFeesSat:-1}]));
});
test('fee geometry uses the same block-header day as the crown',()=>{
  const raw=readJSON('pipeline/raw/block-days.json');
  for(const s of readJSON('public/data/snapshots.json')){
    const sat=blockFeeSatoshis(raw[s.date].records);
    assert.equal(s.totalFeesBtc,sat===null?null:sat/1e8);
    assert.ok(s.notes.some(n=>n.includes('Median-Time-Past')));
    assert.equal(raw[s.date].boundaryScanHeights,30);
  }
});
test('render scales have no fake minimum arcs and production uses 144 blocks',()=>{
  assert.equal(normalized(null,100),0);assert.equal(normalized(0,100),0);assert.ok(Math.abs(normalized(1e-9,100)-1e-11)<1e-25);
  assert.equal(paceFill(144),1);assert.equal(paceFill(72),.5);assert.equal(paceFill(200),1);
  assert.equal(difficultyFill(1,1e14),0);assert.equal(difficultyFill(1e7,1e14),.5);
});
test('impossible blocks and duplicate heights are rejected',()=>{
  validateBlocks([[0,285,1140,1]],'2009-01-03');
  assert.throws(()=>validateBlocks([[1,1000,4000001,1]],'2009-01-03'));
  assert.throws(()=>validateBlocks([[1,215,860,1],[1,215,860,1]],'2009-01-03'));
});
test('dates must be actual calendar dates',()=>{
  assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2023-02-29'),false);assert.equal(validDate('2024-13-01'),false);
});
test('all published snapshots match complete block extracts',()=>{
  const snapshots=readJSON('public/data/snapshots.json'),blocks=readJSON('public/data/blocks.json');
  assert.equal(auditDataset(snapshots,blocks).snapshots,readJSON('pipeline/config.json').snapshots.length);
  for(const [date,record]of Object.entries(readJSON('pipeline/raw/block-days.json')))validateBlockDay(date,record);
});
test('genesis and known boundary corrections are retained without disguising source disagreements',()=>{
  const snapshots=readJSON('public/data/snapshots.json');
  const genesis=snapshots.find(s=>s.date==='2009-01-03');assert.equal(genesis.blockHeight,0);assert.equal(genesis.blockCount,1);assert.equal(genesis.coinmetricsBlockCount,0);
  const early=snapshots.find(s=>s.date==='2009-01-09');assert.equal(early.blockCount,14);assert.equal(early.coinmetricsBlockCount,19);assert.ok(early.notes.some(n=>n.includes('19')));
  assert.equal(snapshots.find(s=>s.date==='2020-04-08').blockCount,144);
  assert.equal(snapshots.find(s=>s.date==='2026-10-05').blockCount,177);
});
test('regressions cannot export artificial scores or mismatched block counts',()=>{
  const snapshots=readJSON('public/data/snapshots.json'),blocks=readJSON('public/data/blocks.json');
  const corrupted=structuredClone(snapshots);corrupted[0].networkHealthScore=10;assert.throws(()=>auditDataset(corrupted,blocks));
  corrupted[0].networkHealthScore=null;corrupted[0].blockCount++;assert.throws(()=>auditDataset(corrupted,blocks));
});
test('fresh data uses proper megabytes, observed means, and unavailable outputs',()=>{
  const snapshots=readJSON('public/data/snapshots.json');
  const mempool=readJSON('pipeline/raw/mempool-size.json');
  for(const s of snapshots){const bytes=mempool.days[s.date]?.value??null;assert.equal(s.mempoolSizeMb,bytes==null?null:bytes/1e6);if(s.coverage.feeHistogram==='unavailable'){assert.equal(s.totalOutputs,null);assert.deepEqual(s.feeBuckets,[]);}}
  assert.equal(snapshots.find(s=>s.date==='2010-05-22').mempoolTxCount,null);
  assert.equal(snapshots.find(s=>s.date==='2026-10-19').mempoolTxCount,null);
});
test('loader fails visibly instead of returning fictional fallback measurements',async()=>{
  const original=global.fetch;
  try{
    const {loadSnapshots}=await import('../src/db.ts');
    global.fetch=async()=>({ok:false,status:503});await assert.rejects(loadSnapshots(),/503/);
    global.fetch=async()=>({ok:true,json:async()=>[{id:'broken'}]});await assert.rejects(loadSnapshots(),/Invalid snapshot/);
  }finally{global.fetch=original;}
});

test('150 curated dates retain 103 previous dates and all have labels and context sources',()=>{
  const config=readJSON('pipeline/config.json'),previous=readJSON('audit/config-before-150.json');
  const dates=new Set(config.snapshots.map(s=>s.date)),old=new Set(previous.snapshots.map(s=>s.date));
  assert.equal(dates.size,150);assert.equal([...dates].filter(d=>old.has(d)).length,103);
  for(const s of config.snapshots){assert.ok(s.contextSources.length>0);assert.ok(s.context&&s.category);assert.ok(!/^\d{4}-\d{2}-\d{2} snapshot$/i.test(s.label));assert.ok(s.date<=config.selection.asOf);}
});
test('all seven core quantities reconcile to raw blocks and provider observations',()=>{
  const raw=readJSON('pipeline/raw/block-days.json');
  const cm=new Map(readJSON('pipeline/raw/coinmetrics.json').rows.map(r=>[r.time.slice(0,10),r]));
  for(const s of readJSON('public/data/snapshots.json')){
    const records=raw[s.date].records,c=cm.get(s.date);
    assert.equal(s.blockCount,records.length);
    assert.equal(s.transactionCount,records.reduce((n,b)=>n+b.txCount,0)-records.length);
    assert.equal(s.meanBlockWeight,records.reduce((n,b)=>n+b.weight,0)/records.length);
    // Fees are compared as integer satoshis, not an accumulated BTC float.
    assert.equal(Math.round(s.totalFeesBtc*1e8),records.reduce((n,b)=>n+b.totalFeesSat,0));
    assert.equal(s.activeAddresses,number(c.AdrActCnt));
    assert.equal(s.networkHashrateEh,c.HashRate==null?null:number(c.HashRate)/1e6);
    // Independent weighted mean over the unique difficulty values in a day.
    const groups=new Map();for(const b of records)groups.set(b.difficulty,(groups.get(b.difficulty)??0)+1);
    const weighted=[...groups].reduce((n,[difficulty,count])=>n+difficulty*count/records.length,0);
    assert.ok(Math.abs(s.difficulty-weighted)<=Math.max(1e-12,weighted*5e-15));
    if(groups.size===1)assert.equal(s.difficulty,records[0].difficulty);
    const details=readJSON(`public/data/block-details/${s.date}.json`);
    assert.deepEqual(details,records);
  }
});
test('incorrect transaction, weight and shared-scale aggregates are rejected',()=>{
  const snapshots=readJSON('public/data/snapshots.json'),blocks=readJSON('public/data/blocks.json');
  for(const mutate of [s=>s.transactionCount++,s=>s.meanBlockWeight++,s=>s.scales.dailyTransactions++,s=>delete s.scales.dailyTransactions]){
    const corrupted=structuredClone(snapshots);mutate(corrupted[0]);assert.throws(()=>auditDataset(corrupted,blocks));
  }
});
