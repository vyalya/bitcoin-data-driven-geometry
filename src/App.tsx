import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mosaicSnapshots, deriveRingBands } from "./data/mosaicSnapshots";
import type { NetworkSnapshot, RingBand, MiningPoolSnapshot, FeeBucket } from "./types";

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

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
  const [activeId, setActiveId] = useState(mosaicSnapshots[0].id);
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

  // Interactive selection state — driven by clicking elements in the 3D scene
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const clearSelection = () => { setSelectedLayer(null); setSelectedPool(null); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Visualizing the Bitcoin Network as a Digital Twin</h1>
          <p className="subhead">High-fidelity view of Bitcoin network state, stress, resilience, and simulation rooted in real data contracts.</p>
        </div>
        <div className="status-cluster">
          {hasOverrides && (
            <div className="simulation-badge">
              <span>What-If Active</span>
              <button className="reset-button" onClick={resetOverrides} type="button">Reset</button>
            </div>
          )}
        </div>
      </header>

      <main className="workspace">
        <section className="canvas-panel">
          <div className="canvas-overlay">
            <div className="hud-card">
              <span>Block Height</span>
              <strong>#{effectiveSnapshot.blockHeight.toLocaleString()}</strong>
            </div>
            <div className="hud-card">
              <span>Mempool</span>
              <strong>{effectiveSnapshot.mempoolTxCount.toLocaleString()} txs</strong>
            </div>
            <div className="hud-card">
              <span>Hashrate</span>
              <strong>{effectiveSnapshot.networkHashrateEh.toFixed(0)} EH/s</strong>
            </div>
          </div>

          {/* Legend */}
          <div className="canvas-legend">
            {RING_LABELS.map((label, i) => (
              <div key={i} className="legend-item" onClick={() => { setSelectedLayer(String(i)); setSelectedPool(null); }}>
                <span className="legend-dot" style={{ background: RING_COLORS[i] }} />
                <span>{label}</span>
              </div>
            ))}
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#FF8C3A" }} />
              <span>Mining Pools</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#FFCC00" }} />
              <span>Halving Epoch</span>
            </div>
          </div>

          {selectedLayer && (
            <div className="selection-indicator">
              <span>{RING_LABELS[parseInt(selectedLayer)] || "Selected"}</span>
              <button onClick={clearSelection} type="button">x</button>
            </div>
          )}

          <Canvas
            camera={{ position: [0, 2.2, 14], fov: 34 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
            dpr={[1, 2]}
          >
            <color attach="background" args={["#000000"]} />
            <fog attach="fog" args={["#000000", 25, 55]} />
            <PrimeRadiantScene
              snapshot={effectiveSnapshot}
              selectedLayer={selectedLayer}
              onSelectLayer={(layer) => { setSelectedLayer(layer); setSelectedPool(null); }}
              onSelectPool={(pool) => { setSelectedPool(pool); setSelectedLayer(null); }}
              onDeselect={clearSelection}
            />
            <EffectComposer>
              <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.6} intensity={2.8} mipmapBlur />
            </EffectComposer>
            <OrbitControls enablePan enableZoom minDistance={1.5} maxDistance={45} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 1.2} />
          </Canvas>
        </section>

        <aside className="sidebar">
          {/* Time filter — scenario presets */}
          <section className="panel">
            <p className="eyebrow">Time Period</p>
            <div className="button-stack">
              {mosaicSnapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  className={snapshot.id === baseSnapshot.id ? "scenario-button active" : "scenario-button"}
                  onClick={() => { setActiveId(snapshot.id); resetOverrides(); clearSelection(); }}
                  type="button"
                >
                  <span>{snapshot.label}</span>
                  <strong>{snapshot.snapshotTime.slice(0, 10)}</strong>
                </button>
              ))}
            </div>
          </section>

          {/* What-If Simulation sliders */}
          <section className="panel">
            <p className="eyebrow">What-If Simulation</p>
            <div className="slider-stack">
              {WHAT_IF_PARAMS.map((param) => {
                const baseVal = baseSnapshot[param.snapshotField] as number;
                const currentVal = overrides[param.key] ?? baseVal;
                const isOverridden = overrides[param.key] !== null && overrides[param.key] !== undefined;

                return (
                  <div key={param.key} className={`slider-row ${isOverridden ? "overridden" : ""}`}>
                    <div className="slider-header">
                      <span className="slider-label">{param.label}</span>
                      <span className="slider-value">
                        {param.max > 100 ? currentVal.toLocaleString() : currentVal.toFixed(1)}
                        <span className="slider-unit">{param.unit}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={currentVal}
                      onChange={(e) => setOverride(param.key, parseFloat(e.target.value))}
                      onDoubleClick={() => setOverride(param.key, null)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* KPI cards */}
          <section className="metrics-grid">
            <MetricCard label="Fee Pressure" value={effectiveSnapshot.feePressureIndex.toFixed(1)} severity={getSeverity(effectiveSnapshot.feePressureIndex)} />
            <MetricCard label="Congestion" value={effectiveSnapshot.congestionScore.toFixed(1)} severity={getSeverity(effectiveSnapshot.congestionScore)} />
            <MetricCard label="Block Stress" value={effectiveSnapshot.blockProductionStress.toFixed(1)} severity={getSeverity(effectiveSnapshot.blockProductionStress)} />
            <MetricCard label="Health" value={effectiveSnapshot.networkHealthScore.toFixed(1)} severity={getSeverity(10 - effectiveSnapshot.networkHealthScore)} />
          </section>

          {/* Interpretation */}
          <section className="panel">
            <p className="eyebrow">Interpretation</p>
            <ul className="notes-list">
              {effectiveSnapshot.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </aside>
      </main>

      {/* Bottom bar — fee buckets + mining pools, filterable from 3D scene clicks */}
      <footer className="bottom-bar">
        <div className={`bottom-panel ${selectedLayer !== null && selectedLayer !== "0" && selectedLayer !== "1" ? "dimmed" : ""}`}>
          <p className="eyebrow">Fee Buckets</p>
          <div className="bottom-row-list">
            {effectiveSnapshot.feeBuckets.map((bucket) => (
              <div className="bottom-item" key={bucket.id}>
                <strong>{bucket.feeRateLabel}</strong>
                <span className="bottom-value">{formatPct(bucket.txShare)}</span>
                <span className="bottom-sub">I: {(bucket.intensity * 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bottom-divider" />
        <div className={`bottom-panel ${selectedLayer !== null && selectedLayer !== "3" ? "dimmed" : ""}`}>
          <p className="eyebrow">Mining Pools</p>
          <div className="bottom-row-list">
            {effectiveSnapshot.miningPools.map((pool) => (
              <div className={`bottom-item ${selectedPool === pool.id ? "highlighted" : ""}`} key={pool.id}>
                <strong>{pool.name}</strong>
                <span className="bottom-value">{formatPct(pool.sharePct)}</span>
                <span className="bottom-sub">{pool.hashRateEh} EH/s</span>
              </div>
            ))}
          </div>
        </div>
      </footer>
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
  selectedLayer: string | null;
  onSelectLayer: (layer: string) => void;
  onSelectPool: (pool: string) => void;
  onDeselect: () => void;
}

function PrimeRadiantScene({ snapshot, selectedLayer, onSelectLayer, onSelectPool, onDeselect }: SceneProps) {
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

      <ReferenceGrid />
      <RadiantCore healthScore={snapshot.networkHealthScore} />
      <BlockSpine snapshot={snapshot} />

      {/* Clickable data rings */}
      {snapshot.ringBands.map((band, i) => (
        <SegmentedDataRing
          key={band.id}
          band={band}
          index={i}
          snapshot={snapshot}
          isSelected={selectedLayer === String(i)}
          isDimmed={selectedLayer !== null && selectedLayer !== String(i)}
          onSelect={() => onSelectLayer(String(i))}
        />
      ))}

      <FeeOrbitRings feeBuckets={snapshot.feeBuckets} />
      <OuterSweepRings />
      <ParticleNebula snapshot={snapshot} />
      <MiningConstellation
        pools={snapshot.miningPools}
        hashrate={snapshot.networkHashrateEh}
        selectedPool={null}
        onSelectPool={onSelectPool}
      />

      <MempoolStrata snapshot={snapshot} />
      <EpochMarkers snapshot={snapshot} />
      <InterRingFilaments snapshot={snapshot} />
      <TransactionDust snapshot={snapshot} />

      <DataInscriptions snapshot={snapshot} />
    </group>
  );
}

/* ─── RADIANT CORE ─── */

function RadiantCore({ healthScore }: { healthScore: number }) {
  const innerRef = useRef<THREE.Mesh>(null);
  const midRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const scale = 0.3 + (healthScore / 10) * 0.2;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.2;
      innerRef.current.rotation.x = t * 0.12;
      const mat = innerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.4 + Math.sin(t * 0.5) * 0.5;
    }
    if (midRef.current) { midRef.current.rotation.y = -t * 0.08; midRef.current.rotation.z = t * 0.06; }
    if (outerRef.current) { outerRef.current.rotation.y = t * 0.035; outerRef.current.rotation.x = -t * 0.028; }
    if (glowRef.current) glowRef.current.scale.setScalar(scale * (2.8 + Math.sin(t * 0.35) * 0.25));
  });

  return (
    <group>
      <mesh ref={innerRef} scale={scale * 0.5}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#FF8C3A" emissive="#FA660F" emissiveIntensity={1.6} metalness={0.5} roughness={0.05} />
      </mesh>
      <mesh ref={midRef} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#FA660F" wireframe transparent opacity={0.35} />
      </mesh>
      <mesh ref={outerRef} scale={scale * 1.5}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#FF8C3A" wireframe transparent opacity={0.12} />
      </mesh>
      <pointLight color="#FA660F" intensity={8} distance={6} decay={1.5} />
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#FA660F" transparent opacity={0.025} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ─── BLOCK SPINE ─── 144 blocks (one day's production) along the spine.
   Each block is an octahedron sized by a deterministic data pattern.
   Blocks near the tip are brighter. Hoverable with block # tooltip.
*/

function BlockSpine({ snapshot }: { snapshot: NetworkSnapshot }) {
  const healthColor = snapshot.networkHealthScore < 5.5 ? "#FF3D00" : "#FA660F";
  const blockCount = Math.max(20, Math.min(snapshot.blockHeight > 0 ? 144 : 20, 144));

  // Deterministic size variation per block (seeded from block height)
  const blocks = useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    };
    const rand = rng(snapshot.blockHeight);

    const spacing = 8.5 / blockCount;
    return Array.from({ length: blockCount }).map((_, i) => {
      const r = rand();
      return {
        y: i * spacing - 4.25,
        scale: 0.025 + r * 0.055, // varied sizes
        blockHeight: snapshot.blockHeight - (blockCount - 1 - i),
        brightness: 0.3 + (i / blockCount) * 0.7, // brighter toward tip
        isTip: i >= blockCount - 3,
      };
    });
  }, [snapshot.blockHeight, blockCount]);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <group>
      {/* Central axis */}
      <mesh position={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.012, 0.012, 9, 16]} />
        <meshStandardMaterial color="#FF8C3A" emissive="#FA660F" emissiveIntensity={0.5} metalness={0.7} roughness={0.15} />
      </mesh>

      {/* 144 blocks */}
      {blocks.map((b, i) => (
        <group key={i} position={[0, b.y, 0.14]}>
          <mesh
            onPointerOver={(e) => { e.stopPropagation(); setHoveredIdx(i); }}
            onPointerOut={() => setHoveredIdx(null)}
          >
            <octahedronGeometry args={[b.scale, 0]} />
            <meshStandardMaterial
              color={b.isTip ? "#FFAA55" : "#FF8C3A"}
              emissive={healthColor}
              emissiveIntensity={hoveredIdx === i ? 1.6 : b.brightness}
              metalness={0.4}
              roughness={0.08}
            />
          </mesh>
          {hoveredIdx === i && (
            <Html center style={{ pointerEvents: "none" }}>
              <div className="scene-tooltip">Block #{b.blockHeight.toLocaleString()}</div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

/* ─── SEGMENTED DATA RING ───
   Each ring has:
   - Distinct color from RING_COLORS
   - Segment heights driven by its SPECIFIC metric (not generic intensity)
   - A label identifying what it represents
   - Different wave patterns per ring for visual variety
*/

function SegmentedDataRing({ band, index, snapshot, isSelected, isDimmed, onSelect }: {
  band: RingBand; index: number; snapshot: NetworkSnapshot;
  isSelected?: boolean; isDimmed?: boolean; onSelect?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // No rotation — static data means static scene
  // Rings only rotate when receiving live data updates

  const color = RING_COLORS[index] || "#FA660F";
  const label = RING_LABELS[index] || "";

  // Each ring's segment heights are driven by its SPECIFIC metric
  const metricValue = [
    snapshot.feePressureIndex / 10,    // Ring 1: fee pressure
    1 - snapshot.blockProductionStress / 10, // Ring 2: settlement health (inverted)
    snapshot.congestionScore / 10,     // Ring 3: congestion
    Math.min(snapshot.mempoolTxCount / 400000, 1), // Ring 4: mempool depth
  ][index] ?? 0.5;

  const segCount = 96;
  const activeCount = Math.round(segCount * band.activeShare);
  const seed = index * 137.5;

  const segments = useMemo(() => {
    const result: Array<{
      x: number; y: number; angle: number;
      isActive: boolean; isMajor: boolean;
      height: number; width: number; depth: number;
      emIntensity: number;
    }> = [];

    for (let i = 0; i < segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2;
      const isActive = i < activeCount;
      const isMajor = i % 8 === 0;

      // More dramatic height variation — driven by the ring's specific metric
      const wave = Math.sin(angle * (2 + index) + seed) * 0.5 + 0.5;
      const dataHeight = isActive
        ? 0.02 + metricValue * 0.22 * (0.25 + wave * 0.75)
        : 0.008;
      const height = isMajor ? dataHeight * 2.0 : dataHeight;

      const arcLen = (2 * Math.PI * band.radius) / segCount;
      const width = arcLen * 0.65;
      const depth = isActive ? 0.025 + metricValue * 0.04 : 0.01;

      const emIntensity = isActive
        ? (0.3 + metricValue * 1.2) * (isMajor ? 1.3 : 0.6 + wave * 0.6)
        : 0;

      result.push({ x: Math.cos(angle) * band.radius, y: Math.sin(angle) * band.radius, angle, isActive, isMajor, height, width, depth, emIntensity });
    }
    return result;
  }, [segCount, activeCount, band.radius, metricValue, seed, index]);

  const dimFactor = isDimmed ? 0.15 : 1;

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
      {/* Clickable track ring */}
      <mesh>
        <ringGeometry args={[band.radius - 0.008, band.radius + 0.008, 256]} />
        <meshBasicMaterial color={color} transparent opacity={(isSelected ? 0.06 : 0.02) * dimFactor} />
      </mesh>

      {/* Segments */}
      {segments.map((seg, i) => (
        <mesh key={i} position={[seg.x, seg.y, 0]} rotation={[0, 0, seg.angle]}>
          <boxGeometry args={[seg.width, seg.height, seg.depth]} />
          {seg.isActive ? (
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={seg.emIntensity * dimFactor}
              metalness={0.3}
              roughness={0.3}
              transparent
              opacity={(0.7 + metricValue * 0.25) * dimFactor}
            />
          ) : (
            <meshBasicMaterial color="#0D0800" transparent opacity={0.03 * dimFactor} />
          )}
        </mesh>
      ))}

      {/* Ring label */}
      <Text
        position={[0, band.radius + 0.2, 0.1]}
        fontSize={0.06}
        color={color}
        anchorX="center"
        anchorY="bottom"
        fillOpacity={isSelected ? 0.6 : 0.3 * dimFactor}
        font={undefined}
      >
        {label}
      </Text>

      {/* Metric value label */}
      <Text
        position={[0, band.radius + 0.12, 0.1]}
        fontSize={0.045}
        color="#FFFFFF"
        anchorX="center"
        anchorY="bottom"
        fillOpacity={0.18}
        font={undefined}
      >
        {(metricValue * 10).toFixed(1)}/10
      </Text>
    </group>
  );
}

/* ─── FEE ORBIT RINGS ─── */

function FeeOrbitRings({ feeBuckets }: { feeBuckets: FeeBucket[] }) {
  const feeColors = ["#FFAA44", "#FF8833", "#FF5500", "#FF3300"];

  return (
    <group>
      {feeBuckets.map((bucket, i) => {
        const radius = 1.05 + i * 0.5;
        const segCount = 64;
        const activeCount = Math.round(segCount * bucket.txShare * 2.5);
        const tiltX = Math.PI / 2.4 + i * 0.06;
        const color = feeColors[i] || "#FA660F";

        return (
          <group key={bucket.id} rotation={[tiltX, 0, Math.PI * 0.12 + i * 0.18]}>
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
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3 + bucket.intensity * 0.8} metalness={0.2} roughness={0.4} transparent opacity={0.4 + bucket.intensity * 0.4} />
                  ) : (
                    <meshBasicMaterial color="#0D0800" transparent opacity={0.015} />
                  )}
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

/* ─── OUTER SWEEP RINGS ─── */

function OuterSweepRings() {
  const rings = useMemo(() => {
    const r: Array<{ radius: number; segCount: number; tiltX: number; tiltZ: number }> = [];
    for (let i = 0; i < 3; i++) r.push({ radius: 5.5 + i * 0.65, segCount: 48 - i * 8, tiltX: Math.PI / 2 + (i - 1) * 0.1, tiltZ: i * 0.2 });
    return r;
  }, []);

  return (
    <group>
      {rings.map((ring, ri) =>
        Array.from({ length: ring.segCount }).map((_, i) => {
          const angle = (i / ring.segCount) * Math.PI * 2;
          const arcLen = (2 * Math.PI * ring.radius) / ring.segCount;
          return (
            <mesh key={`${ri}-${i}`} position={[Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, 0]} rotation={[ring.tiltX - Math.PI / 2, 0, angle + ring.tiltZ]}>
              <boxGeometry args={[arcLen * 0.4, 0.01, 0.015]} />
              <meshStandardMaterial color="#FA660F" emissive="#FA660F" emissiveIntensity={0.15} transparent opacity={0.05 - ri * 0.012} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

/* ─── PARTICLE NEBULA ─── density driven by actual mempool count */

function ParticleNebula({ snapshot }: { snapshot: NetworkSnapshot }) {
  const layer1Ref = useRef<THREE.Group>(null);
  const layer2Ref = useRef<THREE.Group>(null);
  const layer3Ref = useRef<THREE.Group>(null);

  const pressure = snapshot.feePressureIndex / 10;
  const congestion = snapshot.congestionScore / 10;
  const mempoolNorm = Math.min(snapshot.mempoolTxCount / 400000, 1);

  // Particle counts scale with real mempool — empty mempool = sparse field
  const innerCount = Math.max(50, Math.round(mempoolNorm * 600));
  const midCount = Math.max(30, Math.round(mempoolNorm * 400));
  const outerCount = Math.max(20, Math.round(mempoolNorm * 250));

  const innerPos = useMemo(() => {
    const pos = new Float32Array(innerCount * 3);
    for (let i = 0; i < innerCount; i++) {
      const r = 1.2 + Math.random() * (2.5 + congestion * 2);
      const a = (i / innerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * (0.7 + Math.random() * 0.5);
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
    }
    return pos;
  }, [innerCount, congestion]);

  const midPos = useMemo(() => {
    const pos = new Float32Array(midCount * 3);
    for (let i = 0; i < midCount; i++) {
      const r = 2.8 + Math.random() * 3;
      pos[i * 3] = Math.cos(Math.random() * Math.PI * 2) * r;
      pos[i * 3 + 1] = Math.sin(Math.random() * Math.PI * 2) * r;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.8;
    }
    return pos;
  }, [midCount]);

  const outerPos = useMemo(() => {
    const pos = new Float32Array(outerCount * 3);
    for (let i = 0; i < outerCount; i++) {
      const r = 4.5 + Math.random() * 4;
      pos[i * 3] = Math.cos(Math.random() * Math.PI * 2) * r;
      pos[i * 3 + 1] = Math.sin(Math.random() * Math.PI * 2) * r;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return pos;
  }, [outerCount]);

  // Gentle drift — particles float slowly, not spin
  useFrame((_, delta) => {
    if (layer1Ref.current) layer1Ref.current.rotation.z += delta * 0.003;
    if (layer2Ref.current) layer2Ref.current.rotation.z -= delta * 0.002;
    if (layer3Ref.current) layer3Ref.current.rotation.z += delta * 0.001;
  });

  const baseSize = 0.012 + pressure * 0.01;
  const baseOpacity = 0.3 + pressure * 0.4;

  return (
    <group>
      <group ref={layer1Ref}>
        <points>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[innerPos, 3]} /></bufferGeometry>
          <pointsMaterial color="#FA660F" size={baseSize * 1.2} sizeAttenuation transparent opacity={baseOpacity} />
        </points>
      </group>
      <group ref={layer2Ref}>
        <points>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[midPos, 3]} /></bufferGeometry>
          <pointsMaterial color="#FF8C3A" size={baseSize} sizeAttenuation transparent opacity={baseOpacity * 0.5} />
        </points>
      </group>
      <group ref={layer3Ref}>
        <points>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[outerPos, 3]} /></bufferGeometry>
          <pointsMaterial color="#FF6B00" size={baseSize * 0.6} sizeAttenuation transparent opacity={baseOpacity * 0.2} />
        </points>
      </group>
    </group>
  );
}

/* ─── MINING CONSTELLATION ─── with hover tooltips, dramatic size differences */

function MiningConstellation({ pools, hashrate, selectedPool, onSelectPool }: { pools: MiningPoolSnapshot[]; hashrate: number; selectedPool: string | null; onSelectPool: (id: string) => void }) {
  return (
    <group>
      {pools.map((pool, i) => (
        <MiningNode key={pool.id} pool={pool} index={i} total={pools.length} networkHashrate={hashrate} isHighlighted={selectedPool === pool.id} onSelect={() => onSelectPool(pool.id)} />
      ))}
    </group>
  );
}

function MiningNode({ pool, index, total, networkHashrate, isHighlighted, onSelect }: { pool: MiningPoolSnapshot; index: number; total: number; networkHashrate: number; isHighlighted?: boolean; onSelect?: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

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

  return (
    <group position={[x, y, 0]}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[nodeSize, 0]} />
        <meshStandardMaterial
          color={hovered || isHighlighted ? "#FFCC66" : "#FF8C3A"}
          emissive="#FA660F"
          emissiveIntensity={hovered || isHighlighted ? 1.5 : 0.7 + pool.sharePct * 1.5}
          metalness={0.4}
          roughness={0.1}
        />
      </mesh>
      <mesh>
        <octahedronGeometry args={[nodeSize * 1.7, 0]} />
        <meshBasicMaterial color="#FA660F" wireframe transparent opacity={0.05} />
      </mesh>
      <Line points={[[0, 0, 0], [-x, -y, 0]]} color="#FA660F" lineWidth={0.3} transparent opacity={0.03} dashed dashSize={0.12} gapSize={0.06} />

      {/* Always-visible pool label */}
      <Text position={[x > 0 ? 0.3 : -0.3, 0.22, 0]} fontSize={0.075} color="#FFFFFF" anchorX={x > 0 ? "left" : "right"} anchorY="middle" fillOpacity={0.4} font={undefined}>
        {pool.name}
      </Text>
      <Text position={[x > 0 ? 0.3 : -0.3, 0.1, 0]} fontSize={0.055} color="#FA660F" anchorX={x > 0 ? "left" : "right"} anchorY="middle" fillOpacity={0.3} font={undefined}>
        {(pool.sharePct * 100).toFixed(1)}%
      </Text>

      {/* Hover tooltip with full detail */}
      {hovered && (
        <Html center style={{ pointerEvents: "none" }}>
          <div className="scene-tooltip">
            <strong>{pool.name}</strong><br />
            {(pool.sharePct * 100).toFixed(1)}% hashrate share<br />
            ~{pool.hashRateEh} EH/s of {networkHashrate.toFixed(0)} EH/s
          </div>
        </Html>
      )}
    </group>
  );
}

/* ─── MEMPOOL STRATA ───
   Layered particle sheets at different z-depths representing fee tiers.
   Low-fee txs float at the back, high-fee txs push to the front.
   Creates visible stratification when viewed from the side.
*/

function MempoolStrata({ snapshot }: { snapshot: NetworkSnapshot }) {
  const mempoolNorm = Math.min(snapshot.mempoolTxCount / 400000, 1);
  if (mempoolNorm < 0.01) return null; // no mempool = no strata

  const strata = useMemo(() => {
    const layers: Array<{ z: number; count: number; radius: number; color: string; size: number; opacity: number }> = [];
    const buckets = snapshot.feeBuckets;

    buckets.forEach((bucket, i) => {
      const count = Math.max(15, Math.round(bucket.txShare * mempoolNorm * 300));
      layers.push({
        z: -0.8 + i * 0.5,
        count,
        radius: 1.8 + i * 0.6,
        color: ["#FFAA44", "#FF8833", "#FF5500", "#FF3300"][i] || "#FA660F",
        size: 0.008 + bucket.intensity * 0.012,
        opacity: 0.15 + bucket.intensity * 0.3,
      });
    });

    return layers;
  }, [snapshot.feeBuckets, mempoolNorm]);

  return (
    <group>
      {strata.map((layer, li) => {
        const positions = new Float32Array(layer.count * 3);
        for (let i = 0; i < layer.count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = layer.radius * (0.5 + Math.random() * 0.8);
          positions[i * 3] = Math.cos(angle) * r;
          positions[i * 3 + 1] = Math.sin(angle) * r;
          positions[i * 3 + 2] = layer.z + (Math.random() - 0.5) * 0.3;
        }
        return (
          <points key={li}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial color={layer.color} size={layer.size} sizeAttenuation transparent opacity={layer.opacity} />
          </points>
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
  // Show last 24 epochs (≈ 1 year of difficulty adjustments)
  const visibleEpochs = Math.min(epochCount, 24);

  const markers = useMemo(() => {
    const result: Array<{ angle: number; height: number; isHalving: boolean }> = [];
    for (let i = 0; i < visibleEpochs; i++) {
      const epoch = epochCount - visibleEpochs + i;
      const blockAtEpoch = epoch * 2016;
      // Is this epoch near a halving?
      const isHalving = [210000, 420000, 630000, 840000].some(
        (h) => Math.abs(blockAtEpoch - h) < 2016
      );
      result.push({
        angle: (i / visibleEpochs) * Math.PI * 2 - Math.PI / 2,
        height: isHalving ? 0.25 : 0.08 + (i / visibleEpochs) * 0.06,
        isHalving,
      });
    }
    return result;
  }, [epochCount, visibleEpochs]);

  return (
    <group position={[0, 0, -0.5]}>
      {markers.map((m, i) => {
        const r = 6.0;
        return (
          <mesh
            key={i}
            position={[Math.cos(m.angle) * r, Math.sin(m.angle) * r, 0]}
            rotation={[0, 0, m.angle]}
          >
            <boxGeometry args={[0.005, m.height, 0.03]} />
            <meshStandardMaterial
              color={m.isHalving ? "#FFCC00" : "#FA660F"}
              emissive={m.isHalving ? "#FFCC00" : "#FA660F"}
              emissiveIntensity={m.isHalving ? 1.2 : 0.3}
              transparent
              opacity={m.isHalving ? 0.9 : 0.25}
            />
          </mesh>
        );
      })}

      {/* Halving labels */}
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

/* ─── INTER-RING FILAMENTS ───
   Thin arcs connecting adjacent rings, suggesting data flow between
   network layers. Density proportional to network activity.
   Creates visual complexity between the concentric rings.
*/

function InterRingFilaments({ snapshot }: { snapshot: NetworkSnapshot }) {
  const activity = (snapshot.feePressureIndex + snapshot.congestionScore) / 20;
  const filamentCount = Math.max(8, Math.round(activity * 40));

  const filaments = useMemo(() => {
    const result: Array<{ startR: number; endR: number; angle: number; opacity: number }> = [];
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    };
    const rand = rng(snapshot.blockHeight);

    for (let i = 0; i < filamentCount; i++) {
      const ringIdx = Math.floor(rand() * 3);
      const radii = [2.0, 2.85, 3.75, 4.85];
      result.push({
        startR: radii[ringIdx],
        endR: radii[ringIdx + 1],
        angle: rand() * Math.PI * 2,
        opacity: 0.02 + rand() * 0.06,
      });
    }
    return result;
  }, [filamentCount, snapshot.blockHeight]);

  return (
    <group>
      {filaments.map((f, i) => {
        const angleSpread = 0.04;
        return (
          <Line
            key={i}
            points={[
              [Math.cos(f.angle) * f.startR, Math.sin(f.angle) * f.startR, 0],
              [Math.cos(f.angle + angleSpread) * ((f.startR + f.endR) / 2), Math.sin(f.angle + angleSpread) * ((f.startR + f.endR) / 2), 0.1],
              [Math.cos(f.angle + angleSpread * 2) * f.endR, Math.sin(f.angle + angleSpread * 2) * f.endR, 0],
            ]}
            color="#FA660F"
            lineWidth={0.2}
            transparent
            opacity={f.opacity}
          />
        );
      })}
    </group>
  );
}

/* ─── TRANSACTION DUST ───
   Tiny geometric fragments scattered throughout the scene representing
   individual data points — blocks, transactions, confirmations.
   Each is a micro-octahedron or cube. Creates the "organized chaos" texture.
   Count scales with network activity.
*/

function TransactionDust({ snapshot }: { snapshot: NetworkSnapshot }) {
  const activity = (snapshot.feePressureIndex + snapshot.congestionScore + snapshot.blockProductionStress) / 30;
  const mempoolNorm = Math.min(snapshot.mempoolTxCount / 400000, 1);
  const dustCount = Math.max(30, Math.round((activity + mempoolNorm) * 120));

  const fragments = useMemo(() => {
    const result: Array<{
      x: number; y: number; z: number;
      scale: number; type: "oct" | "box";
      opacity: number;
    }> = [];

    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    };
    const rand = rng(snapshot.blockHeight + 999);

    for (let i = 0; i < dustCount; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 1.0 + rand() * 6.5;
      const z = (rand() - 0.5) * 3;

      result.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z,
        scale: 0.008 + rand() * 0.025,
        type: rand() > 0.5 ? "oct" : "box",
        opacity: 0.04 + rand() * 0.12,
      });
    }
    return result;
  }, [dustCount, snapshot.blockHeight]);

  return (
    <group>
      {fragments.map((f, i) => (
        <mesh key={i} position={[f.x, f.y, f.z]}>
          {f.type === "oct" ? (
            <octahedronGeometry args={[f.scale, 0]} />
          ) : (
            <boxGeometry args={[f.scale, f.scale, f.scale]} />
          )}
          <meshStandardMaterial
            color="#FA660F"
            emissive="#FA660F"
            emissiveIntensity={0.3}
            transparent
            opacity={f.opacity}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ─── REFERENCE GRID ─── */

function ReferenceGrid() {
  const compassMarks = useMemo(() => {
    const marks: Array<{ angle: number; innerR: number; outerR: number; isMajor: boolean }> = [];
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const isMajor = i % 6 === 0;
      const isMid = i % 3 === 0 && !isMajor;
      marks.push({ angle, innerR: 6.6, outerR: isMajor ? 7.0 : isMid ? 6.82 : 6.72, isMajor });
    }
    return marks;
  }, []);

  return (
    <group position={[0, 0, -0.8]}>
      {[1.5, 2.3, 3.2, 4.3, 5.5].map((r) => (
        <mesh key={r}><ringGeometry args={[r, r + 0.003, 320]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.015} /></mesh>
      ))}
      <Line points={[[-8, 0, 0], [8, 0, 0]]} color="#FFFFFF" lineWidth={0.3} transparent opacity={0.02} />
      <Line points={[[0, -8, 0], [0, 8, 0]]} color="#FFFFFF" lineWidth={0.3} transparent opacity={0.02} />
      <Line points={[[-6, -6, 0], [6, 6, 0]]} color="#FFFFFF" lineWidth={0.2} transparent opacity={0.008} />
      <Line points={[[-6, 6, 0], [6, -6, 0]]} color="#FFFFFF" lineWidth={0.2} transparent opacity={0.008} />
      {[1, 2, 4, 5, 7, 8, 10, 11].map((i) => {
        const a = (i / 12) * Math.PI * 2;
        return <Line key={i} points={[[0, 0, 0], [Math.cos(a) * 6.6, Math.sin(a) * 6.6, 0]]} color="#FFFFFF" lineWidth={0.15} transparent opacity={0.006} />;
      })}
      {compassMarks.map((m, i) => (
        <Line key={i} points={[[Math.cos(m.angle) * m.innerR, Math.sin(m.angle) * m.innerR, 0], [Math.cos(m.angle) * m.outerR, Math.sin(m.angle) * m.outerR, 0]]} color="#FA660F" lineWidth={m.isMajor ? 0.45 : 0.2} transparent opacity={m.isMajor ? 0.09 : 0.035} />
      ))}
      <mesh><ringGeometry args={[6.85, 6.87, 320]} /><meshBasicMaterial color="#FA660F" transparent opacity={0.06} /></mesh>
      <mesh><ringGeometry args={[6.58, 6.6, 320]} /><meshBasicMaterial color="#FA660F" transparent opacity={0.035} /></mesh>
    </group>
  );
}

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
