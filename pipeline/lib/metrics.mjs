export const feeTotalIndex = btc => btc == null ? null : Math.min(10, btc / 1300 * 10);
export function congestionScore(count) {
  if (count == null) return null;
  if (count <= 10000) return count / 10000 * 2;
  if (count <= 50000) return 2 + (count - 10000) / 40000 * 3;
  if (count <= 150000) return 5 + (count - 50000) / 100000 * 3;
  return Math.min(10, 8 + (count - 150000) / 150000 * 2);
}
export const blockPace = count => count == null ? null : count / 144;
export function feeBuckets(counts) {
  if (counts == null) return [];
  if (counts.length !== 4 || counts.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid fee histogram');
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return [];
  return counts.map((count, i) => ({ id: ['low', 'mid', 'high', 'priority'][i], feeRateLabel: ['0–10 sat/vB', '>10–30 sat/vB', '>30–80 sat/vB', '>80 sat/vB'][i], txShare: count / total, intensity: count / total }));
}
// Sum integer satoshis before converting units. A missing block fee means the
// whole day is unavailable; it must not silently contribute zero.
export function blockFeeSatoshis(records) {
  if (records.some(b => b.totalFeesSat == null)) return null;
  let sum = 0;
  for (const b of records) {
    if (!Number.isSafeInteger(b.totalFeesSat) || b.totalFeesSat < 0) throw new Error('Invalid block fees');
    sum += b.totalFeesSat;
    if (!Number.isSafeInteger(sum)) throw new Error('Fee total exceeds exact integer range');
  }
  return sum;
}
