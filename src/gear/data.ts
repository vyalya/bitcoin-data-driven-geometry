import { loadAllBlocks } from '../db';
import type { BlockTuple } from '../types';

export type GearDay = { heights: number[]; feesSat: (number | null)[] };
export type GearData = {
  schemaVersion: 1;
  maxNonCoinbase: number;
  maxBlockFeesSat: number;
  maxBlocks: number;
  days: Record<string, GearDay>;
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Reject mixed releases before associating any fee with a visible block. */
export function validateGearData(value: unknown, blocksByDate: Record<string, BlockTuple[]>): GearData {
  if (!object(value) || value.schemaVersion !== 1 || !object(value.days)
    || !whole(value.maxNonCoinbase) || !whole(value.maxBlockFeesSat) || !whole(value.maxBlocks)
    || value.maxBlocks < 1) throw new Error('Invalid Gear data');
  const dates = Object.keys(blocksByDate).sort();
  if (!dates.length || dates.length !== Object.keys(value.days).length) throw new Error('Gear dates do not match the block release');
  let maxNonCoinbase = 0, maxBlockFeesSat = 0, maxBlocks = 0;
  for (const date of dates) {
    const day = value.days[date], blocks = blocksByDate[date];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !object(day) || !Array.isArray(day.heights) || !Array.isArray(day.feesSat)
      || day.heights.length !== blocks.length || day.feesSat.length !== blocks.length) {
      throw new Error(`Gear block count mismatch: ${date}`);
    }
    let previousHeight = -1;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i], fee = day.feesSat[i];
      if (!Array.isArray(block) || block.length !== 4 || !block.every(whole) || block[3] < 1
        || block[0] <= previousHeight || !whole(day.heights[i]) || day.heights[i] !== block[0]
        || fee !== null && !whole(fee)) throw new Error(`Gear block identity or value mismatch: ${date} / ${i}`);
      previousHeight = block[0];
      maxNonCoinbase = Math.max(maxNonCoinbase, block[3] - 1);
      if (fee !== null) maxBlockFeesSat = Math.max(maxBlockFeesSat, fee);
    }
    maxBlocks = Math.max(maxBlocks, blocks.length);
  }
  if (value.maxNonCoinbase !== maxNonCoinbase || value.maxBlockFeesSat !== maxBlockFeesSat || value.maxBlocks !== maxBlocks) {
    throw new Error('Gear visual scales do not match the block release');
  }
  return value as GearData;
}

let gearPromise: Promise<GearData> | null = null;
export function loadGearData(): Promise<GearData> {
  gearPromise ??= Promise.all([
    fetch('/data/block-fees.json').then(async response => {
      if (!response.ok) throw new Error(`Gear details unavailable (HTTP ${response.status})`);
      return response.json() as Promise<unknown>;
    }),
    loadAllBlocks(),
  ]).then(([value, blocks]) => validateGearData(value, blocks)).catch(error => {
    gearPromise = null;
    throw error;
  });
  return gearPromise;
}
