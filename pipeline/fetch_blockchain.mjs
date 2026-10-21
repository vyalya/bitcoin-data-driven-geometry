import { getJSON, writeJSON, chartDaily } from './lib/data.mjs';
for (const [chart, expectedUnit] of [['difficulty','Difficulty'],['mempool-count','Transactions'],['mempool-size','Bytes'],['estimated-transaction-volume','BTC']]) {
  const url = `https://api.blockchain.info/charts/${chart}?timespan=all&format=json&sampled=false`;
  const { data, ...request } = await getJSON(url);
  if (data.unit !== expectedUnit) throw new Error(`Unexpected unit for ${chart}: ${data.unit}`);
  const days = chartDaily(data);
  writeJSON(`pipeline/raw/${chart}.json`, { request, unit: data.unit, period: data.period, days });
  console.log(`${chart}: ${Object.keys(days).length} UTC dates, latest ${Object.keys(days).at(-1)}`);
}
