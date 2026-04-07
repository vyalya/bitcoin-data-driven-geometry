import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, Stars, Text } from "@react-three/drei";
import { useMemo, useState } from "react";
import { mockNetworkSnapshots } from "./data/mockNetworkSnapshots";
import type { NetworkSnapshot } from "./types";

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
          <h1>Network Technical Analysis Sandbox</h1>
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

          <Canvas camera={{ position: [0, 2, 12], fov: 45 }}>
            <color attach="background" args={["#07111f"]} />
            <fog attach="fog" args={["#07111f", 12, 26]} />
            <ambientLight intensity={0.8} />
            <pointLight position={[0, 6, 4]} intensity={16} color="#7ed6ff" />
            <pointLight position={[8, -2, 8]} intensity={10} color="#ff9467" />
            <Stars radius={80} depth={32} count={3000} factor={4} saturation={0} fade speed={0.4} />
            <Scene snapshot={activeSnapshot} />
            <OrbitControls enablePan={false} maxDistance={16} minDistance={8} />
          </Canvas>
        </section>

        <aside className="sidebar">
          <section className="panel">
            <p className="eyebrow">Agent Orchestrator</p>
            <h2>Mocked Analysis Flow</h2>
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
  const mempoolCount = Math.max(90, Math.round(snapshot.mempoolTxCount / 2500));
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(mempoolCount * 3);
    const intensity = snapshot.congestionScore / 10;

    for (let index = 0; index < mempoolCount; index += 1) {
      const radius = 2.6 + Math.random() * (2.8 + intensity * 1.6);
      const angle = (index / mempoolCount) * Math.PI * 2;
      const wobble = (Math.random() - 0.5) * 2.4;
      positions[index * 3] = Math.cos(angle) * radius + wobble * 0.12;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 6.5;
      positions[index * 3 + 2] = Math.sin(angle) * radius + wobble * 0.2;
    }

    return positions;
  }, [mempoolCount, snapshot.congestionScore]);

  const particleColor = snapshot.feePressureIndex > 8 ? "#ff8247" : "#7fe6ff";
  const healthColor = snapshot.networkHealthScore < 5.5 ? "#ff6b6b" : "#7ce3b3";

  return (
    <group>
      <gridHelper args={[28, 28, "#12304e", "#0d1f36"]} position={[0, -4, 0]} />

      {Array.from({ length: 8 }).map((_, index) => (
        <Float key={index} speed={1.3} rotationIntensity={0.25} floatIntensity={0.7}>
          <mesh position={[0, index * 1.15 - 3.7, 0]}>
            <boxGeometry args={[0.95, 0.95, 0.95]} />
            <meshStandardMaterial color={index === 7 ? healthColor : "#88caff"} emissive={healthColor} emissiveIntensity={0.28} />
          </mesh>
        </Float>
      ))}

      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color={particleColor} size={0.08 + snapshot.feePressureIndex * 0.012} sizeAttenuation />
      </points>

      {snapshot.miningPools.map((pool, index) => {
        const angle = (index / snapshot.miningPools.length) * Math.PI * 2;
        const radius = 5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (pool.sharePct - 0.15) * 5;

        return (
          <group key={pool.id} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[0.3 + pool.sharePct * 1.2, 24, 24]} />
              <meshStandardMaterial color="#9a88ff" emissive="#6747ff" emissiveIntensity={0.5} />
            </mesh>
            <Text
              position={[0, 0.9, 0]}
              fontSize={0.25}
              color="#d9ecff"
              anchorX="center"
              anchorY="middle"
            >
              {pool.name}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

export default App;
