// The connected gear adds no data provider: these per-block fees are derived from
// the same verified records already used by the detail inspector.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const whole = value => Number.isSafeInteger(value) && value >= 0;

export function deriveBlockFeesData(snapshots, blocksByDate, recordsByDate) {
  if (!Array.isArray(snapshots) || !snapshots.length) throw Error('Missing snapshot release');
  const result = { schemaVersion: 1, maxNonCoinbase: 0, maxBlockFeesSat: 0, maxBlocks: 0, days: {} };
  const dates = new Set();
  for (const day of snapshots) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || dates.has(day.date)) throw Error('Invalid or repeated snapshot date');
    dates.add(day.date);
    const records = recordsByDate[day.date], tuples = blocksByDate[day.date];
    if (!Array.isArray(records) || !Array.isArray(tuples) || records.length !== day.blockCount || records.length !== tuples.length) {
      throw Error(`Block count mismatch: ${day.date}`);
    }
    const row = { heights: [], feesSat: [] };
    let tx = 0, fee = 0, complete = true, previousHeight = -1;
    records.forEach((block, i) => {
      const compact = [block.height, block.size, block.weight, block.txCount];
      if (!compact.every(whole) || block.txCount < 1 || block.weight > 4_000_000 || block.height <= previousHeight
        || !Array.isArray(tuples[i]) || tuples[i].length !== 4 || compact.some((v, j) => v !== tuples[i][j])) {
        throw Error(`Block details disagree with compact release: ${day.date} / ${i}`);
      }
      if (!whole(block.timestamp) || new Date(block.timestamp * 1000).toISOString().slice(0, 10) !== day.date) {
        throw Error(`Block outside UTC header day: ${day.date} / ${i}`);
      }
      previousHeight = block.height;
      row.heights.push(block.height);
      if (block.totalFeesSat === null) complete = false;
      else {
        if (!whole(block.totalFeesSat)) throw Error(`Invalid fees: ${block.height}`);
        fee += block.totalFeesSat;
        result.maxBlockFeesSat = Math.max(result.maxBlockFeesSat, block.totalFeesSat);
      }
      row.feesSat.push(block.totalFeesSat);
      tx += block.txCount - 1;
      result.maxNonCoinbase = Math.max(result.maxNonCoinbase, block.txCount - 1);
    });
    if (!Number.isSafeInteger(tx) || tx !== day.transactionCount || !Number.isSafeInteger(fee)
      || complete !== (day.totalFeesBtc !== null) || complete && fee !== Math.round(day.totalFeesBtc * 1e8)) {
      throw Error(`Daily totals mismatch: ${day.date}`);
    }
    result.maxBlocks = Math.max(result.maxBlocks, records.length);
    result.days[day.date] = row;
  }
  if (Object.keys(blocksByDate).length !== dates.size || Object.keys(recordsByDate).length !== dates.size) throw Error('Release date mismatch');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
  const snapshots = read('public/data/snapshots.json');
  const records = Object.fromEntries(snapshots.map(day => [day.date, read(`public/data/block-details/${day.date}.json`)]));
  const result = deriveBlockFeesData(snapshots, read('public/data/blocks.json'), records);
  writeFileSync(new URL('public/data/block-fees.json', root), JSON.stringify(result) + '\n');
  console.log(`Block fee data: ${Object.keys(result.days).length} days, ${Object.values(result.days).reduce((n, day) => n + day.heights.length, 0)} blocks; verified fee identities and daily totals.`);
}
