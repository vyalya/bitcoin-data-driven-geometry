import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { relationshipGroups } from '../src/gear/relationships.ts';
import { deriveBlockFeesData } from '../pipeline/block_fees.mjs';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const snapshots = read('public/data/snapshots.json');
const tuples = read('public/data/blocks.json');
const records = Object.fromEntries(snapshots.map(day => [day.date, read(`public/data/block-details/${day.date}.json`)]));
const derived = deriveBlockFeesData(snapshots, tuples, records);
const bundled = await build({ entryPoints: [new URL('../src/gear/data.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm' });
const { validateGearData, loadGearData } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('Gear fee identities and totals reconcile with every published block and UTC day', () => {
  assert.equal(snapshots.length, 150);
  assert.equal(Object.values(records).flat().length, 22374);
  assert.deepEqual(read('public/data/block-fees.json'), derived);
  assert.equal(validateGearData(derived, tuples), derived);
  for (const day of snapshots) {
    const row = derived.days[day.date], blocks = records[day.date];
    assert.deepEqual(row.heights, blocks.map(block => block.height));
    assert.deepEqual(row.feesSat, blocks.map(block => block.totalFeesSat));
    assert.equal(row.heights.length, day.blockCount);
    assert.equal(row.feesSat.reduce((sum, fee) => sum + fee, 0), Math.round(day.totalFeesBtc * 1e8));
    assert.equal(blocks.reduce((sum, block) => sum + block.txCount - 1, 0), day.transactionCount);
    for (const block of blocks) assert.equal(new Date(block.timestamp * 1000).toISOString().slice(0, 10), day.date);
  }
  assert.equal(derived.maxBlocks, Math.max(...Object.values(tuples).map(day => day.length)));
  assert.equal(derived.maxNonCoinbase, 7928);
  assert.equal(derived.maxBlockFeesSat, 3762561499);
});

test('relationship highlights express protocol roles without inventing address-to-block topology', () => {
  for (const signal of ['spine', 'transactions', 'fees-total', 'difficulty', 'hashrate', 'particles']) {
    const related = relationshipGroups(signal);
    assert.ok(related.includes(signal));
    assert.equal(new Set(related).size, related.length);
    assert.ok(related.every(value => typeof value === 'string'));
  }
  assert.deepEqual(relationshipGroups('particles'), ['particles', 'transactions']);
  assert.deepEqual(new Set(relationshipGroups('spine')), new Set(['spine', 'transactions', 'fees-total', 'difficulty', 'hashrate']));
  for (const signal of ['difficulty', 'hashrate']) {
    assert.ok(relationshipGroups(signal).includes(signal === 'difficulty' ? 'hashrate' : 'difficulty'));
    assert.ok(relationshipGroups(signal).includes('spine'));
    assert.ok(!relationshipGroups(signal).includes('particles'));
  }
  assert.deepEqual(new Set(relationshipGroups('fees-total')), new Set(['fees-total', 'transactions', 'spine', 'difficulty', 'hashrate']));
  assert.deepEqual(relationshipGroups('unknown'), []);
  assert.deepEqual(relationshipGroups(null), []);
  relationshipGroups('spine').push('fabricated');
  assert.ok(!relationshipGroups('spine').includes('fabricated'));
});

const fixture = () => ({
  snapshots: [{ date: '2009-01-03', blockCount: 1, transactionCount: 0, totalFeesBtc: 0 }],
  tuples: { '2009-01-03': [[0, 285, 1140, 1]] },
  records: { '2009-01-03': [{ height: 0, size: 285, weight: 1140, txCount: 1, timestamp: 1231006505, totalFeesSat: 0 }] },
});
test('generator and loader reject mixed identities, changed scales, totals, dates, and duplicate heights', () => {
  const f = fixture(), generated = deriveBlockFeesData(f.snapshots, f.tuples, f.records);
  assert.equal(validateGearData(generated, f.tuples), generated);
  for (const mutate of [
    value => value.days['2009-01-03'].heights[0]++,
    value => value.days['2009-01-03'].feesSat.push(0),
    value => value.days['2009-01-03'].feesSat[0] = -1,
    value => value.days['2009-01-03'].feesSat[0] = '0',
    value => value.maxNonCoinbase++, value => value.maxBlockFeesSat++,
    value => value.maxBlocks++, value => value.maxBlocks = -1,
    value => value.schemaVersion = 2,
    value => value.days['2009-01-04'] = value.days['2009-01-03'],
  ]) {
    const changed = structuredClone(generated); mutate(changed);
    assert.throws(() => validateGearData(changed, f.tuples));
  }
  for (const mutate of [
    value => value.records['2009-01-03'][0].height++,
    value => value.records['2009-01-03'][0].totalFeesSat++,
    value => value.records['2009-01-03'][0].txCount++,
    value => value.records['2009-01-03'][0].timestamp += 86400,
    value => value.snapshots[0].blockCount++,
  ]) {
    const changed = fixture(); mutate(changed);
    assert.throws(() => deriveBlockFeesData(changed.snapshots, changed.tuples, changed.records));
  }
  const duplicated = fixture();
  duplicated.snapshots[0].blockCount = 2;
  duplicated.records['2009-01-03'].push({ ...duplicated.records['2009-01-03'][0] });
  duplicated.tuples['2009-01-03'].push([...duplicated.tuples['2009-01-03'][0]]);
  assert.throws(() => deriveBlockFeesData(duplicated.snapshots, duplicated.tuples, duplicated.records), /details disagree/);
  const duplicateData = { schemaVersion: 1, maxNonCoinbase: 0, maxBlockFeesSat: 0, maxBlocks: 2, days: { '2009-01-03': { heights: [0, 0], feesSat: [0, 0] } } };
  assert.throws(() => validateGearData(duplicateData, duplicated.tuples), /identity or value mismatch/);
  const missing = fixture();
  missing.records['2009-01-03'][0].totalFeesSat = null;
  missing.snapshots[0].totalFeesBtc = null;
  const unavailable = deriveBlockFeesData(missing.snapshots, missing.tuples, missing.records);
  assert.equal(unavailable.days['2009-01-03'].feesSat[0], null);
  assert.equal(validateGearData(unavailable, missing.tuples), unavailable);
});

test('Gear loader memoizes a validated release and recovers from a failed fetch', async () => {
  const originalFetch = globalThis.fetch, requests = [];
  let fail = true;
  globalThis.fetch = async path => {
    requests.push(path);
    if (path === '/data/blocks.json') return new Response(JSON.stringify(tuples));
    assert.equal(path, '/data/block-fees.json');
    return fail ? new Response('unavailable', { status: 503 }) : new Response(JSON.stringify(derived));
  };
  try {
    const first = loadGearData();
    assert.equal(loadGearData(), first);
    await assert.rejects(first, /HTTP 503/);
    fail = false;
    const recovered = loadGearData();
    assert.equal(loadGearData(), recovered);
    assert.deepEqual(await recovered, derived);
    assert.equal(loadGearData(), recovered);
    assert.deepEqual(requests, ['/data/block-fees.json', '/data/blocks.json', '/data/block-fees.json']);
  } finally { globalThis.fetch = originalFetch; }
});

test('dynamic gear data accepts a coherent release larger than the former 223-block layout', () => {
  const f = fixture(), count = 300, first = f.records['2009-01-03'][0];
  f.snapshots[0].blockCount = count;
  f.records['2009-01-03'] = Array.from({ length: count }, (_, height) => ({ ...first, height }));
  f.tuples['2009-01-03'] = f.records['2009-01-03'].map(block => [block.height, block.size, block.weight, block.txCount]);
  const larger = deriveBlockFeesData(f.snapshots, f.tuples, f.records);
  assert.equal(larger.maxBlocks, count);
  assert.equal(larger.days['2009-01-03'].heights.length, count);
  assert.equal(validateGearData(larger, f.tuples), larger);
});
