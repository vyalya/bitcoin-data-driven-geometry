import { readJSON, writeJSON } from './lib/data.mjs';
import { auditDataset, validateBlockDay } from './lib/validate.mjs';
const snapshots=readJSON('public/data/snapshots.json'),blocks=readJSON('public/data/blocks.json');
const summary=auditDataset(snapshots,blocks);
for(const [date,records]of Object.entries(readJSON('pipeline/raw/block-days.json')))validateBlockDay(date,records);
const old=readJSON('audit/baseline-snapshots.json');
const changes=snapshots.map(s=>{const o=old.find(x=>x.date===s.date);return {date:s.date,added:!o,changes:o?Object.keys(o).filter(k=>typeof o[k]==='number'||o[k]==null).filter(k=>o[k]!==s[k]).map(k=>({field:k,before:o[k],after:s[k]})):[]};});
writeJSON('audit/data-audit.json',{...summary,missingMempoolDays:snapshots.filter(s=>s.mempoolTxCount==null).map(s=>s.date),missingHistogramDays:snapshots.filter(s=>s.coverage.feeHistogram==='unavailable').map(s=>s.date),changes});
console.log(summary);
