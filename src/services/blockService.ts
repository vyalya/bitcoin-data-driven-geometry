/**
 * Block data service — fetches per-block data from Mosaic via Trino SQL.
 * Caches results in memory so revisited dates load instantly.
 */

import type { BlockTuple } from "../types";
import { executeQuery } from "./trinoQuery";

/** In-memory cache: date → blocks */
const cache = new Map<string, BlockTuple[]>();

/** Loading state tracker */
const loading = new Set<string>();

/**
 * SQL template for per-block data.
 * Model: "Bitcoin Network" in schema "shared studio"
 */
function buildBlockQuery(date: string): string {
  // Sanitize date to prevent injection (must be YYYY-MM-DD format)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}`);
  }
  return `SELECT "block height (block height)", "block size bytes", "block weight", "transaction count" FROM "shared studio"."Bitcoin Network" WHERE "snapshot date (snapshot date)" = DATE '${date}' AND "block height (block height)" IS NOT NULL ORDER BY "block height (block height)"`;
}

/**
 * Fetch blocks for a specific date.
 * Returns cached data if available, otherwise queries Mosaic.
 */
export async function fetchBlocksForDate(date: string): Promise<BlockTuple[]> {
  // Return from cache if available
  const cached = cache.get(date);
  if (cached) return cached;

  // Prevent duplicate queries for same date
  if (loading.has(date)) {
    // Wait for the in-flight query to complete
    while (loading.has(date)) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return cache.get(date) ?? [];
  }

  loading.add(date);

  try {
    const sql = buildBlockQuery(date);
    const rows = await executeQuery(sql);

    // Convert rows to BlockTuples: [height, sizeBytes, weight, txCount]
    const blocks: BlockTuple[] = rows.map((row) => [
      Number(row[0]),
      Number(row[1]),
      Number(row[2]),
      Number(row[3]),
    ]);

    cache.set(date, blocks);
    return blocks;
  } catch (err) {
    console.error(`Failed to fetch blocks for ${date}:`, err);
    return [];
  } finally {
    loading.delete(date);
  }
}

/**
 * Check if blocks are cached for a date.
 */
export function hasBlocks(date: string): boolean {
  return cache.has(date);
}

/**
 * Get cached blocks (returns empty array if not loaded).
 */
export function getBlocks(date: string): BlockTuple[] {
  return cache.get(date) ?? [];
}

/**
 * Prefetch blocks for multiple dates (e.g., on app start).
 */
export async function prefetchBlocks(dates: string[]): Promise<void> {
  // Fetch uncached dates in parallel (max 3 concurrent)
  const uncached = dates.filter((d) => !cache.has(d));
  const batches: string[][] = [];
  for (let i = 0; i < uncached.length; i += 3) {
    batches.push(uncached.slice(i, i + 3));
  }
  for (const batch of batches) {
    await Promise.all(batch.map(fetchBlocksForDate));
  }
}
