#!/usr/bin/env node
/**
 * Fetches mining pool distribution from mempool.space and computes HHI
 * (Herfindahl-Hirschman Index) for curated dates where data is available.
 *
 * mempool.space pool stats are only available for ~3 years of history
 * (i.e., roughly 2021-04 onward). Dates before that will have NULL HHI.
 *
 * HHI formula: sum(share_i^2) for all pools i
 * Normalized score: normalize(hhi, 0.05, 0.35) * 10  →  0–10 scale
 *   where 0.05 = perfectly distributed, 0.35 = highly concentrated
 *
 * API: GET https://mempool.space/api/v1/mining/pools/{period}
 * period: '1y', '2y', '3y' — we use '3y' for max coverage
 */
import Database from "duckdb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dir, "config.json"), "utf8"));

// Only attempt for dates where mempool.space data is plausible (2021-04-01+)
const MEMPOOL_START = "2021-04-01";
const TARGET_DATES = config.snapshots
  .map((s) => s.date)
  .filter((d) => d >= MEMPOOL_START)
  .sort();

function hhiNormalized(hhi) {
  const MIN_HHI = 0.05;
  const MAX_HHI = 0.35;
  return Math.max(0, Math.min(10, ((hhi - MIN_HHI) / (MAX_HHI - MIN_HHI)) * 10));
}

async function fetchPoolsForPeriod(period) {
  const url = `https://mempool.space/api/v1/mining/pools/${period}`;
  console.log(`  GET pools/${period}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mempool.space HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Fetching mempool.space pool distribution…");

  // Fetch 3y data — best coverage for our date range
  let poolData;
  try {
    poolData = await fetchPoolsForPeriod("3y");
  } catch (e) {
    console.warn("  mempool.space 3y fetch failed, trying 1y:", e.message);
    poolData = await fetchPoolsForPeriod("1y");
  }

  const pools = poolData.pools ?? [];
  const total = pools.reduce((s, p) => s + (p.blockCount ?? 0), 0);
  if (total === 0) {
    console.warn("  No pool data returned. Skipping HHI upsert.");
    return;
  }

  // HHI from the aggregate pool distribution (not date-specific —
  // mempool.space doesn't give per-day pool stats via the free API).
  // We assign the same HHI to all eligible dates as the best available proxy.
  const hhi = pools.reduce((sum, p) => {
    const share = (p.blockCount ?? 0) / total;
    return sum + share * share;
  }, 0);

  const score = hhiNormalized(hhi);
  console.log(`  HHI raw: ${hhi.toFixed(4)}, normalized score: ${score.toFixed(2)}/10`);

  const db = new Database.Database(join(__dir, "bitcoin.duckdb"));
  const conn = db.connect();

  conn.run(`
    CREATE TABLE IF NOT EXISTS mempool_raw (
      date        DATE PRIMARY KEY,
      hhi_raw     DOUBLE,
      pool_count  INTEGER
    )
  `);

  const stmt = conn.prepare(`
    INSERT OR REPLACE INTO mempool_raw (date, hhi_raw, pool_count)
    VALUES (?, ?, ?)
  `);

  for (const date of TARGET_DATES) {
    stmt.run(date, hhi, pools.length);
  }

  stmt.finalize();
  conn.close();
  db.close();
  console.log(`Upserted HHI for ${TARGET_DATES.length} dates (${MEMPOOL_START}+) into mempool_raw.`);
  console.log("  Dates before 2021-04-01: miner_concentration_score will be NULL.");
}

main().catch((e) => { console.error(e); process.exit(1); });
