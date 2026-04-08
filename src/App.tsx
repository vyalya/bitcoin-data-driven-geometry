import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { mosaicSnapshots, deriveRingBands } from "./data/mosaicSnapshots";
import type { NetworkSnapshot, BlockTuple } from "./types";

/* ═══════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════ */

interface WhatIfParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  snapshotField: keyof NetworkSnapshot;
}

const WHAT_IF_PARAMS: WhatIfParam[] = [
  { key: "hashrate", label: "Hashrate", min: 0, max: 1000, step: 5, unit: "EH/s", snapshotField: "networkHashrateEh" },
  { key: "mempool", label: "Mempool Depth", min: 0, max: 500000, step: 5000, unit: "txs", snapshotField: "mempoolTxCount" },
  { key: "feePressure", label: "Fee Pressure", min: 0, max: 10, step: 0.1, unit: "/10", snapshotField: "feePressureIndex" },
  { key: "congestion", label: "Congestion", min: 0, max: 10, step: 0.1, unit: "/10", snapshotField: "congestionScore" },
  { key: "blockStress", label: "Block Stress", min: 0, max: 10, step: 0.1, unit: "/10", snapshotField: "blockProductionStress" },
];

/* ─── Hover context types ─── */
type HoverContext =
  | { type: "none" }
  | { type: "block"; block: BlockTuple; index: number }
  | { type: "fee"; tierIndex: number }
  | { type: "congestion" }
  | { type: "settlement" }
  | { type: "pool"; poolIndex: number };

function App() {
  const [activeIdx, setActiveIdx] = useState(mosaicSnapshots.length - 1);
  const baseSnapshot = mosaicSnapshots[activeIdx];

  // Blocks from pre-baked static data
  const currentBlocks: BlockTuple[] = baseSnapshot.blocks ?? [];

  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  const hasOverrides = Object.values(overrides).some((v) => v !== null && v !== undefined);
  const setOverride = (key: string, value: number | null) => setOverrides((prev) => ({ ...prev, [key]: value }));
  const resetOverrides = () => setOverrides({});

  const effectiveSnapshot = useMemo<NetworkSnapshot>(() => {
    if (!hasOverrides) return baseSnapshot;
    const s = { ...baseSnapshot };
    for (const param of WHAT_IF_PARAMS) {
      const ov = overrides[param.key];
      if (ov !== null && ov !== undefined) {
        (s as Record<string, unknown>)[param.snapshotField] = ov;
      }
    }
    if (overrides["mempool"] != null && overrides["congestion"] == null) {
      s.congestionScore = Math.min(10, (s.mempoolTxCount / 400000) * 8 + (s.feePressureIndex / 10) * 2);
    }
    if (overrides["mempool"] != null && overrides["feePressure"] == null) {
      s.feePressureIndex = Math.min(10, 0.5 + (s.mempoolTxCount / 400000) * 6);
    }
    s.networkHealthScore = Math.max(0, Math.min(10, 10 - (s.feePressureIndex + s.congestionScore + s.blockProductionStress + s.minerConcentrationScore) / 4));
    s.ringBands = deriveRingBands(s);
    s.mempoolSizeMb = s.mempoolTxCount * 0.00028;
    return s;
  }, [baseSnapshot, overrides, hasOverrides]);

  // Hover/selection state
  const [hoverCtx, setHoverCtx] = useState<HoverContext>({ type: "none" });
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [showDataInfo, setShowDataInfo] = useState(false);

  const onHover = useCallback((groupId: string | null) => setActiveGroup(groupId), []);
  const onClick = useCallback((groupId: string) => {
    setSelectedGroup((prev) => (prev === groupId ? null : groupId));
  }, []);
  const clearSelection = useCallback(() => { setSelectedGroup(null); setActiveGroup(null); }, []);

  const effectiveGroup = selectedGroup ?? activeGroup;

  // Tour
  const [tourStep, setTourStep] = useState<number | null>(null);

  interface TourStep { title: string; text: string; action?: () => void; }
  const tourSteps: TourStep[] = [
    {
      title: "Welcome",
      text: "Every shape is driven by real per-block data from Strategy Mosaic. The central spine shows individual blocks — each sized by weight, colored by transaction count. Rings show fee tiers, settlement health, congestion, and mining pools.",
      action: () => { setActiveIdx(mosaicSnapshots.length - 1); resetOverrides(); },
    },
    {
      title: "Current State — Calm Network",
      text: "The spine blocks are uniform — modern blocks all near the 4MW weight limit. Rings are dim: fee pressure 0.9/10, congestion 0.0/10. The settlement ring is nearly full circle — blocks arriving on schedule.",
      action: () => { setActiveIdx(mosaicSnapshots.length - 1); resetOverrides(); },
    },
    {
      title: "Genesis Era — Tiny Blocks",
      text: "Only 14 blocks mined that day. Each is 215 bytes with 1 transaction. The spine is sparse and tiny — Satoshi mining alone on a CPU. Compare the block sizes to modern blocks.",
      action: () => { setActiveIdx(0); resetOverrides(); },
    },
    {
      title: "2017 Bull Run — Full Blocks",
      text: "Every block is packed — all near 1MB / 4MW weight, 2000-3500 transactions each. Congestion 4.7, fee pressure 2.9. The red congestion ring expands, fee sectors grow. The spine glows hot.",
      action: () => { setActiveIdx(mosaicSnapshots.findIndex(s => s.id === "bull-2017")); resetOverrides(); },
    },
    {
      title: "2024 Halving — Block #840,000",
      text: "The 4th halving block is in this spine. Subsidy dropped from 6.25 to 3.125 BTC. Blocks are packed with 4000-6000 transactions each — Ordinals and Runes driving demand.",
      action: () => { setActiveIdx(mosaicSnapshots.findIndex(s => s.id === "halving-2024")); resetOverrides(); },
    },
    {
      title: "What-If: Flood the Mempool",
      text: "Watch the rings ignite. We're flooding today's calm network with 400K transactions. Congestion ring expands, fee sectors grow, health drops.",
      action: () => { setActiveIdx(mosaicSnapshots.length - 1); resetOverrides(); setOverride("mempool", 400000); setOverride("congestion", 8.5); setOverride("feePressure", 7.0); },
    },
    {
      title: "Your Turn",
      text: "Hover any block or ring to see details in the right panel. Click the timeline to travel through Bitcoin history. Use What-If sliders to stress-test. Every number traces to Mosaic.",
      action: () => { setActiveIdx(mosaicSnapshots.length - 1); resetOverrides(); },
    },
  ];

  const goToTourStep = (step: number) => {
    if (step >= tourSteps.length) { setTourStep(null); return; }
    setTourStep(step);
    tourSteps[step].action?.();
  };

  const s = effectiveSnapshot;

  return (
    <div className="hud-shell">
      <Canvas
        camera={{ position: [0, 2.2, 14], fov: 34 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        dpr={[1, 2]}
        style={{ position: "fixed", inset: 0 }}
      >
        <color attach="background" args={["#000000"]} />
        <fog attach="fog" args={["#000000", 25, 55]} />
        <PrimeRadiantScene
          snapshot={s}
          blocks={currentBlocks}
          activeGroup={effectiveGroup}
          onHover={onHover}
          onClick={onClick}
          onDeselect={clearSelection}
          onBlockHover={(block, index) => setHoverCtx(block ? { type: "block", block, index } : { type: "none" })}
          onRingHover={(type, idx) => {
            if (!type) { setHoverCtx({ type: "none" }); return; }
            if (type === "fee") setHoverCtx({ type: "fee", tierIndex: idx ?? 0 });
            else if (type === "congestion") setHoverCtx({ type: "congestion" });
            else if (type === "settlement") setHoverCtx({ type: "settlement" });
            else if (type === "pool") setHoverCtx({ type: "pool", poolIndex: idx ?? 0 });
          }}
        />
        <EffectComposer>
          <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.6} intensity={2.8} mipmapBlur />
        </EffectComposer>
        <OrbitControls enablePan enableZoom minDistance={1.5} maxDistance={45} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 1.2} />
      </Canvas>

      {/* No block data indicator */}
      {currentBlocks.length === 0 && (
        <div className="no-data-indicator">
          <span>Block data not loaded for this date</span>
        </div>
      )}

      {/* ═══ TOP LEFT: Title + Metrics ═══ */}
      <div className="hud hud-top-left">
        <h1 className="hud-title">Visualizing the Bitcoin Network</h1>
        <p className="hud-powered">Powered by Strategy Mosaic</p>
        <p className="hud-datasource">
          Per-block data published in-memory through a universal semantic layer.
          <button className="info-icon" onClick={() => setShowDataInfo(true)} type="button" title="Data source details">i</button>
        </p>
        <div className="hud-metrics">
          <div className="hud-metric"><span>Block</span><strong>#{s.blockHeight.toLocaleString()}</strong></div>
          <div className="hud-metric"><span>Blocks</span><strong>{currentBlocks.length}</strong></div>
          <div className="hud-metric"><span>Hashrate</span><strong>{s.networkHashrateEh.toFixed(0)} EH/s</strong></div>
        </div>
      </div>

      {/* ═══ RIGHT: Context Panel ═══ */}
      <div className="hud hud-right-panel">
        <div className="context-panel">
          <ContextPanel snapshot={s} hoverCtx={hoverCtx} blocks={currentBlocks} />
        </div>

        {/* What-If toggle */}
        <div className="cockpit-whatif">
          <div className="hud-whatif-header">
            <button className="whatif-toggle" onClick={() => setWhatIfOpen(!whatIfOpen)} type="button">
              What-If {whatIfOpen ? "▾" : "▸"}
            </button>
            {hasOverrides && <button className="reset-button" onClick={resetOverrides} type="button">Reset</button>}
          </div>
          {whatIfOpen && WHAT_IF_PARAMS.map((param) => {
            const baseVal = baseSnapshot[param.snapshotField] as number;
            const currentVal = overrides[param.key] ?? baseVal;
            const isOverridden = overrides[param.key] !== null && overrides[param.key] !== undefined;
            return (
              <div key={param.key} className={`slider-row ${isOverridden ? "overridden" : ""}`}>
                <div className="slider-header">
                  <span className="slider-label">{param.label}</span>
                  <span className="slider-value">{param.max > 100 ? currentVal.toLocaleString() : currentVal.toFixed(1)}<span className="slider-unit">{param.unit}</span></span>
                </div>
                <input type="range" min={param.min} max={param.max} step={param.step} value={currentVal} onChange={(e) => setOverride(param.key, parseFloat(e.target.value))} onDoubleClick={() => setOverride(param.key, null)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ BOTTOM: Timeline Scrubber ═══ */}
      <div className="hud hud-timeline">
        <div className="timeline-bar">
          {mosaicSnapshots.map((snap, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={snap.id}
                className={`timeline-tick ${isActive ? "active" : ""}`}
                onClick={() => { setActiveIdx(i); resetOverrides(); clearSelection(); }}
                type="button"
              >
                <span className="tick-label">{snap.label}</span>
                <span className="tick-year">{snap.snapshotTime.slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
        <div className="timeline-info">
          <span className="timeline-event">{baseSnapshot.label}</span>
          <span className="timeline-date">{baseSnapshot.snapshotTime.slice(0, 10)}</span>
        </div>
      </div>

      {/* ═══ LEFT: What-If toggle button (mobile) ═══ */}

      {/* Data info modal */}
      {showDataInfo && (
        <div className="tour-overlay" onClick={() => setShowDataInfo(false)}>
          <div className="data-info-card" onClick={(e) => e.stopPropagation()}>
            <h3>Data Source</h3>
            <div className="data-info-section">
              <h4>Per-Block Data</h4>
              <p>Each block in the spine is a real Bitcoin block queried from BigQuery via Strategy Mosaic. Block height, size (bytes), weight (WU), and transaction count are exact values from the blockchain.</p>
            </div>
            <div className="data-info-section">
              <h4>Visual Mapping</h4>
              <p>Block scale = weight / 4,000,000. Block brightness = txCount / maxTxCount. Ring arc widths = metric proportions. Nothing is decorative.</p>
            </div>
            <div className="data-info-section">
              <h4>26 Historical Events</h4>
              <p>From Genesis (2009) to today. Each date shows the actual blocks mined that day — between 14 and 165 real blocks per snapshot.</p>
            </div>
            <button className="tour-next" onClick={() => setShowDataInfo(false)} type="button">Close</button>
          </div>
        </div>
      )}

      {/* Tour */}
      {tourStep === null && (
        <button className="hud tour-button" onClick={() => goToTourStep(0)} type="button">Take a Tour</button>
      )}
      {tourStep !== null && tourStep < tourSteps.length && (
        <div className="tour-overlay" onClick={() => goToTourStep((tourStep ?? 0) + 1)}>
          <div className="tour-card" onClick={(e) => e.stopPropagation()}>
            <div className="tour-step-indicator">
              {tourSteps.map((_, i) => (
                <span key={i} className={`tour-dot ${i === tourStep ? "active" : i < tourStep ? "done" : ""}`} />
              ))}
            </div>
            <h3>{tourSteps[tourStep].title}</h3>
            <p>{tourSteps[tourStep].text}</p>
            <div className="tour-actions">
              {tourStep > 0 && <button onClick={() => goToTourStep(tourStep - 1)} type="button">Back</button>}
              {tourStep < tourSteps.length - 1 ? (
                <button className="tour-next" onClick={() => goToTourStep(tourStep + 1)} type="button">Next</button>
              ) : (
                <button className="tour-next" onClick={() => setTourStep(null)} type="button">Start Exploring</button>
              )}
              <button className="tour-skip" onClick={() => { setTourStep(null); setActiveIdx(mosaicSnapshots.length - 1); resetOverrides(); }} type="button">Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CONTEXT PANEL — shows different data per hover target
   ═══════════════════════════════════════════════════════ */

function ContextPanel({ snapshot, hoverCtx, blocks }: { snapshot: NetworkSnapshot; hoverCtx: HoverContext; blocks: BlockTuple[]; blocksLoading?: boolean }) {
  const s = snapshot;

  if (hoverCtx.type === "block") {
    const [h, size, weight, txs] = hoverCtx.block;
    return (
      <div className="ctx-content">
        <div className="ctx-title">Block #{h.toLocaleString()}</div>
        <CtxRow label="Size" value={`${(size / 1000).toFixed(1)} KB`} />
        <CtxRow label="Weight" value={`${(weight / 1000).toFixed(1)} KWU`} />
        <CtxRow label="Transactions" value={txs.toLocaleString()} />
        <CtxRow label="Weight Fill" value={`${((weight / 4000000) * 100).toFixed(1)}%`} />
        <CtxRow label="Index" value={`${hoverCtx.index + 1} of ${blocks.length}`} />
      </div>
    );
  }

  if (hoverCtx.type === "fee") {
    const labels = ["1-10 sat/vB", "11-30 sat/vB", "31-80 sat/vB", "81+ sat/vB"];
    return (
      <div className="ctx-content">
        <div className="ctx-title">Fee Tier: {labels[hoverCtx.tierIndex]}</div>
        {s.feeBuckets.map((b, i) => (
          <CtxRow key={i} label={labels[i]} value={`${(b.txShare * 100).toFixed(1)}%`} highlight={i === hoverCtx.tierIndex} />
        ))}
        <CtxRow label="Fee Pressure" value={`${s.feePressureIndex.toFixed(1)}/10`} />
      </div>
    );
  }

  if (hoverCtx.type === "congestion") {
    return (
      <div className="ctx-content">
        <div className="ctx-title">Network Congestion</div>
        <CtxRow label="Congestion Score" value={`${s.congestionScore.toFixed(1)}/10`} />
        <CtxRow label="Pending Txs" value={s.mempoolTxCount.toLocaleString()} />
        <CtxRow label="Mempool Size" value={`${s.mempoolSizeMb.toFixed(1)} MB`} />
      </div>
    );
  }

  if (hoverCtx.type === "settlement") {
    return (
      <div className="ctx-content">
        <div className="ctx-title">Block Settlement</div>
        <CtxRow label="Block Stress" value={`${s.blockProductionStress.toFixed(1)}/10`} />
        <CtxRow label="Avg Interval" value={`${s.avgBlockIntervalSeconds}s`} />
        <CtxRow label="Blocks Mined" value={`${blocks.length}`} />
        <CtxRow label="Target" value="600s" />
      </div>
    );
  }

  if (hoverCtx.type === "pool") {
    const pool = s.miningPools[hoverCtx.poolIndex];
    if (!pool) return null;
    return (
      <div className="ctx-content">
        <div className="ctx-title">{pool.name}</div>
        <CtxRow label="Hashrate Share" value={`${(pool.sharePct * 100).toFixed(1)}%`} />
        <CtxRow label="Hashrate" value={`${pool.hashRateEh} EH/s`} />
        <CtxRow label="Network Total" value={`${s.networkHashrateEh.toFixed(0)} EH/s`} />
        <CtxRow label="HHI" value={`${s.minerConcentrationScore.toFixed(1)}/10`} />
      </div>
    );
  }

  // Default: overview
  return (
    <div className="ctx-content">
      <div className="ctx-title">{s.label}</div>
      <div className="ctx-divider" />
      <CtxRow label="Health Score" value={`${s.networkHealthScore.toFixed(1)}/10`} />
      <CtxRow label="Fee Pressure" value={`${s.feePressureIndex.toFixed(1)}/10`} />
      <CtxRow label="Congestion" value={`${s.congestionScore.toFixed(1)}/10`} />
      <CtxRow label="Block Stress" value={`${s.blockProductionStress.toFixed(1)}/10`} />
      <CtxRow label="Hashrate" value={`${s.networkHashrateEh.toFixed(0)} EH/s`} />
      <div className="ctx-divider" />
      <CtxRow label="Blocks" value={`${blocks.length}`} />
      <CtxRow label="Mempool" value={s.mempoolTxCount.toLocaleString()} />
      <CtxRow label="Halving Era" value={`${Math.floor(s.blockHeight / 210000) + 1}`} />
      {s.notes.length > 0 && (
        <div className="ctx-notes">
          {s.notes.map((n, i) => <p key={i}>{n}</p>)}
        </div>
      )}
    </div>
  );
}

function CtxRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`ctx-row ${highlight ? "highlight" : ""}`}>
      <span className="ctx-label">{label}</span>
      <span className="ctx-value">{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   3D SCENE — Per-block spine + ring arcs
   ═══════════════════════════════════════════════════════ */

interface SceneProps {
  snapshot: NetworkSnapshot;
  blocks: BlockTuple[];
  activeGroup: string | null;
  onHover: (groupId: string | null) => void;
  onClick: (groupId: string) => void;
  onDeselect: () => void;
  onBlockHover: (block: BlockTuple | null, index: number) => void;
  onRingHover: (type: string | null, idx?: number) => void;
}

function PrimeRadiantScene({ snapshot, blocks: currentBlocks, activeGroup, onHover, onClick, onDeselect, onBlockHover, onRingHover }: SceneProps) {
  const s = snapshot;
  const fp = s.feePressureIndex / 10;
  const cg = s.congestionScore / 10;
  const bs = s.blockProductionStress / 10;
  const health = s.networkHealthScore / 10;

  const dim = (gid: string) => (activeGroup !== null && activeGroup !== gid) ? 0.1 : 1;
  const bright = (gid: string) => activeGroup === gid ? 1.5 : 1;

  const interact = (gid: string) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(gid); },
    onPointerOut: () => onHover(null),
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick(gid); },
  });

  const feeColors = ["#FF9933", "#FF7722", "#FF5511", "#FF3300"];
  const feeLabels = ["1-10 sat/vB", "11-30 sat/vB", "31-80 sat/vB", "81+ sat/vB"];

  return (
    <group key={s.id} position={[0, 0, 0]} scale={0.85}>
      <ambientLight intensity={0.04 + health * 0.04} />
      <pointLight position={[0, 0, 3]} intensity={8 + health * 6} color="#FA660F" distance={20} decay={1.8} />
      <pointLight position={[5, 4, 2]} intensity={4} color="#FF8C3A" distance={18} decay={2} />
      <pointLight position={[-5, -3, 2]} intensity={3} color="#FA660F" distance={16} decay={2} />

      <mesh position={[0, 0, -3]} onClick={onDeselect}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ═══ PER-BLOCK SPINE ═══ */}
      <BlockSpine
        blocks={currentBlocks}
        activeGroup={activeGroup}
        onHover={onHover}
        onClick={onClick}
        onBlockHover={onBlockHover}
        dim={dim("spine")}
        bright={bright("spine")}
      />

      {/* ═══ FEE TIER ARCS (r=2.2) ═══ */}
      {s.feeBuckets.map((bucket, i) => {
        const gid = `fee-${i}`;
        const d = dim(gid) * bright(gid);
        const arcSpan = Math.PI * 2 * bucket.txShare;
        let startAngle = 0;
        for (let j = 0; j < i; j++) startAngle += Math.PI * 2 * s.feeBuckets[j].txShare;
        const height = 0.04 + fp * 0.2 + bucket.intensity * 0.1;
        const z = i * 0.08;
        const subCount = Math.max(3, Math.round(arcSpan / (Math.PI * 2) * 40));
        const gap = arcSpan * 0.06;
        const usable = arcSpan - gap;
        if (usable < 0.01) return null;

        return (
          <group key={gid} position={[0, 0, z]}
            {...interact(gid)}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("fee", i); }}
            onPointerOut={() => { onHover(null); onRingHover(null); }}
          >
            {Array.from({ length: subCount }).map((_, j) => {
              const angle = startAngle + gap / 2 + (j / subCount) * usable;
              const r = 2.2;
              return (
                <mesh key={j} position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]} rotation={[0, 0, angle]}>
                  <boxGeometry args={[Math.max(0.005, (usable / subCount) * r * 0.85), height, 0.035 + bucket.intensity * 0.02]} />
                  <meshStandardMaterial color={feeColors[i]} emissive={feeColors[i]} emissiveIntensity={(0.3 + bucket.intensity * 1.0) * d} metalness={0.3} roughness={0.3} transparent opacity={0.75 * d} />
                </mesh>
              );
            })}
            <Text position={[Math.cos(startAngle + arcSpan / 2) * 2.55, Math.sin(startAngle + arcSpan / 2) * 2.55, 0.1]} fontSize={0.06} color={feeColors[i]} anchorX="center" anchorY="middle" fillOpacity={0.4 * d} font={undefined}>
              {feeLabels[i]}
            </Text>
          </group>
        );
      })}

      {/* ═══ CONGESTION ARC (r=3.3) ═══ */}
      {(() => {
        const gid = "congestion";
        const d = dim(gid) * bright(gid);
        const fillAngle = Math.PI * 2 * Math.max(0.03, cg);
        const height = 0.015 + cg * 0.25;
        const z = cg * 0.3;
        const subCount = Math.max(2, Math.round(fillAngle / (Math.PI * 2) * 36));
        const r = 3.3;
        return (
          <group position={[0, 0, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("congestion"); }}
            onPointerOut={() => { onHover(null); onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            {Array.from({ length: subCount }).map((_, j) => {
              const angle = -fillAngle / 2 + (j / subCount) * fillAngle;
              return (
                <mesh key={j} position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]} rotation={[0, 0, angle]}>
                  <boxGeometry args={[Math.max(0.005, (fillAngle / subCount) * r * 0.85), Math.max(0.005, height), 0.03 + cg * 0.03]} />
                  <meshStandardMaterial color="#FF4400" emissive="#FF4400" emissiveIntensity={(0.2 + cg * 1.5) * d} metalness={0.2} roughness={0.4} transparent opacity={(cg > 0.01 ? 0.6 + cg * 0.3 : 0.05) * d} />
                </mesh>
              );
            })}
            <Text position={[0, r + 0.2, 0.1]} fontSize={0.06} color="#FF4400" anchorX="center" anchorY="bottom" fillOpacity={0.4 * d} font={undefined}>
              Congestion
            </Text>
          </group>
        );
      })()}

      {/* ═══ SETTLEMENT ARC (r=2.8) ═══ */}
      {(() => {
        const gid = "settlement";
        const d = dim(gid) * bright(gid);
        const stressHealth = 1 - bs;
        const fillAngle = Math.PI * 2 * Math.max(0.05, stressHealth);
        const height = 0.03 + stressHealth * 0.12;
        const z = -bs * 0.2;
        const subCount = Math.max(3, Math.round(fillAngle / (Math.PI * 2) * 36));
        const r = 2.8;
        return (
          <group position={[0, 0, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("settlement"); }}
            onPointerOut={() => { onHover(null); onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            {Array.from({ length: subCount }).map((_, j) => {
              const angle = -fillAngle / 2 + (j / subCount) * fillAngle;
              return (
                <mesh key={j} position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]} rotation={[0, 0, angle]}>
                  <boxGeometry args={[Math.max(0.005, (fillAngle / subCount) * r * 0.85), height, 0.035]} />
                  <meshStandardMaterial color="#FA660F" emissive="#FA660F" emissiveIntensity={(0.3 + stressHealth * 0.8) * d} metalness={0.3} roughness={0.3} transparent opacity={0.7 * d} />
                </mesh>
              );
            })}
            <Text position={[0, r + 0.18, 0.1]} fontSize={0.06} color="#FA660F" anchorX="center" anchorY="bottom" fillOpacity={0.4 * d} font={undefined}>
              Settlement
            </Text>
          </group>
        );
      })()}

      {/* ═══ MINING POOL ARCS (r=4.5) ═══ */}
      {(() => {
        let angleOffset = 0;
        return s.miningPools.map((pool, poolIdx) => {
          const gid = `pool-${pool.id}`;
          const d = dim(gid) * bright(gid);
          const arcSpan = Math.PI * 2 * pool.sharePct;
          const startAngle = angleOffset;
          angleOffset += arcSpan;
          const height = 0.02 + pool.sharePct * 0.35;
          const z = pool.sharePct * 0.4;
          const subCount = Math.max(2, Math.round(arcSpan / (Math.PI * 2) * 30));
          const gap = arcSpan * 0.06;
          const usable = arcSpan - gap;
          if (usable < 0.005) return null;
          const r = 4.5;
          const midAngle = startAngle + arcSpan / 2;

          return (
            <group key={gid} position={[0, 0, z]}
              onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("pool", poolIdx); }}
              onPointerOut={() => { onHover(null); onRingHover(null); }}
              onClick={(e) => { e.stopPropagation(); onClick(gid); }}
            >
              {Array.from({ length: subCount }).map((_, j) => {
                const angle = startAngle + gap / 2 + (j / subCount) * usable;
                return (
                  <mesh key={j} position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]} rotation={[0, 0, angle]}>
                    <boxGeometry args={[Math.max(0.005, (usable / subCount) * r * 0.85), height, 0.03 + pool.sharePct * 0.04]} />
                    <meshStandardMaterial color="#CC6600" emissive="#CC6600" emissiveIntensity={(0.2 + pool.sharePct * 2) * d} metalness={0.35} roughness={0.25} transparent opacity={0.7 * d} />
                  </mesh>
                );
              })}
              <Text position={[Math.cos(midAngle) * (r + 0.3), Math.sin(midAngle) * (r + 0.3), 0.1]} fontSize={0.055} color="#FFFFFF" anchorX="center" anchorY="middle" fillOpacity={0.4 * d} font={undefined}>
                {pool.name}
              </Text>
              <Text position={[Math.cos(midAngle) * (r + 0.2), Math.sin(midAngle) * (r + 0.2), 0.1]} fontSize={0.04} color="#CC6600" anchorX="center" anchorY="middle" fillOpacity={0.3 * d} font={undefined}>
                {(pool.sharePct * 100).toFixed(1)}%
              </Text>
            </group>
          );
        });
      })()}

      {/* Ring track lines */}
      {[2.2, 2.8, 3.3, 4.5].map((r) => (
        <mesh key={r} position={[0, 0, -0.1]}>
          <ringGeometry args={[r - 0.003, r + 0.003, 200]} />
          <meshBasicMaterial color="#FA660F" transparent opacity={0.02} />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   PER-BLOCK SPINE — InstancedMesh with real block data
   ═══════════════════════════════════════════════════════ */

function BlockSpine({ blocks, onHover, onClick, onBlockHover, dim, bright }: {
  blocks: BlockTuple[];
  activeGroup?: string | null;
  onHover: (gid: string | null) => void;
  onClick: (gid: string) => void;
  onBlockHover: (block: BlockTuple | null, index: number) => void;
  dim: number;
  bright: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = blocks.length || 1;
  const d = dim * bright;

  // Find max values for normalization
  const maxTxs = useMemo(() => Math.max(...blocks.map(b => b[3]), 1), [blocks]);

  // Set per-instance transforms and colors
  useMemo(() => {
    if (!meshRef.current || blocks.length === 0) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // Spine: visible column of separated blocks
    const blockH = 0.018; // thin blocks
    const gap = 0.025; // generous visible gap
    const step = blockH + gap;
    const spineHeight = count * step;
    const maxSpine = 6; // clamp height
    const scale = spineHeight > maxSpine ? maxSpine / spineHeight : 1;

    for (let i = 0; i < count; i++) {
      const [, , weight, txs] = blocks[i];
      const wNorm = Math.min(weight / 4000000, 1);

      // Width: lightweight blocks are narrow, full blocks are wide
      const w = (0.01 + wNorm * 0.04) * scale;

      dummy.position.set(0, (i * step - spineHeight / 2) * scale, 0);
      dummy.scale.set(w, blockH * scale * 0.5, w);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color: low tx = deep red-orange, high tx = bright yellow-white
      const txNorm = txs / maxTxs;
      const hue = 0.06 - txNorm * 0.02; // slight hue shift
      const sat = 0.95 - txNorm * 0.4;
      const light = 0.2 + txNorm * 0.6;
      color.setHSL(hue, sat, light);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [blocks, count, maxTxs]);

  if (blocks.length === 0) return null;

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover("spine"); }}
      onPointerOut={() => { onHover(null); onBlockHover(null, 0); }}
      onClick={(e) => { e.stopPropagation(); onClick("spine"); }}
    >
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerMove={(e) => {
          if (e.instanceId !== undefined && e.instanceId < blocks.length) {
            onBlockHover(blocks[e.instanceId], e.instanceId);
          }
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#FF8C3A"
          emissive="#FA660F"
          emissiveIntensity={0.2 * d}
          metalness={0.6}
          roughness={0.2}
          transparent
          opacity={0.9 * d}
        />
      </instancedMesh>
    </group>
  );
}

export default App;
