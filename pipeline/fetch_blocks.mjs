import { configuration, getJSON, writeJSON, optionalJSON, readJSON, day, validateBlocks, addDays } from './lib/data.mjs';
import { checkBoundaries } from './lib/block-boundaries.mjs';
const dates = configuration();
const cm = new Map(readJSON('pipeline/raw/coinmetrics.json').rows.map(r => [r.time.slice(0,10), r]));
const result = optionalJSON('pipeline/raw/block-days.json', {});
const force = process.argv.includes('--force');
const errors = [];
for (const { date } of dates) {
  if (!force && result[date]?.complete) continue;
  try {
    const end = Date.parse(addDays(date, 1));
    const daily = await getJSON(`https://blockchain.info/blocks/${end}?format=json`);
    if (!Array.isArray(daily.data)) throw new Error('Invalid daily block listing');
    const listing = daily.data.filter(b => day(b.time) === date);
    if (!listing.length && Number(cm.get(date)?.BlkCnt) !== 0 && date !== '2009-01-03') throw new Error('Empty daily block listing');
    const heightSet = new Set(listing.map(b => b.height));
    if (heightSet.size !== listing.length) throw new Error('Duplicate heights in daily listing');
    const requests = [{ url: daily.url, fetchedAt: daily.fetchedAt, sha256: daily.sha256 }];
    let records = [];
    let height = Math.max(...heightSet);
    const minHeight = Math.min(...heightSet);
    while (height >= minHeight) {
      const response = await getJSON(`https://mempool.space/api/v1/blocks/${height}`);
      if (!Array.isArray(response.data) || !response.data.length) throw new Error('Empty block page');
      requests.push({ url: response.url, fetchedAt: response.fetchedAt, sha256: response.sha256 });
      for (const b of response.data) {
        if (!heightSet.has(b.height)) continue;
        const original = listing.find(x => x.height === b.height);
        if (b.id !== original.hash || b.timestamp !== original.time) throw new Error(`Block source disagreement at ${b.height}`);
        records.push({ height:b.height, hash:b.id, timestamp:b.timestamp, size:b.size, weight:b.weight, txCount:b.tx_count, difficulty:b.difficulty, totalFeesSat:b.extras?.totalFees ?? null });
      }
      const next = Math.min(...response.data.map(b => b.height)) - 1;
      if (next >= height) throw new Error('Block pagination stalled');
      height = next;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    records = await checkBoundaries(date, records, requests);
    records.sort((a,b)=>a.height-b.height);
    validateBlocks(records.map(b=>[b.height,b.size,b.weight,b.txCount]), date);
    if (listing.some(b=>!records.some(r=>r.height===b.height))) throw new Error('Incomplete block detail coverage');
    const expected = Number(cm.get(date)?.BlkCnt);
    const cmCountMatches = records.length === expected;
    // Genesis is excluded from CoinMetrics' ledger-derived count.
    if (!cmCountMatches) console.warn(`${date}: source discrepancy retained: block-header count ${records.length}, CoinMetrics ${expected}`);
    result[date] = { complete:true, boundaryScanHeights:30, requests, records, coinmetricsBlockCount:expected, cmCountMatches };
    writeJSON('pipeline/raw/block-days.json', result);
    console.log(`${date}: ${records.length} blocks, independently matched block headers`);
  } catch (error) {
    console.error(`${date}: ${error.message}`); errors.push({date,error:error.message});
  }
}
writeJSON('audit/block-fetch-errors.json', errors);
if (errors.length) process.exitCode = 1;
