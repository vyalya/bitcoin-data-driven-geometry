import {writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from './lib/data.mjs';
import { readJSON, writeJSON } from './lib/data.mjs';
import { auditDataset, validateBlockDay } from './lib/validate.mjs';
const snapshots=readJSON('pipeline/generated/snapshots.json');
const blocks=readJSON('pipeline/generated/blocks.json');
auditDataset(snapshots,blocks);
const raw=readJSON('pipeline/raw/block-days.json');
for(const s of snapshots){
  validateBlockDay(s.date,raw[s.date]);
  const records=raw[s.date].records;
  if(records.length!==blocks[s.date].length||records.some((b,i)=>[b.height,b.size,b.weight,b.txCount].some((v,j)=>v!==blocks[s.date][i][j])))throw new Error(`Block details disagree: ${s.date}`);
}
// Validate every artifact before replacing any public file.
for(const name of ['snapshots','blocks']){const path=resolve(ROOT,`public/data/${name}.json`);writeFileSync(path+'.tmp',JSON.stringify(readJSON(`pipeline/generated/${name}.json`))+'\n');renameSync(path+'.tmp',path);}
writeJSON('public/data/provenance.json',readJSON('pipeline/generated/provenance.json'));
for(const s of snapshots)writeJSON(`public/data/block-details/${s.date}.json`,raw[s.date].records);
console.log(`Exported and validated ${snapshots.length} snapshots`);
