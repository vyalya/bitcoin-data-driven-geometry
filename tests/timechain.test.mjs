import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {OrbitControls} from 'three-stdlib';
import {fitStudyCamera} from '../src/timechain/camera.ts';
import {
  TILE_WIDTH, TILE_DEPTH, BLOCK_WEIGHT_REFERENCE,
  placement, tileHeight, txFill, feeFill, signalFill, blockAdjacent, addressCount,
} from '../src/timechain/model.ts';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const snapshots = read('public/data/snapshots.json');
const recordsByDate = new Map(snapshots.map(day => [day.date, read(`public/data/block-details/${day.date}.json`)]));
const allRecords = [...recordsByDate.values()].flat();
const maxTransactions = Math.max(...allRecords.map(block => block.txCount - 1));
const maxFees = Math.max(...allRecords.map(block => block.totalFeesSat ?? 0));
const layouts = ['spiral', 'ribbon', 'strata'];

test('Timechain block encodings reconcile every published day to raw block figures', () => {
  assert.equal(snapshots.length, 150);
  assert.equal(allRecords.length, 22374);
  for (const day of snapshots) {
    const blocks = recordsByDate.get(day.date);
    assert.equal(blocks.length, day.blockCount, day.date);
    const tx = blocks.reduce((sum, block) => sum + block.txCount - 1, 0);
    const feesSat = blocks.reduce((sum, block) => {
      assert.ok(Number.isSafeInteger(block.totalFeesSat), `${day.date}: missing fee evidence`);
      return sum + block.totalFeesSat;
    }, 0);
    assert.equal(tx, day.transactionCount, `${day.date}: transactions`);
    assert.equal(feesSat, Math.round(day.totalFeesBtc * 1e8), `${day.date}: fees`);
    const totalWeight = blocks.reduce((sum, block) => sum + block.weight, 0);
    assert.ok(Math.abs(totalWeight / blocks.length - day.meanBlockWeight) < 1e-8, `${day.date}: mean weight`);
    for (const block of blocks) {
      const txBar = txFill(block, maxTransactions);
      const feeBar = feeFill(block.totalFeesSat, maxFees);
      assert.ok(Math.abs(txBar * maxTransactions - (block.txCount - 1)) < 1e-9);
      // Invert the actual log encoding, proving that its reference is BTC and
      // not a date-specific maximum or an accidental satoshi-scale logarithm.
      const decodedSat = Math.expm1(feeBar * Math.log1p(maxFees / 1e8)) * 1e8;
      assert.ok(Math.abs(decodedSat - block.totalFeesSat) < 0.0001);
      assert.ok(Math.abs((tileHeight(block.weight) - 0.06) / 0.70 * BLOCK_WEIGHT_REFERENCE - block.weight) < 1e-8);
    }
  }
});

test('zero, unavailable values, and release-wide scales retain distinct meanings', () => {
  assert.equal(signalFill(null, 10), null);
  assert.equal(signalFill(undefined, 10), null);
  assert.equal(signalFill(NaN, 10), null);
  assert.equal(signalFill(0, 0), 0);
  assert.equal(signalFill(10, 0), null);
  assert.equal(signalFill(5, 10), 0.5);
  assert.equal(signalFill(20, 10), 1);
  assert.equal(txFill({ txCount: 1 }, maxTransactions), 0);
  assert.equal(txFill({ txCount: 0 }, maxTransactions), null);
  assert.equal(txFill({ txCount: maxTransactions + 1 }, maxTransactions), 1);
  assert.equal(feeFill(null, maxFees), null);
  assert.equal(feeFill(0, maxFees), 0);
  assert.equal(feeFill(0, 0), 0);
  assert.equal(feeFill(1, 0), null);
  assert.equal(feeFill(maxFees, maxFees), 1);
  assert.ok(feeFill(1, maxFees) > 0);
  assert.ok(feeFill(1e7, maxFees) < feeFill(1e8, maxFees));
  assert.equal(tileHeight(0), 0.06);
  assert.equal(tileHeight(4e6), 0.76);
  assert.throws(() => tileHeight(NaN), RangeError);
  assert.throws(() => tileHeight(-1), RangeError);
  // Same underlying observation must have the same dimensions on every date.
  const chosen = allRecords.find(block => block.txCount > 1000 && block.totalFeesSat > 0);
  const expected = [tileHeight(chosen.weight), txFill(chosen, maxTransactions), feeFill(chosen.totalFeesSat, maxFees)];
  for (const date of snapshots) {
    const context = recordsByDate.get(date.date);
    assert.deepEqual([...context, chosen].slice(-1).map(block => [tileHeight(block.weight), txFill(block, maxTransactions), feeFill(block.totalFeesSat, maxFees)])[0], expected);
  }
});

test('connectors never bridge a missing block height or reverse chain order', () => {
  assert.equal(blockAdjacent({ height: 0 }, { height: 1 }), true);
  assert.equal(blockAdjacent({ height: 1 }, { height: 3 }), false);
  assert.equal(blockAdjacent({ height: 2 }, { height: 1 }), false);
  assert.equal(blockAdjacent({ height: 1 }, { height: 1 }), false);
  assert.equal(blockAdjacent({ height: -1 }, { height: 0 }), false);
  let actualGaps = 0;
  for (const blocks of recordsByDate.values()) {
    for (let i = 1; i < blocks.length; i++) {
      const consecutive = blocks[i].height === blocks[i - 1].height + 1;
      assert.equal(blockAdjacent(blocks[i - 1], blocks[i]), consecutive);
      if (!consecutive) actualGaps++;
    }
  }
  assert.ok(actualGaps > 0, 'The release contains real header-day height gaps, not only synthetic examples');
});

function corners({ position: [x, , z], yaw }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [-1, 1].flatMap(a => [-1, 1].map(b => {
    const localX = a * TILE_WIDTH / 2, localZ = b * TILE_DEPTH / 2;
    return [x + c * localX + s * localZ, z - s * localX + c * localZ];
  }));
}
function overlaps(a, b) {
  const verticesA = corners(a), verticesB = corners(b);
  const axes = [a.yaw, b.yaw].flatMap(yaw => [[Math.cos(yaw), -Math.sin(yaw)], [Math.sin(yaw), Math.cos(yaw)]]);
  return axes.every(([x, z]) => {
    const first = verticesA.map(p => p[0] * x + p[1] * z);
    const second = verticesB.map(p => p[0] * x + p[1] * z);
    return Math.min(Math.max(...first), Math.max(...second)) - Math.max(Math.min(...first), Math.min(...second)) > 1e-10;
  });
}

test('all arrangements keep block footprints disjoint for the largest actual day and future extension', () => {
  const largest = Math.max(...snapshots.map(day => day.blockCount));
  assert.equal(largest, 223);
  for (const layout of layouts) {
    const tiles = Array.from({ length: 500 }, (_, i) => placement(i, layout));
    for (const tile of tiles) assert.ok([...tile.position, tile.yaw].every(Number.isFinite));
    // The complete current release must fit inside the 3.6-radius gauge.
    for (const tile of tiles.slice(0, largest)) for (const [x, z] of corners(tile)) {
      assert.ok(Math.hypot(x, z) < 3.5, `${layout}: tile intrudes into the comparison gauges`);
    }
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      assert.equal(overlaps(tiles[i], tiles[j]), false, `${layout}: blocks ${i} and ${j} overlap`);
    }
  }
});

test('changing arrangements or dates preserves stable block-index identity and position prefixes', () => {
  const blocks = recordsByDate.get('2024-04-20');
  const originals = structuredClone(blocks);
  const prefix = layouts.map(layout => blocks.slice(0, 10).map((_, i) => placement(i, layout)));
  for (const layout of ['spiral', 'strata', 'ribbon', 'spiral']) {
    const rendered = blocks.map((block, i) => ({ height: block.height, ...placement(i, layout) }));
    assert.deepEqual(rendered.map(tile => tile.height), blocks.map(block => block.height));
  }
  // Extending the release/layout sequence must not move earlier instances.
  for (const layout of layouts) placement(499, layout);
  assert.deepEqual(layouts.map(layout => blocks.slice(0, 10).map((_, i) => placement(i, layout))), prefix);
  assert.deepEqual(blocks, originals);
  assert.throws(() => placement(-1, 'spiral'), RangeError);
  assert.throws(() => placement(0.5, 'spiral'), RangeError);
  assert.throws(() => placement(0, 'unknown'), RangeError);
});

test('address stipples preserve zero, missing coverage, floor conversion, and explicit cap', () => {
  assert.equal(addressCount(null), null);
  assert.equal(addressCount(0), 0);
  assert.equal(addressCount(999), 0);
  assert.equal(addressCount(1000), 1);
  assert.equal(addressCount(1999), 1);
  assert.equal(addressCount(8000, 8000), 1);
  assert.equal(addressCount(2_000_000), 1500);
  assert.throws(() => addressCount(1000, 0), RangeError);
  for (const day of snapshots) assert.equal(addressCount(day.activeAddresses), Math.floor(day.activeAddresses / 1000));
});

// Use real controls, so fitting is checked against their persistent target/state.
test('study camera clears pan, rotation and zoom and fits the full field on portrait and desktop',()=>{
  for(const [width,height] of [[320,490],[375,490],[620,660],[1100,700],[1700,820]]){
    const camera=new PerspectiveCamera(41,width/height,.05,100);
    const controls=new OrbitControls(camera);
    controls.enableDamping=true;
    camera.position.set(9,3,2);camera.zoom=3;controls.target.set(5,-4,3);
    fitStudyCamera(camera,controls,width,height);controls.update();camera.updateMatrixWorld(true);
    assert.deepEqual(controls.target.toArray(),[0,0,0]);assert.equal(camera.zoom,1);assert.equal(controls.enableDamping,true);
    for(let i=0;i<1000;i++){
      const y=1-2*(i+.5)/1000,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));
      const p=new Vector3(r*Math.cos(a),y,r*Math.sin(a)).multiplyScalar(5).project(camera);
      assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${width}x${height} clips the field`);
    }
    controls.dispose();
  }
});
test('generated study scales match all published records',()=>{
  const scales=read('public/data/timechain-scales.json');
  assert.equal(scales.maxNonCoinbase,maxTransactions);assert.equal(scales.maxBlockFeesSat,maxFees);
  assert.equal(scales.maxBlocks,Math.max(...snapshots.map(x=>x.blockCount)));
  assert.equal(scales.totalBlocks,allRecords.length);assert.equal(scales.days,snapshots.length);
});
