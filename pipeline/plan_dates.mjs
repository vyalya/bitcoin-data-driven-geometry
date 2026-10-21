import { readJSON, writeJSON, addDays, validDate, lastCompleteDay } from './lib/data.mjs';
const option = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length+3);
const asOf = option('as-of') ?? lastCompleteDay();
if (!validDate(asOf) || asOf > lastCompleteDay()) throw new Error('Use a completed UTC day');
const config = readJSON('pipeline/config.json');
const current = new Set(config.snapshots.map(s => s.date));
const cm = readJSON('pipeline/raw/coinmetrics.json').rows;
const after = option('after') ?? [...current].sort().at(-1);
if (!validDate(after) || after > asOf) throw new Error('Invalid start of planning window');
const candidates = cm.filter(r => r.time.slice(0,10) > after && r.time.slice(0,10) <= asOf);
const chosen = new Map();
const add = (date, reason, priority = 2) => {
  if (date > asOf || current.has(date)) return;
  if (!chosen.has(date)) chosen.set(date, { date, reasons: [], priority });
  chosen.get(date).reasons.push(reason);
  chosen.get(date).priority = Math.min(chosen.get(date).priority, priority);
};
for (const date of ['2009-01-03','2017-08-24','2021-11-14','2024-01-10']) add(date, 'Missing protocol or approval anchor; verify against primary source', 1);
for (let year = Number(after.slice(0,4)); year <= Number(asOf.slice(0,4)); year++) {
  for (let month=1; month<=12; month++) {
    const date = `${year}-${String(month).padStart(2,'0')}-15`;
    if (date > after) add(date, 'Monthly fixed-calendar baseline');
  }
}
for (const [field, direction] of [['FeeTotNtv',1],['TxCnt',1],['HashRate',1],['HashRate',-1],['BlkCnt',-1]]) {
  const rows = candidates.filter(r => r[field] != null).toSorted((a,b) => direction * (Number(b[field])-Number(a[field])) || a.time.localeCompare(b.time));
  const best = rows[0];
  if (!best) continue;
  const date = best.time.slice(0,10);
  for (const offset of [-1,0,1]) add(addDays(date,offset), offset ? `Adjacent-day control for ${field} extremum on ${date}` : `${direction>0?'Maximum':'Minimum'} ${field} in ${addDays(after,1)}…${asOf}`, offset ? 2 : 1);
}
add(asOf, 'Latest requested completed UTC day; publish missing source fields as null', 1);
const dates = [...chosen.values()].sort((a,b)=>a.date.localeCompare(b.date));
writeJSON('pipeline/next-dates.json', { after, asOf, selection: 'Calendar baselines plus observed extrema and adjacent controls; no price or news inference.', dates });
console.log(JSON.stringify(dates, null, 2));
