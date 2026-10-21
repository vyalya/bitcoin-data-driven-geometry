// Historical filename retained for npm-script compatibility. Staging is JSON;
// immutable source extracts make a clean checkout reproducible without DuckDB.
import { configuration, readJSON, optionalJSON, writeJSON, number, validateBlocks, mean } from './lib/data.mjs';
import { feeTotalIndex, congestionScore, blockPace, feeBuckets, blockFeeSatoshis } from './lib/metrics.mjs';
const config = configuration();
const cmSource = readJSON('pipeline/raw/coinmetrics.json');
const cm = new Map(cmSource.rows.map(r => [r.time.slice(0,10), r]));
const blockDays = readJSON('pipeline/raw/block-days.json');
const charts = Object.fromEntries(['difficulty','mempool-count','mempool-size','estimated-transaction-volume'].map(k=>[k,readJSON(`pipeline/raw/${k}.json`)]));
const transactionDays = optionalJSON('pipeline/raw/bq-transactions.json', {}).days ?? {};
const snapshots = [], blocks = {}, disagreements = [];
for (const entry of config) {
  const date = entry.date, c = cm.get(date);
  if (!c) throw new Error(`Missing CoinMetrics row for ${date}`);
  const blockDay = blockDays[date];
  if (!blockDay?.complete) throw new Error(`Missing validated full-day block data: ${date}`);
  const records = blockDay.records;
  const tuples = records.map(b=>[b.height,b.size,b.weight,b.txCount]);
  validateBlocks(tuples,date); blocks[date] = tuples;
  const blockCount = records.length;
  const cmBlockCount = number(c.BlkCnt);
  const chart = name => charts[name].days[date]?.value ?? null;
  const mempoolTxCount = chart('mempool-count');
  const mempoolBytes = chart('mempool-size');
  const headerFeesSat = blockFeeSatoshis(records);
  const totalFeesBtc = headerFeesSat == null ? null : headerFeesSat / 1e8;
  const coinmetricsFeesBtc = number(c.FeeTotNtv);
  const coinmetricsTransactionCount = number(c.TxCnt);
  const tx = transactionDays[date];
  const nonCoinbaseTxCount = records.reduce((n,b)=>n+b.txCount-1,0);
  if (tx && tx.transactionCount !== nonCoinbaseTxCount) throw new Error(`Incomplete transaction extract ${date}: ${tx.transactionCount} vs ${nonCoinbaseTxCount}`);
  if (tx && headerFeesSat !== null && tx.totalFeesSat !== headerFeesSat) throw new Error(`Transaction fees disagree with block fees: ${date}`);
  const buckets = tx ? feeBuckets(tx.feeBucketCounts) : [];
  if (tx && tx.feeBucketCounts.reduce((a,b)=>a+b,0) !== tx.transactionCount) throw new Error(`Fee histogram does not cover transactions: ${date}`);
  const warnings = ['Hashrate and active addresses use CoinMetrics normalized Median-Time-Past dates; block geometry and fee totals use raw block-header UTC dates. These are different time windows.'];
  if (cmBlockCount !== blockCount) {
    warnings.push(`CoinMetrics reports ${cmBlockCount} blocks; ${blockCount} matched block headers fall within this UTC day. Block geometry uses header timestamps.`);
    disagreements.push({date,blockCount,coinmetricsBlockCount:cmBlockCount});
  }
  if (!tx) warnings.push('Transaction fee-rate histogram and output-size counts have not been queried; these fields are unavailable.');
  if (mempoolTxCount == null) warnings.push('Historical mempool observations are unavailable or do not cover enough of this UTC day.');
  const difficulty = mean(records.map(b=>b.difficulty));
  const networkHashrateEh = number(c.HashRate) == null ? null : number(c.HashRate)/1e6;
  const provenance = {
    blockCount:'Block-header timestamps, independently matched between Blockchain.com and mempool.space',
    difficulty:'Arithmetic mean of difficulty across all blocks with header timestamps on the UTC date',
    networkHashrateEh:'CoinMetrics HashRate daily estimate, TH/s divided by 1,000,000; provider normalized Median-Time-Past day',
    activeAddresses:'CoinMetrics AdrActCnt; addresses participating in ledger changes, not people; provider normalized Median-Time-Past day',
    totalFeesBtc:'Sum of mempool.space block extras.totalFees in integer satoshis / 100,000,000, for the displayed block-header UTC day',
    coinmetricsFeesBtc:'CoinMetrics FeeTotNtv; normalized daily comparator, not used for the fee geometry',
    mempoolTxCount:'Blockchain.com observed mempool; arithmetic mean of intraday samples',
    mempoolSizeMb:'Blockchain.com observed mempool bytes, arithmetic sample mean divided by 1,000,000',
    btcTransferred:'Blockchain.com estimated transaction value, excluding estimated change; not raw output value',
  };
  snapshots.push({
    schemaVersion:2,id:entry.id,label:entry.label,category:entry.category??"bitcoin",date,context:entry.context??null,contextSources:entry.contextSources??[],
    blockHeight:records.at(-1)?.height??null,blockCount,coinmetricsBlockCount:cmBlockCount,
    transactionCount:nonCoinbaseTxCount,meanBlockWeight:blockCount?records.reduce((n,b)=>n+b.weight,0)/blockCount:null,avgBlockIntervalSeconds:blockCount?86400/blockCount:null,
    blockPace:blockPace(blockCount),networkHashrateEh,mempoolTxCount,mempoolSizeMb:mempoolBytes==null?null:mempoolBytes/1e6,
    feeTotalIndex:feeTotalIndex(totalFeesBtc),congestionScore:congestionScore(mempoolTxCount),
    blockProductionStress:null,minerConcentrationScore:null,networkHealthScore:null,
    difficulty,activeAddresses:number(c.AdrActCnt),uniqueSenders:null,uniqueReceivers:null,
    btcTransferred:chart('estimated-transaction-volume'),totalFeesBtc,coinmetricsFeesBtc,coinmetricsTransactionCount,
    totalOutputs:tx?.totalOutputs??null,whaleOutputs1000:tx?.outputsGte1000??null,whaleOutputs100:tx?.outputs100To1000??null,
    midOutputs10:tx?.outputs10To100??null,retailOutputs:tx?.outputsLt10??null,
    feeBuckets:buckets,notes:warnings,provenance,
    coverage:{mempool:charts['mempool-count'].days[date]??null,mempoolSize:charts['mempool-size'].days[date]??null,feeHistogram:tx?'complete':'unavailable'},
    narration:`${date} UTC: ${blockCount.toLocaleString('en-US')} blocks with ${nonCoinbaseTxCount.toLocaleString('en-US')} non-coinbase transactions. ${totalFeesBtc==null?'Daily fee total unavailable.':`${totalFeesBtc.toLocaleString('en-US',{maximumFractionDigits:8})} BTC in fees across those blocks (mempool.space).`} ${entry.context??''}`.trim(),
  });
}
const max = key => Math.max(1,...snapshots.map(s=>s[key]??0));
const scales={dailyTransactions:max('transactionCount'),feesBtc:max('totalFeesBtc'),hashrateEh:max('networkHashrateEh'),difficulty:max('difficulty'),estimatedVolumeBtc:max('btcTransferred'),blockTxCount:Math.max(1,...Object.values(blocks).flat().map(b=>b[3])),blockSizeBytes:4000000,blockWeight:4000000,detailAddressesPerParticle:1000,gridAddressesPerParticle:8000};
for(const s of snapshots)s.scales=scales;
writeJSON('pipeline/generated/snapshots.json',snapshots);
writeJSON('pipeline/generated/blocks.json',blocks);
writeJSON('pipeline/generated/provenance.json',{schemaVersion:2,builtAt:new Date().toISOString(),dateRange:[config[0].date,config.at(-1).date],snapshotCount:snapshots.length,scales,coinmetricsRequests:cmSource.requests,charts:Object.fromEntries(Object.entries(charts).map(([k,v])=>[k,{...v.request,unit:v.unit,period:v.period,lastDate:Object.keys(v.days).at(-1)}])),blockRequestsFile:'pipeline/raw/block-days.json',timestampMethodology:'https://gitbook-docs.coinmetrics.io/network-data/methodologies/normalizing-block-times',disagreements,limitations:['CoinMetrics normalizes block times using Median-Time-Past; its daily estimates do not share the block geometry’s header-timestamp window.', 'Mempool is observed by one provider, not a global ledger quantity.','No fee tiers or large-output classifications are inferred from aggregate daily fees.','Daily hashrate is a provider estimate, not a security or decentralization rating.','Historical commentary without primary-source support is withheld.']});
console.log(`Built ${snapshots.length} snapshots; ${disagreements.length} provider count disagreements explicitly retained.`);
