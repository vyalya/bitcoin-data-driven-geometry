/**
 * Runtime data layer — plain fetch() of JSON artefacts produced by the
 * offline pipeline. Replaces the previous DuckDB-WASM + Parquet setup,
 * which was overkill for ~200 KB of data read once at mount.
 *
 * loadSnapshots()  → reads /data/snapshots.json  (~100 KB, ~25 KB gzipped)
 * loadAllBlocks()  → reads /data/blocks.json     (~430 KB, ~80 KB gzipped)
 *
 * Both return null / {} on 404 so the caller falls back to the static
 * 25-snapshot bundle committed in src/data/staticSnapshots.ts.
 */
import type { NetworkSnapshot, BlockTuple } from "./types";

// ─── Derived helpers (mirror build_db.mjs + match the previous shape) ───────

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
    { id: "rb-1", label: "Inner fee band",    radius: 2.0,  density: 0.4 + fp * 0.5,       intensity: 0.3 + fp * 0.6,     activeShare: 0.4 + fp * 0.5 },
    { id: "rb-2", label: "Settlement band",   radius: 2.85, density: 0.5 + (1 - bs) * 0.4, intensity: 0.4 + health * 0.4, activeShare: 0.5 + health * 0.35 },
    { id: "rb-3", label: "Congestion band",   radius: 3.75, density: 0.35 + cg * 0.55,     intensity: 0.3 + cg * 0.6,     activeShare: 0.3 + mp * 0.6 },
    { id: "rb-4", label: "Outer mempool band",radius: 4.85, density: 0.3 + mp * 0.6,       intensity: 0.25 + cg * 0.5,    activeShare: 0.35 + mp * 0.5 },
  ];
}

// ─── Row shape written by pipeline/export_json.mjs ─────────────────────────

interface SnapshotRow {
  id: string;
  label: string;
  date: string;
  narration: string | null;
  notes: string[];
  blockHeight: number;
  avgBlockIntervalSeconds: number;
  networkHashrateEh: number;
  mempoolTxCount: number;
  mempoolSizeMb: number;
  feePressureIndex: number;
  congestionScore: number;
  blockProductionStress: number;
  minerConcentrationScore: number | null;
  networkHealthScore: number;
  difficulty: number;
  activeAddresses: number;
  btcTransferred: number;
  totalFeesBtc: number;
  totalOutputs: number;
  whaleOutputs1000: number;
  whaleOutputs100: number;
  midOutputs10: number;
  retailOutputs: number;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function loadSnapshots(): Promise<NetworkSnapshot[] | null> {
  try {
    const res = await fetch("/data/snapshots.json");
    if (!res.ok) return null;
    const rows = (await res.json()) as SnapshotRow[];
    return rows.map((row): NetworkSnapshot => {
      const s = {
        feePressureIndex:      row.feePressureIndex,
        congestionScore:       row.congestionScore,
        blockProductionStress: row.blockProductionStress,
        mempoolTxCount:        row.mempoolTxCount,
        networkHealthScore:    row.networkHealthScore,
      };
      return {
        id:    row.id,
        label: row.label,
        snapshotTime: `${row.date}T00:00:00Z`,
        narration:    row.narration ?? undefined,
        mode: "historical",
        blockHeight:             row.blockHeight,
        avgBlockIntervalSeconds: row.avgBlockIntervalSeconds,
        networkHashrateEh:       row.networkHashrateEh,
        mempoolTxCount:          row.mempoolTxCount,
        mempoolSizeMb:           row.mempoolSizeMb,
        feePressureIndex:        row.feePressureIndex,
        congestionScore:         row.congestionScore,
        blockProductionStress:   row.blockProductionStress,
        minerConcentrationScore: row.minerConcentrationScore ?? 0,
        networkHealthScore:      row.networkHealthScore,
        difficulty:              row.difficulty,
        activeAddresses:         row.activeAddresses,
        uniqueSenders:           0,
        uniqueReceivers:         0,
        btcTransferred:          row.btcTransferred,
        totalFeesBtc:            row.totalFeesBtc,
        totalOutputs:            row.totalOutputs,
        whaleOutputs1000:        row.whaleOutputs1000,
        whaleOutputs100:         row.whaleOutputs100,
        midOutputs10:            row.midOutputs10,
        retailOutputs:           row.retailOutputs,
        feeBuckets:              deriveFeeBuckets(row.feePressureIndex),
        ringBands:               deriveRingBands(s),
        notes:                   row.notes,
        blocks:                  [],
      };
    });
  } catch (e) {
    console.warn("[db] snapshots.json fetch failed:", e);
    return null;
  }
}

/** Fetches every date's blocks in one JSON. Used by grid view to render
 *  block crowns on every cell. Returns {} on miss. */
export async function loadAllBlocks(): Promise<Record<string, BlockTuple[]>> {
  try {
    const res = await fetch("/data/blocks.json");
    if (!res.ok) return {};
    return (await res.json()) as Record<string, BlockTuple[]>;
  } catch (e) {
    console.warn("[db] blocks.json fetch failed:", e);
    return {};
  }
}

/** Compatibility shim — reads from the bulk map, one date out. */
export async function loadBlocksForDate(date: string): Promise<BlockTuple[]> {
  const all = await loadAllBlocks();
  return all[date] ?? [];
}
