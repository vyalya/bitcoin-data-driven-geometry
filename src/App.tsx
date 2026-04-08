import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mosaicSnapshots, deriveRingBands } from "./data/mosaicSnapshots";
import type { NetworkSnapshot, RingBand, MiningPoolSnapshot, FeeBucket } from "./types";

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function getSeverity(value: number): "normal" | "elevated" | "critical" {
  if (value >= 8) return "critical";
  if (value >= 6) return "elevated";
  return "normal";
}

/** Per-ring color palette — each ring has a distinct identity */
const RING_COLORS = [
  "#FF6B00", // Ring 1: deep orange — fee pressure
  "#FA660F", // Ring 2: primary orange — settlement
  "#FF4400", // Ring 3: red-orange — congestion (hot)
  "#CC5500", // Ring 4: copper — mempool depth
] as const;

const RING_LABELS = [
  "Fee Pressure",
  "Settlement",
  "Congestion",
  "Mempool Depth",
] as const;

/* ═══════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════ */

/* ─── What-If slider definitions ─── */

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

function App() {
  const [activeId, setActiveId] = useState("current");
  const baseSnapshot = useMemo(
    () => mosaicSnapshots.find((s) => s.id === activeId) ?? mosaicSnapshots[0],
    [activeId]
  );

  // What-if overrides — null means "use real data"
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});

  const hasOverrides = Object.values(overrides).some((v) => v !== null && v !== undefined);

  const setOverride = (key: string, value: number | null) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const resetOverrides = () => setOverrides({});

  // Compute effective snapshot by merging base with overrides
  const effectiveSnapshot = useMemo<NetworkSnapshot>(() => {
    if (!hasOverrides) return baseSnapshot;

    const s = { ...baseSnapshot };

    for (const param of WHAT_IF_PARAMS) {
      const ov = overrides[param.key];
      if (ov !== null && ov !== undefined) {
        (s as Record<string, unknown>)[param.snapshotField] = ov;
      }
    }

    // Auto-derive correlated metrics when one slider changes
    // If mempool changed but congestion wasn't manually set, derive it
    if (overrides["mempool"] != null && overrides["congestion"] == null) {
      s.congestionScore = Math.min(10, (s.mempoolTxCount / 400000) * 8 + (s.feePressureIndex / 10) * 2);
    }
    // If mempool changed but fee pressure wasn't manually set, derive it
    if (overrides["mempool"] != null && overrides["feePressure"] == null) {
      s.feePressureIndex = Math.min(10, 0.5 + (s.mempoolTxCount / 400000) * 6);
    }

    // Recompute health score from stress metrics
    const fp = s.feePressureIndex;
    const cg = s.congestionScore;
    const bs = s.blockProductionStress;
    const mc = s.minerConcentrationScore;
    s.networkHealthScore = Math.max(0, Math.min(10, 10 - (fp + cg + bs + mc) / 4));

    // Recompute ring bands from new metrics
    s.ringBands = deriveRingBands(s);

    // Recompute mempool size estimate
    s.mempoolSizeMb = s.mempoolTxCount * 0.00028;

    return s;
  }, [baseSnapshot, overrides, hasOverrides]);

  // Unified interaction: hover = highlight + dim others, click = lock + show detail panel
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [detailText, setDetailText] = useState<{ title: string; body: string } | null>(null);
  const [showDataInfo, setShowDataInfo] = useState(false);

  const handleGroupClick = (groupId: string, title: string, body: string) => {
    if (selectedGroup === groupId) {
      setSelectedGroup(null);
      setDetailText(null);
    } else {
      setSelectedGroup(groupId);
      setDetailText({ title, body });
    }
  };

  const clearSelection = () => { setSelectedGroup(null); setDetailText(null); setHoveredGroup(null); };

  // The active group is either the clicked (locked) or hovered one
  const activeGroup = selectedGroup ?? hoveredGroup;

  // Guided tour
  const [tourStep, setTourStep] = useState<number | null>(null);
  // Tour that DRIVES the app — switches time periods, adjusts sliders
  interface TourStep {
    title: string;
    text: string;
    action?: () => void; // runs when step activates
  }

  const tourSteps: TourStep[] = [
    {
      title: "Welcome",
      text: "This is a digital twin of the Bitcoin network. Every shape is driven by real blockchain data from Strategy Mosaic. Let's walk through a live analysis.",
      action: () => { setActiveId("current"); resetOverrides(); },
    },
    {
      title: "Current State — Block #880,547",
      text: "You're looking at today's network. 876 EH/s hashrate. Health score 8.7/10 — the core is large and bright. Mempool is nearly empty (1K txs) so the congestion ring is flat. The 144 blocks on the spine are uniform because block stress is only 0.9/10.",
      action: () => { setActiveId("current"); resetOverrides(); },
    },
    {
      title: "Now let's go back to the 2017 Bull Run",
      text: "Watch every ring change. Congestion jumps to 4.7/10 — the red-orange ring ignites with 343K pending transactions. The mempool strata particles appear. Hashrate is only 13 EH/s (vs 876 today). Health drops to 6.9. The entire scene feels stressed.",
      action: () => { setActiveId("bull-2017"); resetOverrides(); },
    },
    {
      title: "Block #457,316 — 2017 Peak",
      text: "The spine shows block #457,316. The outer rings glow intensely — fee pressure at 2.9/10 means users are competing for block space. Notice the fee pressure ring has taller segments in the high-fee quadrants. Hover any block on the spine to see its number.",
      action: () => { setActiveId("bull-2017"); resetOverrides(); },
    },
    {
      title: "Compare: FTX Collapse",
      text: "November 2022 — FTX just collapsed. The market is panicking. But look at the network: health 8.5/10, blocks perfect at 600s, mempool barely 12K. Bitcoin's protocol was completely indifferent to FTX. The core is large and bright. 245 EH/s.",
      action: () => { setActiveId("ftx"); resetOverrides(); },
    },
    {
      title: "Jump to the 2024 ATH — $73K",
      text: "March 2024. ETF-driven surge to $73K. 380K mempool transactions — the highest in our dataset. Congestion at 4.8/10. The congestion ring is ablaze. Particles are dense. But blocks are still coming every 600s. The network bends but doesn't break.",
      action: () => { setActiveId("ath-2024"); resetOverrides(); },
    },
    {
      title: "What-If: Stress Test the Network",
      text: "Now let's simulate. We'll take today's healthy network and flood the mempool to 400K transactions. Watch the congestion ring ignite, particles multiply, and health score plummet.",
      action: () => { setActiveId("current"); resetOverrides(); setOverride("mempool", 400000); setOverride("congestion", 8.5); setOverride("feePressure", 7.0); },
    },
    {
      title: "What-If: Mining Crisis",
      text: "Now drop the hashrate to 50 EH/s — like a massive mining ban. The mining pool nodes shrink dramatically. Block stress increases. The core dims. This is what a 94% hashrate drop looks like geometrically.",
      action: () => { setActiveId("current"); resetOverrides(); setOverride("hashrate", 50); setOverride("blockStress", 7.5); },
    },
    {
      title: "Your Turn",
      text: "You've seen how the visualization responds to real events and hypothetical scenarios. Switch time periods on the right. Drag the What-If sliders on the left. Hover and click any element. Every shape tells a story rooted in data.",
      action: () => { setActiveId("current"); resetOverrides(); },
    },
  ];

  const goToTourStep = (step: number) => {
    if (step >= tourSteps.length) {
      setTourStep(null);
      setActiveId("current");
      resetOverrides();
      return;
    }
    setTourStep(step);
    tourSteps[step].action?.();
  };

  return (
    <div className="hud-shell">
      {/* Full-bleed Canvas */}
      <Canvas
        camera={{ position: [0, 2.2, 14], fov: 34 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        dpr={[1, 2]}
        style={{ position: "fixed", inset: 0 }}
      >
        <color attach="background" args={["#000000"]} />
        <fog attach="fog" args={["#000000", 25, 55]} />
        <PrimeRadiantScene
          snapshot={effectiveSnapshot}
          activeGroup={activeGroup}
          onHover={setHoveredGroup}
          onClick={handleGroupClick}
          onDeselect={clearSelection}
        />
        <EffectComposer>
          <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.6} intensity={2.8} mipmapBlur />
        </EffectComposer>
        <OrbitControls enablePan enableZoom minDistance={1.5} maxDistance={45} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 1.2} />
      </Canvas>

      {/* ═══ FLOATING HUD PANELS ═══ */}

      {/* Top-left: Title + key metrics */}
      <div className="hud hud-top-left">
        <h1 className="hud-title">Visualizing the Bitcoin Network</h1>
        <p className="hud-powered">Powered by Strategy Mosaic</p>
        <p className="hud-datasource">
          Raw blockchain data published in-memory through a universal semantic layer — every metric traceable, every visual accountable.
          <button className="info-icon" onClick={() => setShowDataInfo(true)} type="button" title="Data source details">i</button>
        </p>
        <div className="hud-metrics">
          <div className="hud-metric"><span>Block</span><strong>#{effectiveSnapshot.blockHeight.toLocaleString()}</strong></div>
          <div className="hud-metric"><span>Mempool</span><strong>{effectiveSnapshot.mempoolTxCount.toLocaleString()}</strong></div>
          <div className="hud-metric"><span>Hashrate</span><strong>{effectiveSnapshot.networkHashrateEh.toFixed(0)} EH/s</strong></div>
        </div>
      </div>

      {/* Top-right: Time presets */}
      <div className="hud hud-top-right">
        <p className="eyebrow">Time Period</p>
        <div className="hud-time-list">
          {mosaicSnapshots.map((s) => (
            <button key={s.id} className={s.id === baseSnapshot.id ? "hud-time-btn active" : "hud-time-btn"} onClick={() => { setActiveId(s.id); resetOverrides(); clearSelection(); }} type="button">
              <span>{s.label}</span>
              <span className="hud-time-date">{s.snapshotTime.slice(0, 10)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Left-center: What-If Simulation */}
      <div className="hud hud-left-center">
        <div className="hud-whatif-header">
          <p className="eyebrow">What-If Simulation</p>
          {hasOverrides && <button className="reset-button" onClick={resetOverrides} type="button">Reset</button>}
        </div>
        {WHAT_IF_PARAMS.map((param) => {
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

      {/* Bottom-left: KPIs + Legend */}
      <div className="hud hud-bottom-left">
        <div className="hud-kpis">
          <MetricCard label="Fee Pressure" value={effectiveSnapshot.feePressureIndex.toFixed(1)} severity={getSeverity(effectiveSnapshot.feePressureIndex)} />
          <MetricCard label="Congestion" value={effectiveSnapshot.congestionScore.toFixed(1)} severity={getSeverity(effectiveSnapshot.congestionScore)} />
          <MetricCard label="Block Stress" value={effectiveSnapshot.blockProductionStress.toFixed(1)} severity={getSeverity(effectiveSnapshot.blockProductionStress)} />
          <MetricCard label="Health" value={effectiveSnapshot.networkHealthScore.toFixed(1)} severity={getSeverity(10 - effectiveSnapshot.networkHealthScore)} />
        </div>
        {/* Legend removed — rings have their own labels in the scene */}
      </div>

      {/* Fixed detail panel — appears on click */}
      {detailText && (
        <div className="hud hud-detail-panel">
          <div className="detail-header">
            <strong>{detailText.title}</strong>
            <button onClick={clearSelection} type="button">x</button>
          </div>
          <p>{detailText.body}</p>
        </div>
      )}

      {/* Data source info modal */}
      {showDataInfo && (
        <div className="tour-overlay" onClick={() => setShowDataInfo(false)}>
          <div className="data-info-card" onClick={(e) => e.stopPropagation()}>
            <h3>Data Source & Methodology</h3>

            <div className="data-info-section">
              <h4>Source Data</h4>
              <p>Historical Bitcoin blockchain metrics extracted from public APIs (blockchain.com, mempool.space) covering 2009 to present. Daily granularity — one snapshot per calendar day. Published in-memory directly from source through Strategy.</p>
            </div>

            <div className="data-info-section">
              <h4>Strategy Mosaic</h4>
              <p>Raw data is governed through the Strategy Mosaic universal semantic layer — published in-memory from source, no intermediate warehouse. Mosaic defines the canonical metrics (fee pressure index, congestion score, block production stress, miner concentration, network health) as governed, auditable calculations. Every number displayed traces back to a Mosaic-defined metric.</p>
            </div>

            <div className="data-info-section">
              <h4>Visual Mapping</h4>
              <p>Each geometric element maps 1:1 to a Mosaic metric. Ring heights = metric values. Ring sector widths = data proportions (fee tier share, pool hashrate share). Particle counts = mempool transaction counts. Block sizes = production stress. Nothing is decorative — if it glows, it means something.</p>
            </div>

            <div className="data-info-section">
              <h4>What-If Simulation</h4>
              <p>The sliders modify metric values client-side using the same derivation formulas that Mosaic uses. The base data is real; the simulation applies bounded overrides locally. Health score recomputes as the inverse average of the four stress metrics. No server round-trip occurs during what-if — it's instant, local computation on real foundations.</p>
            </div>

            <div className="data-info-section">
              <h4>Limitations</h4>
              <p>Mining pool shares are period-aggregated (not daily granular). Fee tier distributions use modeled estimates. Mempool data is unavailable before ~2017. Block-level metrics are daily averages, not per-block. These limitations are reflected honestly — empty data shows as empty visualization.</p>
            </div>

            <button className="tour-next" onClick={() => setShowDataInfo(false)} type="button">Close</button>
          </div>
        </div>
      )}

      {/* Tour button */}
      {tourStep === null && (
        <button className="hud tour-button" onClick={() => goToTourStep(0)} type="button">
          Take a Tour
        </button>
      )}

      {/* Tour overlay */}
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
              <button className="tour-skip" onClick={() => { setTourStep(null); setActiveId("current"); resetOverrides(); }} type="button">Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom strip removed — data is in the 3D scene tooltips */}
    </div>
  );
}

function MetricCard({ label, value, severity }: { label: string; value: string; severity: "normal" | "elevated" | "critical" }) {
  return (
    <div className="metric-card" data-severity={severity}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   3D SCENE — PRIME RADIANT
   ═══════════════════════════════════════════════════════ */

interface SceneProps {
  snapshot: NetworkSnapshot;
  activeGroup: string | null;
  onHover: (groupId: string | null) => void;
  onClick: (groupId: string, title: string, body: string) => void;
  onDeselect: () => void;
}

function PrimeRadiantScene({ snapshot, activeGroup, onHover, onClick, onDeselect }: SceneProps) {
  return (
    <group position={[0, -0.15, 0]} scale={0.78}>
      {/* Lighting */}
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 2]} intensity={12} color="#FA660F" distance={22} decay={1.8} />
      <pointLight position={[6, 5, 4]} intensity={5} color="#FF8C3A" distance={20} decay={2} />
      <pointLight position={[-6, -4, 4]} intensity={4} color="#FA660F" distance={18} decay={2} />
      <pointLight position={[0, -6, 2]} intensity={3} color="#7A3308" distance={16} decay={2} />
      <pointLight position={[0, 6, 1]} intensity={2} color="#FF6B00" distance={14} decay={2} />

      {/* Click empty space to deselect */}
      <mesh position={[0, 0, -2]} onClick={onDeselect}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Every element below is rooted in real data with a tooltip */}

      <BlockSpine key={`spine-${snapshot.id}`} snapshot={snapshot} />

      {/* 4 data rings */}
      {snapshot.ringBands.map((band, i) => {
        const gid = `ring-${i}`;
        return (
          <SegmentedDataRing
            key={`${snapshot.id}-${band.id}`}
            band={band}
            index={i}
            snapshot={snapshot}
            isDimmed={activeGroup !== null && activeGroup !== gid}
            isHighlighted={activeGroup === gid}
            groupId={gid}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}

      {/* Fee tier orbital paths */}
      <FeeOrbitRings key={`fee-${snapshot.id}`} feeBuckets={snapshot.feeBuckets} activeGroup={activeGroup} onHover={onHover} onClick={onClick} />

      {/* Mining pool constellation */}
      <MiningConstellation
        key={`mining-${snapshot.id}`}
        pools={snapshot.miningPools}
        hashrate={snapshot.networkHashrateEh}
        activeGroup={activeGroup}
        onHover={onHover}
        onClick={onClick}
      />

      <MempoolStrata key={`strata-${snapshot.id}`} snapshot={snapshot} />
      <EpochMarkers key={`epoch-${snapshot.id}`} snapshot={snapshot} />
      <InterRingFilaments key={`filaments-${snapshot.id}`} snapshot={snapshot} />
      <DataInscriptions key={`labels-${snapshot.id}`} snapshot={snapshot} />
    </group>
  );
}

/* ─── RADIANT CORE ─── */

/* RadiantCore removed — wireframe shells were decorative.
   Health score is communicated via KPI cards and the overall ring activity.
   The spine blocks serve as the central visual anchor. */

/* ─── BLOCK SPINE ─── 144 blocks per day via InstancedMesh.
   All blocks are the SAME size because we have daily aggregates,
   not per-block data. The COUNT is the data (more/fewer blocks =
   faster/slower block production). Each block is hoverable.
   Color = health (orange = healthy, red = stressed).
*/

function BlockSpine({ snapshot }: { snapshot: NetworkSnapshot }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const healthColor = new THREE.Color(snapshot.networkHealthScore < 5.5 ? "#FF3D00" : "#FA660F");
  const blockCount = Math.max(10, Math.min(snapshot.blockHeight > 0 ? 144 : 20, 200));
  const blockSize = 0.03;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => { setHoveredIdx(null); }, [snapshot.id]);

  const blockData = useMemo(() => {
    const spacing = 8 / blockCount;
    return Array.from({ length: blockCount }).map((_, i) => ({
      y: i * spacing - 4,
      blockHeight: snapshot.blockHeight - (blockCount - 1 - i),
    }));
  }, [snapshot.blockHeight, blockCount]);

  // Update instance matrices
  useMemo(() => {
    if (!meshRef.current) return;
    blockData.forEach((b, i) => {
      dummy.position.set(0, b.y, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [blockData, dummy]);

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, blockCount]}
        onPointerMove={(e) => {
          if (e.instanceId !== undefined) { e.stopPropagation(); setHoveredIdx(e.instanceId); }
        }}
        onPointerOut={() => setHoveredIdx(null)}
      >
        <octahedronGeometry args={[blockSize, 0]} />
        <meshStandardMaterial
          color="#FF8C3A"
          emissive={healthColor}
          emissiveIntensity={0.6}
          metalness={0.4}
          roughness={0.08}
        />
      </instancedMesh>

      {hoveredIdx !== null && hoveredIdx < blockData.length && (
        <group position={[0, blockData[hoveredIdx].y, 0]}>
          <Html center style={{ pointerEvents: "none" }}>
            <div className="scene-tooltip">
              <strong>Block #{blockData[hoveredIdx].blockHeight.toLocaleString()}</strong>
              1 of {blockCount} blocks mined this day
              {"\n"}Avg interval: {snapshot.avgBlockIntervalSeconds}s (target: 600s)
              {"\n"}Stress: {snapshot.blockProductionStress.toFixed(1)}/10
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

/* ─── DATA RING ───
   Each ring has segments matching its ACTUAL data granularity:

   Ring 0 (Fee Pressure): 4 sectors = 4 fee tiers. Height = txShare.
   Ring 1 (Settlement): 1 sector per block mined (up to 144). Height = uniform (healthy) or varied (stressed).
   Ring 2 (Congestion): 4 sectors = mempool txs per fee tier. Height = pending txs in that tier.
   Ring 3 (Mining): 5 sectors = 5 pools. Arc width = hashrate share. Height = share proportion.

   Every segment is individually hoverable with a unique tooltip.
*/

function SegmentedDataRing({ band, index, snapshot, isDimmed, isHighlighted, groupId, onHover, onClick }: {
  band: RingBand; index: number; snapshot: NetworkSnapshot;
  isDimmed?: boolean; isHighlighted?: boolean;
  groupId: string;
  onHover: (id: string | null) => void;
  onClick: (id: string, title: string, body: string) => void;
}) {
  const color = RING_COLORS[index] || "#FA660F";
  const label = RING_LABELS[index] || "";
  const dimFactor = isDimmed ? 0.12 : 1;
  const brightFactor = isHighlighted ? 1.4 : 1;

  // Build segments based on ring type — each segment is a UNIQUE data point
  const segments = useMemo(() => {
    const result: Array<{
      startAngle: number; endAngle: number; midAngle: number;
      height: number; depth: number; emIntensity: number;
      tooltipTitle: string; tooltipDetail: string;
    }> = [];

    if (index === 0) {
      // FEE PRESSURE: 4 sectors = 4 fee tiers
      const tiers = snapshot.feeBuckets;
      let angleOffset = 0;
      tiers.forEach((tier) => {
        const arcSpan = (Math.PI * 2) * tier.txShare; // proportional arc
        const height = 0.03 + tier.txShare * 0.3 + (snapshot.feePressureIndex / 10) * 0.15;
        const mempoolInTier = Math.round(snapshot.mempoolTxCount * tier.txShare);
        result.push({
          startAngle: angleOffset,
          endAngle: angleOffset + arcSpan,
          midAngle: angleOffset + arcSpan / 2,
          height,
          depth: 0.04 + tier.intensity * 0.03,
          emIntensity: 0.3 + tier.intensity * 1.2,
          tooltipTitle: `Fee Tier: ${tier.feeRateLabel}`,
          tooltipDetail: `${(tier.txShare * 100).toFixed(1)}% of transactions\n${mempoolInTier > 0 ? mempoolInTier.toLocaleString() + " pending txs" : "No pending txs"}\nIntensity: ${(tier.intensity * 100).toFixed(0)}/100`,
        });
        angleOffset += arcSpan;
      });
    } else if (index === 1) {
      // SETTLEMENT: 1 arc = one daily block production stress value
      // This is honest — we have ONE stress metric per day, not per-block
      const stress = snapshot.blockProductionStress / 10;
      const health = 1 - stress;
      const fillAngle = Math.PI * 2 * Math.max(0.1, health); // healthy = more fill
      const height = 0.03 + health * 0.15;
      result.push({
        startAngle: -fillAngle / 2,
        endAngle: fillAngle / 2,
        midAngle: 0,
        height,
        depth: 0.04,
        emIntensity: 0.3 + health * 0.8,
        tooltipTitle: "Block Production",
        tooltipDetail: `Stress: ${snapshot.blockProductionStress.toFixed(1)}/10\nAvg interval: ${snapshot.avgBlockIntervalSeconds}s (target: 600s)\n144 blocks mined\n${stress < 0.2 ? "Healthy — blocks on schedule" : stress < 0.5 ? "Moderate stress — some irregularity" : "High stress — irregular block times"}`,
      });
    } else if (index === 2) {
      // CONGESTION: 1 arc = one daily congestion score
      // Honest — we have ONE congestion metric, not per-tier congestion
      const cg = snapshot.congestionScore / 10;
      const total = snapshot.mempoolTxCount;
      const fillAngle = Math.PI * 2 * Math.max(0.05, cg); // more congestion = more fill
      const height = 0.01 + cg * 0.25;
      result.push({
        startAngle: -fillAngle / 2,
        endAngle: fillAngle / 2,
        midAngle: 0,
        height: Math.max(0.005, height),
        depth: 0.03 + cg * 0.04,
        emIntensity: cg > 0.01 ? 0.3 + cg * 1.5 : 0.05,
        tooltipTitle: "Network Congestion",
        tooltipDetail: `Score: ${snapshot.congestionScore.toFixed(1)}/10\n${total.toLocaleString()} pending transactions\n${snapshot.mempoolSizeMb.toFixed(1)} MB mempool\n${cg < 0.1 ? "Clear — no congestion" : cg < 0.3 ? "Light traffic" : cg < 0.5 ? "Moderate backlog" : "Heavy congestion"}`,
      });
    } else {
      // MINING: 5 sectors = 5 pools, arc width = hashrate share
      let angleOffset = 0;
      snapshot.miningPools.forEach((pool) => {
        const arcSpan = (Math.PI * 2) * pool.sharePct;
        const height = 0.03 + pool.sharePct * 0.4;
        result.push({
          startAngle: angleOffset, endAngle: angleOffset + arcSpan, midAngle: angleOffset + arcSpan / 2,
          height, depth: 0.04 + pool.sharePct * 0.05,
          emIntensity: 0.3 + pool.sharePct * 1.5,
          tooltipTitle: pool.name,
          tooltipDetail: `${(pool.sharePct * 100).toFixed(1)}% hashrate\n${pool.hashRateEh} EH/s\n${pool.shareChange30d >= 0 ? "+" : ""}${(pool.shareChange30d * 100).toFixed(1)}% 30d`,
        });
        angleOffset += arcSpan;
      });
    }

    return result;
  }, [index, snapshot]);

  // Build detail text for click panel
  const detailBody = segments.map((s) => `${s.tooltipTitle}\n${s.tooltipDetail}`).join("\n\n");

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover(groupId); }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => { e.stopPropagation(); onClick(groupId, `${label} Ring`, detailBody); }}
    >
      {/* Track ring */}
      <mesh>
        <ringGeometry args={[band.radius - 0.008, band.radius + 0.008, 256]} />
        <meshBasicMaterial color={color} transparent opacity={(isHighlighted ? 0.06 : 0.02) * dimFactor} />
      </mesh>

      {/* Data segments */}
      {segments.map((seg, si) => {
        const arcLen = seg.endAngle - seg.startAngle;
        if (!arcLen || arcLen < 0.001 || !isFinite(arcLen)) return null;
        const subCount = Math.max(2, Math.round(arcLen / (Math.PI * 2) * 48));
        const gap = arcLen * 0.06;
        const usableArc = arcLen - gap;
        if (!usableArc || usableArc < 0.001 || !isFinite(usableArc)) return null;
        if (!isFinite(seg.height) || !isFinite(seg.depth)) return null;

        return (
          <group key={si}>
            {Array.from({ length: subCount }).map((_, j) => {
              const t = j / subCount;
              const angle = seg.startAngle + gap / 2 + t * usableArc;
              const x = Math.cos(angle) * band.radius;
              const y = Math.sin(angle) * band.radius;
              const w = Math.max(0.005, (usableArc / subCount) * band.radius * 0.85);

              return (
                <mesh key={j} position={[x, y, 0]} rotation={[0, 0, angle]}>
                  <boxGeometry args={[w, seg.height, seg.depth]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={seg.emIntensity * dimFactor * brightFactor}
                    metalness={0.3}
                    roughness={0.3}
                    transparent
                    opacity={0.7 * dimFactor * brightFactor}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {/* Ring label */}
      {/* Ring label — name */}
      <Text
        position={[0, band.radius + 0.22, 0.1]}
        fontSize={0.07}
        color={color}
        anchorX="center"
        anchorY="bottom"
        fillOpacity={isHighlighted ? 0.8 : 0.4 * dimFactor}
        font={undefined}
      >
        {label}
      </Text>
      {/* Ring label — score + segment count */}
      <Text
        position={[0, band.radius + 0.13, 0.1]}
        fontSize={0.05}
        color="#FFFFFF"
        anchorX="center"
        anchorY="bottom"
        fillOpacity={isHighlighted ? 0.5 : 0.2 * dimFactor}
        font={undefined}
      >
        {([snapshot.feePressureIndex, snapshot.blockProductionStress, snapshot.congestionScore, snapshot.minerConcentrationScore][index] ?? 0).toFixed(1)}/10 · {segments.length} {segments.length === 1 ? "value" : "values"}
      </Text>
    </group>
  );
}

/* ─── FEE ORBIT RINGS ─── */

function FeeOrbitRings({ feeBuckets, activeGroup, onHover, onClick }: { feeBuckets: FeeBucket[]; activeGroup: string | null; onHover: (id: string | null) => void; onClick: (id: string, title: string, body: string) => void }) {
  const feeColors = ["#FFAA44", "#FF8833", "#FF5500", "#FF3300"];
  const feeLabels = ["1-10 sat/vB", "11-30 sat/vB", "31-80 sat/vB", "81+ sat/vB"];

  return (
    <group>
      {feeBuckets.map((bucket, i) => {
        const radius = 1.05 + i * 0.5;
        const segCount = 64;
        const activeCount = Math.round(segCount * bucket.txShare * 2.5);
        const tiltX = Math.PI / 2.4 + i * 0.06;
        const color = feeColors[i] || "#FA660F";

        return (
          <group
            key={bucket.id}
            rotation={[tiltX, 0, Math.PI * 0.12 + i * 0.18]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(`fee-${i}`); }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onClick(`fee-${i}`, `Fee Tier: ${feeLabels[i]}`, `${(bucket.txShare * 100).toFixed(1)}% of transactions\nIntensity: ${(bucket.intensity * 100).toFixed(0)}/100`); }}
          >
            {Array.from({ length: segCount }).map((_, j) => {
              const angle = (j / segCount) * Math.PI * 2;
              const isActive = j < activeCount;
              const wave = Math.sin(angle * 2 + i * 1.7) * 0.5 + 0.5;
              const h = isActive ? 0.015 + bucket.intensity * 0.08 * (0.5 + wave * 0.5) : 0.005;
              const arcLen = (2 * Math.PI * radius) / segCount;

              return (
                <mesh key={j} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]} rotation={[0, 0, angle]}>
                  <boxGeometry args={[arcLen * 0.55, h, 0.02]} />
                  {isActive ? (
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={(activeGroup === `fee-${i}` ? 1.5 : 0.3) + bucket.intensity * 0.8} metalness={0.2} roughness={0.4} transparent opacity={(activeGroup !== null && activeGroup !== `fee-${i}`) ? 0.1 : 0.4 + bucket.intensity * 0.4} />
                  ) : (
                    <meshBasicMaterial color="#0D0800" transparent opacity={0.015} />
                  )}
                </mesh>
              );
            })}
            {/* Tooltip removed — shown in fixed detail panel on click */}
          </group>
        );
      })}
    </group>
  );
}

/* ─── OUTER SWEEP RINGS ─── */

/* OuterSweepRings removed — decorative, not rooted in data */
/* ParticleNebula removed — individual particles not traceable to data points */

/* ParticleNebula function removed — replaced by MempoolStrata (data-rooted per-tier particles) */

/* ─── MINING CONSTELLATION ─── with hover tooltips, dramatic size differences */

function MiningConstellation({ pools, hashrate, activeGroup, onHover, onClick }: { pools: MiningPoolSnapshot[]; hashrate: number; activeGroup: string | null; onHover: (id: string | null) => void; onClick: (id: string, title: string, body: string) => void }) {
  return (
    <group>
      {pools.map((pool, i) => (
        <MiningNode key={pool.id} pool={pool} index={i} total={pools.length} networkHashrate={hashrate} activeGroup={activeGroup} onHover={onHover} onClick={onClick} />
      ))}
    </group>
  );
}

function MiningNode({ pool, index, total, networkHashrate, activeGroup, onHover, onClick }: { pool: MiningPoolSnapshot; index: number; total: number; networkHashrate: number; activeGroup: string | null; onHover: (id: string | null) => void; onClick: (id: string, title: string, body: string) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gid = `pool-${pool.id}`;

  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const r = 5.8;
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r;

  // Dramatic size scaling — Foundry (30%) is 6x bigger than MARA (4.3%)
  const nodeSize = 0.03 + pool.sharePct * 0.55;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.06;
    }
  });

  const isActive = activeGroup === gid;
  const isDimmed = activeGroup !== null && activeGroup !== gid;
  const dim = isDimmed ? 0.12 : 1;
  const bright = isActive ? 1.4 : 1;

  return (
    <group
      position={[x, y, 0]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(gid); }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => { e.stopPropagation(); onClick(gid, pool.name, `${(pool.sharePct * 100).toFixed(1)}% hashrate share\n${pool.hashRateEh} EH/s of ${networkHashrate.toFixed(0)} EH/s total`); }}
    >
      <mesh ref={meshRef}>
        <octahedronGeometry args={[nodeSize, 0]} />
        <meshStandardMaterial
          color={isActive ? "#FFCC66" : "#FF8C3A"}
          emissive="#FA660F"
          emissiveIntensity={(0.7 + pool.sharePct * 1.5) * dim * bright}
          metalness={0.4}
          roughness={0.1}
        />
      </mesh>
      <mesh>
        <octahedronGeometry args={[nodeSize * 1.7, 0]} />
        <meshBasicMaterial color="#FA660F" wireframe transparent opacity={0.05 * dim} />
      </mesh>
      <Line points={[[0, 0, 0], [-x, -y, 0]]} color="#FA660F" lineWidth={0.3} transparent opacity={0.03 * dim} dashed dashSize={0.12} gapSize={0.06} />
      <Text position={[x > 0 ? 0.3 : -0.3, 0.22, 0]} fontSize={0.075} color="#FFFFFF" anchorX={x > 0 ? "left" : "right"} anchorY="middle" fillOpacity={0.4 * dim * bright} font={undefined}>
        {pool.name}
      </Text>
      <Text position={[x > 0 ? 0.3 : -0.3, 0.1, 0]} fontSize={0.055} color="#FA660F" anchorX={x > 0 ? "left" : "right"} anchorY="middle" fillOpacity={0.3 * dim * bright} font={undefined}>
        {(pool.sharePct * 100).toFixed(1)}%
      </Text>
    </group>
  );
}

/* ─── MEMPOOL STRATA ───
   Each particle = ~1,000 pending transactions at a specific fee tier.
   Stratified by z-depth: low-fee txs behind, priority txs in front.
   Only visible when mempool has transactions — zero mempool = nothing.
*/

function MempoolStrata({ snapshot }: { snapshot: NetworkSnapshot }) {
  const mempoolNorm = Math.min(snapshot.mempoolTxCount / 400000, 1);
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  if (mempoolNorm < 0.01) return null;

  const feeColors = ["#FFAA44", "#FF8833", "#FF5500", "#FF3300"];
  const feeLabels = ["1-10 sat/vB", "11-30 sat/vB", "31-80 sat/vB", "81+ sat/vB"];

  return (
    <group>
      {snapshot.feeBuckets.map((bucket, li) => {
        const txsInTier = Math.round(snapshot.mempoolTxCount * bucket.txShare);
        const particleCount = Math.max(8, Math.round(txsInTier / 1000));
        const positions = new Float32Array(particleCount * 3);
        const radius = 1.8 + li * 0.6;
        const z = -0.8 + li * 0.5;

        // Deterministic placement seeded from block height + tier
        let seed = snapshot.blockHeight * 7 + li * 31;
        for (let i = 0; i < particleCount; i++) {
          seed = (seed * 16807) % 2147483647;
          const angle = (seed / 2147483647) * Math.PI * 2;
          seed = (seed * 16807) % 2147483647;
          const rVar = (seed / 2147483647) * 0.8 + 0.5;
          positions[i * 3] = Math.cos(angle) * radius * rVar;
          positions[i * 3 + 1] = Math.sin(angle) * radius * rVar;
          seed = (seed * 16807) % 2147483647;
          positions[i * 3 + 2] = z + ((seed / 2147483647) - 0.5) * 0.3;
        }

        return (
          <group key={li}>
            <points
              onPointerOver={(e) => { e.stopPropagation(); setHoveredLayer(li); }}
              onPointerOut={() => setHoveredLayer(null)}
            >
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              </bufferGeometry>
              <pointsMaterial
                color={feeColors[li]}
                size={0.008 + bucket.intensity * 0.014}
                sizeAttenuation
                transparent
                opacity={hoveredLayer === li ? 0.8 : 0.15 + bucket.intensity * 0.3}
              />
            </points>
            {hoveredLayer === li && (
              <Html position={[0, radius * 0.7, z]} center style={{ pointerEvents: "none" }}>
                <div className="scene-tooltip">
                  <strong>{feeLabels[li]}</strong><br />
                  ~{txsInTier.toLocaleString()} pending txs<br />
                  {(bucket.txShare * 100).toFixed(1)}% of mempool
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ─── EPOCH MARKERS ───
   Small tick marks on the outer boundary ring representing difficulty
   adjustment epochs. Each mark = one epoch (~2016 blocks ≈ 2 weeks).
   Denser marks = more epochs visible in the historical window.
*/

function EpochMarkers({ snapshot }: { snapshot: NetworkSnapshot }) {
  const epochCount = Math.floor(snapshot.blockHeight / 2016);
  const visibleEpochs = Math.min(epochCount, 24);
  const [hoveredEpoch, setHoveredEpoch] = useState<number | null>(null);

  const markers = useMemo(() => {
    const result: Array<{ angle: number; height: number; isHalving: boolean; epochNum: number; blockStart: number }> = [];
    for (let i = 0; i < visibleEpochs; i++) {
      const epoch = epochCount - visibleEpochs + i;
      const blockAtEpoch = epoch * 2016;
      const isHalving = [210000, 420000, 630000, 840000].some(
        (h) => Math.abs(blockAtEpoch - h) < 2016
      );
      result.push({
        angle: (i / visibleEpochs) * Math.PI * 2 - Math.PI / 2,
        height: isHalving ? 0.25 : 0.08 + (i / visibleEpochs) * 0.06,
        isHalving,
        epochNum: epoch,
        blockStart: blockAtEpoch,
      });
    }
    return result;
  }, [epochCount, visibleEpochs]);

  useEffect(() => { setHoveredEpoch(null); }, [snapshot.id]);

  return (
    <group position={[0, 0, -0.5]}>
      {markers.map((m, i) => {
        const r = 6.0;
        const isHovered = hoveredEpoch === i;
        return (
          <group key={i}>
            <mesh
              position={[Math.cos(m.angle) * r, Math.sin(m.angle) * r, 0]}
              rotation={[0, 0, m.angle]}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredEpoch(i); }}
              onPointerOut={() => setHoveredEpoch(null)}
            >
              <boxGeometry args={[0.005, isHovered ? m.height * 1.5 : m.height, 0.03]} />
              <meshStandardMaterial
                color={m.isHalving ? "#FFCC00" : "#FA660F"}
                emissive={m.isHalving ? "#FFCC00" : "#FA660F"}
                emissiveIntensity={isHovered ? 1.8 : m.isHalving ? 1.2 : 0.3}
                transparent
                opacity={isHovered ? 1 : m.isHalving ? 0.9 : 0.25}
              />
            </mesh>
            {isHovered && (
              <Html position={[Math.cos(m.angle) * 6.5, Math.sin(m.angle) * 6.5, 0.2]} center style={{ pointerEvents: "none" }}>
                <div className="scene-tooltip">
                  <strong>{m.isHalving ? "Halving Epoch" : `Difficulty Epoch #${m.epochNum}`}</strong>
                  Block {m.blockStart.toLocaleString()}–{(m.blockStart + 2015).toLocaleString()}
                  {m.isHalving ? "\nBlock subsidy was halved at this epoch" : "\nDifficulty adjusted every 2,016 blocks (~2 weeks)"}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {markers.filter((m) => m.isHalving).map((m, i) => (
        <Text
          key={`h-${i}`}
          position={[Math.cos(m.angle) * 6.35, Math.sin(m.angle) * 6.35, 0]}
          fontSize={0.05}
          color="#FFCC00"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.4}
          font={undefined}
        >
          HALVING
        </Text>
      ))}
    </group>
  );
}

/* ─── FEE FLOW ARCS ───
   Arcs connecting fee pressure ring → congestion ring, representing
   the flow of transaction fees through the network. Each arc = fee
   pressure at that angular position pushing into congestion.
   Count = feePressureIndex × congestionScore. Zero activity = no arcs.
*/

function InterRingFilaments({ snapshot }: { snapshot: NetworkSnapshot }) {
  const [hovered, setHovered] = useState(false);
  const intensity = snapshot.feePressureIndex * snapshot.congestionScore;
  if (intensity < 0.1) return null; // no fee pressure + congestion = no flow

  const arcCount = Math.max(4, Math.round(intensity * 2));
  const radii = [2.0, 2.85, 3.75, 4.85];

  const arcs = useMemo(() => {
    const result: Array<{ startR: number; endR: number; angle: number; opacity: number }> = [];
    let seed = snapshot.blockHeight * 13;
    for (let i = 0; i < arcCount; i++) {
      seed = (seed * 16807) % 2147483647;
      const ringIdx = Math.floor((seed / 2147483647) * 3);
      seed = (seed * 16807) % 2147483647;
      const angle = (seed / 2147483647) * Math.PI * 2;
      seed = (seed * 16807) % 2147483647;
      result.push({ startR: radii[ringIdx], endR: radii[ringIdx + 1], angle, opacity: 0.02 + (seed / 2147483647) * 0.06 });
    }
    return result;
  }, [arcCount, snapshot.blockHeight]);

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {arcs.map((f, i) => (
        <Line key={i} points={[
          [Math.cos(f.angle) * f.startR, Math.sin(f.angle) * f.startR, 0],
          [Math.cos(f.angle + 0.04) * ((f.startR + f.endR) / 2), Math.sin(f.angle + 0.04) * ((f.startR + f.endR) / 2), 0.1],
          [Math.cos(f.angle + 0.08) * f.endR, Math.sin(f.angle + 0.08) * f.endR, 0],
        ]} color="#FA660F" lineWidth={0.3} transparent opacity={hovered ? f.opacity * 3 : f.opacity} />
      ))}
      {hovered && (
        <Html position={[0, 3.3, 0.2]} center style={{ pointerEvents: "none" }}>
          <div className="scene-tooltip">
            <strong>Fee Flow</strong><br />
            {arcCount} active fee pressure channels<br />
            Intensity: {intensity.toFixed(1)}
          </div>
        </Html>
      )}
    </group>
  );
}

/* TransactionDust removed — redundant with BlockSpine */
/* ReferenceGrid removed — decorative lines not rooted in data */

/* ─── DATA INSCRIPTIONS ─── */

function DataInscriptions({ snapshot }: { snapshot: NetworkSnapshot }) {
  const items = useMemo(() => [
    { text: `${snapshot.avgBlockIntervalSeconds}s avg interval`, angle: Math.PI * 0.12, radius: 6.3 },
    { text: `${snapshot.mempoolSizeMb > 0 ? snapshot.mempoolSizeMb.toFixed(0) + " MB mempool" : "Mempool clear"}`, angle: Math.PI * 0.4, radius: 6.0 },
    { text: `${snapshot.networkHashrateEh.toFixed(0)} EH/s`, angle: -Math.PI * 0.15, radius: 6.2 },
    { text: `Health ${snapshot.networkHealthScore.toFixed(1)}/10`, angle: -Math.PI * 0.44, radius: 5.9 },
  ], [snapshot]);

  return (
    <group>
      {items.map((item, i) => (
        <Text key={i} position={[Math.cos(item.angle) * item.radius, Math.sin(item.angle) * item.radius, -0.4]} fontSize={0.055} color="#FFFFFF" anchorX="center" anchorY="middle" fillOpacity={0.15} font={undefined}>
          {item.text}
        </Text>
      ))}
    </group>
  );
}

/* BlockLabels removed — block hover tooltips are now inline on BlockSpine */

export default App;
