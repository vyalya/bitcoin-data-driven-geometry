import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
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
  { key: "difficulty", label: "Difficulty", min: 0, max: 200000000000000, step: 1000000000000, unit: "", snapshotField: "difficulty" },
  { key: "activeAddr", label: "Active Addresses", min: 0, max: 1500000, step: 1000, unit: "", snapshotField: "activeAddresses" },
  { key: "feePressure", label: "Fee Pressure", min: 0, max: 10, step: 0.1, unit: "/10", snapshotField: "feePressureIndex" },
  { key: "congestion", label: "Congestion", min: 0, max: 10, step: 0.1, unit: "/10", snapshotField: "congestionScore" },
  { key: "blockStress", label: "Block Stress", min: 0, max: 10, step: 0.1, unit: "/10", snapshotField: "blockProductionStress" },
];

/* ─── Per-snapshot narration ─── */
const NARRATION: Record<string, string> = {
  genesis: "January 9, 2009 — six days after the genesis block. Only 14 blocks mined. Each is 215 bytes with a single transaction. Satoshi is mining alone on a CPU. The entire Bitcoin network is one node, one miner, zero real transactions. The spine is sparse and tiny — this is the quietest day in Bitcoin history.",
  pizza: "May 22, 2010 — Laszlo Hanyecz pays 10,000 BTC for two pizzas, the first real-world Bitcoin purchase. Block heights around 57K. Most blocks still carry just 1 transaction. Those 10,000 BTC would be worth over $700 million in 2024.",
  "bubble-2011": "June 19, 2011 — Bitcoin's first major bubble just burst. BTC hit $31, then crashed to $2. Mt. Gox has been hacked for the first time. Blocks are small, transactions few. Early chaos, but the network keeps producing blocks every ~10 minutes.",
  "bubble-2013": "April 10, 2013 — BTC crashed from $266 to $50 in hours. Fast blocks at 452s signal ASICs arriving and hashrate surging. Block sizes vary wildly — some nearly empty, others packed. The network is growing up.",
  mtgox: "February 24, 2014 — Mt. Gox declared bankruptcy. 850,000 BTC lost. Hashrate barely 0.026 EH/s. A dark day for Bitcoin trust, but the blocks keep coming. Block sizes range from tiny coinbase-only to full 1MB. The protocol is indifferent to market panic.",
  "bear-2015": "January 14, 2015 — the deepest bear market despair. BTC is around $200. But the network is quietly building: 0.36 EH/s, steady 596s block intervals. Blocks show growing variety in size — real economic activity underneath the price collapse.",
  "halving-2016": "July 9, 2016 — the 2nd halving. Block subsidy drops from 25 to 12.5 BTC. Hashrate at 1.6 EH/s. The network is calm, mempool clear. This is the quiet before the 2017 storm. Notice how blocks near the halving boundary are packed — miners racing.",
  "bull-2017": "December 20, 2017 — BTC near $20K. The spine glows hot: every block packed near 4 MWU with 2,000-3,500 transactions. 343K pending transactions in the mempool. Congestion score 4.7/10. Fee pressure at 2.9/10. The settlement ring stays full — blocks still arriving on schedule despite the chaos.",
  "bear-2018": "December 15, 2018 — BTC bottomed near $3,200. Blood in the streets. But look at the network: 41 EH/s, empty mempool, perfect health score 8.6/10. Block intervals are textbook 600s. The network doesn't care about price.",
  "rally-2019": "June 26, 2019 — BTC briefly hit $13K. 76K mempool transactions building. Fast blocks at 524s as hashrate surges to 65 EH/s. The congestion ring is just starting to glow. A preview of things to come.",
  covid: "March 12, 2020 — COVID Black Thursday. BTC dropped 50% in 24 hours. Global pandemic panic. But blocks keep coming at 572s intervals. 27K mempool transactions — a spike, but manageable. The settlement ring stays nearly complete. Bitcoin doesn't have a circuit breaker.",
  "halving-2020": "May 11, 2020 — the 3rd halving. Subsidy drops from 12.5 to 6.25 BTC. 109 EH/s hashrate, near-empty mempool. The spine shows blocks near block 629,867. Recovery is underway. In 12 months, BTC will be at $64K.",
  coinbase: "April 14, 2021 — Coinbase goes public on NASDAQ. BTC at $64K. 257K mempool transactions — heavy institutional-driven congestion. Congestion ring expanding. Fee tiers show pressure across all brackets. The network is handling the biggest influx of new users in its history.",
  "china-ban": "June 28, 2021 — China banned mining. Hashrate crashed from 180 to 109 EH/s overnight. Paradoxically healthy: low fees, clear mempool, perfect block production. The congestion ring is barely visible. Bitcoin routed around the largest mining ban in history in weeks.",
  "ath-2021": "November 10, 2021 — Bitcoin hit $69K, the all-time high. Fast blocks at 580s. Moderate mempool at 33K transactions. The spine shows well-filled blocks. Bull market peak. Notice the settlement ring is nearly complete — network performance remains excellent even at ATH prices.",
  ukraine: "February 24, 2022 — Russia invaded Ukraine. BTC used for cross-border humanitarian aid. The network is unfazed: 184 EH/s, perfect 600s block intervals, zero congestion. The protocol's neutrality is its superpower.",
  ftx: "November 11, 2022 — FTX and Alameda collapsed. Contagion across crypto. But Bitcoin's network: 245 EH/s, normal blocks, health 8.5/10. The mempool has 12K transactions — barely a blip. The spine is calm. Layer 1 is untouchable.",
  "recovery-2023": "January 14, 2023 — bear market ending. BTC climbing from $16K. 290 EH/s — hashrate grew through the entire bear. Only 2,533 mempool transactions. The network has never been healthier or more secure, even as speculators fled.",
  inscriptions: "December 16, 2023 — Ordinals inscriptions flood the network. 346K mempool transactions — congestion matching the 2017 peak. 528 EH/s hashrate. The congestion ring is blazing. But blocks keep coming: the settlement ring holds. New use case, same reliable block production.",
  etf: "January 11, 2024 — the SEC approved spot Bitcoin ETFs. Institutional era begins. Fast blocks at 499s as miners race. 482 EH/s. The mempool is actually clear — the market celebrated off-chain. Block stress elevated at 1.9/10 from the fast intervals.",
  "ath-2024": "March 14, 2024 — new ATH near $73K driven by ETF inflows. 380K mempool transactions — the highest congestion in the entire dataset. Congestion ring maxed out. Fee pressure 2.9/10. Health dips to 6.9. But the spine shows blocks still arriving, still full, still processing transactions.",
  "halving-2024": "April 20, 2024 — the 4th halving. Block #840,000. Subsidy drops from 6.25 to 3.125 BTC. The spine shows blocks packed with 4,000-6,000 transactions — Ordinals and Runes driving demand. Slower blocks at 665s. 642 EH/s. A new era of Bitcoin scarcity.",
  election: "November 10, 2024 — post-election rally toward $90K. Pro-crypto sentiment surges. 243K mempool transactions. 701 EH/s. The network is handling the demand surge while delivering blocks on schedule. Congestion visible but manageable.",
  trump: "January 20, 2025 — pro-crypto president inaugurated. 719 EH/s, zero congestion, perfect health 8.6/10. The network is calm and extremely secure. The political backdrop is bullish, but the protocol just produces blocks.",
  correction: "October 10, 2025 — market correction. Prices declining. But 907 EH/s — all-time high hashrate. Only 8,688 mempool transactions. Health 8.6/10. The spine shows blocks mining normally. The network doesn't care about price. It never has.",
};

/* ─── Hover context types ─── */
type HoverContext =
  | { type: "none" }
  | { type: "block"; block: BlockTuple; index: number }
  | { type: "fee"; tierIndex: number }
  | { type: "congestion" }
  | { type: "settlement" }
  | { type: "hashrate" }
  | { type: "difficulty" }
  | { type: "volume" };

function App() {
  const [activeIdx, setActiveIdx] = useState(0);
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
    s.networkHealthScore = Math.max(0, Math.min(10, 10 - (s.feePressureIndex + s.congestionScore + s.blockProductionStress + s.minerConcentrationScore) / 4));
    s.ringBands = deriveRingBands(s);
    s.mempoolSizeMb = s.mempoolTxCount * 0.00028;
    return s;
  }, [baseSnapshot, overrides, hasOverrides]);

  // Hover/selection state
  const [hoverCtx, setHoverCtx] = useState<HoverContext>({ type: "none" });
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showDataInfo, setShowDataInfo] = useState(false);
  // Legacy legend state — the standalone legend modal was replaced by a tab
  // in the Info modal, but these values are still referenced by scene props.
  // Setters are intentionally unused.
  const [showLegend] = useState(false);
  const [legendHover] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "detail">("grid");
  const [gridHoverIdx, setGridHoverIdx] = useState<number | null>(null);
  // Grid-view selection: first tap previews, second tap (on same cell) enters detail
  const [gridSelectedIdx, setGridSelectedIdx] = useState<number | null>(null);
  const [showGuideTab, setShowGuideTab] = useState<"legend" | "source" | "visual">("legend");

  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const preClickState = useRef({ wasPlaying: false, wasRotating: true });
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(playing);
  playRef.current = playing;
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const rotationRef = useRef(rotationEnabled);
  rotationRef.current = rotationEnabled;

  const onHover = useCallback((groupId: string | null) => {
    setActiveGroup(groupId);
  }, []);

  const onClick = useCallback((groupId: string) => {
    setPinnedGroup(prev => {
      if (prev === groupId) {
        // Unpin same shape → resume
        setPlaying(preClickState.current.wasPlaying);
        setRotationEnabled(preClickState.current.wasRotating);
        return null;
      }
      if (!prev) {
        // First pin — save current state then pause
        preClickState.current = { wasPlaying: playRef.current, wasRotating: rotationRef.current };
        setPlaying(false);
        setRotationEnabled(false);
      }
      // Pin new shape (or switch pin) — stay paused
      return groupId;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setPinnedGroup(prev => {
      if (prev) {
        // Was pinned → resume
        setPlaying(preClickState.current.wasPlaying);
        setRotationEnabled(preClickState.current.wasRotating);
      }
      return null;
    });
    setActiveGroup(null);
  }, []);

  // The group that drives the right panel KPIs — legend hover > pinned > hover
  const displayGroup = legendHover ?? pinnedGroup ?? activeGroup;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (!playRef.current) return;
      setActiveIdx((prev) => {
        const next = prev + 1;
        if (next >= mosaicSnapshots.length) {
          setPlaying(false);
          return prev;
        }
        return next;
      });
      resetOverrides();
    }, 2200);
    return () => clearInterval(timer);
  }, [playing]);

  // Narration: show on every snapshot change
  const [showNarration, setShowNarration] = useState(true);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [whatIfExpanded, setWhatIfExpanded] = useState(false);

  // Viewport width for mobile-specific rendering decisions
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Touch-start Y for swipe-up gesture on the mobile sheet handle
  const sheetTouchStartY = useRef<number | null>(null);

  // Refs for auto-scrolling the mobile timeline strip to the active item
  const timelineRef = useRef<HTMLDivElement>(null);
  const tlItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // In grid view the active chip tracks the selected index; in detail view it
  // tracks activeIdx. Either way we want the strip to center on it.
  const scrollTargetIdx = view === "grid" ? (gridSelectedIdx ?? activeIdx) : activeIdx;
  useEffect(() => {
    const container = timelineRef.current;
    const item = tlItemRefs.current[scrollTargetIdx];
    if (!container || !item) return;
    // Only scroll the horizontal strip (mobile). On desktop the strip is a
    // vertical list with no horizontal scroll; detect by actual scrollable
    // width rather than computed flex-direction (which is unreliable).
    if (container.scrollWidth <= container.clientWidth + 1) return;
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const itemOffsetLeft = itemRect.left - containerRect.left + container.scrollLeft;
    const target = itemOffsetLeft - (container.clientWidth - item.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [scrollTargetIdx]);

  // When a shape is selected on mobile, we only update the sheet handle title
  // — we do NOT auto-expand. The user can then tap or swipe up on the handle
  // to reveal the KPIs. Instant expansion was jarring and obscured the actual
  // object they just tapped.

  // Keep the grid-view selection synced with whichever date is being viewed,
  // so returning to grid from detail highlights the cell the user was on.
  useEffect(() => {
    if (view === "detail") setGridSelectedIdx(activeIdx);
  }, [view, activeIdx]);
  const prevIdxRef = useRef(activeIdx);
  useEffect(() => {
    if (prevIdxRef.current !== activeIdx) {
      setShowNarration(true);
      prevIdxRef.current = activeIdx;
    }
  }, [activeIdx]);

  const s = effectiveSnapshot;

  // Descriptive label for whatever shape is currently being inspected in the
  // detail view. Shown in the mobile bottom-sheet handle so the user can see
  // what they just tapped without expanding the sheet.
  const selectionLabel: string | null = (() => {
    if (view !== "detail") return null;
    const feeLabels = ["1-10 sat/vB", "11-30 sat/vB", "31-80 sat/vB", "81+ sat/vB"];
    switch (hoverCtx.type) {
      case "block": return `Block #${hoverCtx.block[0].toLocaleString()}`;
      case "fee": return `Fee Tier · ${feeLabels[hoverCtx.tierIndex]}`;
      case "settlement": return "Block Settlement";
      case "congestion": return "Network Congestion";
      case "volume": return "BTC Volume";
      case "hashrate": return "Hashrate";
      case "difficulty": return "Difficulty";
      default: return null;
    }
  })();

  return (
    <div className="hud-shell">
      <Canvas
        camera={{ position: [0, 0, 22], fov: 42 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        style={{ position: "fixed", inset: 0 }}
        onPointerMissed={() => {
          if (view === "detail") {
            setPinnedGroup(null);
            setActiveGroup(null);
            setHoverCtx({ type: "none" });
          }
        }}
      >
        <color attach="background" args={["#020202"]} />
        {view === "detail" && <fog attach="fog" args={["#010101", 20, 45]} />}
        <CameraRig view={view} />
        {view === "grid" ? (
          <GridScene
            snapshots={mosaicSnapshots}
            hoverIdx={gridHoverIdx}
            selectedIdx={gridSelectedIdx}
            legendHover={legendHover}
            onHover={setGridHoverIdx}
            onSelect={(i) => {
              // Mobile: first tap previews (updates sheet + highlights cell),
              // second tap on the same cell enters detail view. Desktop keeps
              // single-click-to-enter since hover already previews.
              if (isMobile && gridSelectedIdx !== i) {
                setGridSelectedIdx(i);
              } else {
                setActiveIdx(i);
                setGridSelectedIdx(i);
                setView("detail");
                setGridHoverIdx(null);
              }
            }}
          />
        ) : (
          <PrimeRadiantScene
            snapshot={s}
            blocks={currentBlocks}
            activeGroup={displayGroup}
            frozen={!!pinnedGroup || showLegend}
            legendView={showLegend}
            onHover={onHover}
            onClick={onClick}
            rotationEnabled={rotationEnabled}
            onDeselect={clearSelection}
            onBlockHover={(block, index) => { setHoverCtx(block ? { type: "block", block, index } : { type: "none" }); }}
            onRingHover={(type, idx) => {
              if (!type) { if (!pinnedGroup) setHoverCtx({ type: "none" }); return; }
              if (type === "fee") setHoverCtx({ type: "fee", tierIndex: idx ?? 0 });
              else if (type === "congestion") setHoverCtx({ type: "congestion" });
              else if (type === "settlement") setHoverCtx({ type: "settlement" });
              else if (type === "hashrate") setHoverCtx({ type: "hashrate" });
              else if (type === "difficulty") setHoverCtx({ type: "difficulty" });
              else if (type === "volume") setHoverCtx({ type: "volume" });
            }}
          />
        )}
        {isMobile ? (
          // Mobile: no bloom, no chromatic aberration. iOS GPUs render
          // post-processing in half-float precision, which overflows on close-up
          // HDR emissive pixels and produces spurious green/blue color shifts.
          // The raw emissive materials look fine on their own without bloom.
          <EffectComposer multisampling={0}>
            <Vignette eskil={false} offset={0.3} darkness={0.7} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0}>
            <Bloom luminanceThreshold={view === "grid" ? 0.55 : 0.4} luminanceSmoothing={0.5} intensity={view === "grid" ? 0.4 : 0.7} mipmapBlur levels={6} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.00035, 0.00035)} radialModulation={false} modulationOffset={0} />
            <Vignette eskil={false} offset={0.25} darkness={0.7} />
          </EffectComposer>
        )}
        {view === "detail" && <TrackballControls noPan={false} noZoom={false} noRotate={false} minDistance={0.3} maxDistance={60} rotateSpeed={2} zoomSpeed={1.5} panSpeed={0.8} />}
      </Canvas>

      {/* ═══ TOP BANNER ═══ */}
      <div className="hud hud-banner">
        <h1 className="hud-title">The Bitcoin Network as Data Driven Geometry</h1>
        <p className="hud-powered">Powered by Strategy Mosaic</p>
      </div>

      {/* ═══ GRID VIEW SUBTITLE ═══ */}
      {view === "grid" && (
        <div className="hud grid-subtitle">
          25 historical snapshots · hover any in the timeline or click to explore
        </div>
      )}

      {/* ═══ LEFT PANEL: Timeline ═══ */}
      <div className="hud hud-left-panel">
        <div className="left-panel-controls">
          {/* Grid button — left */}
          <button
            className={`grid-return-btn ${view === "grid" ? "active" : ""}`}
            onClick={() => {
              if (view === "detail") {
                setView("grid");
                setPinnedGroup(null);
                setActiveGroup(null);
                setPlaying(false);
              }
            }}
            type="button"
            title="Grid view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          {/* Play button — middle */}
          <button
            className="timeline-play-btn"
            disabled={view === "grid"}
            onClick={() => {
              if (view === "grid") return;
              if (playing) {
                setPlaying(false);
                setRotationEnabled(false);
              } else {
                setPinnedGroup(null);
                setActiveGroup(null);
                if (activeIdx >= mosaicSnapshots.length - 1) setActiveIdx(0);
                setPlaying(true);
                setRotationEnabled(true);
              }
            }}
            type="button"
          >
            {playing ? "❚❚" : "▶"} {playing ? "Pause" : "Play"}
          </button>

          {/* Rotate button — right */}
          <button
            className={`rotate-toggle ${view === "detail" && rotationEnabled && !pinnedGroup ? "active" : ""}`}
            disabled={view === "grid"}
            onClick={() => {
              if (view === "grid") return;
              if (rotationEnabled && !pinnedGroup) {
                setRotationEnabled(false);
              } else {
                setPinnedGroup(null);
                setActiveGroup(null);
                setRotationEnabled(true);
              }
            }}
            type="button"
            title="Toggle rotation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
              <circle cx="20" cy="9" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        <div className="timeline-vertical" ref={timelineRef}>
          {mosaicSnapshots.map((snap, i) => {
            // Active in grid view tracks hover (desktop) or selected (mobile).
            // Active in detail view tracks the currently-viewed date.
            const gridActiveIdx = gridHoverIdx ?? gridSelectedIdx;
            const isActive = view === "grid" ? gridActiveIdx === i : i === activeIdx;
            return (
              <button
                key={snap.id}
                ref={(el) => { tlItemRefs.current[i] = el; }}
                className={`tl-item ${isActive ? "active" : ""}`}
                onMouseEnter={() => { if (view === "grid") setGridHoverIdx(i); }}
                onMouseLeave={() => { if (view === "grid") setGridHoverIdx(null); }}
                onClick={() => {
                  if (view === "grid") {
                    setActiveIdx(i);
                    setView("detail");
                    setGridHoverIdx(null);
                  } else {
                    setActiveIdx(i); resetOverrides(); clearSelection(); setPlaying(false);
                  }
                }}
                type="button"
              >
                <span className="tl-dot" />
                <div className="tl-text">
                  <span className="tl-label">{snap.label}</span>
                  <span className="tl-date">{snap.snapshotTime.slice(0, 10)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Context + What-If ═══ */}
      <div className={`hud hud-right-panel ${mobileSheetExpanded ? "mobile-expanded" : "mobile-collapsed"}`}>
        {/* Mobile-only collapsible handle */}
        <div
          className="mobile-sheet-handle"
          onClick={() => setMobileSheetExpanded(v => !v)}
          onTouchStart={(e) => { sheetTouchStartY.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => {
            const start = sheetTouchStartY.current;
            if (start == null) return;
            const dy = e.changedTouches[0].clientY - start;
            sheetTouchStartY.current = null;
            // Swipe up → expand; swipe down → collapse
            if (dy < -20) setMobileSheetExpanded(true);
            else if (dy > 20) setMobileSheetExpanded(false);
          }}
          role="button"
          tabIndex={0}
          aria-label={mobileSheetExpanded ? "Collapse details" : "Expand details. Swipe up for full KPIs."}
        >
          <span className="handle-title">
            {selectionLabel ?? "Tap to see more"}
          </span>
          {selectionLabel && (
            <button
              className="handle-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                setHoverCtx({ type: "none" });
                setPinnedGroup(null);
                setActiveGroup(null);
              }}
              type="button"
              aria-label="Clear selection"
              title="Clear selection"
            >
              ✕
            </button>
          )}
          <button
            className="handle-info-btn"
            onClick={(e) => { e.stopPropagation(); setShowGuideTab("legend"); setShowDataInfo(true); }}
            type="button"
            aria-label="Info"
          >
            <span className="info-icon">i</span>
          </button>
          <span className={`handle-chevron ${mobileSheetExpanded ? "up" : "down"}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </div>

        {/* Desktop header — Legend + Info buttons (hidden on mobile via CSS) */}
        <div className="right-panel-header">
          <button
            className="panel-header-btn"
            onClick={() => { setShowGuideTab("legend"); setShowDataInfo(true); }}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="5" height="3" rx="0.5" fill="#FF8C3A"/><line x1="8" y1="3.5" x2="15" y2="3.5" stroke="#777" strokeWidth="1.2"/><circle cx="3.5" cy="8.5" r="1.8" stroke="#FA660F" strokeWidth="1.2" fill="none"/><line x1="8" y1="8.5" x2="15" y2="8.5" stroke="#777" strokeWidth="1.2"/><circle cx="3.5" cy="13.5" r="1" fill="#FFAA55"/><line x1="8" y1="13.5" x2="15" y2="13.5" stroke="#777" strokeWidth="1.2"/></svg>
            Legend
          </button>
          <button
            className="panel-header-btn"
            onClick={() => { setShowGuideTab("source"); setShowDataInfo(true); }}
            type="button"
          >
            <span className="info-icon">i</span> Info
          </button>
        </div>

        <div className={`context-panel ${view === "grid" ? "context-full" : ""}`}>
          {/* Mobile-only: embed the narration at the top of the sheet content */}
          {view === "detail" && NARRATION[baseSnapshot.id] && (
            <div className="mobile-narration">
              <span className="mobile-narration-label">Context</span>
              <p>{NARRATION[baseSnapshot.id]}</p>
            </div>
          )}
          <ContextPanel
            snapshot={
              view === "grid"
                ? mosaicSnapshots[gridHoverIdx ?? gridSelectedIdx ?? activeIdx]
                : s
            }
            hoverCtx={view === "grid" ? { type: "none" } : hoverCtx}
            blocks={
              view === "grid"
                ? (mosaicSnapshots[gridHoverIdx ?? gridSelectedIdx ?? activeIdx].blocks ?? [])
                : currentBlocks
            }
          />
        </div>
        {view === "detail" && (
          <div className={`whatif-collapsible ${whatIfExpanded ? "expanded" : "collapsed"}`}>
            <div className="right-divider" />
            <button
              className="whatif-toggle"
              onClick={() => setWhatIfExpanded(v => !v)}
              type="button"
            >
              <span className="whatif-title">What-If Simulation</span>
              <span className={`whatif-chevron ${whatIfExpanded ? "up" : "down"}`}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </button>
            {whatIfExpanded && (
              <div className="whatif-section">
                <div className="whatif-popover-header">
                  <span className="whatif-popover-title">What-If Simulation</span>
                  <div className="whatif-popover-actions">
                    {hasOverrides && (
                      <button className="reset-button" onClick={resetOverrides} type="button">Reset</button>
                    )}
                    <button
                      className="whatif-popover-close"
                      onClick={() => setWhatIfExpanded(false)}
                      type="button"
                      aria-label="Close What-If"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {WHAT_IF_PARAMS.map((param) => {
                  const baseVal = baseSnapshot[param.snapshotField] as number;
                  const currentVal = overrides[param.key] ?? baseVal;
                  const isOverridden = overrides[param.key] !== null && overrides[param.key] !== undefined;
                  return (
                    <div key={param.key} className={`slider-row ${isOverridden ? "overridden" : ""}`}>
                      <div className="slider-header">
                        <span className="slider-label">{param.label}</span>
                        <span className="slider-value">{param.key === "difficulty" ? formatDifficulty(currentVal) : param.max > 100 ? currentVal.toLocaleString() : currentVal.toFixed(1)}<span className="slider-unit">{param.unit}</span></span>
                      </div>
                      <input type="range" min={param.min} max={param.max} step={param.step} value={currentVal} onChange={(e) => setOverride(param.key, parseFloat(e.target.value))} onDoubleClick={() => setOverride(param.key, null)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ NARRATION BUBBLE ═══ */}
      {view === "detail" && showNarration && NARRATION[baseSnapshot.id] && (
        <div className="narration-bar">
          <div className="narration-content">
            <span className="narration-label">{baseSnapshot.label}</span>
            <p className="narration-text">{NARRATION[baseSnapshot.id]}</p>
          </div>
          <button className="narration-close" onClick={() => setShowNarration(false)} type="button" title="Hide narration">✕</button>
        </div>
      )}

      {/* ═══ INFO / VISUAL GUIDE MODAL ═══ */}
      {showDataInfo && (
        <div className="guide-overlay" onClick={() => setShowDataInfo(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="guide-tabs">
              <button className={`guide-tab ${showGuideTab === "legend" ? "active" : ""}`} onClick={() => setShowGuideTab("legend")} type="button">Legend</button>
              <button className={`guide-tab ${showGuideTab === "visual" ? "active" : ""}`} onClick={() => setShowGuideTab("visual")} type="button">How to Read</button>
              <button className={`guide-tab ${showGuideTab === "source" ? "active" : ""}`} onClick={() => setShowGuideTab("source")} type="button">Data Sources</button>
            </div>

            {showGuideTab === "legend" && (
              <div className="guide-body guide-legend-body">
                {[
                  { id: "spine", icon: <span className="legend-block" />, name: "Block", desc: "Each cuboid is one block; width = weight (up to 4 MWU), brightness = tx count." },
                  { id: "fee-0", icon: <span className="legend-line" style={{ background: "#FF9933" }} />, name: "Fee Tiers", desc: "4 horizontal arcs showing fee distribution and pressure." },
                  { id: "settlement", icon: <span className="legend-line" style={{ background: "#FA660F" }} />, name: "Settlement", desc: "Arc length = block production health (full = on schedule)." },
                  { id: "congestion", icon: <span className="legend-line" style={{ background: "#FF4400" }} />, name: "Congestion", desc: "Red arc; length and thickness scale with network congestion." },
                  { id: "volume", icon: <span className="legend-line" style={{ background: "#FFB040" }} />, name: "BTC Volume", desc: "Gold arc proportional to daily BTC transferred vs 4.6M BTC peak." },
                  { id: "hashrate-ring", icon: <span className="legend-arc" />, name: "Hashrate", desc: "Vertical ring, proportional to hashrate vs 1305 EH/s peak." },
                  { id: "difficulty-ring", icon: <span className="legend-arc dark" />, name: "Difficulty", desc: "Vertical ring, log-scaled from 1 to 150 trillion." },
                  { id: "particles", icon: <span className="legend-dot" />, name: "Addresses", desc: "Each particle ≈ 1,000 active addresses; larger = whale activity." },
                ].map((item) => (
                  <div key={item.id} className="guide-legend-item">
                    <div className="guide-legend-icon">{item.icon}</div>
                    <div className="guide-legend-text">
                      <strong>{item.name}</strong>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showGuideTab === "source" && (
              <div className="guide-body">
                <div className="data-info-section">
                  <h4>Underlying Data</h4>
                  <p>On-chain data — blocks, transactions, addresses, outputs, fees, and transfer volumes — is sourced from Google BigQuery's public Bitcoin blockchain dataset. Network and mempool analytics — hashrate, difficulty, fee pressure, congestion, block production stress, mempool depth, and mining pool shares — come from blockchain and mempool data extracts.</p>
                </div>
                <div className="data-info-section">
                  <h4>Strategy Mosaic — Semantic Layer</h4>
                  <p>Strategy Mosaic provides a unified semantic layer over these raw sources. Every metric in this visualization is served from a single certified model — delivering a single source of truth and consistent business logic across all 25 historical snapshots.</p>
                </div>
                <div className="data-info-section">
                  <h4>What You're Seeing</h4>
                  <p>25 historically significant dates from Genesis (Jan 2009) through 2025. Each shows real blocks mined that day, real address activity, real BTC volumes, and real network conditions — all published through Mosaic and rendered as data-driven geometry. Nothing is decorative.</p>
                </div>
                <div className="data-info-section">
                  <h4>Per-Field Source of Truth</h4>
                  <p>Each metric comes from the most authoritative free public source:</p>
                  <p>• <strong>activeAddresses, hashrate, totalFeesBtc, blocksPerDay</strong> → CoinMetrics community API (the gold-standard on-chain data provider used by Bloomberg, CoinDesk, and academic researchers).</p>
                  <p>• <strong>difficulty</strong> → blockchain.com /charts/difficulty (CoinMetrics community tier doesn't expose difficulty).</p>
                  <p>• <strong>btcTransferred</strong> → raw transfer volume from the original Mosaic / BigQuery extract, which matches Glassnode's "Transfer Volume" methodology (includes change outputs). The blockchain.com "estimated" version filters more aggressively and reports ~10x lower numbers — we don't use it because it doesn't match how the metric is reported elsewhere.</p>
                  <p>• <strong>mempool count and size</strong> → blockchain.com (no widely available historical mempool source agrees fully; this is the best free option).</p>
                  <p>Bitcoin hashrate is always an estimate (derived from observed block production), so day-to-day numbers can swing ±15% across sources depending on smoothing window. CoinMetrics applies its own smoothing.</p>
                </div>
              </div>
            )}

            {showGuideTab === "visual" && (
              <div className="guide-body">
                <div className="data-info-section">
                  <h4>Center Spine — Blocks</h4>
                  <p>Each cuboid is one real block from that day. Width = block weight (wider = fuller, up to 4 MWU). Brightness = transaction count (brighter = more txs). Hover a block to see it scale up and show its exact data.</p>
                </div>
                <div className="data-info-section">
                  <h4>Horizontal Rings — Transaction Metrics</h4>
                  <p>Fee Tiers (r=2.2): four arcs showing fee distribution, thickness scales with fee pressure. Settlement (r=2.8): arc length = block production health (full circle = on schedule). Congestion (r=3.3): red arc, length scales with congestion score. BTC Volume (r=3.8): gold arc proportional to daily BTC transferred vs the 4.6M BTC/day peak.</p>
                </div>
                <div className="data-info-section">
                  <h4>Vertical Rings — Security Metrics</h4>
                  <p>Hashrate (YZ plane, r=2.5): arc proportional to hashrate vs 1305 EH/s peak. Difficulty (XZ plane, r=3.0): log-scaled arc from 1 to 150 trillion. These rings grow dramatically from Genesis to 2025.</p>
                </div>
                <div className="data-info-section">
                  <h4>Floating Particles — Active Addresses</h4>
                  <p>Each particle represents ~1,000 active addresses. Genesis = zero particles. Bull market peaks = over a thousand glowing dots filling the space. Larger bright particles indicate whale activity (outputs over 100 BTC).</p>
                </div>
                <div className="data-info-section">
                  <h4>Interaction</h4>
                  <p>Hover any block or ring to see its data in the right panel. Use the timeline to travel through 25 historical events. Drag What-If sliders to simulate hypothetical network conditions — rings and particles respond in real time. Toggle rotation with the ⟳ button.</p>
                </div>
              </div>
            )}

            <button className="guide-close" onClick={() => setShowDataInfo(false)} type="button">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CONTEXT PANEL — shows different data per hover target
   ═══════════════════════════════════════════════════════ */

function formatDifficulty(d: number): string {
  if (d >= 1e12) return `${(d / 1e12).toFixed(1)}T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(1)}B`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(1)}M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(1)}K`;
  return d.toFixed(0);
}

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

  if (hoverCtx.type === "hashrate") {
    return (
      <div className="ctx-content">
        <div className="ctx-title">Network Hashrate</div>
        <CtxRow label="Hashrate" value={`${s.networkHashrateEh.toFixed(1)} EH/s`} />
        <CtxRow label="Ring Fill" value={`${((s.networkHashrateEh / 1305.5) * 100).toFixed(1)}%`} />
        <CtxRow label="Halving Era" value={`${Math.floor(s.blockHeight / 210000) + 1}`} />
        <div className="ctx-notes"><p>Blue vertical ring. Arc length proportional to hashrate relative to the 2025 peak of ~1,305 EH/s. Measures total computational power securing the network. Sourced from CoinMetrics.</p></div>
      </div>
    );
  }

  if (hoverCtx.type === "volume") {
    return (
      <div className="ctx-content">
        <div className="ctx-title">BTC Volume</div>
        <CtxRow label="BTC Transferred" value={`${Math.round(s.btcTransferred).toLocaleString()}`} />
        <CtxRow label="Ring Fill" value={`${((s.btcTransferred / 4600000) * 100).toFixed(1)}%`} />
        <CtxRow label="Active Addresses" value={s.activeAddresses.toLocaleString()} />
        <CtxRow label="Total Outputs" value={s.totalOutputs.toLocaleString()} />
        <div className="ctx-notes"><p>Gold horizontal ring at r=3.8. Arc length proportional to daily raw BTC transfer volume (Glassnode-style methodology, including change outputs) relative to the 2021 ATH of ~4.6M BTC/day.</p></div>
      </div>
    );
  }

  if (hoverCtx.type === "difficulty") {
    return (
      <div className="ctx-content">
        <div className="ctx-title">Mining Difficulty</div>
        <CtxRow label="Difficulty" value={formatDifficulty(s.difficulty)} />
        <CtxRow label="Hashrate" value={`${s.networkHashrateEh.toFixed(1)} EH/s`} />
        <CtxRow label="Difficulty Epoch" value={`${Math.floor(s.blockHeight / 2016)}`} />
        <div className="ctx-notes"><p>Purple vertical ring. Log-scaled arc — difficulty spans from 1 (Genesis) to 150 trillion (2025). Adjusts every 2,016 blocks to maintain ~10 min block times.</p></div>
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
      <CtxRow label="Difficulty" value={formatDifficulty(s.difficulty)} />
      <div className="ctx-divider" />
      <CtxRow label="Blocks" value={`${blocks.length}`} />
      <CtxRow label="Mempool" value={s.mempoolTxCount.toLocaleString()} />
      <CtxRow label="Halving Era" value={`${Math.floor(s.blockHeight / 210000) + 1}`} />
      {s.activeAddresses > 0 && (<>
        <div className="ctx-divider" />
        <CtxRow label="Active Addresses" value={s.activeAddresses.toLocaleString()} />
        <CtxRow label="BTC Transferred" value={`${Math.round(s.btcTransferred).toLocaleString()}`} />
        {s.totalFeesBtc > 0 && <CtxRow label="Total Fees" value={`${s.totalFeesBtc.toFixed(2)} BTC`} />}
        <CtxRow label="Whale Outputs" value={`${(s.whaleOutputs1000 + s.whaleOutputs100).toLocaleString()}`} />
      </>)}
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
  frozen?: boolean;
  rotationEnabled?: boolean;
  legendView?: boolean;
  onHover: (groupId: string | null) => void;
  onClick: (groupId: string) => void;
  onDeselect?: () => void;
  onBlockHover: (block: BlockTuple | null, index: number) => void;
  onRingHover: (type: string | null, idx?: number) => void;
}

/* ═══════════════════════════════════════════════════════
   CAMERA RIG — smoothly animates camera between grid and detail views
   ═══════════════════════════════════════════════════════ */

function CameraRig({ view }: { view: "grid" | "detail" }) {
  const { camera, size } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 22));
  const targetFov = useRef(42);
  const transitioning = useRef(false);
  const transitionStart = useRef(0);

  useEffect(() => {
    if (view === "grid") {
      // Account for side panels covering part of the canvas. These must match
      // the responsive panel widths declared in styles.css.
      const vpW = size.width;
      const vpH = size.height;
      let sidebarWidth: number;
      let topReserve: number;
      let bottomReserve: number;
      if (vpW > 1200) {
        sidebarWidth = 310 + 330 + 32; // default panels + margins
        topReserve = 100;
        bottomReserve = 40;
      } else if (vpW > 1000) {
        sidebarWidth = 260 + 290 + 32;
        topReserve = 100;
        bottomReserve = 40;
      } else if (vpW > 820) {
        sidebarWidth = 230 + 260 + 24;
        topReserve = 90;
        bottomReserve = 40;
      } else if (vpW > 640) {
        sidebarWidth = 210 + 230 + 20;
        topReserve = 80;
        bottomReserve = 40;
      } else {
        // Mobile: panels are top strip + bottom sheet, not sidebars.
        sidebarWidth = 0;
        topReserve = 110; // banner + timeline strip
        // Bottom sheet: when collapsed it's ~64px; when expanded it overlays
        // the canvas, but we still frame to the collapsed footprint so the
        // geometry stays at a consistent size.
        bottomReserve = 72;
      }
      const usableW = Math.max(vpW - sidebarWidth, 280);
      const usableH = Math.max(vpH - topReserve - bottomReserve, 280);
      // Canvas aspect — what three.js uses for projection.
      const canvasAspect = vpW / vpH;

      // Grid footprint: 5x5 at SPACING_X=3.6, SPACING_Y=3.2, cell radius ~1.4.
      // Half-extents plus a bit of breathing room.
      const gridHalfW = (4 * 3.6) / 2 + 1.6; // ~8.8
      const gridHalfH = (4 * 3.2) / 2 + 1.6; // ~8.0

      // Pick a FOV: wider on narrow/mobile so the grid doesn't need a huge z.
      const fov = vpW < 640 ? 55 : vpW < 900 ? 48 : 42;
      const tanHalf = Math.tan((fov * Math.PI) / 360);

      // We want the grid to fit inside the *usable* region at the focal plane.
      // Visible half-height at distance d = d * tanHalf.
      // Visible half-width at distance d = d * tanHalf * canvasAspect.
      // Fraction of that width that's "usable" (not covered by sidebars)
      // = usableW / vpW. Same for height = usableH / vpH.
      const usableFracW = usableW / vpW;
      const usableFracH = usableH / vpH;
      const distH = gridHalfH / (tanHalf * usableFracH);
      const distW = gridHalfW / (tanHalf * canvasAspect * usableFracW);
      const dist = Math.min(Math.max(distH, distW), 60);

      // Center grid vertically within the usable region. Positive C_y → camera
      // looks at a point above world origin → grid appears below screen center.
      // Desktop has a small banner top → slight downshift. Mobile has a huge
      // bottom sheet → large upshift.
      const verticalShiftPx = (topReserve - bottomReserve) / 2;
      const worldPerPx = (dist * tanHalf * 2) / vpH;
      const offsetY = verticalShiftPx * worldPerPx;

      targetPos.current.set(0, offsetY, dist);
      targetFov.current = fov;
      // Reset up vector — TrackballControls modifies it during free rotation
      camera.up.set(0, 1, 0);
    } else {
      targetPos.current.set(0, 1.5, 11);
      targetFov.current = size.width < 640 ? 44 : 36;
      camera.up.set(0, 1, 0);
    }
    transitioning.current = true;
    transitionStart.current = performance.now();
  }, [view, camera, size.width, size.height]);

  useFrame((_, delta) => {
    if (!transitioning.current) return;
    const elapsed = (performance.now() - transitionStart.current) / 1000;
    // Transition for max 1 second — after that, stop fighting the user controls
    if (elapsed > 1.0) {
      transitioning.current = false;
      return;
    }
    const t = 1 - Math.pow(0.001, delta);
    camera.position.lerp(targetPos.current, t);
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.fov !== undefined) {
      persp.fov += (targetFov.current - persp.fov) * t;
      persp.updateProjectionMatrix();
    }
    if (view === "grid") {
      camera.lookAt(0, targetPos.current.y, 0);
    }
  });

  return null;
}

/* ═══════════════════════════════════════════════════════
   GRID SCENE — 5x5 landing page with simplified mini snapshots
   ═══════════════════════════════════════════════════════ */

function GridScene({ snapshots, hoverIdx, selectedIdx, legendHover, onHover, onSelect }: {
  snapshots: NetworkSnapshot[];
  hoverIdx: number | null;
  selectedIdx: number | null;
  legendHover: string | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const [, forceUpdate] = useState(0);
  // Used for the selected-cell pulse animation.
  const pulseRef = useRef(0);

  // Staggered phase offsets so cells don't rotate in lockstep
  const phaseOffsets = useMemo(() =>
    Array.from({ length: snapshots.length }, () => Math.random() * Math.PI * 2),
  [snapshots.length]);

  useFrame((_, delta) => {
    groupRefs.current.forEach((g) => {
      if (g) g.rotation.y += delta * 0.15;
    });
    pulseRef.current += delta;
    forceUpdate((n) => n + 1);
  });

  // 5x5 grid layout
  const COLS = 5;
  const SPACING_X = 3.6; // world units between cells (horizontal)
  const SPACING_Y = 3.2; // world units between cells (vertical, tighter)

  // Gentle pulse for the selected cell (1.0 ± 0.06)
  const pulse = 1 + Math.sin(pulseRef.current * 3.2) * 0.06;

  return (
    <group position={[0, -0.3, 0]}>
      {/* Grid-wide lighting — shared across all cells */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 10, 15]} intensity={6} color="#FA660F" distance={60} decay={1.5} />
      <pointLight position={[15, -5, 10]} intensity={4} color="#FF8C3A" distance={50} decay={1.5} />
      <pointLight position={[-15, 5, 10]} intensity={4} color="#CC5500" distance={50} decay={1.5} />

      {snapshots.map((snap, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * SPACING_X;
        const y = ((COLS - 1) / 2 - row) * SPACING_Y;
        const isHovered = hoverIdx === i;
        const isSelected = selectedIdx === i;
        // Dim non-hovered cells when hovering. If nothing is hovered but
        // something is selected, dim the non-selected cells.
        const dim = hoverIdx !== null
          ? (isHovered ? 1 : 0.25)
          : selectedIdx !== null
            ? (isSelected ? 1 : 0.45)
            : 1;
        // Selected cell is larger and pulses; hovered cell is larger.
        const baseScale = isSelected ? 0.36 * pulse : isHovered ? 0.32 : 0.28;

        return (
          <group
            key={snap.id}
            position={[x, y, 0]}
            rotation={[0, phaseOffsets[i], 0]}
          >
            {/* Invisible hit target for reliable hover */}
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); onHover(i); }}
              onPointerOut={() => onHover(null)}
              onClick={(e) => { e.stopPropagation(); onSelect(i); }}
            >
              <sphereGeometry args={[1.5, 12, 10]} />
              <meshBasicMaterial colorWrite={false} depthWrite={false} />
            </mesh>

            {/* Selection ring — subtle orange circle around the selected cell */}
            {isSelected && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.3, 1.38, 48]} />
                <meshBasicMaterial color="#FA660F" transparent opacity={0.55 * pulse} side={THREE.DoubleSide} />
              </mesh>
            )}

            <group
              ref={(r) => { groupRefs.current[i] = r; }}
              scale={baseScale}
            >
              <MiniSnapshot snapshot={snap} opacity={dim} highlighted={isHovered || isSelected} legendHover={legendHover} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   MINI SNAPSHOT — simplified version for grid cells
   ═══════════════════════════════════════════════════════ */

function MiniSnapshot({ snapshot: s, opacity: dim, highlighted, legendHover }: {
  snapshot: NetworkSnapshot;
  opacity: number;
  highlighted: boolean;
  legendHover: string | null;
}) {
  const fp = s.feePressureIndex / 10;
  const cg = s.congestionScore / 10;
  const bs = s.blockProductionStress / 10;
  const maxHashrate = 1305.5;
  const maxDifficulty = 150839487445892;
  const maxBtcVolume = 4600000;
  const hrNorm = Math.min(s.networkHashrateEh / maxHashrate, 1);
  const diffLog = s.difficulty > 0 ? Math.log10(s.difficulty) / Math.log10(maxDifficulty) : 0;
  const vol = Math.min(s.btcTransferred / maxBtcVolume, 1);
  const blocks = s.blocks ?? [];

  const feeColors = ["#FF9933", "#FF7722", "#FF5511", "#FF3300"];
  const op = dim * (highlighted ? 1 : 0.85);

  // Legend hover glow boost — matches the keys used in the legend overlay
  const lhGlow = (key: string) => {
    if (!legendHover) return { mult: 1, extra: 0 };
    // fee-0 matches any fee tier highlight
    if (legendHover === "fee-0" && key.startsWith("fee")) return { mult: 1.8, extra: 0.5 };
    if (legendHover === key) return { mult: 1.8, extra: 0.5 };
    return { mult: 1, extra: 0 };
  };
  const spineHl = legendHover === "spine" || highlighted;

  return (
    <group>
      {/* Simplified spine — just a few representative blocks */}
      <MiniSpine blocks={blocks} opacity={op} highlighted={spineHl} />

      {/* Fee tier arcs */}
      {s.feeBuckets.map((bucket, i) => {
        const arcSpan = Math.PI * 2 * bucket.txShare;
        let startAngle = 0;
        for (let j = 0; j < i; j++) startAngle += Math.PI * 2 * s.feeBuckets[j].txShare;
        const thickness = 0.04 + fp * 0.12 + bucket.intensity * 0.08;
        const gap = arcSpan * 0.04;
        const usable = arcSpan - gap;
        if (usable < 0.01) return null;
        const g = lhGlow(`fee-${i}`);
        return (
          <group key={i} position={[0, 0, i * 0.06]}>
            <ArcBand radius={2.2} thickness={thickness} depth={0.05} startAngle={startAngle + gap / 2} endAngle={startAngle + gap / 2 + usable} color={feeColors[i]} emissiveIntensity={(0.3 + bucket.intensity * 0.5 + g.extra) * g.mult} opacity={0.8 * op * g.mult} />
          </group>
        );
      })}

      {/* Settlement */}
      {(() => {
        const stressHealth = 1 - bs;
        const fillAngle = Math.PI * 2 * Math.max(0.05, stressHealth);
        const g = lhGlow("settlement");
        return (
          <group position={[0, 0, -bs * 0.15]}>
            <ArcBand radius={2.8} thickness={0.03 + stressHealth * 0.08} depth={0.05} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#FA660F" emissiveIntensity={(0.25 + stressHealth * 0.5 + g.extra) * g.mult} opacity={0.75 * op * g.mult} />
          </group>
        );
      })()}

      {/* Congestion */}
      {(() => {
        const fillAngle = Math.PI * 2 * Math.max(0.03, cg);
        const g = lhGlow("congestion");
        return (
          <group position={[0, 0, cg * 0.2]}>
            <ArcBand radius={3.3} thickness={0.02 + cg * 0.18} depth={0.05} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#FF4400" emissiveIntensity={(0.2 + cg * 0.8 + g.extra) * g.mult} opacity={(cg > 0.01 ? 0.65 + cg * 0.25 : 0.06) * op * g.mult} />
          </group>
        );
      })()}

      {/* BTC Volume */}
      {(() => {
        const fillAngle = Math.PI * 2 * Math.max(0.02, vol);
        const g = lhGlow("volume");
        return (
          <group position={[0, 0, vol * 0.15]}>
            <ArcBand radius={3.8} thickness={0.02 + vol * 0.14} depth={0.05} startAngle={Math.PI - fillAngle / 2} endAngle={Math.PI + fillAngle / 2} color="#FFB040" emissiveIntensity={(0.2 + vol * 0.6 + g.extra) * g.mult} opacity={(0.4 + vol * 0.4) * op * g.mult} />
          </group>
        );
      })()}

      {/* Hashrate vertical */}
      {(() => {
        const fillAngle = Math.PI * 2 * Math.max(0.02, hrNorm);
        const g = lhGlow("hashrate-ring");
        return (
          <group rotation={[0, Math.PI / 2, 0]}>
            <ArcBand radius={2.5} thickness={0.02 + hrNorm * 0.1} depth={0.04} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#FF7722" emissiveIntensity={(0.2 + hrNorm * 0.6 + g.extra) * g.mult} opacity={(0.5 + hrNorm * 0.35) * op * g.mult} />
          </group>
        );
      })()}

      {/* Difficulty vertical */}
      {(() => {
        const fillAngle = Math.PI * 2 * Math.max(0.02, diffLog);
        const g = lhGlow("difficulty-ring");
        return (
          <group rotation={[Math.PI / 2, 0, 0]}>
            <ArcBand radius={3.0} thickness={0.02 + diffLog * 0.08} depth={0.04} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#CC6600" emissiveIntensity={(0.2 + diffLog * 0.5 + g.extra) * g.mult} opacity={(0.4 + diffLog * 0.4) * op * g.mult} />
          </group>
        );
      })()}

      {/* Simplified particles — address count proxy */}
      <MiniParticles count={Math.min(Math.floor(s.activeAddresses / 8000), 180)} opacity={op} highlighted={legendHover === "particles"} />
    </group>
  );
}

/* Mini particle cloud — reduced count + static positions per cell */
const MINI_PARTICLE_MAX = 180;
function MiniParticles({ count, opacity, highlighted = false }: { count: number; opacity: number; highlighted?: boolean }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(MINI_PARTICLE_MAX * 3);
    for (let i = 0; i < MINI_PARTICLE_MAX; i++) {
      // Distribute around rings — random angle, random radius in 1.8-4.0 range, random y
      const a = Math.random() * Math.PI * 2;
      const r = 1.8 + Math.random() * 2.2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);

  const geoRef = useRef<THREE.BufferGeometry>(null);
  useLayoutEffect(() => {
    if (geoRef.current) geoRef.current.setDrawRange(0, count);
  }, [count]);

  if (count === 0) return null;

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={highlighted ? "#FFFFFF" : "#FFAA55"}
        size={highlighted ? 0.14 : 0.08}
        transparent
        opacity={(highlighted ? 0.95 : 0.5) * opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* Mini spine — reduced instanced mesh for grid cells */
function MiniSpine({ blocks, opacity: blockOpacity, highlighted }: { blocks: BlockTuple[]; opacity: number; highlighted: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = blocks.length || 1;
  const maxTxs = useMemo(() => Math.max(...blocks.map(b => b[3]), 1), [blocks]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || blocks.length === 0) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const spineH = 4;
    const slot = spineH / count;
    const bh = Math.max(0.005, Math.min(0.04, slot * 0.4));

    for (let i = 0; i < count; i++) {
      const [, size, weight, txs] = blocks[i];
      const wNorm = Math.min(weight / 4000000, 1);
      const sNorm = Math.min(size / 2000000, 1);
      const w = 0.03 + wNorm * 0.18;
      const dp = 0.02 + sNorm * 0.12;
      const y = (i - (count - 1) / 2) * slot;
      dummy.position.set(0, y, 0);
      dummy.scale.set(w, bh, dp);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const txNorm = txs / maxTxs;
      const hue = 0.07 - txNorm * 0.03;
      const sat = 0.85 - txNorm * 0.45;
      const light = 0.3 + txNorm * 0.5;
      color.setHSL(hue, sat, light);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, count, maxTxs]);

  if (blocks.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={highlighted ? "#FFD080" : "#FF8C3A"}
        emissive="#FA660F"
        emissiveIntensity={highlighted ? 0.25 : 0.08}
        metalness={0.85}
        roughness={0.15}
        transparent
        opacity={blockOpacity * 0.9}
      />
    </instancedMesh>
  );
}

function PrimeRadiantScene({ snapshot, blocks: currentBlocks, activeGroup, frozen = false, rotationEnabled = true, legendView = false, onHover, onClick, onBlockHover, onRingHover }: SceneProps) {
  const s = snapshot;

  // Target values from snapshot
  const fpTarget = s.feePressureIndex / 10;
  const cgTarget = s.congestionScore / 10;
  const bsTarget = s.blockProductionStress / 10;
  const healthTarget = s.networkHealthScore / 10;
  const maxHashrate = 1305.5;
  const maxDifficulty = 150839487445892;
  const maxBtcVolume = 4600000; // 2021 ATH peak ~4.6M BTC/day raw transfer (Glassnode methodology)
  const hrTarget = Math.min(s.networkHashrateEh / maxHashrate, 1);
  const diffTarget = s.difficulty > 0 ? Math.log10(s.difficulty) / Math.log10(maxDifficulty) : 0;
  const volTarget = Math.min(s.btcTransferred / maxBtcVolume, 1);

  // Animated values — lerp toward targets each frame
  const mpTarget = s.mempoolTxCount;
  const anim = useRef({ fp: fpTarget, cg: cgTarget, bs: bsTarget, health: healthTarget, hr: hrTarget, diff: diffTarget, vol: volTarget, mp: mpTarget, blockAlpha: 1 });
  const prevSnapshotId = useRef(s.id);
  const [, forceUpdate] = useState(0);

  // Detect snapshot change → trigger block fade
  if (prevSnapshotId.current !== s.id) {
    anim.current.blockAlpha = 0;
    prevSnapshotId.current = s.id;
    // Evict old arc geometry cache
    if (arcGeoCache.size > 200) {
      const keys = Array.from(arcGeoCache.keys());
      for (let i = 0; i < 100; i++) { arcGeoCache.get(keys[i])?.dispose(); arcGeoCache.delete(keys[i]); }
    }
  }

  // Slow ambient rotation — pauses when frozen, snaps to front view for legend
  const sceneRef = useRef<THREE.Group>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);
  useFrame((_, delta) => {
    if (sceneRef.current) {
      if (legendView) {
        // Smoothly lerp to front-facing view (y=0)
        sceneRef.current.rotation.y += (0 - sceneRef.current.rotation.y) * Math.min(delta * 4, 1);
      } else if (rotationEnabled && !frozen) {
        sceneRef.current.rotation.y += delta * 0.08;
      }
    }
    // Subtle pulse on core light
    timeRef.current += delta;
    if (coreLightRef.current) {
      coreLightRef.current.intensity = (0.5 + health * 0.5) + Math.sin(timeRef.current * 1.5) * 0.1;
    }

    // Lerp animated values toward targets
    const t = 1 - Math.pow(0.04, delta); // ~3s to settle
    const a = anim.current;
    a.fp += (fpTarget - a.fp) * t;
    a.cg += (cgTarget - a.cg) * t;
    a.bs += (bsTarget - a.bs) * t;
    a.health += (healthTarget - a.health) * t;
    a.hr += (hrTarget - a.hr) * t;
    a.diff += (diffTarget - a.diff) * t;
    a.vol += (volTarget - a.vol) * t;
    a.mp += (mpTarget - a.mp) * t;
    a.blockAlpha += (1 - a.blockAlpha) * t;
    forceUpdate(n => n + 1); // trigger re-render with new lerped values
  });

  // Use animated values for rendering
  const fp = anim.current.fp;
  const cg = anim.current.cg;
  const bs = anim.current.bs;
  const health = anim.current.health;
  const hrNormAnim = anim.current.hr;
  const diffLogAnim = anim.current.diff;
  const volAnim = anim.current.vol;

  // Soft selection: hovered shape gets brighter, nothing else dims
  const glowMult = (gid: string) => activeGroup === gid ? 1.8 : 1;
  const glowExtra = (gid: string) => activeGroup === gid ? 0.5 : 0;

  const feeColors = ["#FF9933", "#FF7722", "#FF5511", "#FF3300"];


  return (
    <group ref={sceneRef} position={[0, 0, 0]} scale={0.85}>
      {/* Three-point lighting for cinematic depth */}
      <ambientLight intensity={0.03 + health * 0.03} />
      {/* Key light — warm orange from front-above */}
      <pointLight position={[0, 3, 6]} intensity={4 + health * 3} color="#FA660F" distance={22} decay={1.8} />
      {/* Fill light — softer, from the side */}
      <pointLight position={[6, 1, 2]} intensity={2} color="#FF8C3A" distance={20} decay={2} />
      {/* Rim light — behind and below for edge separation */}
      <pointLight position={[-4, -4, -3]} intensity={3} color="#CC5500" distance={18} decay={1.8} />
      {/* Core glow — inside the spine, pulses subtly with network health */}
      <pointLight ref={coreLightRef} position={[0, 0, 0]} intensity={0.5 + health * 0.5} color="#FFAA44" distance={4} decay={2.5} />

      {/* Background — no pointer events, just for click-away clearing */}

      {/* ═══ PER-BLOCK SPINE ═══ */}
      <BlockSpine
        blocks={currentBlocks}
        opacity={anim.current.blockAlpha}
        frozen={frozen}
        highlighted={activeGroup === "spine"}
        onHover={onHover}
        onClick={onClick}
        onBlockHover={onBlockHover}
      />

      {/* ═══ FEE TIER ARCS (r=2.2) ═══ */}
      {s.feeBuckets.map((bucket, i) => {
        const gid = `fee-${i}`;
        const g = glowMult(gid);
        const arcSpan = Math.PI * 2 * bucket.txShare;
        let startAngle = 0;
        for (let j = 0; j < i; j++) startAngle += Math.PI * 2 * s.feeBuckets[j].txShare;
        const thickness = 0.04 + fp * 0.12 + bucket.intensity * 0.08;
        const z = i * 0.06;
        const gap = arcSpan * 0.04;
        const usable = arcSpan - gap;
        if (usable < 0.01) return null;
        const r = 2.2;

        return (
          <group key={gid} position={[0, 0, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("fee", i); }}
            onPointerOut={(e) => { onHover(null); if (e.pointerType === "mouse") onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            <ArcBand radius={r} thickness={thickness} depth={0.05 + bucket.intensity * 0.03} startAngle={startAngle + gap / 2} endAngle={startAngle + gap / 2 + usable} color={feeColors[i]} emissiveIntensity={(0.25 + bucket.intensity * 0.6 + glowExtra(gid)) * g} opacity={0.8 * g} />
          </group>
        );
      })}

      {/* ═══ CONGESTION ARC (r=3.3) ═══ */}
      {(() => {
        const gid = "congestion";
        const g = glowMult(gid);
        const fillAngle = Math.PI * 2 * Math.max(0.03, cg);
        const thickness = 0.02 + cg * 0.18;
        const z = cg * 0.2;
        const r = 3.3;
        return (
          <group position={[0, 0, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("congestion"); }}
            onPointerOut={(e) => { onHover(null); if (e.pointerType === "mouse") onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            <ArcBand radius={r} thickness={thickness} depth={0.05 + cg * 0.04} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#FF4400" emissiveIntensity={(0.2 + cg * 0.8 + glowExtra(gid)) * g} opacity={(cg > 0.01 ? 0.65 + cg * 0.25 : 0.06) * g} />
          </group>
        );
      })()}

      {/* ═══ SETTLEMENT ARC (r=2.8) ═══ */}
      {(() => {
        const gid = "settlement";
        const g = glowMult(gid);
        const stressHealth = 1 - bs;
        const fillAngle = Math.PI * 2 * Math.max(0.05, stressHealth);
        const thickness = 0.03 + stressHealth * 0.08;
        const z = -bs * 0.15;
        const r = 2.8;
        return (
          <group position={[0, 0, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("settlement"); }}
            onPointerOut={(e) => { onHover(null); if (e.pointerType === "mouse") onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            <ArcBand radius={r} thickness={thickness} depth={0.05} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#FA660F" emissiveIntensity={(0.25 + stressHealth * 0.5 + glowExtra(gid)) * g} opacity={0.75 * g} />
          </group>
        );
      })()}

      {/* ═══ BTC VOLUME ARC (r=3.8) — daily BTC transferred ═══ */}
      {(() => {
        const gid = "volume";
        const g = glowMult(gid);
        const vol = volAnim;
        const fillAngle = Math.PI * 2 * Math.max(0.02, vol);
        const thickness = 0.02 + vol * 0.14;
        const r = 3.8;
        return (
          <group position={[0, 0, vol * 0.15]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("volume"); }}
            onPointerOut={(e) => { onHover(null); if (e.pointerType === "mouse") onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            <ArcBand radius={r} thickness={thickness} depth={0.05 + vol * 0.03} startAngle={Math.PI - fillAngle / 2} endAngle={Math.PI + fillAngle / 2} color="#FFB040" emissiveIntensity={(0.2 + vol * 0.6 + glowExtra(gid)) * g} opacity={(0.4 + vol * 0.4) * g} />
          </group>
        );
      })()}

      {/* ═══ HASHRATE ARC — vertical ring (YZ plane, r=2.5) ═══ */}
      {(() => {
        const gid = "hashrate-ring";
        const g = glowMult(gid);
        const hrNorm = hrNormAnim;
        const fillAngle = Math.PI * 2 * Math.max(0.02, hrNorm);
        const thickness = 0.02 + hrNorm * 0.1;
        const r = 2.5;
        return (
          <group rotation={[0, Math.PI / 2, 0]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("hashrate"); }}
            onPointerOut={(e) => { onHover(null); if (e.pointerType === "mouse") onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            <ArcBand radius={r} thickness={thickness} depth={0.04 + hrNorm * 0.02} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#FF7722" emissiveIntensity={(0.2 + hrNorm * 0.6 + glowExtra(gid)) * g} opacity={(0.5 + hrNorm * 0.35) * g} />
          </group>
        );
      })()}

      {/* ═══ DIFFICULTY ARC — vertical ring (XZ plane, r=3.0) ═══ */}
      {(() => {
        const gid = "difficulty-ring";
        const g = glowMult(gid);
        // Log scale: difficulty spans 1 to 150T — linear would make early eras invisible
        const diffLog = diffLogAnim;
        const fillAngle = Math.PI * 2 * Math.max(0.02, diffLog);
        const thickness = 0.02 + diffLog * 0.08;
        const r = 3.0;
        return (
          <group rotation={[Math.PI / 2, 0, 0]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(gid); onRingHover("difficulty"); }}
            onPointerOut={(e) => { onHover(null); if (e.pointerType === "mouse") onRingHover(null); }}
            onClick={(e) => { e.stopPropagation(); onClick(gid); }}
          >
            <ArcBand radius={r} thickness={thickness} depth={0.04 + diffLog * 0.02} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#CC6600" emissiveIntensity={(0.2 + diffLog * 0.5 + glowExtra(gid)) * g} opacity={(0.4 + diffLog * 0.4) * g} />
          </group>
        );
      })()}

      {/* Track lines removed — cleaner look */}

      {/* ═══ ADDRESS PARTICLES — count driven by activeAddresses ═══ */}
      <AddressParticles
        count={Math.min(Math.floor(s.activeAddresses / 1000), 1500)}
        whaleRatio={s.activeAddresses > 0 ? (s.whaleOutputs1000 + s.whaleOutputs100) / Math.max(s.totalOutputs, 1) : 0}
        paused={!rotationEnabled || frozen}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   ADDRESS PARTICLES — count = activeAddresses / 5000
   Data-honest: 0 addresses = 0 particles
   Whale ratio drives size: more whales = larger bright particles
   ═══════════════════════════════════════════════════════ */

const MAX_PARTICLES = 1500;

function AddressParticles({ count, whaleRatio, paused = false }: { count: number; whaleRatio: number; paused?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const dataRef = useRef<{ angles: Float32Array; speeds: Float32Array; radii: Float32Array; yOffsets: Float32Array; yDrift: Float32Array } | null>(null);

  useMemo(() => {
    const angles = new Float32Array(MAX_PARTICLES);
    const speeds = new Float32Array(MAX_PARTICLES);
    const radii = new Float32Array(MAX_PARTICLES);
    const yOffsets = new Float32Array(MAX_PARTICLES);
    const yDrift = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.05 + Math.random() * 0.18;
      radii[i] = 1.5 + Math.random() * 2.5; // spread across all ring radii
      yOffsets[i] = (Math.random() - 0.5) * 4;
      yDrift[i] = (Math.random() - 0.5) * 0.1;
    }
    dataRef.current = { angles, speeds, radii, yOffsets, yDrift };
  }, []);

  const positions = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const sizes = useMemo(() => new Float32Array(MAX_PARTICLES), []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !dataRef.current || count === 0) return;
    const { angles, speeds, radii, yOffsets, yDrift } = dataRef.current;
    const pos = pointsRef.current.geometry.attributes.position;
    const sizeAttr = pointsRef.current.geometry.attributes.size;

    for (let i = 0; i < count; i++) {
      if (!paused) {
        angles[i] += speeds[i] * delta;
        yOffsets[i] += yDrift[i] * delta;
        if (yOffsets[i] > 2.5) yOffsets[i] = -2.5;
        if (yOffsets[i] < -2.5) yOffsets[i] = 2.5;
      }

      const rr = radii[i] + Math.sin(angles[i] * 2) * 0.1;
      (pos.array as Float32Array)[i * 3] = Math.cos(angles[i]) * rr;
      (pos.array as Float32Array)[i * 3 + 1] = yOffsets[i];
      (pos.array as Float32Array)[i * 3 + 2] = Math.sin(angles[i]) * rr;

      // First few % of particles are "whales" — bigger
      const isWhale = i < count * Math.min(whaleRatio * 10, 0.15);
      (sizeAttr.array as Float32Array)[i] = isWhale ? 0.06 : 0.02;
    }
    pos.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    pointsRef.current.geometry.setDrawRange(0, count);
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color="#FFAA55"
        size={0.035}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* ═══════════════════════════════════════════════════════
   ARC BAND — smooth ring segment using ExtrudeGeometry
   ═══════════════════════════════════════════════════════ */

const arcGeoCache = new Map<string, THREE.ExtrudeGeometry>();

function makeArcGeo(radius: number, thickness: number, depth: number, startAngle: number, endAngle: number) {
  const key = `${radius.toFixed(2)}_${thickness.toFixed(3)}_${depth.toFixed(3)}_${startAngle.toFixed(3)}_${endAngle.toFixed(3)}`;
  const cached = arcGeoCache.get(key);
  if (cached) return cached;

  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  const segments = Math.max(12, Math.round(Math.abs(endAngle - startAngle) / (Math.PI * 2) * 64));
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * (endAngle - startAngle);
    if (i === 0) shape.moveTo(Math.cos(a) * outer, Math.sin(a) * outer);
    else shape.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
  }
  for (let i = segments; i >= 0; i--) {
    const a = startAngle + (i / segments) * (endAngle - startAngle);
    shape.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
  }
  shape.closePath();
  const bevelT = Math.min(depth * 0.3, 0.008);
  const bevelS = Math.min(thickness * 0.08, 0.006);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bevelS,
    bevelSegments: 2,
  });
  arcGeoCache.set(key, g);
  return g;
}

function ArcBand({ radius, thickness, depth, startAngle, endAngle, color, emissiveIntensity, opacity }: {
  radius: number; thickness: number; depth: number;
  startAngle: number; endAngle: number;
  color: string; emissiveIntensity: number; opacity: number;
}) {
  const geo = useMemo(() => makeArcGeo(radius, thickness, depth, startAngle, endAngle), [radius, thickness, depth, startAngle, endAngle]);
  // Thicker invisible hit area for easier mouse interaction
  // Hit padding kept modest so background taps between rings aren't captured.
  const hitGeo = useMemo(() => makeArcGeo(radius, Math.max(thickness * 1.8, 0.09), depth * 2, startAngle, endAngle), [radius, thickness, depth, startAngle, endAngle]);

  return (
    <group>
      {/* Invisible hit mesh — fat target for raycasting */}
      <mesh geometry={hitGeo} position={[0, 0, -depth * 1.5]}>
        <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Visible arc */}
      <mesh geometry={geo} position={[0, 0, -depth / 2]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.6}
          roughness={0.18}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          envMapIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   PER-BLOCK SPINE — InstancedMesh with real block data
   ═══════════════════════════════════════════════════════ */

function blockColor(txNorm: number, color: THREE.Color) {
  const hue = 0.07 - txNorm * 0.03;
  const sat = 0.85 - txNorm * 0.45;
  const light = 0.3 + txNorm * 0.5;
  color.setHSL(hue, sat, light);
}

function BlockSpine({ blocks, opacity: blockOpacity = 1, frozen = false, highlighted = false, onHover, onClick, onBlockHover }: {
  blocks: BlockTuple[];
  opacity?: number;
  frozen?: boolean;
  highlighted?: boolean;
  onHover: (gid: string | null) => void;
  onClick: (gid: string) => void;
  onBlockHover: (block: BlockTuple | null, index: number) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredRef = useRef<number>(-1);
  const count = blocks.length || 1;
  const maxTxs = useMemo(() => Math.max(...blocks.map(b => b[3]), 1), [blocks]);

  // useLayoutEffect: set matrices synchronously before paint to prevent identity-matrix flash
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || blocks.length === 0) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    hoveredRef.current = -1;

    const spineH = 4;
    const slot = spineH / count;
    const bh = Math.max(0.005, Math.min(0.04, slot * 0.4));

    for (let i = 0; i < count; i++) {
      const [, size, weight, txs] = blocks[i];
      const wNorm = Math.min(weight / 4000000, 1);
      const sNorm = Math.min(size / 2000000, 1);

      const w = 0.03 + wNorm * 0.18;
      const dp = 0.02 + sNorm * 0.12;

      const y = (i - (count - 1) / 2) * slot;
      dummy.position.set(0, y, 0);
      dummy.scale.set(w, bh, dp);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      blockColor(txs / maxTxs, color);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, count, maxTxs]);

  // Highlight: color to white + scale up 2.5x for visibility
  const origMatrix = useRef(new THREE.Matrix4());
  const highlightInstance = useCallback((idx: number) => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.instanceColor) return;
    const prev = hoveredRef.current;
    const color = new THREE.Color();
    const dummy = new THREE.Object3D();

    // Restore previous
    if (prev >= 0 && prev < blocks.length) {
      blockColor(blocks[prev][3] / maxTxs, color);
      mesh.setColorAt(prev, color);
      mesh.setMatrixAt(prev, origMatrix.current);
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Highlight new
    if (idx >= 0 && idx < blocks.length) {
      // Save original matrix
      mesh.getMatrixAt(idx, origMatrix.current);
      // Scale up
      const m = origMatrix.current.clone();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      m.decompose(pos, quat, scl);
      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.set(scl.x * 2.5, scl.y * 2.5, scl.z * 2.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;

      color.set("#FFFFFF");
      mesh.setColorAt(idx, color);
    }

    hoveredRef.current = idx;
    mesh.instanceColor.needsUpdate = true;
  }, [blocks, maxTxs]);

  if (blocks.length === 0) return null;

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover("spine"); }}
      onPointerOut={(e) => {
        onHover(null);
        // On touch, leave the block selection in place — it should only be
        // cleared by a background tap or a new selection. Desktop mouse still
        // clears on hover-out when not pinned.
        if (e.pointerType === "mouse" && !frozen) {
          onBlockHover(null, 0);
          highlightInstance(-1);
        }
      }}
      onClick={(e) => { e.stopPropagation(); onClick("spine"); }}
    >
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerMove={(e) => {
          if (e.instanceId !== undefined && e.instanceId < blocks.length) {
            onBlockHover(blocks[e.instanceId], e.instanceId);
            highlightInstance(e.instanceId);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && e.instanceId < blocks.length) {
            onBlockHover(blocks[e.instanceId], e.instanceId);
            highlightInstance(e.instanceId);
          }
          // Also fire the group-level click so the spine pins/pauses just
          // like before. The outer group's onClick is shadowed by this
          // stopPropagation, so we invoke its handler manually.
          onClick("spine");
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={highlighted ? "#FFD080" : "#FF8C3A"}
          emissive={highlighted ? "#FFAA44" : "#FA660F"}
          emissiveIntensity={highlighted ? 0.4 : 0.1}
          metalness={0.85}
          roughness={0.1}
          transparent
          opacity={(highlighted ? 1.0 : 0.95) * blockOpacity}
          envMapIntensity={0.4}
        />
      </instancedMesh>
    </group>
  );
}

export default App;
