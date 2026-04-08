import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mockNetworkSnapshots } from "./data/mockNetworkSnapshots";
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

/* ═══════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════ */

function App() {
  const [activeId, setActiveId] = useState(mockNetworkSnapshots[0].id);
  const activeSnapshot = useMemo(
    () => mockNetworkSnapshots.find((s) => s.id === activeId) ?? mockNetworkSnapshots[0],
    [activeId]
  );

  const isSimulation = activeSnapshot.mode === "simulation";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Institutional Bitcoin Network Intelligence</p>
          <h1>Visualizing the Bitcoin Network as a Digital Twin</h1>
          <p className="subhead">
            High-fidelity view of Bitcoin network state, stress, resilience, and simulation rooted in real data contracts.
          </p>
        </div>
        <div className="status-cluster">
          <div className="status-pill">
            <span>Mode</span>
            <strong>{isSimulation ? "Simulation" : "Historical"}</strong>
          </div>
          <div className="status-pill">
            <span>Time</span>
            <strong>{activeSnapshot.snapshotTime.slice(0, 16).replace("T", " ")}</strong>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="canvas-panel">
          <div className="canvas-overlay">
            <div className="hud-card">
              <span>Block Height</span>
              <strong>#{activeSnapshot.blockHeight.toLocaleString()}</strong>
            </div>
            <div className="hud-card">
              <span>Mempool</span>
              <strong>{activeSnapshot.mempoolTxCount.toLocaleString()} txs</strong>
            </div>
            <div className="hud-card">
              <span>Hashrate</span>
              <strong>{activeSnapshot.networkHashrateEh.toFixed(0)} EH/s</strong>
            </div>
          </div>

          <div className="scene-intro">
            <p className="eyebrow">Prime Radiant</p>
            <h2>Network State Instrument</h2>
            <p>
              Settlement spine, fee pressure, mempool density, and miner concentration rendered as a living digital twin.
            </p>
          </div>

          <Canvas
            camera={{ position: [0, 2.2, 14], fov: 34 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
            dpr={[1, 2]}
          >
            <color attach="background" args={["#000000"]} />
            <fog attach="fog" args={["#000000", 25, 55]} />
            <PrimeRadiantScene snapshot={activeSnapshot} />
            <EffectComposer>
              <Bloom
                luminanceThreshold={0.08}
                luminanceSmoothing={0.6}
                intensity={2.8}
                mipmapBlur
              />
            </EffectComposer>
            <OrbitControls
              enablePan
              enableZoom
              minDistance={1.5}
              maxDistance={45}
              minPolarAngle={Math.PI / 8}
              maxPolarAngle={Math.PI / 1.2}
              autoRotate
              autoRotateSpeed={0.08}
            />
          </Canvas>
        </section>

        <aside className="sidebar">
          {isSimulation && (
            <div className="simulation-badge">
              <span>⚡ Simulation Active</span>
            </div>
          )}

          <section className="panel">
            <p className="eyebrow">Scenario Presets</p>
            <div className="button-stack">
              {mockNetworkSnapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  className={snapshot.id === activeSnapshot.id ? "scenario-button active" : "scenario-button"}
                  onClick={() => setActiveId(snapshot.id)}
                  type="button"
                >
                  <span>{snapshot.label}</span>
                  <strong>{snapshot.mode === "historical" ? "Observed" : "Simulated"}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <strong className="panel-title">Prime Radiant</strong>
            <p className="panel-subtitle">Network State Instrument</p>
          </section>

          <section className="metrics-grid">
            <MetricCard label="Fee Pressure" value={activeSnapshot.feePressureIndex.toFixed(1)} severity={getSeverity(activeSnapshot.feePressureIndex)} />
            <MetricCard label="Congestion" value={activeSnapshot.congestionScore.toFixed(1)} severity={getSeverity(activeSnapshot.congestionScore)} />
            <MetricCard label="Block Stress" value={activeSnapshot.blockProductionStress.toFixed(1)} severity={getSeverity(activeSnapshot.blockProductionStress)} />
            <MetricCard label="Health" value={activeSnapshot.networkHealthScore.toFixed(1)} severity={getSeverity(10 - activeSnapshot.networkHealthScore)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Fee Buckets</p>
            <div className="bucket-list">
              {activeSnapshot.feeBuckets.map((bucket) => (
                <div className="bucket-row" key={bucket.id}>
                  <div>
                    <strong>{bucket.feeRateLabel}</strong>
                    <span>Transaction share</span>
                  </div>
                  <div>
                    <strong>{formatPct(bucket.txShare)}</strong>
                    <span>Intensity {(bucket.intensity * 100).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Mining Pools</p>
            <div className="pool-list">
              {activeSnapshot.miningPools.map((pool) => (
                <div className="pool-row" key={pool.id}>
                  <div>
                    <strong>{pool.name}</strong>
                    <span>{pool.hashRateEh.toFixed(0)} EH/s</span>
                  </div>
                  <div>
                    <strong>{formatPct(pool.sharePct)}</strong>
                    <span>{pool.shareChange30d >= 0 ? "+" : ""}{(pool.shareChange30d * 100).toFixed(1)}% 30d</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Interpretation</p>
            <ul className="notes-list">
              {activeSnapshot.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
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

function PrimeRadiantScene({ snapshot }: { snapshot: NetworkSnapshot }) {
  return (
    <group position={[0, -0.15, 0]} scale={0.78}>
      {/* Lighting rig — dramatic, warm */}
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 2]} intensity={12} color="#FA660F" distance={22} decay={1.8} />
      <pointLight position={[6, 5, 4]} intensity={5} color="#FF8C3A" distance={20} decay={2} />
      <pointLight position={[-6, -4, 4]} intensity={4} color="#FA660F" distance={18} decay={2} />
      <pointLight position={[0, -6, 2]} intensity={3} color="#7A3308" distance={16} decay={2} />
      <pointLight position={[0, 6, 1]} intensity={2} color="#FF6B00" distance={14} decay={2} />

      {/* L0 — Reference grid */}
      <ReferenceGrid />

      {/* L1 — Central nexus */}
      <RadiantCore healthScore={snapshot.networkHealthScore} />

      {/* L2 — Settlement spine */}
      <SettlementSpine snapshot={snapshot} />

      {/* L3 — Segmented data rings (each block = a data abstraction) */}
      {snapshot.ringBands.map((band, i) => (
        <SegmentedDataRing key={band.id} band={band} index={i} />
      ))}

      {/* L4 — Fee orbit rings (tilted, segmented by fee tier) */}
      <FeeOrbitRings feeBuckets={snapshot.feeBuckets} />

      {/* L5 — Outer sweep rings (sparse, structural) */}
      <OuterSweepRings />

      {/* L6 — Particle nebula */}
      <ParticleNebula snapshot={snapshot} />

      {/* L7 — Mining constellation */}
      <MiningConstellation pools={snapshot.miningPools} />

      {/* L8 — Data inscriptions */}
      <DataInscriptions snapshot={snapshot} />

      {/* L9 — Block labels */}
      <BlockLabels snapshot={snapshot} />
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
    if (midRef.current) {
      midRef.current.rotation.y = -t * 0.08;
      midRef.current.rotation.z = t * 0.06;
    }
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.035;
      outerRef.current.rotation.x = -t * 0.028;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(scale * (2.8 + Math.sin(t * 0.35) * 0.25));
    }
  });

  return (
    <group>
      {/* Solid core */}
      <mesh ref={innerRef} scale={scale * 0.5}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#FF8C3A"
          emissive="#FA660F"
          emissiveIntensity={1.6}
          metalness={0.5}
          roughness={0.05}
        />
      </mesh>

      {/* Wireframe shell 1 */}
      <mesh ref={midRef} scale={scale * 0.95}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#FA660F" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Wireframe shell 2 */}
      <mesh ref={outerRef} scale={scale * 1.5}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#FF8C3A" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Core illumination */}
      <pointLight color="#FA660F" intensity={8} distance={6} decay={1.5} />

      {/* Volumetric glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#FA660F" transparent opacity={0.025} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ─── SETTLEMENT SPINE ─── */

function SettlementSpine({ snapshot }: { snapshot: NetworkSnapshot }) {
  const healthColor = snapshot.networkHealthScore < 5.5 ? "#FF3D00" : "#FA660F";

  return (
    <group>
      {/* Central axis */}
      <mesh position={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.025, 0.025, 10, 24]} />
        <meshStandardMaterial
          color="#FF8C3A"
          emissive="#FA660F"
          emissiveIntensity={0.8}
          metalness={0.7}
          roughness={0.1}
        />
      </mesh>

      {/* Blocks */}
      {Array.from({ length: 9 }).map((_, i) => (
        <SpineBlock key={i} index={i} y={i * 0.78 - 3.1} scale={0.18 + i * 0.008} healthColor={healthColor} isTip={i > 6} />
      ))}
    </group>
  );
}

function SpineBlock({ index, y, scale, healthColor, isTip }: { index: number; y: number; scale: number; healthColor: string; isTip: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      const wave = Math.sin(t * 0.6 - index * 0.55);
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.7 + wave * 0.4;
      meshRef.current.rotation.y = t * 0.05 + index * 0.18;
    }
  });

  return (
    <group position={[0, y, 0.16]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[scale, 0]} />
        <meshStandardMaterial
          color={isTip ? "#FFAA55" : "#FF8C3A"}
          emissive={healthColor}
          emissiveIntensity={0.8}
          metalness={0.45}
          roughness={0.08}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[scale * 1.4, 0]} />
        <meshBasicMaterial color="#FA660F" wireframe transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

/* ─── SEGMENTED DATA RING ───
   Each ring is composed of discrete building blocks, not solid geometry.

   Ring 1 (Inner fee band):   segments = transaction batches grouped by fee level
   Ring 2 (Settlement band):  segments = confirmed blocks in recent epoch
   Ring 3 (Congestion band):  segments = mempool depth slices by priority
   Ring 4 (Outer mempool):    segments = pending transaction cohorts by age

   Active segments glow (data present), inactive are dim scaffolding.
   Height variation = metric intensity at that position.
   The ring reads like a circular bar chart — every block means something.
*/

function SegmentedDataRing({ band, index }: { band: RingBand; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const speed = (index % 2 === 0 ? 1 : -1) * (0.008 + index * 0.003);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.z += delta * speed;
  });

  const segCount = 96;
  const activeCount = Math.round(segCount * band.activeShare);

  // Pre-generate a deterministic height variation pattern per ring
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

      // Height varies based on data intensity + positional wave
      const wave = Math.sin(angle * 3 + seed) * 0.5 + 0.5; // 0-1
      const dataHeight = isActive
        ? 0.04 + band.intensity * 0.12 * (0.5 + wave * 0.5)
        : 0.015;

      // Major segments are taller structural pillars
      const height = isMajor ? dataHeight * 1.8 : dataHeight;

      // Width = arc length each segment occupies (with gap)
      const arcLen = (2 * Math.PI * band.radius) / segCount;
      const width = arcLen * 0.65; // 65% fill, 35% gap

      const depth = isActive ? 0.035 + band.intensity * 0.025 : 0.015;

      const emIntensity = isActive
        ? (0.5 + band.intensity * 0.9) * (isMajor ? 1.2 : 0.8 + wave * 0.4)
        : 0;

      result.push({
        x: Math.cos(angle) * band.radius,
        y: Math.sin(angle) * band.radius,
        angle, isActive, isMajor, height, width, depth, emIntensity,
      });
    }
    return result;
  }, [segCount, activeCount, band.radius, band.intensity, seed]);

  return (
    <group ref={groupRef}>
      {/* Faint track ring — the rail these blocks sit on */}
      <mesh>
        <ringGeometry args={[band.radius - 0.008, band.radius + 0.008, 256]} />
        <meshBasicMaterial color="#FA660F" transparent opacity={0.025} />
      </mesh>

      {/* Building blocks */}
      {segments.map((seg, i) => (
        <mesh key={i} position={[seg.x, seg.y, 0]} rotation={[0, 0, seg.angle]}>
          <boxGeometry args={[seg.width, seg.height, seg.depth]} />
          {seg.isActive ? (
            <meshStandardMaterial
              color="#FA660F"
              emissive="#FA660F"
              emissiveIntensity={seg.emIntensity}
              metalness={0.3}
              roughness={0.3}
              transparent
              opacity={0.75 + band.intensity * 0.2}
            />
          ) : (
            <meshBasicMaterial
              color="#1A1000"
              transparent
              opacity={0.04}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

/* ─── FEE ORBIT RINGS ───
   Tilted segmented rings — each segment is a batch of transactions
   at that fee tier. Tilt differentiates them from the flat data rings.
   More segments lit = more transactions at that fee level.
*/

function FeeOrbitRings({ feeBuckets }: { feeBuckets: FeeBucket[] }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    groupRefs.current.forEach((g, i) => {
      if (g) {
        const spd = (i % 2 === 0 ? -1 : 1) * (0.005 + i * 0.002);
        g.rotation.z += delta * spd;
      }
    });
  });

  return (
    <group>
      {feeBuckets.map((bucket, i) => {
        const radius = 1.05 + i * 0.5;
        const segCount = 64;
        const activeCount = Math.round(segCount * bucket.txShare * 2.5); // scale up for visibility
        const tiltX = Math.PI / 2.4 + i * 0.06;

        return (
          <group
            key={bucket.id}
            ref={(el) => { groupRefs.current[i] = el; }}
            rotation={[tiltX, 0, Math.PI * 0.12 + i * 0.18]}
          >
            {Array.from({ length: segCount }).map((_, j) => {
              const angle = (j / segCount) * Math.PI * 2;
              const isActive = j < activeCount;
              const wave = Math.sin(angle * 2 + i * 1.7) * 0.5 + 0.5;
              const h = isActive ? 0.02 + bucket.intensity * 0.06 * (0.6 + wave * 0.4) : 0.008;
              const arcLen = (2 * Math.PI * radius) / segCount;
              const w = arcLen * 0.55;

              return (
                <mesh
                  key={j}
                  position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
                  rotation={[0, 0, angle]}
                >
                  <boxGeometry args={[w, h, 0.025]} />
                  {isActive ? (
                    <meshStandardMaterial
                      color="#FA660F"
                      emissive="#FA660F"
                      emissiveIntensity={0.4 + bucket.intensity * 0.7}
                      metalness={0.2}
                      roughness={0.4}
                      transparent
                      opacity={0.5 + bucket.intensity * 0.35}
                    />
                  ) : (
                    <meshBasicMaterial color="#0D0800" transparent opacity={0.02} />
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

/* ─── OUTER SWEEP RINGS ───
   Sparse structural rings at the perimeter — like scaffolding
   or orbital tracks waiting for data. Very faint, widely spaced segments.
*/

function OuterSweepRings() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.z += delta * 0.001;
  });

  const rings = useMemo(() => {
    const result: Array<{ radius: number; segCount: number; tiltX: number; tiltZ: number }> = [];
    for (let i = 0; i < 3; i++) {
      result.push({
        radius: 5.5 + i * 0.65,
        segCount: 48 - i * 8,
        tiltX: Math.PI / 2 + (i - 1) * 0.1,
        tiltZ: i * 0.2,
      });
    }
    return result;
  }, []);

  return (
    <group ref={groupRef}>
      {rings.map((ring, ri) =>
        Array.from({ length: ring.segCount }).map((_, i) => {
          const angle = (i / ring.segCount) * Math.PI * 2;
          const arcLen = (2 * Math.PI * ring.radius) / ring.segCount;
          return (
            <mesh
              key={`${ri}-${i}`}
              position={[
                Math.cos(angle) * ring.radius,
                Math.sin(angle) * ring.radius,
                0,
              ]}
              rotation={[ring.tiltX - Math.PI / 2, 0, angle + ring.tiltZ]}
            >
              <boxGeometry args={[arcLen * 0.4, 0.01, 0.015]} />
              <meshStandardMaterial
                color="#FA660F"
                emissive="#FA660F"
                emissiveIntensity={0.15}
                transparent
                opacity={0.06 - ri * 0.015}
              />
            </mesh>
          );
        })
      )}
    </group>
  );
}

/* ─── PARTICLE NEBULA ─── Dense multi-layer cloud */

function ParticleNebula({ snapshot }: { snapshot: NetworkSnapshot }) {
  const layer1Ref = useRef<THREE.Group>(null);
  const layer2Ref = useRef<THREE.Group>(null);
  const layer3Ref = useRef<THREE.Group>(null);
  const layer4Ref = useRef<THREE.Group>(null);

  const pressure = snapshot.feePressureIndex / 10;
  const congestion = snapshot.congestionScore / 10;

  // Layer 1: Dense inner cloud (mempool core)
  const innerCount = Math.max(400, Math.round(snapshot.mempoolTxCount / 500));
  const innerPos = useMemo(() => {
    const pos = new Float32Array(innerCount * 3);
    for (let i = 0; i < innerCount; i++) {
      const r = 1.2 + Math.random() * (2.5 + congestion);
      const a = (i / innerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const tilt = (Math.random() - 0.5) * 1.8;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * (0.7 + Math.random() * 0.5);
      pos[i * 3 + 2] = tilt;
    }
    return pos;
  }, [innerCount, congestion]);

  // Layer 2: Mid-range particles
  const midCount = Math.max(300, Math.round(snapshot.mempoolTxCount / 800));
  const midPos = useMemo(() => {
    const pos = new Float32Array(midCount * 3);
    for (let i = 0; i < midCount; i++) {
      const r = 2.8 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      const tilt = (Math.random() - 0.5) * 2.8;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = tilt;
    }
    return pos;
  }, [midCount]);

  // Layer 3: Outer haze (wide, sparse, larger particles)
  const outerCount = Math.max(200, Math.round(snapshot.mempoolTxCount / 1400));
  const outerPos = useMemo(() => {
    const pos = new Float32Array(outerCount * 3);
    for (let i = 0; i < outerCount; i++) {
      const r = 4.5 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      const tilt = (Math.random() - 0.5) * 4;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = tilt;
    }
    return pos;
  }, [outerCount]);

  // Layer 4: Background dust (very sparse, very wide)
  const dustCount = 500;
  const dustPos = useMemo(() => {
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 2 + Math.random() * 10;
      const a = Math.random() * Math.PI * 2;
      const tilt = (Math.random() - 0.5) * 6;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = tilt;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (layer1Ref.current) layer1Ref.current.rotation.z += delta * 0.018;
    if (layer2Ref.current) layer2Ref.current.rotation.z -= delta * 0.01;
    if (layer3Ref.current) layer3Ref.current.rotation.z += delta * 0.005;
    if (layer4Ref.current) layer4Ref.current.rotation.z -= delta * 0.002;
  });

  const baseSize = 0.014 + pressure * 0.008;
  const baseOpacity = 0.35 + pressure * 0.4;

  return (
    <group>
      {/* Dense inner */}
      <group ref={layer1Ref}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[innerPos, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#FA660F" size={baseSize * 1.2} sizeAttenuation transparent opacity={baseOpacity} />
        </points>
      </group>

      {/* Mid-range */}
      <group ref={layer2Ref}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[midPos, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#FF8C3A" size={baseSize} sizeAttenuation transparent opacity={baseOpacity * 0.65} />
        </points>
      </group>

      {/* Outer haze */}
      <group ref={layer3Ref}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[outerPos, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#FA660F" size={baseSize * 1.5} sizeAttenuation transparent opacity={baseOpacity * 0.3} />
        </points>
      </group>

      {/* Background dust */}
      <group ref={layer4Ref}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#FF6B00" size={baseSize * 0.5} sizeAttenuation transparent opacity={0.12} />
        </points>
      </group>
    </group>
  );
}

/* ─── MINING CONSTELLATION ─── */

function MiningConstellation({ pools }: { pools: MiningPoolSnapshot[] }) {
  return (
    <group>
      {pools.map((pool, i) => (
        <MiningNode key={pool.id} pool={pool} index={i} total={pools.length} />
      ))}
    </group>
  );
}

function MiningNode({ pool, index, total }: { pool: MiningPoolSnapshot; index: number; total: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const r = 5.8;
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r;
  const nodeSize = 0.05 + pool.sharePct * 0.35;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group position={[x, y, 0]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[nodeSize, 0]} />
        <meshStandardMaterial
          color="#FF8C3A"
          emissive="#FA660F"
          emissiveIntensity={0.9}
          metalness={0.4}
          roughness={0.1}
        />
      </mesh>
      <mesh>
        <octahedronGeometry args={[nodeSize * 1.7, 0]} />
        <meshBasicMaterial color="#FA660F" wireframe transparent opacity={0.06} />
      </mesh>
      <Line
        points={[[0, 0, 0], [-x, -y, 0]]}
        color="#FA660F"
        lineWidth={0.3}
        transparent
        opacity={0.04}
        dashed
        dashSize={0.12}
        gapSize={0.06}
      />
      <Text position={[x > 0 ? 0.3 : -0.3, 0.22, 0]} fontSize={0.08} color="#FFFFFF" anchorX={x > 0 ? "left" : "right"} anchorY="middle" fillOpacity={0.4} font={undefined}>
        {pool.name}
      </Text>
      <Text position={[x > 0 ? 0.3 : -0.3, 0.1, 0]} fontSize={0.055} color="#FA660F" anchorX={x > 0 ? "left" : "right"} anchorY="middle" fillOpacity={0.3} font={undefined}>
        {(pool.sharePct * 100).toFixed(0)}%
      </Text>
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
      {/* Concentric reference circles */}
      {[1.5, 2.3, 3.2, 4.3, 5.5].map((r) => (
        <mesh key={r}>
          <ringGeometry args={[r, r + 0.003, 320]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.015} />
        </mesh>
      ))}

      {/* Cardinal crosshairs */}
      <Line points={[[-8, 0, 0], [8, 0, 0]]} color="#FFFFFF" lineWidth={0.3} transparent opacity={0.02} />
      <Line points={[[0, -8, 0], [0, 8, 0]]} color="#FFFFFF" lineWidth={0.3} transparent opacity={0.02} />

      {/* Diagonal refs */}
      <Line points={[[-6, -6, 0], [6, 6, 0]]} color="#FFFFFF" lineWidth={0.2} transparent opacity={0.008} />
      <Line points={[[-6, 6, 0], [6, -6, 0]]} color="#FFFFFF" lineWidth={0.2} transparent opacity={0.008} />

      {/* 30° radials */}
      {[1, 2, 4, 5, 7, 8, 10, 11].map((i) => {
        const a = (i / 12) * Math.PI * 2;
        return <Line key={i} points={[[0, 0, 0], [Math.cos(a) * 6.6, Math.sin(a) * 6.6, 0]]} color="#FFFFFF" lineWidth={0.15} transparent opacity={0.006} />;
      })}

      {/* Compass graduation */}
      {compassMarks.map((m, i) => (
        <Line key={i} points={[[Math.cos(m.angle) * m.innerR, Math.sin(m.angle) * m.innerR, 0], [Math.cos(m.angle) * m.outerR, Math.sin(m.angle) * m.outerR, 0]]} color="#FA660F" lineWidth={m.isMajor ? 0.45 : 0.2} transparent opacity={m.isMajor ? 0.09 : 0.035} />
      ))}

      {/* Outer boundary */}
      <mesh><ringGeometry args={[6.85, 6.87, 320]} /><meshBasicMaterial color="#FA660F" transparent opacity={0.06} /></mesh>
      <mesh><ringGeometry args={[6.58, 6.6, 320]} /><meshBasicMaterial color="#FA660F" transparent opacity={0.035} /></mesh>
    </group>
  );
}

/* ─── DATA INSCRIPTIONS ─── */

function DataInscriptions({ snapshot }: { snapshot: NetworkSnapshot }) {
  const items = useMemo(() => [
    { text: `${snapshot.avgBlockIntervalSeconds}s avg interval`, angle: Math.PI * 0.12, radius: 6.3 },
    { text: `${snapshot.mempoolSizeMb} MB mempool`, angle: Math.PI * 0.4, radius: 6.0 },
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

/* ─── BLOCK LABELS ─── */

function BlockLabels({ snapshot }: { snapshot: NetworkSnapshot }) {
  return (
    <group position={[0, 0, 0.4]}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} position={[0.5, i * 0.78 - 1.56, 0]} fontSize={0.06} color="#FFFFFF" anchorX="left" anchorY="middle" fillOpacity={0.22} font={undefined}>
          #{(snapshot.blockHeight - (4 - i)).toLocaleString()}
        </Text>
      ))}
    </group>
  );
}

export default App;
