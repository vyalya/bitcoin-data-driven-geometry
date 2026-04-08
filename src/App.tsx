import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mosaicSnapshots, deriveRingBands } from "./data/mosaicSnapshots";
import type { NetworkSnapshot } from "./types";

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

/* getSeverity removed — cockpit readout shows raw values */

/* Ring colors/labels removed — now inline in PrimeRadiantScene */

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
  /* detailText removed — cockpit readout replaces the detail panel */
  const [showDataInfo, setShowDataInfo] = useState(false);
  const [timeExpanded, setTimeExpanded] = useState(false);

  const handleGroupClick = (groupId: string, _title: string, _body: string) => {
    setSelectedGroup(selectedGroup === groupId ? null : groupId);
  };

  const clearSelection = () => { setSelectedGroup(null); setHoveredGroup(null); };

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
      text: "Every shape, color, and size is driven by real blockchain data from Strategy Mosaic. Colors matter: deep orange = fee pressure, primary orange = settlement health, red-orange = congestion, copper = mining distribution. Brighter = more intense. Let's see it in action.",
      action: () => { setActiveId("current"); resetOverrides(); },
    },
    {
      title: "Current State — Calm Network",
      text: "Block #880,547. The rings are dim and thin — fee pressure 0.9/10, congestion 0.0/10. The fee pressure ring (innermost, deep orange) has 4 small sectors — one per fee tier. The congestion ring (red-orange) is barely a sliver because there's almost no backlog. The settlement ring (orange) is nearly full circle — stress only 0.9/10, blocks arriving on schedule.",
      action: () => { setActiveId("current"); resetOverrides(); },
    },
    {
      title: "2017 Bull Run — Watch the Colors Change",
      text: "Now look at the difference. Congestion jumps to 4.7 — the red-orange congestion ring expands to fill half the circle, glowing intensely. Fee pressure rises to 2.9 — the deep orange fee ring sectors grow taller, especially the 81+ sat/vB tier. The outer mining ring (copper) shows only 13 EH/s across 5 small pool nodes. Everything is brighter, hotter, more stressed.",
      action: () => { setActiveId("bull-2017"); resetOverrides(); },
    },
    {
      title: "FTX Collapse — Network Doesn't Care",
      text: "November 2022 — FTX just imploded. But look: the rings are calm. Congestion 0.09 — the red-orange ring is nearly invisible. Settlement stress 0.9 — the orange ring is a full, steady circle. Fee pressure 0.9. The network's geometry looks almost identical to today's calm state. Bitcoin's protocol was indifferent to the exchange chaos. The data proves it visually.",
      action: () => { setActiveId("ftx"); resetOverrides(); },
    },
    {
      title: "2024 ATH $73K — Maximum Stress",
      text: "March 2024. 380K mempool transactions. Congestion ring at 4.8 — the red-orange arc expands dramatically and glows hot. Fee pressure ring sectors are tall — the 81+ sat/vB tier dominates as users bid up fees. But the settlement ring stays full — blocks still arriving on time despite the chaos. The network bends but doesn't break.",
      action: () => { setActiveId("ath-2024"); resetOverrides(); },
    },
    {
      title: "What-If: Flood the Mempool",
      text: "Watch the color shift in real-time. We're taking today's calm network and flooding it with 400K transactions. The congestion ring (red-orange) expands and ignites. Fee pressure ring sectors grow tall. The KPI cards in the corner update — health drops from 8.7 to under 5. The visualization literally heats up.",
      action: () => { setActiveId("current"); resetOverrides(); setOverride("mempool", 400000); setOverride("congestion", 8.5); setOverride("feePressure", 7.0); },
    },
    {
      title: "What-If: Mining Crisis",
      text: "Now drop hashrate to 50 EH/s — a 94% crash. The mining pool nodes (copper, outer perimeter) shrink dramatically — Foundry USA goes from a large node to tiny. Block stress increases to 7.5 — the settlement ring shrinks from a full circle to a thin arc, signaling irregular block production. The visualization tells you exactly where the stress is.",
      action: () => { setActiveId("current"); resetOverrides(); setOverride("hashrate", 50); setOverride("blockStress", 7.5); },
    },
    {
      title: "Your Turn",
      text: "Hover any group to highlight it — everything else dims. Click to lock the selection and see details. Switch time periods on the right to compare eras. Use What-If sliders to stress-test. Every ring color, every arc width, every sector height traces back to a specific Mosaic metric.",
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

      {/* Right panel: Cockpit readout + collapsible time picker */}
      <div className="hud hud-right-panel">
        {/* Collapsible time picker */}
        <div className="cockpit-time">
          <button className="time-toggle" onClick={() => setTimeExpanded(!timeExpanded)} type="button">
            <span className="eyebrow" style={{ margin: 0 }}>Time Period</span>
            <span className="time-current">{baseSnapshot.label} · {baseSnapshot.snapshotTime.slice(0, 10)}</span>
          </button>
          {timeExpanded && (
            <div className="time-dropdown">
              {mosaicSnapshots.map((s) => (
                <button key={s.id} className={s.id === baseSnapshot.id ? "time-option active" : "time-option"} onClick={() => { setActiveId(s.id); resetOverrides(); clearSelection(); setTimeExpanded(false); }} type="button">
                  <span>{s.label}</span>
                  <span className="time-option-date">{s.snapshotTime.slice(0, 10)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cockpit readout — all metrics grouped by what they drive */}
        <div className="cockpit-readout">
          <CockpitSection title="Block Production" groupId="ring-1" activeGroup={activeGroup} items={[
            ["Blocks Mined", "144"],
            ["Avg Interval", `${effectiveSnapshot.avgBlockIntervalSeconds}s`],
            ["Block Stress", `${effectiveSnapshot.blockProductionStress.toFixed(1)}/10`],
            ["Block Height", `#${effectiveSnapshot.blockHeight.toLocaleString()}`],
          ]} />
          <CockpitSection title="Fee Market" groupId="ring-0" activeGroup={activeGroup} items={[
            ["1-10 sat/vB", `${(effectiveSnapshot.feeBuckets[0]?.txShare * 100).toFixed(1)}%`],
            ["11-30 sat/vB", `${(effectiveSnapshot.feeBuckets[1]?.txShare * 100).toFixed(1)}%`],
            ["31-80 sat/vB", `${(effectiveSnapshot.feeBuckets[2]?.txShare * 100).toFixed(1)}%`],
            ["81+ sat/vB", `${(effectiveSnapshot.feeBuckets[3]?.txShare * 100).toFixed(1)}%`],
            ["Fee Pressure", `${effectiveSnapshot.feePressureIndex.toFixed(1)}/10`],
          ]} />
          <CockpitSection title="Mempool" groupId="ring-2" activeGroup={activeGroup} items={[
            ["Pending Txs", effectiveSnapshot.mempoolTxCount.toLocaleString()],
            ["Size", `${effectiveSnapshot.mempoolSizeMb.toFixed(1)} MB`],
            ["Congestion", `${effectiveSnapshot.congestionScore.toFixed(1)}/10`],
          ]} />
          <CockpitSection title="Mining" groupId="ring-3" activeGroup={activeGroup} items={[
            ["Hashrate", `${effectiveSnapshot.networkHashrateEh.toFixed(1)} EH/s`],
            ["HHI", `${effectiveSnapshot.minerConcentrationScore.toFixed(1)}/10`],
            ...effectiveSnapshot.miningPools.map((p) => [p.name, `${(p.sharePct * 100).toFixed(1)}%`] as [string, string]),
          ]} />
          <CockpitSection title="Network Health" groupId={null} activeGroup={activeGroup} items={[
            ["Health Score", `${effectiveSnapshot.networkHealthScore.toFixed(1)}/10`],
            ["Halving Era", `${Math.floor(effectiveSnapshot.blockHeight / 210000) + 1}`],
          ]} />
        </div>

        {/* What-If Simulation */}
        <div className="cockpit-whatif">
          <div className="hud-whatif-header">
            <p className="eyebrow" style={{ margin: 0 }}>What-If</p>
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
      </div>

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

/* MetricCard removed — replaced by cockpit readout */

function CockpitSection({ title, groupId, activeGroup, items }: {
  title: string;
  groupId: string | null;
  activeGroup: string | null;
  items: Array<[string, string]>;
}) {
  const isActive = groupId !== null && activeGroup === groupId;
  return (
    <div className={`cockpit-section ${isActive ? "active" : ""}`}>
      <div className="cockpit-section-title">{title}</div>
      {items.map(([label, value], i) => (
        <div key={i} className="cockpit-row">
          <span className="cockpit-label">{label}</span>
          <span className="cockpit-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   3D SCENE — 11 HONEST SHAPES
   Every shape = one atomic data entity
   Every visual property = one Mosaic metric
   ═══════════════════════════════════════════════════════ */

interface SceneProps {
  snapshot: NetworkSnapshot;
  activeGroup: string | null;
  onHover: (groupId: string | null) => void;
  onClick: (groupId: string, title: string, body: string) => void;
  onDeselect: () => void;
}

function PrimeRadiantScene({ snapshot, activeGroup, onHover, onClick, onDeselect }: SceneProps) {
  const s = snapshot;
  const fp = s.feePressureIndex / 10;
  const cg = s.congestionScore / 10;
  const bs = s.blockProductionStress / 10;
  const health = s.networkHealthScore / 10;
  const hrNorm = Math.min(s.networkHashrateEh / 1000, 1);

  // Dim factor for non-active groups
  const dim = (gid: string) => (activeGroup !== null && activeGroup !== gid) ? 0.1 : 1;
  const bright = (gid: string) => activeGroup === gid ? 1.5 : 1;

  // Shared interaction handler
  const interact = (gid: string, title: string, body: string) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(gid); },
    onPointerOut: () => onHover(null),
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick(gid, title, body); },
  });

  // Fee tier colors: warmer = higher fee tier
  const feeColors = ["#FF9933", "#FF7722", "#FF5511", "#FF3300"];
  const feeLabels = ["1-10 sat/vB", "11-30 sat/vB", "31-80 sat/vB", "81+ sat/vB"];

  return (
    <group key={s.id} position={[0, 0, 0]} scale={0.85}>
      <ambientLight intensity={0.04 + health * 0.04} />
      <pointLight position={[0, 0, 3]} intensity={8 + health * 6} color="#FA660F" distance={20} decay={1.8} />
      <pointLight position={[5, 4, 2]} intensity={4} color="#FF8C3A" distance={18} decay={2} />
      <pointLight position={[-5, -3, 2]} intensity={3} color="#FA660F" distance={16} decay={2} />

      {/* Click background to deselect */}
      <mesh position={[0, 0, -3]} onClick={onDeselect}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ═══ SHAPE 1-4: FEE TIER ARCS (inner ring, r=2.2) ═══ */}
      {s.feeBuckets.map((bucket, i) => {
        const gid = `fee-${i}`;
        const d = dim(gid) * bright(gid);
        // Arc width proportional to txShare
        const arcSpan = Math.PI * 2 * bucket.txShare;
        // Starting angle: sequential around the ring
        let startAngle = 0;
        for (let j = 0; j < i; j++) startAngle += Math.PI * 2 * s.feeBuckets[j].txShare;
        // Height driven by fee pressure
        const height = 0.04 + fp * 0.2 + bucket.intensity * 0.1;
        // Z-depth: higher fee tiers push forward
        const z = i * 0.08;
        // Sub-segments for visual texture
        const subCount = Math.max(3, Math.round(arcSpan / (Math.PI * 2) * 40));
        const gap = arcSpan * 0.06;
        const usable = arcSpan - gap;
        if (usable < 0.01) return null;

        return (
          <group key={gid} position={[0, 0, z]} {...interact(gid, `Fee Tier: ${feeLabels[i]}`, `${(bucket.txShare * 100).toFixed(1)}% of transactions\nIntensity: ${(bucket.intensity * 100).toFixed(0)}/100\nFee Pressure: ${s.feePressureIndex.toFixed(1)}/10`)}>
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

      {/* ═══ SHAPE 5: CONGESTION ARC (middle ring, r=3.3) ═══ */}
      {(() => {
        const gid = "congestion";
        const d = dim(gid) * bright(gid);
        const fillAngle = Math.PI * 2 * Math.max(0.03, cg);
        const height = 0.015 + cg * 0.25;
        const z = cg * 0.3; // pushes forward when congested
        const subCount = Math.max(2, Math.round(fillAngle / (Math.PI * 2) * 36));
        const r = 3.3;
        return (
          <group position={[0, 0, z]} {...interact(gid, "Network Congestion", `Score: ${s.congestionScore.toFixed(1)}/10\n${s.mempoolTxCount.toLocaleString()} pending txs\n${s.mempoolSizeMb.toFixed(1)} MB mempool`)}>
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

      {/* ═══ SHAPE 6: SETTLEMENT ARC (middle ring, r=2.8) ═══ */}
      {(() => {
        const gid = "settlement";
        const d = dim(gid) * bright(gid);
        const stressHealth = 1 - bs;
        const fillAngle = Math.PI * 2 * Math.max(0.05, stressHealth);
        const height = 0.03 + stressHealth * 0.12;
        const z = -bs * 0.2; // pushes back when stressed
        const subCount = Math.max(3, Math.round(fillAngle / (Math.PI * 2) * 36));
        const r = 2.8;
        return (
          <group position={[0, 0, z]} {...interact(gid, "Block Settlement", `Stress: ${s.blockProductionStress.toFixed(1)}/10\nAvg interval: ${s.avgBlockIntervalSeconds}s (target: 600s)\n144 blocks mined`)}>
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

      {/* ═══ SHAPES 7-11: MINING POOL ARCS (outer ring, r=4.5) ═══ */}
      {(() => {
        let angleOffset = 0;
        return s.miningPools.map((pool) => {
          const gid = `pool-${pool.id}`;
          const d = dim(gid) * bright(gid);
          const arcSpan = Math.PI * 2 * pool.sharePct;
          const startAngle = angleOffset;
          angleOffset += arcSpan;
          // Height driven by pool's hashrate relative to network
          const poolHr = pool.hashRateEh;
          const height = 0.02 + pool.sharePct * 0.35;
          // Z-depth: larger pools push forward
          const z = pool.sharePct * 0.4;
          const subCount = Math.max(2, Math.round(arcSpan / (Math.PI * 2) * 30));
          const gap = arcSpan * 0.06;
          const usable = arcSpan - gap;
          if (usable < 0.005) return null;
          const r = 4.5;
          const midAngle = startAngle + arcSpan / 2;

          return (
            <group key={gid} position={[0, 0, z]} {...interact(gid, pool.name, `${(pool.sharePct * 100).toFixed(1)}% hashrate\n${poolHr} EH/s of ${s.networkHashrateEh.toFixed(0)} total`)}>
              {Array.from({ length: subCount }).map((_, j) => {
                const angle = startAngle + gap / 2 + (j / subCount) * usable;
                return (
                  <mesh key={j} position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]} rotation={[0, 0, angle]}>
                    <boxGeometry args={[Math.max(0.005, (usable / subCount) * r * 0.85), height, 0.03 + pool.sharePct * 0.04]} />
                    <meshStandardMaterial color="#CC6600" emissive="#CC6600" emissiveIntensity={(0.2 + pool.sharePct * 2) * d} metalness={0.35} roughness={0.25} transparent opacity={0.7 * d} />
                  </mesh>
                );
              })}
              {/* Pool label */}
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

      {/* ═══ SHAPE 12: BLOCK SPINE (central column) ═══ */}
      {(() => {
        const gid = "spine";
        const d = dim(gid) * bright(gid);
        const blockCount = 144;
        const meshRef = useRef<THREE.InstancedMesh>(null);
        const dummy = useMemo(() => new THREE.Object3D(), []);
        const healthColor = new THREE.Color(health > 0.55 ? "#FA660F" : "#FF3D00");
        // Block size driven by avg_tx_per_block (more txs = bigger blocks)
        const blockSize = 0.02 + hrNorm * 0.015;

        useMemo(() => {
          if (!meshRef.current) return;
          const spacing = 7 / blockCount;
          for (let i = 0; i < blockCount; i++) {
            dummy.position.set(0, i * spacing - 3.5, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
          }
          meshRef.current.instanceMatrix.needsUpdate = true;
        }, [dummy, blockCount]);

        return (
          <group {...interact(gid, "Block Spine", `Block #${s.blockHeight.toLocaleString()}\n144 blocks this day\nInterval: ${s.avgBlockIntervalSeconds}s\nHealth: ${s.networkHealthScore.toFixed(1)}/10`)}>
            <instancedMesh ref={meshRef} args={[undefined, undefined, blockCount]}>
              <octahedronGeometry args={[blockSize, 0]} />
              <meshStandardMaterial color="#FF8C3A" emissive={healthColor} emissiveIntensity={0.5 * d} metalness={0.4} roughness={0.1} transparent opacity={0.8 * d} />
            </instancedMesh>
          </group>
        );
      })()}

      {/* Ring track lines — subtle reference circles at each ring radius */}
      {[2.2, 2.8, 3.3, 4.5].map((r) => (
        <mesh key={r} position={[0, 0, -0.1]}>
          <ringGeometry args={[r - 0.003, r + 0.003, 200]} />
          <meshBasicMaterial color="#FA660F" transparent opacity={0.02} />
        </mesh>
      ))}
    </group>
  );
}

/* All old components deleted — 11 shapes inline in PrimeRadiantScene */

export default App;
