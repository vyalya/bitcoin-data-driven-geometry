/**
 * DuckDB-WASM data layer.
 *
 * loadSnapshots() tries to read /data/snapshots.parquet via DuckDB-WASM.
 * If the file doesn't exist (development without a pipeline run), it returns
 * null and the caller falls back to the static snapshots import.
 *
 * loadBlocksForDate(date) similarly returns per-block spine data from
 * /data/blocks.parquet, falling back to the static blockData import.
 */
import * as duckdb from "@duckdb/duckdb-wasm";
import type { NetworkSnapshot, BlockTuple } from "./types";

// ─── Derived metric helpers (mirrors build_db.mjs formulas) ──────────────────

function deriveFeeBuckets(feePressureIndex: number) {
  const anchors: Array<[number, [number, number, number, number]]> = [
    [0, [0.78, 0.16, 0.05, 0.01]],
    [1, [0.62, 0.24, 0.10, 0.04]],
    [2, [0.42, 0.30, 0.20, 0.08]],
    [3, [0.26, 0.32, 0.27, 0.15]],
    [5, [0.12, 0.24, 0.34, 0.30]],
  ];
  const fpi = Math.max(0, Math.min(feePressureIndex, 5));
  let lo = anchors[0], hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (fpi >= anchors[i][0] && fpi <= anchors[i + 1][0]) {
      lo = anchors[i]; hi = anchors[i + 1]; break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const t = (fpi - lo[0]) / span;
  const raw = lo[1].map((v, i) => v + (hi[1][i] - v) * t) as [number, number, number, number];
  const sum = raw[0] + raw[1] + raw[2] + raw[3];
  const [s0, s1, s2, s3] = raw.map((v) => v / sum);
  return [
    { id: "low",      feeRateLabel: "1-10 sat/vB",   txShare: s0, intensity: Math.min(s0 / 0.25, 1) },
    { id: "mid",      feeRateLabel: "11-30 sat/vB",  txShare: s1, intensity: Math.min(s1 / 0.3, 1) },
    { id: "high",     feeRateLabel: "31-80 sat/vB",  txShare: s2, intensity: Math.min(s2 / 0.25, 1) },
    { id: "priority", feeRateLabel: "81+ sat/vB",    txShare: s3, intensity: Math.min(s3 / 0.2, 1) },
  ];
}

function deriveRingBands(s: {
  feePressureIndex: number; congestionScore: number;
  blockProductionStress: number; mempoolTxCount: number; networkHealthScore: number;
}) {
  const fp = s.feePressureIndex / 10, cg = s.congestionScore / 10;
  const bs = s.blockProductionStress / 10, mp = Math.min(s.mempoolTxCount / 400000, 1);
  const health = s.networkHealthScore / 10;
  return [
    { id: "rb-1", label: "Inner fee band",    radius: 2.0,  density: 0.4 + fp * 0.5, intensity: 0.3 + fp * 0.6, activeShare: 0.4 + fp * 0.5 },
    { id: "rb-2", label: "Settlement band",   radius: 2.85, density: 0.5 + (1 - bs) * 0.4, intensity: 0.4 + health * 0.4, activeShare: 0.5 + health * 0.35 },
    { id: "rb-3", label: "Congestion band",   radius: 3.75, density: 0.35 + cg * 0.55, intensity: 0.3 + cg * 0.6, activeShare: 0.3 + mp * 0.6 },
    { id: "rb-4", label: "Outer mempool band",radius: 4.85, density: 0.3 + mp * 0.6, intensity: 0.25 + cg * 0.5, activeShare: 0.35 + mp * 0.5 },
  ];
}

// ─── Date coercion ───────────────────────────────────────────────────────────
// DuckDB-WASM returns DATE columns via Arrow as either Date objects or numeric
// values (ms / seconds / days since epoch). Normalize to "YYYY-MM-DD".
function toISODate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const ms = v > 1e12 ? v          // already milliseconds
             : v > 1e9  ? v * 1000   // Unix seconds
             : v * 86400000;         // days since epoch
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === "bigint") {
    const n = Number(v);
    return toISODate(n);
  }
  return String(v).slice(0, 10);
}

// ─── DuckDB singleton ─────────────────────────────────────────────────────────

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: "text/javascript" })
    );
    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  })();
  return dbPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns null if /data/snapshots.parquet doesn't exist — caller uses static fallback. */
export async function loadSnapshots(): Promise<NetworkSnapshot[] | null> {
  // Probe: does the parquet file exist?
  try {
    const probe = await fetch("/data/snapshots.parquet", { method: "HEAD" });
    if (!probe.ok) {
      console.warn(`[db] snapshots.parquet HEAD probe returned ${probe.status} — falling back to static data`);
      return null;
    }
  } catch (e) {
    console.warn("[db] snapshots.parquet HEAD probe failed:", e);
    return null;
  }

  const database = await getDB();
  // Register the parquet as a virtual file so DuckDB-WASM can read it via HTTP range requests
  const parquetUrl = new URL("/data/snapshots.parquet", window.location.origin).toString();
  await database.registerFileURL("snapshots.parquet", parquetUrl, duckdb.DuckDBDataProtocol.HTTP, false);

  const conn = await database.connect();

  try {
    await conn.query(`
      CREATE OR REPLACE VIEW snapshots AS
      SELECT * FROM parquet_scan('snapshots.parquet')
    `);

    const result = await conn.query(`SELECT * FROM snapshots ORDER BY date`);
    const rows = result.toArray();

    return rows.map((row): NetworkSnapshot => {
      const fpi  = Number(row.fee_pressure_index   ?? 0);
      const cong = Number(row.congestion_score      ?? 0);
      const stress = Number(row.block_production_stress ?? 1);
      const health = Number(row.network_health_score ?? 5);
      const mempoolTx = Number(row.mempool_tx_count ?? 0);

      return {
        id:    String(row.id),
        label: String(row.label),
        snapshotTime: `${toISODate(row.date)}T00:00:00Z`,
        narration:    row.narration != null ? String(row.narration) : undefined,
        mode: "historical",
        blockHeight:             Number(row.block_height             ?? 0),
        avgBlockIntervalSeconds: Number(row.avg_block_interval_secs  ?? 600),
        networkHashrateEh:       Number(row.network_hashrate_eh      ?? 0),
        mempoolTxCount:          mempoolTx,
        mempoolSizeMb:           Number(row.mempool_size_mb          ?? 0),
        feePressureIndex:        fpi,
        congestionScore:         cong,
        blockProductionStress:   stress,
        minerConcentrationScore: row.miner_concentration_score != null ? Number(row.miner_concentration_score) : 0,
        networkHealthScore:      health,
        difficulty:              Number(row.difficulty               ?? 0),
        activeAddresses:         Number(row.active_addresses         ?? 0),
        uniqueSenders:           Number(row.unique_senders           ?? 0),
        uniqueReceivers:         Number(row.unique_receivers         ?? 0),
        btcTransferred:          Number(row.btc_transferred          ?? 0),
        totalFeesBtc:            Number(row.total_fees_btc           ?? 0),
        totalOutputs:            Number(row.total_outputs            ?? 0),
        whaleOutputs1000:        Number(row.whale_outputs_1000       ?? 0),
        whaleOutputs100:         Number(row.whale_outputs_100        ?? 0),
        midOutputs10:            Number(row.mid_outputs_10           ?? 0),
        retailOutputs:           Number(row.retail_outputs           ?? 0),
        feeBuckets:              deriveFeeBuckets(fpi),
        ringBands:               deriveRingBands({ feePressureIndex: fpi, congestionScore: cong, blockProductionStress: stress, mempoolTxCount: mempoolTx, networkHealthScore: health }),
        notes:                   JSON.parse(String(row.notes ?? "[]")),
        blocks:                  [],  // populated separately by loadBlocksForDate()
      };
    });
  } finally {
    await conn.close();
  }
}

/** Fetches every date's blocks in one query and returns them keyed by date.
 * Used by grid view to render block crowns on every cell. Returns {} if the
 * parquet is missing. */
export async function loadAllBlocks(): Promise<Record<string, BlockTuple[]>> {
  try {
    const probe = await fetch("/data/blocks.parquet", { method: "HEAD" });
    if (!probe.ok) return {};
  } catch {
    return {};
  }

  const database = await getDB();
  const blocksUrl = new URL("/data/blocks.parquet", window.location.origin).toString();
  await database.registerFileURL("blocks.parquet", blocksUrl, duckdb.DuckDBDataProtocol.HTTP, false);

  const conn = await database.connect();
  try {
    await conn.query(`
      CREATE OR REPLACE VIEW blocks AS
      SELECT * FROM parquet_scan('blocks.parquet')
    `);
    const result = await conn.query(`
      SELECT block_height, date, size_bytes, weight, tx_count
      FROM blocks
      ORDER BY date, block_height
    `);
    const out: Record<string, BlockTuple[]> = {};
    for (const r of result.toArray()) {
      const date = toISODate(r.date);
      if (!out[date]) out[date] = [];
      out[date].push([
        Number(r.block_height),
        Number(r.size_bytes),
        Number(r.weight),
        Number(r.tx_count),
      ]);
    }
    return out;
  } catch (e) {
    console.error("[db] loadAllBlocks failed:", e);
    return {};
  } finally {
    await conn.close();
  }
}

/** Returns per-block spine tuples for a given date from blocks.parquet, or [] on miss. */
export async function loadBlocksForDate(date: string): Promise<BlockTuple[]> {
  try {
    const probe = await fetch("/data/blocks.parquet", { method: "HEAD" });
    if (!probe.ok) return [];
  } catch {
    return [];
  }

  const database = await getDB();
  const blocksUrl = new URL("/data/blocks.parquet", window.location.origin).toString();
  await database.registerFileURL("blocks.parquet", blocksUrl, duckdb.DuckDBDataProtocol.HTTP, false);

  const conn = await database.connect();

  try {
    await conn.query(`
      CREATE OR REPLACE VIEW blocks AS
      SELECT * FROM parquet_scan('blocks.parquet')
    `);

    const result = await conn.query(`
      SELECT block_height, size_bytes, weight, tx_count
      FROM blocks
      WHERE date = '${date}'
      ORDER BY block_height
    `);

    return result.toArray().map((r): BlockTuple => [
      Number(r.block_height),
      Number(r.size_bytes),
      Number(r.weight),
      Number(r.tx_count),
    ]);
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}
