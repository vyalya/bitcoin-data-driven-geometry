import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const readJSON = path => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
export const optionalJSON = (path, fallback) => existsSync(resolve(ROOT, path)) ? readJSON(path) : fallback;
export function writeJSON(path, value) {
  const target = resolve(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(`${target}.tmp`, JSON.stringify(value, null, 2) + '\n');
  renameSync(`${target}.tmp`, target);
}
export const sha256 = text => createHash('sha256').update(text).digest('hex');
export function number(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid nonnegative measurement: ${value}`);
  return n;
}
export function mean(values) {
  if(!values.length)return null;
  // Subtract a reference before summing. Identical large difficulties must
  // retain exactly the same value instead of accumulating rounding drift.
  const reference=values[0];
  return reference+values.reduce((sum,value)=>sum+(value-reference),0)/values.length;
}
export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export const day = timestamp => new Date(timestamp * 1000).toISOString().slice(0, 10);
export const addDays = (date, n) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
export const lastCompleteDay = () => addDays(new Date().toISOString().slice(0, 10), -1);
export function configuration() {
  const config = readJSON('pipeline/config.json');
  const ids = new Set(), dates = new Set();
  for (const s of config.snapshots) {
    if (!validDate(s.date) || s.date > lastCompleteDay() || ids.has(s.id) || dates.has(s.date)) throw new Error(`Invalid/duplicate/incomplete snapshot: ${s.id} ${s.date}`);
    ids.add(s.id); dates.add(s.date);
  }
  return config.snapshots.toSorted((a, b) => a.date.localeCompare(b.date));
}
export async function getJSON(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'bitcoin-geometry-audit/2' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
      const text = await response.text();
      return { data: JSON.parse(text), url, fetchedAt: new Date().toISOString(), sha256: sha256(text) };
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}
export function chartDaily(chart, { sampled = false } = {}) {
  if (sampled || chart.status !== 'ok' || !Array.isArray(chart.values)) throw new Error('Invalid or sampled chart');
  const groups = new Map();
  for (const point of chart.values) {
    const value = number(point.y);
    if (!Number.isFinite(point.x) || value == null) continue;
    const date = day(point.x);
    if (!groups.has(date)) groups.set(date, new Map());
    if (groups.get(date).has(point.x)) throw new Error(`Duplicate chart timestamp: ${point.x}`);
    groups.get(date).set(point.x, value);
  }
  const result = {};
  for (const [date, values] of groups) {
    const points = [...values].sort((a, b) => a[0] - b[0]);
    // Intraday data: arithmetic mean of provider samples, not a time-weighted
    // network-wide mean. Require broad coverage; do not turn partial days into zeros.
    const daily = chart.period === 'day';
    const start = Date.parse(date) / 1000;
    const gaps = points.slice(1).map((p, i) => p[0] - points[i][0]);
    const complete = daily ? points.length === 1 : points.length >= 24 && points[0][0] - start <= 3600 && start + 86400 - points.at(-1)[0] <= 3600 && Math.max(...gaps) <= 3600;
    result[date] = {
      value: complete ? points.reduce((s, p) => s + p[1], 0) / points.length : null,
      samples: points.length, complete,
      firstTimestamp: points[0][0], lastTimestamp: points.at(-1)[0],
      aggregation: daily ? 'provider daily value' : 'arithmetic mean of provider intraday samples',
    };
  }
  return result;
}
export function validateBlocks(blocks, date) {
  if (!Array.isArray(blocks)) throw new Error(`Invalid blocks: ${date}`);
  const seen = new Set();
  for (const block of blocks) {
    if (!Array.isArray(block) || block.length !== 4 || !block.every(Number.isSafeInteger)) throw new Error(`Invalid block tuple: ${date}`);
    const [height, size, weight, txs] = block;
    if (seen.has(height) || height < 0 || size < 80 || size > 4000000 || weight < size || weight > size * 4 || weight > 4000000 || txs < 1) throw new Error(`Impossible/duplicate block: ${date} ${height}`);
    seen.add(height);
  }
}
