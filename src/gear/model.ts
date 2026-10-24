export const BLOCK_BASE_RADIUS = 1.5;
export const BLOCK_WEIGHT_LIMIT = 4_000_000;
export const TRANSACTION_BASE_RADIUS = .8;
export const METRIC_MAX_LENGTH = .58;
export const POLYGON_SIDES = 64;
// The fixed opening distinguishes a day’s sequence from a closed loop.
export const CHAIN_GAP_ANGLE = Math.PI / 6;
export type GearPose = {
  position: [number, number, number]; normal: [number, number, number];
  tangent: [number, number, number]; angle: number;
};

/** Clockwise along an open 330-degree path; positions express height order. */
export function blockPose(index: number, count: number): GearPose {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new RangeError('Gear index must identify a block within a positive integer count');
  }
  const angle = count===1 ? Math.PI/2 : Math.PI/2-CHAIN_GAP_ANGLE/2-(2*Math.PI-CHAIN_GAP_ANGLE)*index/(count-1);
  const normal: [number, number, number] = [Math.cos(angle), Math.sin(angle), 0];
  return {
    position: [BLOCK_BASE_RADIUS * normal[0], BLOCK_BASE_RADIUS * normal[1], 0],
    normal, tangent: [Math.sin(angle), -Math.cos(angle), 0], angle,
  };
}

/** A fixed visibility stem is separate from the linear block-weight extension. */
export function blockLength(weight: number): number {
  if (!Number.isSafeInteger(weight) || weight < 0 || weight > BLOCK_WEIGHT_LIMIT) throw new RangeError('Invalid block weight');
  return .12 + .75 * weight / BLOCK_WEIGHT_LIMIT;
}
export function transactionLength(txCount: number | null | undefined, maxNonCoinbase: number): number | null {
  if (txCount == null || !Number.isSafeInteger(txCount) || txCount < 1) return null;
  if (txCount === 1) return 0;
  if (!Number.isSafeInteger(maxNonCoinbase) || maxNonCoinbase <= 0 || txCount - 1 > maxNonCoinbase) return null;
  return METRIC_MAX_LENGTH * (txCount - 1) / maxNonCoinbase;
}
export function feeLength(feeSat: number | null | undefined, maxFeeSat: number): number | null {
  if (feeSat == null || !Number.isSafeInteger(feeSat) || feeSat < 0) return null;
  if (feeSat === 0) return 0;
  if (!Number.isSafeInteger(maxFeeSat) || maxFeeSat <= 0 || feeSat > maxFeeSat) return null;
  return METRIC_MAX_LENGTH * Math.log1p(feeSat / 1e8) / Math.log1p(maxFeeSat / 1e8);
}

/** Exact regular-polygon perimeter prefix, including a partial final straight side. */
export function polygonPoint(radius: number, fraction: number, z = 0): [number, number, number] {
  if (!Number.isFinite(z) || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError('Invalid polygon position');
  const along = fraction * POLYGON_SIDES, side = Math.min(POLYGON_SIDES - 1, Math.floor(along)), mix = along - side;
  const a = Math.PI / 2 - side * Math.PI * 2 / POLYGON_SIDES, b = a - Math.PI * 2 / POLYGON_SIDES;
  return [radius * (Math.cos(a) * (1 - mix) + Math.cos(b) * mix), radius * (Math.sin(a) * (1 - mix) + Math.sin(b) * mix), z];
}

/** A selection guide needs at least one visible measured bar. */
export function hasBlockBars(txCount:number|null|undefined, feesSat:number|null|undefined, maxNonCoinbase:number, maxFeeSat:number):boolean {
  return (transactionLength(txCount,maxNonCoinbase)??0)>0 || (feeLength(feesSat,maxFeeSat)??0)>0;
}
