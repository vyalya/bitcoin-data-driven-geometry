import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, readJSON, validDate } from './lib/data.mjs';
const query=readFileSync(resolve(ROOT,'pipeline/queries/transaction_metrics.sql'),'utf8');
for(const [name,file] of [['next','next-dates-parameter.json'],['all','all-dates-parameter.json']]){
  const dates=readJSON(`pipeline/queries/${file}`);
  if(!Array.isArray(dates)||!dates.length||dates.some(d=>!validDate(d))||new Set(dates).size!==dates.length)throw new Error('Invalid query dates');
  const literal=`[${dates.map(d=>`DATE '${d}'`).join(', ')}]`;
  const body=query.split('\n').filter(l=>!l.startsWith('-- Standard SQL.')).join('\n').replaceAll('@dates',literal);
  writeFileSync(resolve(ROOT,`pipeline/queries/transaction_metrics_${name}.sql`),`-- Generated; ${dates.length} dates. Dry-run before execution.\n`+body);
}
