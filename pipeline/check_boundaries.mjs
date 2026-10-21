import { readJSON, writeJSON } from './lib/data.mjs';
import { checkBoundaries } from './lib/block-boundaries.mjs';
const days = readJSON('pipeline/raw/block-days.json');
const entries = Object.entries(days);
let next = 0;
async function worker() {
  while (next < entries.length) {
    const [date, entry] = entries[next++];
    if (entry.boundaryScanHeights === 30) continue;
    const before = entry.records.length;
    entry.records = await checkBoundaries(date, entry.records, entry.requests);
    entry.boundaryScanHeights = 30;
    entry.cmCountMatches = entry.records.length === entry.coinmetricsBlockCount;
    writeJSON('pipeline/raw/block-days.json', days);
    console.log(`${date}: ${entry.records.length} blocks; ${entry.records.length-before} added by boundary scan`);
  }
}
await Promise.all([worker(),worker()]);
