/** Data encodings shared by every Timechain arrangement.
 * Positions and yaw describe presentation only; they never encode a measurement.
 */
export type Layout = 'spiral' | 'ribbon' | 'strata';
export type Placement = { position: [number, number, number]; yaw: number };
export type TimechainBlock = {
  height: number;
  weight: number;
  txCount: number;
  totalFeesSat: number | null;
};
export type TimechainScales = {
  maxNonCoinbaseTransactions: number;
  maxBlockFeesSat: number;
};

export const TILE_WIDTH = 0.16;
export const TILE_DEPTH = 0.30;
export const TILE_GAP = 0.04;
export const BLOCK_WEIGHT_REFERENCE = 4_000_000;
export const MAX_ADDRESS_MARKS = 1500;
const SATOSHIS_PER_BTC = 100_000_000;
const SPIRAL_START_RADIUS = 0.60;
const SPIRAL_GROWTH = 0.082;

/** Null stays null so a renderer can distinguish unavailable from observed zero. */
export function signalFill(value: number | null | undefined, maximum: number): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 0;
  if (!Number.isFinite(maximum) || maximum <= 0) return null;
  return Math.min(value / maximum, 1);
}

/** The small physical base is a labeled presentation allowance, not extra weight. */
export function tileHeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) throw new RangeError('Block weight must be finite and nonnegative');
  return 0.06 + 0.70 * weight / BLOCK_WEIGHT_REFERENCE;
}

export function txFill(block: Pick<TimechainBlock, 'txCount'>, maxNonCoinbase: number): number | null {
  if (!Number.isSafeInteger(block.txCount) || block.txCount < 1) return null;
  return signalFill(block.txCount - 1, maxNonCoinbase);
}

/** Fees use log1p(BTC), with the same release-wide maximum for every date. */
export function feeFill(feeSat: number | null | undefined, maxBlockFeesSat: number): number | null {
  if (feeSat == null || !Number.isSafeInteger(feeSat) || feeSat < 0) return null;
  if (feeSat === 0) return 0;
  if (!Number.isSafeInteger(maxBlockFeesSat) || maxBlockFeesSat <= 0) return null;
  return Math.min(Math.log1p(feeSat / SATOSHIS_PER_BTC) / Math.log1p(maxBlockFeesSat / SATOSHIS_PER_BTC), 1);
}

/** Only consecutive heights may receive a connector. This is not hash validation. */
export function blockAdjacent(a: Pick<TimechainBlock, 'height'>, b: Pick<TimechainBlock, 'height'>): boolean {
  return Number.isSafeInteger(a.height) && a.height >= 0 && Number.isSafeInteger(b.height) && b.height === a.height + 1;
}

export function addressCount(active: number | null | undefined, unit = 1000): number | null {
  if (active == null || !Number.isSafeInteger(active) || active < 0) return null;
  if (!Number.isFinite(unit) || unit <= 0) throw new RangeError('Addresses per mark must be positive');
  return Math.min(MAX_ADDRESS_MARKS, Math.floor(active / unit));
}

// Grow a single deterministic sequence. A short day uses a prefix of the same
// placements as a busy day; changing the date never rescales or reflows its tiles.
const spiralAngles = [0];
function spiralAngle(index: number): number {
  while (spiralAngles.length <= index) {
    const theta = spiralAngles[spiralAngles.length - 1];
    const radius = SPIRAL_START_RADIUS + SPIRAL_GROWTH * theta;
    // A .20 center arc step would overlap the inner corners near the center.
    // Correct for the inner tile edge, approaching .20 as radius increases.
    const arcStep = (TILE_WIDTH + TILE_GAP) * radius / (radius - TILE_DEPTH / 2);
    const first = arcStep / Math.hypot(radius, SPIRAL_GROWTH);
    const midpointRadius = radius + SPIRAL_GROWTH * first / 2;
    spiralAngles.push(theta + arcStep / Math.hypot(midpointRadius, SPIRAL_GROWTH));
  }
  return spiralAngles[index];
}

export function placement(index: number, layout: Layout): Placement {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('Block index must be a nonnegative integer');
  if (layout === 'spiral') {
    const theta = spiralAngle(index);
    const radius = SPIRAL_START_RADIUS + SPIRAL_GROWTH * theta;
    const dx = SPIRAL_GROWTH * Math.cos(theta) - radius * Math.sin(theta);
    const dz = SPIRAL_GROWTH * Math.sin(theta) + radius * Math.cos(theta);
    // Three.js positive yaw sends local +x toward world -z.
    return { position: [radius * Math.cos(theta), 0, radius * Math.sin(theta)], yaw: -Math.atan2(dz, dx) };
  }
  if (layout === 'ribbon') {
    const row = Math.floor(index / 18);
    const column = row % 2 ? 17 - index % 18 : index % 18;
    const x = (column - 8.5) * (TILE_WIDTH + TILE_GAP);
    const wave = 0.045 * Math.sin(x * 1.1);
    // Fixed six-row offset centers the 223-block release maximum. It does not
    // depend on the active date; future rows continue beyond the current frame.
    return { position: [x, 0, (row - 6) * 0.46 + wave], yaw: -Math.atan(0.0495 * Math.cos(x * 1.1)) + (row % 2 ? Math.PI : 0) };
  }
  if (layout === 'strata') {
    const row = Math.floor(index / 16);
    const column = row % 2 ? 15 - index % 16 : index % 16;
    const x = (column - 7.5) * (TILE_WIDTH + TILE_GAP);
    // An open curved tapestry, not an opaque stack. Every block remains exposed.
    return { position: [x + 0.22 * Math.sin(row * 0.28), 0, (row - 6.5) * 0.38 + 0.045 * x * x], yaw: -Math.atan(0.09 * x) + (row % 2 ? Math.PI : 0) };
  }
  throw new RangeError(`Unknown Timechain layout: ${layout}`);
}
