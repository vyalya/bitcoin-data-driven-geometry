import { getJSON, day } from './data.mjs';

// Header timestamps need not increase with height. Scan outside both daily
// endpoints even when an unrelated provider's normalized daily count matches.
export async function checkBoundaries(date, records, requests) {
  if (!records.length) return records;
  const byHeight = new Map(records.map(b => [b.height, b]));
  const low = Math.min(...byHeight.keys()), high = Math.max(...byHeight.keys());
  const tips = new Set([high + 30, high + 15, low - 1, low - 16].filter(h => h >= 0));
  for (let h = low; h <= high; h++) if (!byHeight.has(h)) tips.add(h);
  for (const tip of tips) {
    const response = await getJSON(`https://mempool.space/api/v1/blocks/${tip}`);
    if (!Array.isArray(response.data) || !response.data.length) throw new Error('Empty boundary page');
    requests.push({url:response.url,fetchedAt:response.fetchedAt,sha256:response.sha256});
    for (const b of response.data) {
      if (day(b.timestamp) !== date || byHeight.has(b.height)) continue;
      const second = await getJSON(`https://blockstream.info/api/blocks/${b.height}`);
      requests.push({url:second.url,fetchedAt:second.fetchedAt,sha256:second.sha256});
      const check = second.data.find(x => x.height === b.height);
      if (!check || ['id','timestamp','size','weight','tx_count'].some(k => check[k] !== b[k])) throw new Error(`Independent boundary mismatch ${b.height}`);
      byHeight.set(b.height, {height:b.height,hash:b.id,timestamp:b.timestamp,size:b.size,weight:b.weight,txCount:b.tx_count,difficulty:b.difficulty,totalFeesSat:b.extras?.totalFees??null});
    }
  }
  return [...byHeight.values()].sort((a,b) => a.height-b.height);
}
