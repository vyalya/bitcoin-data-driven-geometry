import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, Stars, Text } from "@react-three/drei";
import { useMemo, useState } from "react";
import { mockNetworkSnapshots } from "./data/mockNetworkSnapshots";
import type { NetworkSnapshot, RingBand } from "./types";

const promptMap: Record<string, string> = {
  baseline: "Show me the baseline network state around the halving window.",
  "fee-spike": "Simulate a fee spike and show me where congestion is building.",
  "hashrate-drop": "Simulate a hashrate shock and explain the resilience impact."
};

function scoreTone(score: number) {
  if (score >= 8) return "Strong";
  if (score >= 6) return "Stable";
  if (score >= 4) return "Stressed";
  return "Critical";
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function App() {
  const [activeId, setActiveId] = useState(mockNetworkSnapshots[0].id);
  const activeSnapshot = useMemo(
    () => mockNetworkSnapshots.find((snapshot) => snapshot.id === activeId) ?? mockNetworkSnapshots[0],
    [activeId]
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Bitcoin Network Digital Twin</p>
          <h1>Institutional Bitcoin Network Intelligence</h1>
          <p className="subhead">
            A high-fidelity view of Bitcoin network state, stress, resilience, and simulation rooted in real data contracts.
          </p>
        </div>
        <div className="status-cluster">
          <div className="status-pill">
            <span>Mode</span>
            <strong>{activeSnapshot.mode === "historical" ? "Historical" : "Simulation"}</strong>
          </div>
          <div className="status-pill">
            <span>Time</span>
            <strong>{activeSnapshot.snapshotTime.slice(0, 16).replace("T", " ")}</strong>
          </div>
          <div className="status-pill">
            <span>Health</span>
            <strong>{scoreTone(activeSnapshot.networkHealthScore)}</strong>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="canvas-panel">
          <div className="scene-intro">
            <p className="eyebrow">Command View</p>
            <h2>Settlement Spine / Mempool Field</h2>
            <p>
              Historical-and-simulated network state expressed through block cadence, fee pressure, and miner concentration.
            </p>
          </div>
          <div className="canvas-overlay">
            <div className="hud-card">
              <span>Immutable Spine</span>
              <strong>Block #{activeSnapshot.blockHeight.toLocaleString()}</strong>
            </div>
            <div className="hud-card">
              <span>Mempool Storm</span>
              <strong>{activeSnapshot.mempoolTxCount.toLocaleString()} txs</strong>
            </div>
            <div className="hud-card">
              <span>Network Hashrate</span>
              <strong>{activeSnapshot.networkHashrateEh.toFixed(0)} EH/s</strong>
            </div>
          </div>

          <div className="analysis-ribbon">
            <span>Analysis Lens</span>
            <strong>
              {activeSnapshot.id === "baseline"
                ? "Network Health"
                : activeSnapshot.id === "fee-spike"
                  ? "Mempool and Fees"
                  : "Resilience and Stress"}
            </strong>
          </div>

          <Canvas camera={{ position: [0, 0.1, 13.6], fov: 34 }}>
            <color attach="background" args={["#120704"]} />
            <fog attach="fog" args={["#120704", 10, 22]} />
            <ambientLight intensity={0.72} />
            <pointLight position={[0, 5, 5]} intensity={22} color="#ffba57" />
            <pointLight position={[5, 0, 6]} intensity={10} color="#ff6e1d" />
            <pointLight position={[-5, 0, 4]} intensity={7} color="#8b2f0b" />
            <Stars radius={60} depth={24} count={1400} factor={2.6} saturation={0} fade speed={0.3} />
            <Scene snapshot={activeSnapshot} />
            <OrbitControls
              enablePan={false}
              enableZoom
              minDistance={9.8}
              maxDistance={17.5}
              minPolarAngle={Math.PI / 2.18}
              maxPolarAngle={Math.PI / 1.9}
              minAzimuthAngle={-0.3}
              maxAzimuthAngle={0.3}
            />
          </Canvas>
        </section>

        <aside className="sidebar">
          <section className="panel">
            <p className="eyebrow">Agent Orchestrator</p>
            <h2>Semantic Command Layer</h2>
            <div className="chat-bubble user">{promptMap[activeSnapshot.id]}</div>
            <div className="chat-bubble system">
              {activeSnapshot.mode === "historical"
                ? "Rendering a baseline historical network state from the mocked semantic model."
                : "Applying a bounded simulation overlay to the historical baseline and returning delta-oriented scene updates."}
            </div>
          </section>

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

          <section className="panel metrics-grid">
            <MetricCard label="Fee Pressure" value={activeSnapshot.feePressureIndex.toFixed(1)} />
            <MetricCard label="Congestion" value={activeSnapshot.congestionScore.toFixed(1)} />
            <MetricCard label="Block Stress" value={activeSnapshot.blockProductionStress.toFixed(1)} />
            <MetricCard label="Miner Concentration" value={activeSnapshot.minerConcentrationScore.toFixed(1)} />
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Scene({ snapshot }: { snapshot: NetworkSnapshot }) {
  const mempoolCount = Math.max(160, Math.round(snapshot.mempoolTxCount / 1400));
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(mempoolCount * 3);
    const intensity = snapshot.congestionScore / 10 + 0.35;

    for (let index = 0; index < mempoolCount; index += 1) {
      const radius = 2.15 + Math.random() * (1.7 + intensity * 1.15);
      const angle = (index / mempoolCount) * Math.PI * 2;
      const tilt = (Math.random() - 0.5) * 2.3;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius * (0.72 + Math.random() * 0.48);
      positions[index * 3 + 2] = tilt + (Math.random() - 0.5) * 0.75;
    }

    return positions;
  }, [mempoolCount, snapshot.congestionScore]);

  const particleColor = snapshot.feePressureIndex > 8 ? "#ff7a1a" : "#ffb85c";
  const healthColor = snapshot.networkHealthScore < 5.5 ? "#ff6428" : "#ffcf73";
  const arcParticles = useMemo(() => {
    const points: Array<[number, number, number]> = [];

    snapshot.feeBuckets.forEach((bucket, bucketIndex) => {
      const radius = 2.15 + bucketIndex * 0.62;
      const count = Math.max(24, Math.round(bucket.txShare * 180));

      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        points.push([
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0.12 + bucket.intensity * 0.26
        ]);
      }
    });

    return points;
  }, [snapshot.feeBuckets]);

  const burstPositions = useMemo(() => {
    const points: Array<[number, number, number]> = [];

    snapshot.ringBands.forEach((band) => {
      const count = Math.max(12, Math.round(70 * band.density));

      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
        points.push([
          Math.cos(angle) * band.radius,
          Math.sin(angle) * band.radius,
          (Math.random() - 0.5) * 0.55
        ]);
      }
    });

    return points;
  }, [snapshot.ringBands]);

  return (
    <group position={[0, -0.05, 0]} scale={0.82}>
      <InstrumentBackdrop />

      <mesh position={[0, 0, -0.8]}>
        <circleGeometry args={[4.95, 96]} />
        <meshBasicMaterial color="#1d0904" transparent opacity={0.28} />
      </mesh>

      <mesh position={[0, 0, -0.35]}>
        <ringGeometry args={[1.9, 4.65, 96]} />
        <meshBasicMaterial color="#4d1708" transparent opacity={0.16} />
      </mesh>

      <mesh position={[0, 0, 0.4]}>
        <ringGeometry args={[1.15, 1.55, 96]} />
        <meshBasicMaterial color="#ff902b" transparent opacity={0.3} />
      </mesh>

      <mesh position={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.06, 0.06, 8.5, 20]} />
        <meshStandardMaterial color="#ffd18b" emissive="#ff902b" emissiveIntensity={1.2} />
      </mesh>

      {snapshot.ringBands.map((band) => (
        <DataRing key={band.id} band={band} />
      ))}

      {snapshot.feeBuckets.map((bucket, index) => (
        <OrbitBand key={bucket.id} radius={1.2 + index * 0.52} intensity={bucket.intensity} />
      ))}

      {Array.from({ length: 7 }).map((_, index) => (
        <Float key={index} speed={1 + index * 0.03} rotationIntensity={0.08} floatIntensity={0.16}>
          <group position={[0, index * 0.86 - 2.6, 0.18]}>
            <mesh>
              <octahedronGeometry args={[0.34 + index * 0.018, 0]} />
              <meshStandardMaterial
                color={index > 4 ? "#ffd595" : "#ff9d40"}
                emissive={healthColor}
                emissiveIntensity={0.62}
                metalness={0.22}
                roughness={0.18}
              />
            </mesh>
            <mesh position={[0, 0, -0.08]}>
              <octahedronGeometry args={[0.42 + index * 0.018, 0]} />
              <meshBasicMaterial color="#ff8e2e" transparent opacity={0.08} />
            </mesh>
          </group>
        </Float>
      ))}

      <points position={[0, 0, -0.12]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={particleColor} size={0.032 + snapshot.feePressureIndex * 0.007} sizeAttenuation transparent opacity={0.72} />
      </points>

      {arcParticles.map((point, index) => (
        <mesh key={`${point.join("-")}-${index}`} position={point}>
          <boxGeometry args={[0.018, 0.045, 0.12]} />
          <meshBasicMaterial color="#ffcf7f" transparent opacity={0.78} />
        </mesh>
      ))}

      {burstPositions.map((point, index) => (
        <mesh key={`${point.join("-")}-${index}`} position={point}>
          <boxGeometry args={[0.018, 0.018, 0.09]} />
          <meshBasicMaterial color="#ffd08c" transparent opacity={0.52} />
        </mesh>
      ))}

      {snapshot.miningPools.map((pool, index) => {
        const angle = ((index / snapshot.miningPools.length) * Math.PI * 2) - Math.PI / 2;
        const radius = 4.7;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <group key={pool.id} position={[x, y, 0.15]}>
            <mesh>
              <octahedronGeometry args={[0.11 + pool.sharePct * 0.45, 0]} />
              <meshStandardMaterial color="#ffb14a" emissive="#ff6e17" emissiveIntensity={0.78} />
            </mesh>
            <mesh position={[-x * 0.5, -y * 0.5, -0.18]} rotation={[0, 0, angle]}>
              <boxGeometry args={[radius, 0.008, 0.008]} />
              <meshBasicMaterial color="#8c3110" transparent opacity={0.26} />
            </mesh>
            <Text
              position={[x > 0 ? 0.28 : -0.28, 0.18, 0]}
              fontSize={0.11}
              color="#f7d7a6"
              anchorX={x > 0 ? "left" : "right"}
              anchorY="middle"
            >
              {pool.name}
            </Text>
          </group>
        );
      })}

      <BlockLabels snapshot={snapshot} />
    </group>
  );
}

function DataRing({ band }: { band: RingBand }) {
  const segments = Math.max(72, Math.round(180 * band.density));
  const activeSegments = Math.max(8, Math.round(segments * band.activeShare));
  const blocks = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const isActive = index < activeSegments;
    const x = Math.cos(angle) * band.radius;
    const y = Math.sin(angle) * band.radius;

    blocks.push(
      <mesh key={`${band.id}-${index}`} position={[x, y, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.012, 0.035 + band.intensity * 0.075, 0.085]} />
        <meshBasicMaterial
          color={isActive ? "#ffad3b" : "#5f2810"}
          transparent
          opacity={isActive ? 0.86 : 0.16}
        />
      </mesh>
    );
  }

  return <group>{blocks}</group>;
}

function OrbitBand({ radius, intensity }: { radius: number; intensity: number }) {
  return (
    <group rotation={[Math.PI / 2.8, 0, 0]}>
      <mesh position={[0, 0, -0.2 + intensity * 0.2]}>
        <torusGeometry args={[radius, 0.014 + intensity * 0.012, 10, 120]} />
        <meshBasicMaterial color="#ff8d2c" transparent opacity={0.22 + intensity * 0.18} />
      </mesh>
    </group>
  );
}

function InstrumentBackdrop() {
  return (
    <group position={[0, 0, -1.2]}>
      <mesh position={[0, 0, 0]}>
        <ringGeometry args={[5.35, 5.42, 96]} />
        <meshBasicMaterial color="#8e3110" transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <ringGeometry args={[4.55, 4.62, 96]} />
        <meshBasicMaterial color="#6d210a" transparent opacity={0.18} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[10.8, 0.025, 0.025]} />
        <meshBasicMaterial color="#7b2a0e" transparent opacity={0.14} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[0.025, 10.8, 0.025]} />
        <meshBasicMaterial color="#7b2a0e" transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

function BlockLabels({ snapshot }: { snapshot: NetworkSnapshot }) {
  const labels = Array.from({ length: 4 }).map((_, index) => ({
    id: index,
    text: `Block #${(snapshot.blockHeight - (3 - index)).toLocaleString()}`,
    y: index * 0.86 - 1.75
  }));

  return (
    <group position={[0, 0, 0.55]}>
      {labels.map((label) => (
        <Text
          key={label.id}
          position={[0.96, label.y, 0]}
          fontSize={0.09}
          color="#f0c180"
          anchorX="left"
          anchorY="middle"
        >
          {label.text}
        </Text>
      ))}
    </group>
  );
}

export default App;
