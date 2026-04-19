import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import * as THREE from "three";
import { staticSnapshots } from "./data/staticSnapshots";
import { loadSnapshots, loadBlocksForDate, loadAllBlocks } from "./db";
import type { NetworkSnapshot, BlockTuple } from "./types";

/* ═══════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════ */

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
  // Start with static fallback, upgrade to DuckDB data if parquet is present
  const [snapshots, setSnapshots] = useState<NetworkSnapshot[]>(staticSnapshots);
  const [activeIdx, setActiveIdx] = useState(0);
  const baseSnapshot = snapshots[Math.min(activeIdx, snapshots.length - 1)];
  // False until the parquet load attempt settles (success or fail). Used to
  // avoid flashing the static 25-snapshot count before the real 105 lands.
  const [snapshotsSettled, setSnapshotsSettled] = useState(false);

  useEffect(() => {
    loadSnapshots().then((loaded) => {
      if (loaded && loaded.length > 0) setSnapshots(loaded);
    }).catch((e) => { console.error("[App] loadSnapshots threw:", e); })
    .finally(() => setSnapshotsSettled(true));
  }, []);

  // Blocks: pre-baked if present, otherwise fetched from blocks.parquet. On
  // mount we pull the full blocks table in one query and index by date so
  // every grid cell has its crown from the start.
  const [blocksByDate, setBlocksByDate] = useState<Record<string, BlockTuple[]>>({});
  useEffect(() => {
    loadAllBlocks().then((all) => {
      if (Object.keys(all).length > 0) setBlocksByDate(all);
    }).catch((e) => console.error("[App] loadAllBlocks threw:", e));
  }, []);

  // Inject blocks into every snapshot so downstream components (grid cells,
  // detail view) all just read snap.blocks without needing prop drilling.
  const snapshotsWithBlocks = useMemo<NetworkSnapshot[]>(() => {
    return snapshots.map((s) => {
      if (s.blocks && s.blocks.length > 0) return s;
      const date = s.snapshotTime.slice(0, 10);
      const blocks = blocksByDate[date];
      if (!blocks || blocks.length === 0) return s;
      return { ...s, blocks };
    });
  }, [snapshots, blocksByDate]);
  const activeDate = baseSnapshot.snapshotTime.slice(0, 10);
  // Fallback: if the bulk load missed the active date, fetch per-date.
  useEffect(() => {
    if ((baseSnapshot.blocks && baseSnapshot.blocks.length > 0) || blocksByDate[activeDate]) return;
    loadBlocksForDate(activeDate).then((blocks) => {
      if (blocks.length > 0) setBlocksByDate((prev) => ({ ...prev, [activeDate]: blocks }));
    }).catch((e) => console.error("[App] loadBlocksForDate threw:", e));
  }, [activeDate, baseSnapshot.blocks, blocksByDate]);
  const currentBlocks: BlockTuple[] = baseSnapshot.blocks && baseSnapshot.blocks.length > 0
    ? baseSnapshot.blocks
    : (blocksByDate[activeDate] ?? []);

  // All displayed values come directly from the snapshot — no overrides.
  const effectiveSnapshot = baseSnapshot;

  // Search / filter — parses multi-qualifier queries. Every token is ANDed
  // with text and OR'd across date tokens.
  //   YYYY                         single year          (2024)
  //   YYYY-YYYY                    year range inclusive (2020-2023)
  //   YYYY-MM                      single month         (2020-03)
  //   YYYY-MM-DD                   single date          (2020-03-12)
  //   YYYY-MM-DD..YYYY-MM-DD       date range           (2020-03-01..2020-06-30)
  //   today                        today's date
  //   <X> to <Y>                   range from X to Y    (e.g. "2025-11 to today")
  //   anything else                free-text substring of label/id
  const [searchQuery, setSearchQuery] = useState("");
  const matchedIndices = useMemo<Set<number> | null>(() => {
    const raw = searchQuery.trim();
    if (!raw) return null;

    const todayISO = new Date().toISOString().slice(0, 10);
    // Resolve a "boundary" token (year / month / date / today) to an ISO date,
    // expanding years/months to the first or last day based on which side of a
    // range it sits on.
    const resolveBoundary = (tok: string, side: "from" | "to"): string | null => {
      if (tok === "today") return todayISO;
      if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) return tok;
      let m = tok.match(/^(\d{4})-(\d{2})$/);
      if (m) {
        if (side === "from") return `${tok}-01`;
        const lastDay = new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate();
        return `${tok}-${String(lastDay).padStart(2, "0")}`;
      }
      if (/^\d{4}$/.test(tok)) return side === "from" ? `${tok}-01-01` : `${tok}-12-31`;
      return null;
    };

    // Tokenize, then compact "<X> to <Y>" triples into a single "X..Y" token
    const rawTokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const tokens: string[] = [];
    for (let i = 0; i < rawTokens.length; i++) {
      if (i + 2 < rawTokens.length && rawTokens[i + 1] === "to") {
        const from = resolveBoundary(rawTokens[i], "from");
        const to   = resolveBoundary(rawTokens[i + 2], "to");
        if (from && to) {
          tokens.push(`${from}..${to}`);
          i += 2;
          continue;
        }
      }
      tokens.push(rawTokens[i]);
    }

    const dateRanges: Array<[string, string]> = [];
    const textTokens: string[] = [];

    for (const t of tokens) {
      let m: RegExpMatchArray | null;
      if ((m = t.match(/^(.+)\.\.(.+)$/))) {
        const from = resolveBoundary(m[1], "from");
        const to   = resolveBoundary(m[2], "to");
        if (from && to) {
          const [lo, hi] = from <= to ? [from, to] : [to, from];
          dateRanges.push([lo, hi]);
          continue;
        }
      }
      if (t === "today") { dateRanges.push([todayISO, todayISO]); continue; }
      if ((m = t.match(/^(\d{4})-(\d{4})$/))) {
        const [lo, hi] = +m[1] <= +m[2] ? [m[1], m[2]] : [m[2], m[1]];
        dateRanges.push([`${lo}-01-01`, `${hi}-12-31`]);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        dateRanges.push([t, t]);
      } else if ((m = t.match(/^(\d{4})-(\d{2})$/))) {
        const y = m[1], mo = m[2];
        const lastDay = new Date(Date.UTC(+y, +mo, 0)).getUTCDate();
        dateRanges.push([`${y}-${mo}-01`, `${y}-${mo}-${String(lastDay).padStart(2, "0")}`]);
      } else if (/^\d{4}$/.test(t)) {
        dateRanges.push([`${t}-01-01`, `${t}-12-31`]);
      } else {
        textTokens.push(t);
      }
    }

    const out = new Set<number>();
    snapshots.forEach((s, i) => {
      const date = s.snapshotTime.slice(0, 10);
      if (dateRanges.length > 0 && !dateRanges.some(([lo, hi]) => date >= lo && date <= hi)) return;
      if (textTokens.length > 0) {
        const hay = `${s.label} ${s.id}`.toLowerCase();
        if (!textTokens.every((tok) => hay.includes(tok))) return;
      }
      out.add(i);
    });
    return out;
  }, [searchQuery, snapshots]);

  // Hover/selection state
  const [hoverCtx, setHoverCtx] = useState<HoverContext>({ type: "none" });
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showDataInfo, setShowDataInfo] = useState(false);
  const [searchHelpOpen, setSearchHelpOpen] = useState(false);
  // Legacy legend state — the standalone legend modal was replaced by a tab
  // in the Info modal, but these values are still referenced by scene props.
  // Setters are intentionally unused.
  const [showLegend] = useState(false);
  const [legendHover] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "detail">("grid");
  // TrackballControls fights the transition lerp when both run the same frame
  // (its per-frame lookAt overrides ours, causing a visible jump mid-fade).
  // Delay mounting the controls until the 1-second transition finishes.
  const [controlsReady, setControlsReady] = useState(false);
  useEffect(() => {
    if (view !== "detail") { setControlsReady(false); return; }
    const id = setTimeout(() => setControlsReady(true), 1050);
    return () => clearTimeout(id);
  }, [view]);
  // Two-source hover: timeline-item hover drives the camera (grid pane scrolls
  // to the row). Grid-cell hover drives the timeline (auto-scrolls the list).
  // Merged into `gridHoverIdx` for consumers that just need "anything hovered"
  // (right KPI panel, grid cell highlight, etc.).
  const [timelineHoverIdx, setTimelineHoverIdx] = useState<number | null>(null);
  const [cellHoverIdx, setCellHoverIdx] = useState<number | null>(null);
  const gridHoverIdx = timelineHoverIdx ?? cellHoverIdx;
  // Grid-view selection: first tap previews, second tap (on same cell) enters detail
  const [gridSelectedIdx, setGridSelectedIdx] = useState<number | null>(null);
  const [showGuideTab, setShowGuideTab] = useState<"about" | "legend" | "visual" | "source">("about");

  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const preClickState = useRef({ wasPlaying: false, wasRotating: true });
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(playing);
  playRef.current = playing;
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const rotationRef = useRef(rotationEnabled);
  rotationRef.current = rotationEnabled;
  // Grid-mode orbit is disabled — row scrolling is the grid's native
  // interaction and TrackballControls over a 21-row-tall scrollable grid
  // never produced a usable view. Orbit remains available in detail view.
  const gridOrbitEnabled = false;

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
        if (next >= snapshots.length) {
          setPlaying(false);
          return prev;
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [playing]);

  // Narration: show on every snapshot change
  const [showNarration, setShowNarration] = useState(true);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);

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

  // Refs for auto-scrolling the timeline to the currently focused item
  const timelineRef = useRef<HTMLDivElement>(null);
  const tlItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // True while the mouse is inside the timeline itself — we suppress
  // auto-scroll in that case since the user is already looking at the row
  // their cursor is on, and re-scrolling would yank the cell out from under.
  const timelineHovered = useRef(false);
  // In grid view, follow hover (desktop) or selected (mobile) or active.
  // In detail view, always follow activeIdx.
  // Timeline auto-scroll follows cell hover (so hovering a grid cell brings
  // its entry into view) or the current selection if nothing is hovered.
  const scrollTargetIdx = view === "grid"
    ? (cellHoverIdx ?? gridSelectedIdx ?? activeIdx)
    : activeIdx;
  useEffect(() => {
    if (timelineHovered.current) return;
    const container = timelineRef.current;
    const item = tlItemRefs.current[scrollTargetIdx];
    if (!container || !item) return;
    const horizontal = container.scrollWidth > container.clientWidth + 1;
    if (horizontal) {
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const itemOffsetLeft = itemRect.left - containerRect.left + container.scrollLeft;
      const itemRight = itemOffsetLeft + item.clientWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      // Only scroll if item is outside the visible viewport. Prevents the
      // jumpiness that happens when hovering across adjacent cells — if
      // the target is already visible, no re-centering is needed.
      if (itemOffsetLeft < viewLeft + 8 || itemRight > viewRight - 8) {
        const target = itemOffsetLeft - (container.clientWidth - item.clientWidth) / 2;
        container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      }
    } else {
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const itemTop = itemRect.top - containerRect.top + container.scrollTop;
      const itemBottom = itemTop + item.clientHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      // Only scroll if item is outside the visible area — avoids jitter.
      if (itemTop < viewTop || itemBottom > viewBottom) {
        const target = itemTop - (container.clientHeight - item.clientHeight) / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      }
    }
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
        <CameraRig view={view} snapCount={snapshots.length} focusIdx={timelineHoverIdx ?? gridSelectedIdx} gridOrbitEnabled={gridOrbitEnabled} />
        {view === "grid" ? (snapshotsSettled ? (
          <GridScene
            snapshots={snapshotsWithBlocks}
            hoverIdx={gridHoverIdx}
            selectedIdx={gridSelectedIdx}
            matchedIndices={matchedIndices}
            legendHover={legendHover}
            onHover={setCellHoverIdx}
            onSelect={(i) => {
              // Mobile: first tap previews (updates sheet + highlights cell),
              // second tap on the same cell enters detail. Desktop: single
              // click enters detail directly.
              if (isMobile && gridSelectedIdx !== i) {
                setGridSelectedIdx(i);
              } else {
                setActiveIdx(i);
                setGridSelectedIdx(i);
                setView("detail");
                setCellHoverIdx(null);
                setTimelineHoverIdx(null);
              }
            }}
          />
        ) : null) : (
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
        {view === "detail" && controlsReady && <TrackballControls noPan={false} noZoom={false} noRotate={false} minDistance={0.3} maxDistance={60} rotateSpeed={2} zoomSpeed={1.5} panSpeed={0.8} />}
      </Canvas>

      {/* ═══ TOP BANNER ═══ */}
      <div className="hud hud-banner">
        <h1 className="hud-title">The Bitcoin Network as Data Driven Geometry</h1>
      </div>

      {/* ═══ GRID VIEW SUBTITLE ═══ */}
      {view === "grid" && (
        <div className="hud grid-subtitle">
          {!snapshotsSettled
            ? "Loading historical snapshots…"
            : isMobile
              ? `${snapshots.length} snapshots · tap a cell to select, double-tap to explore`
              : `${snapshots.length} historical snapshots · hover any in the timeline or click to explore`}
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

          {/* Play button — middle. From grid view, always starts from Genesis
              and switches into detail view. From detail view, resumes from the
              current snapshot (or restarts if already at the end). */}
          <button
            className="timeline-play-btn"
            onClick={() => {
              if (playing) {
                setPlaying(false);
                setRotationEnabled(false);
                return;
              }
              setPinnedGroup(null);
              setActiveGroup(null);
              const startIdx = view === "grid"
                ? 0
                : (activeIdx >= snapshots.length - 1 ? 0 : activeIdx);
              setActiveIdx(startIdx);
              if (view === "grid") {
                setCellHoverIdx(null);
                setTimelineHoverIdx(null);
                setGridSelectedIdx(null);
                setView("detail");
              }
              setPlaying(true);
              setRotationEnabled(true);
            }}
            type="button"
          >
            {playing ? "❚❚" : "▶"} {playing ? "Pause" : "Play"}
          </button>

          {/* Rotate button — detail view only. Toggles ambient rotation.
              Disabled in grid view (orbit proved impractical over a
              21-row scrollable grid). */}
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

        <div className="timeline-search">
          <svg className="timeline-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>
          <input
            type="text"
            placeholder="Search name, year, or range…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search snapshots"
          />
          {searchQuery && (
            <button
              className="timeline-search-clear"
              onClick={() => setSearchQuery("")}
              type="button"
              aria-label="Clear search"
            >×</button>
          )}
          <button
            className={`timeline-search-help ${searchHelpOpen ? "open" : ""}`}
            onClick={() => setSearchHelpOpen((v) => !v)}
            type="button"
            aria-label="Search syntax help"
            aria-expanded={searchHelpOpen}
          >?</button>
        </div>
        {searchHelpOpen && (
          <div className="timeline-search-hints" role="tooltip">
            <div className="hints-title">Search syntax</div>
            <dl>
              <dt>Name</dt><dd><code>halving</code> · <code>mt gox</code></dd>
              <dt>Year</dt><dd><code>2024</code></dd>
              <dt>Year range</dt><dd><code>2020-2023</code></dd>
              <dt>Month</dt><dd><code>2020-03</code></dd>
              <dt>Date</dt><dd><code>2020-03-12</code></dd>
              <dt>Precise range</dt><dd><code>2020-03-01..2020-06-30</code></dd>
              <dt>Natural range</dt><dd><code>2017 to 2021</code> · <code>2025-11 to today</code></dd>
              <dt>Combine</dt><dd><code>halving 2024 to today</code></dd>
            </dl>
            <div className="hints-note">Text terms are AND'd; date terms are OR'd. Use space to separate.</div>
          </div>
        )}
        {matchedIndices !== null && (
          <div className="timeline-search-count">
            {matchedIndices.size} of {snapshots.length}
          </div>
        )}

        <div
          className="timeline-vertical"
          ref={timelineRef}
          onMouseEnter={() => { timelineHovered.current = true; }}
          onMouseLeave={() => { timelineHovered.current = false; }}
        >
          {matchedIndices !== null && matchedIndices.size === 0 ? (
            <div className="timeline-search-empty">No snapshots match “{searchQuery}”.</div>
          ) : (
            snapshots.map((snap, i) => {
              if (matchedIndices !== null && !matchedIndices.has(i)) return null;
              // Active in grid view tracks hover (desktop) or selected (mobile).
              // Active in detail view tracks the currently-viewed date.
              const gridActiveIdx = gridHoverIdx ?? gridSelectedIdx;
              const isActive = view === "grid" ? gridActiveIdx === i : i === activeIdx;
              return (
                <button
                  key={snap.id}
                  ref={(el) => { tlItemRefs.current[i] = el; }}
                  className={`tl-item ${isActive ? "active" : ""}`}
                  onMouseEnter={() => { if (view === "grid") setTimelineHoverIdx(i); }}
                  onMouseLeave={() => { if (view === "grid") setTimelineHoverIdx(null); }}
                  onClick={() => {
                    if (view === "grid") {
                      setActiveIdx(i);
                      setGridSelectedIdx(i);
                      setView("detail");
                      setTimelineHoverIdx(null);
                      setCellHoverIdx(null);
                    } else {
                      setActiveIdx(i); clearSelection(); setPlaying(false);
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
            })
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Context KPIs ═══ */}
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
          {!mobileSheetExpanded && (
            <span className="handle-title">
              {selectionLabel ?? "Tap to see more"}
            </span>
          )}
          {mobileSheetExpanded && <span className="handle-title handle-title-min">Close</span>}
          <button
            className="handle-info-btn"
            onClick={(e) => { e.stopPropagation(); setShowGuideTab("about"); setShowDataInfo(true); }}
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
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="5" height="3" rx="0.5" fill="#FFB547"/><line x1="8" y1="3.5" x2="15" y2="3.5" stroke="#777" strokeWidth="1.2"/><circle cx="3.5" cy="8.5" r="1.8" stroke="#F7931A" strokeWidth="1.2" fill="none"/><line x1="8" y1="8.5" x2="15" y2="8.5" stroke="#777" strokeWidth="1.2"/><circle cx="3.5" cy="13.5" r="1" fill="#FFCA6E"/><line x1="8" y1="13.5" x2="15" y2="13.5" stroke="#777" strokeWidth="1.2"/></svg>
            Legend
          </button>
          <button
            className="panel-header-btn"
            onClick={() => { setShowGuideTab("about"); setShowDataInfo(true); }}
            type="button"
          >
            <span className="info-icon">i</span> Info
          </button>
        </div>

        <div className={`context-panel ${view === "grid" ? "context-full" : ""}`}>
          {/* Mobile-only: embed the narration at the top of the sheet content */}
          {view === "detail" && (NARRATION[baseSnapshot.id] ?? baseSnapshot.narration) && (
            <div className="mobile-narration">
              <span className="mobile-narration-label">Context</span>
              <p>{NARRATION[baseSnapshot.id] ?? baseSnapshot.narration}</p>
            </div>
          )}
          <ContextPanel
            snapshot={
              view === "grid"
                ? snapshots[gridHoverIdx ?? gridSelectedIdx ?? activeIdx]
                : s
            }
            hoverCtx={view === "grid" ? { type: "none" } : hoverCtx}
            blocks={
              view === "grid"
                ? (snapshots[gridHoverIdx ?? gridSelectedIdx ?? activeIdx]?.blocks ?? [])
                : currentBlocks
            }
          />
        </div>
      </div>

      {/* ═══ NARRATION BUBBLE ═══ */}
      {view === "detail" && showNarration && (NARRATION[baseSnapshot.id] ?? baseSnapshot.narration) && (
        <div className="narration-bar">
          <div className="narration-content">
            <span className="narration-label">{baseSnapshot.label}</span>
            <p className="narration-text">{NARRATION[baseSnapshot.id] ?? baseSnapshot.narration}</p>
          </div>
          <button className="narration-close" onClick={() => setShowNarration(false)} type="button" title="Hide narration">✕</button>
        </div>
      )}

      {/* ═══ INFO / VISUAL GUIDE MODAL ═══ */}
      {showDataInfo && (
        <div className="guide-overlay" onClick={() => setShowDataInfo(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="guide-tabs">
              <button className={`guide-tab ${showGuideTab === "about" ? "active" : ""}`} onClick={() => setShowGuideTab("about")} type="button">About</button>
              <button className={`guide-tab ${showGuideTab === "legend" ? "active" : ""}`} onClick={() => setShowGuideTab("legend")} type="button">Legend</button>
              <button className={`guide-tab ${showGuideTab === "visual" ? "active" : ""}`} onClick={() => setShowGuideTab("visual")} type="button">How to Read</button>
              <button className={`guide-tab ${showGuideTab === "source" ? "active" : ""}`} onClick={() => setShowGuideTab("source")} type="button">Sources</button>
            </div>

            {showGuideTab === "about" && (
              <div className="guide-body">
                <div className="guide-section">
                  <h4 className="guide-section-title">What this is</h4>
                  <p className="guide-paragraph">
                    A <strong>data-driven portrait</strong> of the Bitcoin network at specific moments —
                    halvings, halts, booms, busts, hacks, bans, ATHs. Each of the {snapshots.length} snapshots
                    is a three-dimensional reading of one day's network state: how many blocks were mined,
                    how full they were, what fees were paid, how much BTC moved, who was mining.
                  </p>
                </div>

                <div className="guide-section">
                  <h4 className="guide-section-title">The rule</h4>
                  <p className="guide-paragraph">
                    <em>Every shape maps to a real number.</em> Nothing in the scene is decorative —
                    if it renders, it's tied to a specific metric pulled from a public, free-to-access
                    source. No synthetic data, no smoothing for aesthetics, no filler geometry. Calm days
                    look calm because the network was calm; crisis days look tortured because it was.
                  </p>
                </div>

                <div className="guide-section">
                  <h4 className="guide-section-title">How to explore</h4>
                  <p className="guide-paragraph">
                    Start with the <strong>Legend</strong> to learn what each element represents, then
                    <strong> How to Read</strong> to see how data moves the geometry. Scrub through
                    history with the timeline, search by year or event, or orbit and zoom the scene
                    directly to inspect a particular moment up close.
                  </p>
                </div>
              </div>
            )}

            {showGuideTab === "legend" && (
              <div className="guide-body">
                <p className="guide-lede">
                  Every shape in the scene maps to one real metric. Here's what each element is
                  and which number drives it.
                </p>

                <div className="guide-section">
                  <h4 className="guide-section-title">Elements of the scene</h4>
                  <div className="guide-cards">
                    {[
                      { icon: <span className="legend-block" />, name: "Block Crown", desc: "A radial ring of spikes at the center — one spike per block mined that day.", meta: "Spike length ← block weight (up to 4 MWU) · Brightness ← transaction count" },
                      { icon: <span className="legend-line" style={{ background: "#FFBF5E" }} />, name: "Fee Tiers", desc: "Four horizontal arcs (r=2.2), one per fee bucket (1–10, 11–30, 31–80, 81+ sat/vB).", meta: "Thickness ← fee pressure · Segment share ← bucket distribution" },
                      { icon: <span className="legend-line" style={{ background: "#F7931A" }} />, name: "Settlement", desc: "Horizontal arc (r=2.8). Full circle = blocks on schedule; shrinks when blocks arrive late.", meta: "Arc length ← average block interval vs 600 s target" },
                      { icon: <span className="legend-line" style={{ background: "#D97706" }} />, name: "Congestion", desc: "Horizontal arc (r=3.3). Barely visible when the mempool is clear; blazes under load.", meta: "Thickness + intensity ← mempool transaction count" },
                      { icon: <span className="legend-line" style={{ background: "#FFC850" }} />, name: "BTC Volume", desc: "Gold horizontal arc (r=3.8) along the far hemisphere.", meta: "Arc length ← daily BTC transferred vs the 4.6M BTC peak" },
                      { icon: <span className="legend-arc" />, name: "Hashrate Ring", desc: "Vertical ring (YZ plane, r=2.5). Invisible at Genesis; near-full at peak security.", meta: "Arc length ← hashrate vs the ~1,305 EH/s peak" },
                      { icon: <span className="legend-arc dark" />, name: "Difficulty Ring", desc: "Vertical ring (XZ plane, r=3.0). Spans 17 orders of magnitude on a log scale.", meta: "Arc length ← log₁₀(difficulty), from 1 to 150 trillion" },
                      { icon: <span className="legend-dot" />, name: "Address Particles", desc: "Glowing dots around the core. Genesis has zero; bull peaks have 1,000+.", meta: "Count ← active addresses ÷ 1,000 · Size ← whale activity" },
                    ].map((item, i) => (
                      <div key={i} className="guide-card">
                        <div className="guide-card-icon">{item.icon}</div>
                        <div>
                          <span className="guide-card-name">{item.name}</span>
                          <p className="guide-card-desc">{item.desc}</p>
                          <p className="guide-card-meta"><em>{item.meta}</em></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showGuideTab === "visual" && (
              <div className="guide-body">
                <p className="guide-lede">
                  The scene responds continuously to the data. Here's how each metric moves the
                  geometry as it rises or falls.
                </p>

                <div className="guide-section">
                  <h4 className="guide-section-title">Data → Geometry</h4>
                  <div className="guide-map">
                    <span className="guide-map-data">Hashrate climbs</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Vertical hashrate ring fills toward a full circle</span>

                    <span className="guide-map-data">Difficulty climbs</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Vertical difficulty ring expands (log scale, so early growth is rapid)</span>

                    <span className="guide-map-data">Fees paid per tx rise</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Fee-tier arcs thicken; share shifts from low to high tiers</span>

                    <span className="guide-map-data">Blocks arrive late (&gt; 600 s)</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Settlement arc shrinks from a full circle</span>

                    <span className="guide-map-data">Mempool fills</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Congestion arc thickens and brightens to a deep amber</span>

                    <span className="guide-map-data">More BTC moved on-chain</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">BTC Volume arc grows longer and brighter</span>

                    <span className="guide-map-data">More active users</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">More floating particles; larger ones mark whale-sized outputs</span>

                    <span className="guide-map-data">Blocks carry more txs</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Central block-crown spikes glow brighter; longer ones mean fuller blocks</span>
                  </div>
                </div>

                <div className="guide-section">
                  <h4 className="guide-section-title">Reading Across Snapshots</h4>
                  <p className="guide-paragraph">
                    Compare two dates to see how an event reshaped the network. A <em>calm</em> day
                    looks like a compact spine with rings sitting quiet. A <em>crisis</em> day — a
                    bubble top, an Ordinals surge, an ETF approval — shows a thick congestion band,
                    fat high-fee arcs, and a shrunken settlement circle even as hashrate keeps growing.
                  </p>
                </div>

                <div className="guide-section">
                  <h4 className="guide-section-title">How to Interact</h4>
                  <div className="guide-map">
                    <span className="guide-map-data">Hover any shape</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Right panel shows that element's underlying numbers</span>

                    <span className="guide-map-data">Click a shape</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Pins it; rotation pauses and KPIs lock for inspection</span>

                    <span className="guide-map-data">Click empty space</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Unpins and resumes the scene</span>

                    <span className="guide-map-data">Drag the canvas</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Orbit the geometry in 3D — full 360° around any axis, no pole lock</span>

                    <span className="guide-map-data">Scroll / pinch on canvas</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Zoom in and out; zoom far in to inspect individual blocks on the spine</span>

                    <span className="guide-map-data">Right-click + drag</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Pan the scene sideways without rotating</span>

                    <span className="guide-map-data">Grid icon (top-left)</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Zoom out to the full {snapshots.length}-snapshot overview; scroll to browse eras</span>

                    <span className="guide-map-data">Timeline on the left</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Jump to any date; search by name, year, or range</span>

                    <span className="guide-map-data">Play button</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Auto-advance through history from Genesis onward</span>

                    <span className="guide-map-data">Rotation toggle (top-left)</span>
                    <span className="guide-map-arrow">→</span>
                    <span className="guide-map-visual">Turn ambient rotation on or off while exploring</span>
                  </div>
                </div>
              </div>
            )}

            {showGuideTab === "source" && (
              <div className="guide-body">
                <p className="guide-lede">
                  {snapshots.length} historically significant dates from Genesis (2009) through 2026.
                  Every number comes from a public, free-to-access source. Nothing is made up.
                </p>

                <div className="guide-section">
                  <h4 className="guide-section-title">Where the Numbers Come From</h4>
                  <ul className="source-list">
                    <li><span className="source-field">Hashrate, active addresses, total fees, block count</span><span className="source-arrow">→</span><span className="source-origin">CoinMetrics community API</span></li>
                    <li><span className="source-field">Difficulty, mempool size &amp; count, BTC transferred</span><span className="source-arrow">→</span><span className="source-origin">blockchain.com Charts API</span></li>
                    <li><span className="source-field">Miner concentration (HHI, 2021 onward)</span><span className="source-arrow">→</span><span className="source-origin">mempool.space mining pools API</span></li>
                    <li><span className="source-field">Per-block spine (height, size, weight, tx count)</span><span className="source-arrow">→</span><span className="source-origin">Google BigQuery public <code>crypto_bitcoin</code> dataset</span></li>
                  </ul>
                </div>

                <div className="guide-section">
                  <h4 className="guide-section-title">Derived Values</h4>
                  <p className="guide-paragraph">
                    A handful of scores — <em>block production stress</em>, <em>congestion</em>,{" "}
                    <em>fee pressure</em>, <em>network health</em> — are computed from the raw
                    fields above using simple piecewise formulas. They're <strong>not</strong>{" "}
                    independent sources; they're just different lenses on the same data.
                  </p>
                  <p className="guide-paragraph">
                    The four fee-tier arcs are a <strong>shape projection</strong> of fee pressure:
                    a single scalar (sats per transaction) is mapped to a four-bucket distribution
                    via published anchor curves. It's still entirely data-driven — no decoration —
                    but it's a projection, not a per-block histogram. A real histogram would
                    require a separate BigQuery extract over the <code>transactions</code> table.
                  </p>
                </div>

                <div className="guide-section">
                  <h4 className="guide-section-title">A Note on Hashrate</h4>
                  <p className="guide-paragraph">
                    Hashrate can't be measured directly — it's always estimated from block production
                    and difficulty. Different providers publish different values for the same day
                    depending on their smoothing window. Day-to-day numbers can swing ±15% from
                    random block-timing variance. We use CoinMetrics' value, the one most analysts
                    and news outlets cite.
                  </p>
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
        <CtxRow label="Avg Interval" value={`${Math.round(s.avgBlockIntervalSeconds)}s`} />
        <CtxRow label="Blocks Mined" value={`${blocks.length}`} />
        <CtxRow label="Target" value="600s" />
      </div>
    );
  }

  if (hoverCtx.type === "hashrate") {
    const hasData = s.networkHashrateEh > 0;
    return (
      <div className="ctx-content">
        <div className="ctx-title">Network Hashrate</div>
        <CtxRow label="Hashrate" value={hasData ? `${s.networkHashrateEh.toFixed(1)} EH/s` : "— (no data)"} />
        <CtxRow label="Ring Fill" value={hasData ? `${((s.networkHashrateEh / 1305.5) * 100).toFixed(1)}%` : "—"} />
        <CtxRow label="Halving Era" value={`${Math.floor(s.blockHeight / 210000) + 1}`} />
        <div className="ctx-notes"><p>{hasData
          ? "Amber vertical ring. Arc length proportional to hashrate relative to the 2025 peak of ~1,305 EH/s. Measures total computational power securing the network. Sourced from CoinMetrics."
          : "CoinMetrics hashrate coverage starts in 2011. For earlier dates, no estimate is reported — so the ring is hidden rather than shown as zero."}</p></div>
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
    const hasDiff = s.difficulty > 0;
    const hasHr = s.networkHashrateEh > 0;
    return (
      <div className="ctx-content">
        <div className="ctx-title">Mining Difficulty</div>
        <CtxRow label="Difficulty" value={hasDiff ? formatDifficulty(s.difficulty) : "— (no data)"} />
        <CtxRow label="Hashrate" value={hasHr ? `${s.networkHashrateEh.toFixed(1)} EH/s` : "— (no data)"} />
        <CtxRow label="Difficulty Epoch" value={`${Math.floor(s.blockHeight / 2016)}`} />
        <div className="ctx-notes"><p>{hasDiff
          ? "Deep-gold vertical ring. Log-scaled arc — difficulty spans from 1 (Genesis) to 150 trillion (2025). Adjusts every 2,016 blocks to maintain ~10 min block times."
          : "blockchain.com difficulty coverage doesn't reach this date. The ring is hidden rather than shown as zero."}</p></div>
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
      <CtxRow label="Hashrate" value={s.networkHashrateEh > 0 ? `${s.networkHashrateEh.toFixed(0)} EH/s` : "—"} />
      <CtxRow label="Difficulty" value={s.difficulty > 0 ? formatDifficulty(s.difficulty) : "—"} />
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

function CameraRig({ view, snapCount, focusIdx, gridOrbitEnabled }: { view: "grid" | "detail"; snapCount: number; focusIdx: number | null; gridOrbitEnabled: boolean }) {
  const { camera, size, gl } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 22));
  const targetFov = useRef(42);
  const transitioning = useRef(false);
  const transitionStart = useRef(0);

  // Scroll state (grid mode only)
  const COLS = 5;
  const SPACING_Y = 3.2;
  const uiOffsetY = useRef(0);   // sidebar-bias Y, set on each grid view entry
  const gridDist = useRef(22);   // Z distance in grid mode, set on each grid view entry
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInGrid = useRef(view === "grid");
  isInGrid.current = view === "grid";
  // When the user toggles orbit on in grid view, TrackballControls takes over
  // wheel + touch — we must suppress the scroll-to-row handler so they don't
  // fight over camera.position.
  const orbitOn = useRef(gridOrbitEnabled);
  orbitOn.current = gridOrbitEnabled;

  // When orbit flips ON in grid view, snap camera to a fixed overview pose
  // that frames the whole grid from the front. TrackballControls' target is
  // (0,0,0) by default; keeping the camera on the Z axis at a fixed distance
  // makes rotation orbit cleanly around the grid center instead of producing
  // the tall "stretched column" view that happens when you rotate while
  // already scrolled to a far row.
  useLayoutEffect(() => {
    if (view !== "grid" || !gridOrbitEnabled) return;
    const ROWS = Math.ceil(snapCount / COLS);
    const gridFullH = (ROWS - 1) * SPACING_Y + 2;
    const fov = size.width < 640 ? 55 : size.width < 900 ? 48 : 42;
    const tanHalf = Math.tan((fov * Math.PI) / 360);
    const dist = Math.min(gridFullH / (2 * tanHalf), 60);
    camera.position.set(0, 0, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.fov !== undefined) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }
  }, [view, gridOrbitEnabled, snapCount, size.width, camera]);

  // Compute row-center world Y (rows are symmetric around 0, row 0 at top)
  const rowCenterY = useCallback((row: number) => {
    const ROWS = Math.ceil(snapCount / COLS);
    return ((ROWS - 1) / 2 - row) * SPACING_Y;
  }, [snapCount]);

  // Wheel + touch scroll handler. The camera shows ~5 rows at once, so the
  // valid center-of-view row range is [HALF_VIEW, ROWS-1-HALF_VIEW]; scrolling
  // beyond would push the grid off-screen at top or bottom.
  const HALF_VIEW = 2;
  useEffect(() => {
    const ROWS = Math.ceil(snapCount / COLS);
    const minRow = Math.min(HALF_VIEW, ROWS - 1);
    const maxRow = Math.max(ROWS - 1 - HALF_VIEW, minRow);
    const topY = rowCenterY(minRow);   // most "scrolled-up" center
    const botY = rowCenterY(maxRow);   // most "scrolled-down" center

    const doSnap = () => {
      const relY = targetPos.current.y - uiOffsetY.current;
      let closestRow = minRow, closestDist = Infinity;
      for (let r = minRow; r <= maxRow; r++) {
        const d = Math.abs(rowCenterY(r) - relY);
        if (d < closestDist) { closestDist = d; closestRow = r; }
      }
      targetPos.current.y = rowCenterY(closestRow) + uiOffsetY.current;
    };

    const clamp = (y: number) =>
      Math.max(botY + uiOffsetY.current, Math.min(topY + uiOffsetY.current, y));

    const handleWheel = (e: WheelEvent) => {
      if (!isInGrid.current || orbitOn.current) return;
      e.preventDefault();
      targetPos.current.y = clamp(targetPos.current.y - e.deltaY * 0.018);
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(doSnap, 300);
    };

    let touchY = 0;
    const handleTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isInGrid.current || orbitOn.current) return;
      e.preventDefault();
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      targetPos.current.y = clamp(targetPos.current.y - dy * 0.05);
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(doSnap, 300);
    };

    const canvas = gl.domElement;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, [gl.domElement, snapCount, rowCenterY]);

  // Follow external focus (timeline hover/select) — scroll camera to that row
  useEffect(() => {
    if (view !== "grid" || focusIdx == null || gridOrbitEnabled) return;
    const ROWS = Math.ceil(snapCount / COLS);
    const minRow = Math.min(HALF_VIEW, ROWS - 1);
    const maxRow = Math.max(ROWS - 1 - HALF_VIEW, minRow);
    const focusRow = Math.floor(focusIdx / COLS);
    const clampedRow = Math.max(minRow, Math.min(maxRow, focusRow));
    targetPos.current.y = rowCenterY(clampedRow) + uiOffsetY.current;
    if (snapTimer.current) { clearTimeout(snapTimer.current); snapTimer.current = null; }
  }, [focusIdx, view, snapCount, rowCenterY, gridOrbitEnabled]);


  // useLayoutEffect (not useEffect): we need to reposition the camera
  // synchronously after the view switches, before the browser paints. A plain
  // useEffect fires after paint, leaving one frame where the new scene is
  // rendered with the camera still at the old (grid) position — the visible
  // "snap" on entering detail view.
  useLayoutEffect(() => {
    if (view === "grid") {
      // Account for side panels covering part of the canvas. These must match
      // the responsive panel widths declared in styles.css.
      const vpW = size.width;
      const vpH = size.height;
      let sidebarWidth: number;
      let topReserve: number;
      let bottomReserve: number;
      // Banner is now a single line of text (subtitle removed) — significantly
      // less vertical space needed at the top, so we shrink topReserve across
      // all breakpoints.
      if (vpW > 1200) {
        sidebarWidth = 310 + 330 + 32; // default panels + margins
        topReserve = 60;
        bottomReserve = 40;
      } else if (vpW > 1000) {
        sidebarWidth = 260 + 290 + 32;
        topReserve = 60;
        bottomReserve = 40;
      } else if (vpW > 820) {
        sidebarWidth = 230 + 260 + 24;
        topReserve = 56;
        bottomReserve = 40;
      } else if (vpW > 640) {
        sidebarWidth = 210 + 230 + 20;
        topReserve = 52;
        bottomReserve = 40;
      } else {
        // Mobile: panels are top strip + bottom sheet, not sidebars.
        // Single-line banner (~38px) + timeline strip (44px) + small gap = ~88
        sidebarWidth = 0;
        topReserve = 88;
        // Bottom sheet: when collapsed it's ~54px; when expanded it overlays
        // the canvas, but we still frame to the collapsed footprint so the
        // geometry stays at a consistent size.
        bottomReserve = 60;
      }
      const usableW = Math.max(vpW - sidebarWidth, 280);
      const usableH = Math.max(vpH - topReserve - bottomReserve, 280);
      // Canvas aspect — what three.js uses for projection.
      const canvasAspect = vpW / vpH;

      // Show ~5 rows at a time: cell radius ~1.4, 5 rows of SPACING_Y=3.2.
      const gridHalfW = (4 * 3.6) / 2 + 1.6; // ~8.8 (5 cols)
      const gridHalfH = (4 * 3.2) / 2 + 1.6; // ~8.0 (5 visible rows)

      // Pick a FOV: wider on narrow/mobile so the grid doesn't need a huge z.
      const fov = vpW < 640 ? 55 : vpW < 900 ? 48 : 42;
      const tanHalf = Math.tan((fov * Math.PI) / 360);

      const usableFracW = usableW / vpW;
      const usableFracH = usableH / vpH;
      const distH = gridHalfH / (tanHalf * usableFracH);
      const distW = gridHalfW / (tanHalf * canvasAspect * usableFracW);
      const dist = Math.min(Math.max(distH, distW), 60);

      // Center grid vertically within the usable region.
      const verticalShiftPx = (topReserve - bottomReserve) / 2;
      const worldPerPx = (dist * tanHalf * 2) / vpH;
      const offsetY = verticalShiftPx * worldPerPx;

      uiOffsetY.current = offsetY;
      gridDist.current = dist;

      // Start with the top of the grid (rows 0..4) filling the viewport —
      // center on row HALF_VIEW so rows 0..HALF_VIEW*2 fit without empty space above.
      const ROWS = Math.ceil(snapCount / COLS);
      const startRow = Math.min(HALF_VIEW, Math.max(0, ROWS - 1));
      const startY = rowCenterY(startRow) + offsetY;
      targetPos.current.set(0, startY, dist);
      targetFov.current = fov;
      // Reset up vector — TrackballControls modifies it during free rotation
      camera.up.set(0, 1, 0);
    } else {
      // Cut directly to the detail camera pose — no camera lerp. The grid
      // view can be framed from anywhere (high Y to see rows, distant Z),
      // and lerping from there to (0, 1.5, 11) produced a visible snap or
      // descent no matter how we interpolated. The scene's own opacity
      // fade-in carries the transition feel; the camera is just there when
      // it's needed.
      //
      // Look at the ORIGIN, not (0, 1.5, 0). The scene geometry is centered
      // at origin; looking at (0, 1.5, 0) pushes the scene visibly into the
      // lower half of the canvas and — because TrackballControls defaults
      // its target to (0,0,0) and resets lookAt when it mounts — caused a
      // visible "jump up" as the scene re-centered. Matching the controls'
      // default eliminates that jump.
      const fov = size.width < 640 ? 44 : 36;
      targetPos.current.set(0, 1.5, 11);
      targetFov.current = fov;
      camera.up.set(0, 1, 0);
      camera.position.set(0, 1.5, 11);
      const persp = camera as THREE.PerspectiveCamera;
      if (persp.fov !== undefined) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
      camera.lookAt(0, 0, 0);
      transitioning.current = false;
      return;
    }
    transitioning.current = true;
    transitionStart.current = performance.now();
  }, [view, camera, size.width, size.height, rowCenterY]);

  useFrame((_, delta) => {
    const t = 1 - Math.pow(0.002, delta);

    if (view === "grid") {
      // When orbit is enabled, TrackballControls owns the camera — don't
      // fight it with the scroll lerp or the forward-facing lookAt.
      if (gridOrbitEnabled) return;
      // Always smooth-lerp Y toward scroll target (even after transition settles)
      camera.position.y += (targetPos.current.y - camera.position.y) * t;
      // During initial transition: also lerp Z and FOV
      if (transitioning.current) {
        const elapsed = (performance.now() - transitionStart.current) / 1000;
        if (elapsed > 1.0) transitioning.current = false;
        camera.position.z += (gridDist.current - camera.position.z) * t;
        const persp = camera as THREE.PerspectiveCamera;
        if (persp.fov !== undefined) {
          persp.fov += (targetFov.current - persp.fov) * t;
          persp.updateProjectionMatrix();
        }
      }
      camera.lookAt(0, camera.position.y, 0);
      return;
    }

    // Detail view: run transition lerp
    if (!transitioning.current) return;
    const elapsed = (performance.now() - transitionStart.current) / 1000;
    if (elapsed > 1.0) { transitioning.current = false; return; }
    camera.position.lerp(targetPos.current, t);
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.fov !== undefined) {
      persp.fov += (targetFov.current - persp.fov) * t;
      persp.updateProjectionMatrix();
    }
    // Track the camera's current Y rather than the target Y. Using the target
    // would snap the line-of-sight on frame 1 while the camera is still far
    // from target — visually the scene would "jump" into place. Following the
    // camera's actual Y keeps it smooth throughout the descent.
    camera.lookAt(0, camera.position.y, 0);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════
   GRID SCENE — 5x5 landing page with simplified mini snapshots
   ═══════════════════════════════════════════════════════ */

function GridScene({ snapshots, hoverIdx, selectedIdx, matchedIndices, legendHover, onHover, onSelect }: {
  snapshots: NetworkSnapshot[];
  hoverIdx: number | null;
  selectedIdx: number | null;
  matchedIndices: Set<number> | null;
  legendHover: string | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const [, forceUpdate] = useState(0);
  // Used for the selected-cell pulse animation.
  const pulseRef = useRef(0);

  // Staggered phase offsets — deterministic (golden-ratio seed) so cells don't
  // re-randomize on every mount while still appearing visually distributed.
  const phaseOffsets = useMemo(() =>
    Array.from({ length: snapshots.length }, (_, i) => Math.sin(i * 1.618) * Math.PI * 2),
  [snapshots.length]);

  useFrame((_, delta) => {
    // Grid cells are static. Earlier we rotated each cell around Y, but the
    // block-crown lives in the XY plane and goes edge-on (invisible) every
    // 180° of that rotation. Static 3D reads just fine — rotation is for
    // detail view, where the camera orbits explicitly.
    pulseRef.current += delta;
    forceUpdate((n) => n + 1);
  });

  // 21×5 scrollable grid layout
  const COLS = 5;
  const ROWS = Math.ceil(snapshots.length / COLS);
  const SPACING_X = 3.6; // world units between cells (horizontal)
  const SPACING_Y = 3.2; // world units between cells (vertical)

  // Gentle pulse for the selected cell (1.0 ± 0.06)
  const pulse = 1 + Math.sin(pulseRef.current * 3.2) * 0.06;

  return (
    <group position={[0, -0.3, 0]}>
      {/* Grid-wide lighting — shared across all cells */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 10, 15]} intensity={6} color="#F7931A" distance={60} decay={1.5} />
      <pointLight position={[15, -5, 10]} intensity={4} color="#FFB547" distance={50} decay={1.5} />
      <pointLight position={[-15, 5, 10]} intensity={4} color="#B87206" distance={50} decay={1.5} />

      {snapshots.map((snap, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * SPACING_X;
        const y = ((ROWS - 1) / 2 - row) * SPACING_Y;
        const isHovered = hoverIdx === i;
        const isSelected = selectedIdx === i;
        const isFilteredOut = matchedIndices !== null && !matchedIndices.has(i);
        // Dim non-hovered cells when hovering. If nothing is hovered but
        // something is selected, dim the non-selected cells. Filtered-out
        // cells stay in place but fade heavily so history's shape is preserved.
        const dim = isFilteredOut
          ? 0.1
          : hoverIdx !== null
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
            rotation={[0, 0, phaseOffsets[i]]}
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

  const feeColors = ["#FFBF5E", "#F2A63C", "#E08B15", "#C77000"];
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
        // Amplify thickness response to fee pressure so low-fee days look
        // genuinely thin and high-fee days look genuinely fat. fp is 0..1.
        const thickness = 0.02 + fp * 0.28 + bucket.intensity * 0.05;
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
            <ArcBand radius={2.8} thickness={0.03 + stressHealth * 0.08} depth={0.05} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#F7931A" emissiveIntensity={(0.25 + stressHealth * 0.5 + g.extra) * g.mult} opacity={0.75 * op * g.mult} />
          </group>
        );
      })()}

      {/* Congestion */}
      {(() => {
        const fillAngle = Math.PI * 2 * Math.max(0.03, cg);
        const g = lhGlow("congestion");
        return (
          <group position={[0, 0, cg * 0.2]}>
            <ArcBand radius={3.3} thickness={0.02 + cg * 0.18} depth={0.05} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#D97706" emissiveIntensity={(0.2 + cg * 0.8 + g.extra) * g.mult} opacity={(cg > 0.01 ? 0.65 + cg * 0.25 : 0.06) * op * g.mult} />
          </group>
        );
      })()}

      {/* BTC Volume */}
      {(() => {
        const fillAngle = Math.PI * 2 * Math.max(0.02, vol);
        const g = lhGlow("volume");
        return (
          <group position={[0, 0, vol * 0.15]}>
            <ArcBand radius={3.8} thickness={0.02 + vol * 0.14} depth={0.05} startAngle={Math.PI - fillAngle / 2} endAngle={Math.PI + fillAngle / 2} color="#FFC850" emissiveIntensity={(0.2 + vol * 0.6 + g.extra) * g.mult} opacity={(0.4 + vol * 0.4) * op * g.mult} />
          </group>
        );
      })()}

      {/* Hashrate vertical — only when CoinMetrics reports a value */}
      {s.networkHashrateEh > 0 && (() => {
        const fillAngle = Math.PI * 2 * Math.max(0.02, hrNorm);
        const g = lhGlow("hashrate-ring");
        return (
          <group rotation={[0, Math.PI / 2, 0]}>
            <ArcBand radius={2.5} thickness={0.02 + hrNorm * 0.1} depth={0.04} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#F2A63C" emissiveIntensity={(0.2 + hrNorm * 0.6 + g.extra) * g.mult} opacity={(0.5 + hrNorm * 0.35) * op * g.mult} />
          </group>
        );
      })()}

      {/* Difficulty vertical — only when blockchain.com reports a value */}
      {s.difficulty > 0 && (() => {
        const fillAngle = Math.PI * 2 * Math.max(0.02, diffLog);
        const g = lhGlow("difficulty-ring");
        return (
          <group rotation={[Math.PI / 2, 0, 0]}>
            <ArcBand radius={3.0} thickness={0.02 + diffLog * 0.08} depth={0.04} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#A8740A" emissiveIntensity={(0.2 + diffLog * 0.5 + g.extra) * g.mult} opacity={(0.4 + diffLog * 0.4) * op * g.mult} />
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
        color={highlighted ? "#FFFFFF" : "#FFCA6E"}
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

    // Radial "block crown" — same shape as the detail-view spine, just
    // bigger/thicker here to remain visible at grid scale (each mini cell
    // is rendered at ~0.28× scale inside the grid).
    const INNER_R = 0.15;
    const MIN_SPIKE = 0.25;
    const MAX_SPIKE = 1.15;

    for (let i = 0; i < count; i++) {
      const [, size, weight, txs] = blocks[i];
      const wNorm = Math.min(weight / 4000000, 1);
      const sNorm = Math.min(size / 2000000, 1);

      const spikeLen = MIN_SPIKE + MAX_SPIKE * wNorm;
      const thickness = 0.04 + sNorm * 0.05;
      const midR = INNER_R + spikeLen / 2;

      const angle = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * midR, Math.sin(angle) * midR, 0);
      dummy.lookAt(0, 0, 0);
      dummy.scale.set(thickness, thickness, spikeLen);
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
        color={highlighted ? "#FFDF9E" : "#FFB547"}
        emissive="#F7931A"
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

  const feeColors = ["#FFBF5E", "#F2A63C", "#E08B15", "#C77000"];


  return (
    <group ref={sceneRef} position={[0, 0, 0]} scale={0.85}>
      {/* Three-point lighting for cinematic depth */}
      <ambientLight intensity={0.03 + health * 0.03} />
      {/* Key light — warm orange from front-above */}
      <pointLight position={[0, 3, 6]} intensity={4 + health * 3} color="#F7931A" distance={22} decay={1.8} />
      {/* Fill light — softer, from the side */}
      <pointLight position={[6, 1, 2]} intensity={2} color="#FFB547" distance={20} decay={2} />
      {/* Rim light — behind and below for edge separation */}
      <pointLight position={[-4, -4, -3]} intensity={3} color="#B87206" distance={18} decay={1.8} />
      {/* Core glow — inside the spine, pulses subtly with network health */}
      <pointLight ref={coreLightRef} position={[0, 0, 0]} intensity={0.5 + health * 0.5} color="#F2B456" distance={4} decay={2.5} />

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
        // Amplify thickness response to fee pressure so low-fee days look
        // genuinely thin and high-fee days look genuinely fat. fp is 0..1.
        const thickness = 0.02 + fp * 0.28 + bucket.intensity * 0.05;
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
            <ArcBand radius={r} thickness={thickness} depth={0.05 + cg * 0.04} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#D97706" emissiveIntensity={(0.2 + cg * 0.8 + glowExtra(gid)) * g} opacity={(cg > 0.01 ? 0.65 + cg * 0.25 : 0.06) * g} />
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
            <ArcBand radius={r} thickness={thickness} depth={0.05} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#F7931A" emissiveIntensity={(0.25 + stressHealth * 0.5 + glowExtra(gid)) * g} opacity={0.75 * g} />
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
            <ArcBand radius={r} thickness={thickness} depth={0.05 + vol * 0.03} startAngle={Math.PI - fillAngle / 2} endAngle={Math.PI + fillAngle / 2} color="#FFC850" emissiveIntensity={(0.2 + vol * 0.6 + glowExtra(gid)) * g} opacity={(0.4 + vol * 0.4) * g} />
          </group>
        );
      })()}

      {/* ═══ HASHRATE ARC — vertical ring (YZ plane, r=2.5). Hidden when
           no hashrate data exists for this date (pre-2011 CoinMetrics). ═══ */}
      {s.networkHashrateEh > 0 && (() => {
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
            <ArcBand radius={r} thickness={thickness} depth={0.04 + hrNorm * 0.02} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#F2A63C" emissiveIntensity={(0.2 + hrNorm * 0.6 + glowExtra(gid)) * g} opacity={(0.5 + hrNorm * 0.35) * g} />
          </group>
        );
      })()}

      {/* ═══ DIFFICULTY ARC — vertical ring (XZ plane, r=3.0). Hidden when
           blockchain.com doesn't have difficulty for this date. ═══ */}
      {s.difficulty > 0 && (() => {
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
            <ArcBand radius={r} thickness={thickness} depth={0.04 + diffLog * 0.02} startAngle={-fillAngle / 2} endAngle={fillAngle / 2} color="#A8740A" emissiveIntensity={(0.2 + diffLog * 0.5 + glowExtra(gid)) * g} opacity={(0.4 + diffLog * 0.4) * g} />
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
        color="#FFCA6E"
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

  // useLayoutEffect: set matrices synchronously before paint to prevent
  // identity-matrix flash. Blocks are arranged as a radial "crown" in the
  // XY plane — each block is a spike pointing outward from center, length
  // driven by weight (fuller block = longer spike), thickness by size,
  // color brightness by tx count. This reads legibly from any view angle
  // instead of looking like a horizontal beam when seen from the side.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || blocks.length === 0) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    hoveredRef.current = -1;

    const INNER_R = 0.3;
    const MIN_SPIKE = 0.12;
    const MAX_SPIKE = 1.35;

    for (let i = 0; i < count; i++) {
      const [, size, weight, txs] = blocks[i];
      const wNorm = Math.min(weight / 4000000, 1);
      const sNorm = Math.min(size / 2000000, 1);

      const spikeLen = MIN_SPIKE + MAX_SPIKE * wNorm;
      const thickness = 0.012 + sNorm * 0.022;
      const midR = INNER_R + spikeLen / 2;

      const angle = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * midR, Math.sin(angle) * midR, 0);
      dummy.lookAt(0, 0, 0);
      // After lookAt, local +Z faces outward from origin. Extend the box
      // along Z for the spike length; width/height are the thin axes.
      dummy.scale.set(thickness, thickness, spikeLen);
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

    // Highlight new — thicken the spike (cross-section grows) but keep its
    // length unchanged so it never protrudes through the surrounding rings.
    // Local X and Y are the thin axes; local Z is the radial length.
    if (idx >= 0 && idx < blocks.length) {
      mesh.getMatrixAt(idx, origMatrix.current);
      const m = origMatrix.current.clone();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      m.decompose(pos, quat, scl);
      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.set(scl.x * 3.0, scl.y * 3.0, scl.z);
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
          color={highlighted ? "#FFDF9E" : "#FFB547"}
          emissive={highlighted ? "#F2B456" : "#F7931A"}
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
