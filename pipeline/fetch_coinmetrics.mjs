import { getJSON, writeJSON, lastCompleteDay } from './lib/data.mjs';
const end = process.argv.find(a => a.startsWith('--as-of='))?.split('=')[1] ?? lastCompleteDay();
let url = `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=AdrActCnt,TxCnt,FeeTotNtv,HashRate,BlkCnt&frequency=1d&start_time=2009-01-03&end_time=${end}&page_size=10000`;
const rows = [], requests = [], seen = new Set();
while (url) {
  if (seen.has(url) || new URL(url).origin !== 'https://community-api.coinmetrics.io') throw new Error('Unexpected pagination URL');
  seen.add(url);
  const response = await getJSON(url);
  if (!Array.isArray(response.data.data)) throw new Error('Missing CoinMetrics rows');
  rows.push(...response.data.data);
  const { data, ...provenance } = response; requests.push(provenance);
  url = data.next_page_url;
}
writeJSON('pipeline/raw/coinmetrics.json', { requests, rows });
console.log(`Saved ${rows.length} daily CoinMetrics rows`);
