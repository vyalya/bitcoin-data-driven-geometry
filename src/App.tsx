import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TrackballControls, Html, Line } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useMemo, useContext, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { resetCameraPose, gridLayout } from "./camera";
import { setBlockInstances, POINT_HIT_THRESHOLD } from "./geometry";
import type { FormStyle } from "./geometry";
import { sameSelection, inspectSelection } from "./selection";
import { SnapshotCaption } from "./SnapshotCaption";
import { normalized, difficultyFill, formatMetric, randomFor } from "./metrics";
import { staticSnapshots } from "./data/staticSnapshots";
import { loadSnapshots, loadAllBlocks, loadBlockDetailsForDate } from "./db";
import type { NetworkSnapshot, BlockTuple, BlockRecord } from "./types";
import { buildGearGeometry } from "./gear/geometry";
import { polygonPoint } from "./gear/model";
import { addressPoint } from "./gear/presentation";
import { GearShape, GearDataContext } from "./gear/Scene";
import { loadGearData } from "./gear/data";
import type { GearData } from "./gear/data";
import { gearShapes, gearDescriptions, gearLegendDefinitions, gearRelations } from "./gear/copy";
import { relationshipGroups } from "./gear/relationships";
import { coreRingSpecs } from "./rings";
import { legacySignalLabels, legacyEndpoints } from "./legacyLabels";
import { SignalLabels } from "./gear/SignalLabels";

/* ═══════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════ */

/* ─── Hover context types ─── */
type MetricId = "blocks" | "transactions" | "weight" | "fees-total" | "difficulty" | "hashrate" | "addresses";
type HoverContext = { type: "none" } | { type: "block"; block: BlockTuple; index: number } | { type: MetricId; block?: BlockTuple; index?: number };
const metricGroups: Record<MetricId,string> = {blocks:"spine",weight:"spine",transactions:"transactions","fees-total":"fees-total",difficulty:"difficulty",hashrate:"hashrate",addresses:"particles"};

type AppProps = { initialFormStyle?:FormStyle; initialView?:"grid"|"detail"; initialDate?:string; initialPanelsHidden?:boolean };
function App({initialFormStyle="gear",initialView="grid",initialDate,initialPanelsHidden=true}:AppProps={}) {
  // Start with an empty loading state, then load validated JSON
  const [snapshots, setSnapshots] = useState<NetworkSnapshot[]>(staticSnapshots);
  const [activeIdx, setActiveIdx] = useState(0);
  const [resetVersion, setResetVersion] = useState(0);
  const [panelsHidden,setPanelsHidden]=useState(initialPanelsHidden);
  const [formStyle, setFormStyle] = useState<FormStyle>(initialFormStyle);
  const bannerRef=useRef<HTMLDivElement>(null);
  const [headerClearance,setHeaderClearance]=useState(0);
  useLayoutEffect(()=>{
    const banner=bannerRef.current;if(!banner)return;
    let disposed=false;
    const measure=()=>{if(!disposed)setHeaderClearance(Math.ceil(banner.getBoundingClientRect().bottom)+12);};
    const observer=new ResizeObserver(measure);
    observer.observe(banner);window.addEventListener('resize',measure);measure();
    void document.fonts?.ready.then(measure);
    return ()=>{disposed=true;observer.disconnect();window.removeEventListener('resize',measure);};
  },[formStyle,panelsHidden]);
  const [labelsVisible,setLabelsVisible]=useState<boolean>(()=>{
    try{const saved=JSON.parse(localStorage.getItem('bitcoin-geometry-labels')??'null');return typeof saved?.visible==='boolean'?saved.visible:saved?.signals===true||saved?.endpoints!==false;}
    catch{return true;}
  });
  useEffect(()=>{try{localStorage.setItem('bitcoin-geometry-labels',JSON.stringify({visible:labelsVisible}));}catch{/* Storage is optional. */}},[labelsVisible]);
  const baseSnapshot = snapshots[Math.min(activeIdx, snapshots.length - 1)];
  // False until the JSON load attempt settles (success or fail). Used to
  // avoid flashing the placeholder count before the data lands.
  const [snapshotsSettled, setSnapshotsSettled] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshots().then((loaded) => {
      if (loaded && loaded.length > 0) {
        setSnapshots(loaded);
        if(initialDate){const index=loaded.findIndex(s=>s.snapshotTime.startsWith(initialDate));if(index>=0)setActiveIdx(index);}
      }
    }).catch((e) => { setDataError(String(e)); })
    .finally(() => setSnapshotsSettled(true));
  }, []);

  const [gearData,setGearData]=useState<GearData|null>(null);
  const [gearError,setGearError]=useState<string|null>(null);
  const [gearAttempt,setGearAttempt]=useState(0);
  useEffect(()=>{
    if(formStyle!=="gear" || gearData)return;
    let cancelled=false;
    loadGearData().then(data=>{if(!cancelled){setGearData(data);setGearError(null);}}).catch(e=>{if(!cancelled)setGearError(String(e));});
    return ()=>{cancelled=true;};
  },[formStyle,gearData,gearAttempt]);

  // Blocks: loaded from the validated blocks.json artifact. On
  // mount we pull the full blocks table in one query and index by date so
  // every grid cell has its crown from the start.
  const [blocksByDate, setBlocksByDate] = useState<Record<string, BlockTuple[]>>({});
  const [blocksSettled, setBlocksSettled] = useState(false);
  useEffect(() => {
    loadAllBlocks().then((all) => {
      if (Object.keys(all).length > 0) setBlocksByDate(all);
    }).catch((e) => setDataError(String(e))).finally(() => setBlocksSettled(true));
  }, []);

  useEffect(() => {
    if (!snapshotsSettled || !blocksSettled) return;
    if (snapshots.some(s => (blocksByDate[s.snapshotTime.slice(0,10)]?.length ?? -1) !== s.blockCount)) setDataError("Snapshot and block files disagree. Reload the current data release.");
  }, [snapshots, snapshotsSettled, blocksByDate, blocksSettled]);

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
  const currentBlocks: BlockTuple[] = baseSnapshot.blocks && baseSnapshot.blocks.length > 0
    ? baseSnapshot.blocks
    : (blocksByDate[activeDate] ?? []);

  const [blockDetails,setBlockDetails]=useState<{date:string;records:BlockRecord[]}>({date:"",records:[]});
  const [blockDetailsError,setBlockDetailsError]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    setBlockDetailsError(null);
    if(!snapshotsSettled)return;
    loadBlockDetailsForDate(activeDate).then(records=>{
      if(!cancelled)setBlockDetails({date:activeDate,records});
    }).catch(()=>{if(!cancelled)setBlockDetailsError("Additional block details could not load. Weight, size and transaction counts remain available.");});
    return ()=>{cancelled=true;};
  },[activeDate,snapshotsSettled]);

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
        const hay = `${s.label} ${s.id} ${s.category ?? ""} ${s.context ?? ""}`.toLowerCase();
        if (!textTokens.every((tok) => hay.includes(tok))) return;
      }
      out.add(i);
    });
    return out;
  }, [searchQuery, snapshots]);

  // Hover/selection state
  const [hoverCtx, setHoverCtx] = useState<HoverContext>({ type: "none" });
  const hoverCtxRef = useRef<HoverContext>({ type: "none" });
  const pendingMetric = useRef<MetricId|null>(null);
  const [pinnedCtx, setPinnedCtx] = useState<HoverContext>({ type: "none" });
  const updateHoverCtx = (context: HoverContext) => {
    hoverCtxRef.current = context;
    setHoverCtx(context);
  };
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showDataInfo, setShowDataInfo] = useState(false);
  const [searchHelpOpen, setSearchHelpOpen] = useState(false);
  // Legacy legend state — the standalone legend modal was replaced by a tab
  // in the Info modal, but these values are still referenced by scene props.
  // Setters are intentionally unused.
  const [showLegend] = useState(false);
  const [legendHover] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "detail">(initialView);
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
    const context=hoverCtxRef.current;
    setPanelsHidden(false);
    setMobileSheetExpanded(true);
    const release=pinnedGroup===groupId && sameSelection(pinnedCtx,context);
    if(release){
      setPinnedCtx({type:"none"});setPinnedGroup(null);
      setPlaying(preClickState.current.wasPlaying);
      setRotationEnabled(preClickState.current.wasRotating);
    }else{
      if(!pinnedGroup)preClickState.current={wasPlaying:playRef.current,wasRotating:rotationRef.current};
      setPinnedCtx(context);setPinnedGroup(groupId);
      setPlaying(false);setRotationEnabled(false);
    }
  }, [pinnedGroup,pinnedCtx]);

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
    setPinnedCtx({ type: "none" });
    setHoverCtx({ type: "none" });
    hoverCtxRef.current = { type: "none" };
  }, []);

  useEffect(() => {
    if(pendingMetric.current){
      const metric=pendingMetric.current;pendingMetric.current=null;
      setPinnedCtx({type:metric});setPinnedGroup(metricGroups[metric]);return;
    }
    // A block selected on one date must never be shown under another date.
    setPinnedGroup(null);
    setPinnedCtx({ type: "none" });
    setHoverCtx({ type: "none" });
    hoverCtxRef.current = { type: "none" };
    setActiveGroup(null);
  }, [activeDate]);
  const inspection = inspectSelection(hoverCtx,activeGroup,pinnedCtx,pinnedGroup);
  const displayedCtx = inspection.context;

  // Preview the hovered signal; restore the pinned figures on pointer exit.
  const displayGroup = legendHover ?? inspection.group;

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
  const hoveredSnapshot = view === "grid"
    ? (cellHoverIdx === null ? null : snapshots[cellHoverIdx])
    : (activeGroup === null ? null : baseSnapshot);

  // Descriptive label for whatever shape is currently being inspected in the
  // detail view. Shown in the mobile bottom-sheet handle so the user can see
  // what they just tapped without expanding the sheet.
  const selectionLabel: string | null = (() => {
    if (view !== "detail") return null;
    if (displayedCtx.type === "none") return null;
    if (displayedCtx.type === "block" || displayedCtx.block) return `Block #${displayedCtx.block![0].toLocaleString()}`;
    return formStyle==="gear" ? gearShapes[displayedCtx.type] : {blocks:"Blocks · center",weight:"Block weight · teeth",transactions:"Transactions · ring 1","fees-total":"Fees · ring 2",difficulty:"Difficulty · ring 3",hashrate:"Hashrate · ring 4",addresses:"Active addresses · dots"}[displayedCtx.type];
  })();

  if (dataError) return <main className="data-error" role="alert"><h1>Data could not be loaded</h1><p>{dataError}</p><p>No substitute measurements are displayed.</p><button onClick={() => window.location.reload()}>Retry</button></main>;

  return (
    <GearDataContext.Provider value={gearData}>
    <div className={`hud-shell form-${formStyle} view-${view} ${showNarration?"has-narration":""} ${panelsHidden?"panels-hidden":""}`}>
      <div className="scene-viewport" style={{top:`max(var(--scene-top), ${headerClearance}px)`}} onPointerLeave={()=>{setCellHoverIdx(null);setActiveGroup(null);}}>
      <Canvas key={`${view}-${resetVersion}`}
        camera={{ position: [0, 0, 22], fov: 42, near: 0.05 }}
        raycaster={{ params: { Mesh:{}, Line:{threshold:0.05}, LOD:{}, Sprite:{}, Points: { threshold: POINT_HIT_THRESHOLD } } }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        onPointerMissed={() => {
          if (view === "detail") {
            clearSelection();
          }
        }}
      >
        <color attach="background" args={[formStyle !== "classic" ? "#171717" : "#020202"]} />
        {view === "detail" && <fog attach="fog" args={[formStyle !== "classic" ? "#171717" : "#010101", 20, 45]} />}
        <CameraRig key={`${view}-${resetVersion}`} view={view} snapCount={matchedIndices !== null ? matchedIndices.size : snapshots.length} focusIdx={timelineHoverIdx ?? gridSelectedIdx} gridOrbitEnabled={gridOrbitEnabled} searchActive={matchedIndices !== null} />
        {view === "grid" ? (snapshotsSettled ? (
          <GridScene key={formStyle}
            formStyle={formStyle}
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
          <PrimeRadiantScene key={`${resetVersion}-${formStyle}`}
            formStyle={formStyle}
            showEndpointLabels={labelsVisible}
            showSignalLabels={labelsVisible}
            snapshot={s}
            blocks={currentBlocks}
            activeGroup={displayGroup}
            frozen={!!pinnedGroup || showLegend}
            selectedBlockIndex={displayedCtx.type!=="none"?displayedCtx.index??-1:-1}
            legendView={showLegend}
            onHover={onHover}
            onClick={onClick}
            rotationEnabled={rotationEnabled}
            onDeselect={clearSelection}
            onBlockHover={(block, index) => { updateHoverCtx(block ? { type: "block", block, index } : { type: "none" }); }}
            onRingHover={(type) => updateHoverCtx(type ? {type: type as MetricId} : {type:"none"})}
            onMetricBlockHover={(type,block,index)=>updateHoverCtx({type,block,index})}
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
            <Bloom luminanceThreshold={view === "grid" ? 0.55 : 0.4} luminanceSmoothing={0.5} intensity={formStyle!=="classic" ? 0.08 : view === "grid" ? 0.4 : 0.7} mipmapBlur levels={6} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(formStyle!=="classic"?0:0.00035,formStyle!=="classic"?0:0.00035)} radialModulation={false} modulationOffset={0}/>
            <Vignette eskil={false} offset={0.25} darkness={formStyle!=="classic"?.3:.7} />
          </EffectComposer>
        )}
        {view === "detail" && <TrackballControls key={resetVersion} staticMoving={false} dynamicDampingFactor={0.14} noPan={false} noZoom={false} noRotate={false} minDistance={0.8} maxDistance={45} rotateSpeed={1.5} zoomSpeed={1.1} panSpeed={0.65} />}
      </Canvas>
      {formStyle==="gear"&&!gearData&&<div className="gear-load-status" role="status">{gearError??"Connecting the block details…"}{gearError&&<button type="button" onClick={()=>{setGearError(null);setGearAttempt(n=>n+1);}}>Retry</button>}</div>}
      {panelsHidden && snapshotsSettled && hoveredSnapshot && (
        <div className="scene-day-marker">
          <SnapshotCaption snapshot={hoveredSnapshot} />
        </div>
      )}
      </div>
      {formStyle !== "classic" && <div className="space-atmosphere" aria-hidden="true"/>}

      {/* ═══ TOP BANNER ═══ */}
      <div className="hud hud-banner" ref={bannerRef}>
        <h1 className="hud-title">Bitcoin <span> / </span> A network in time</h1><p className="hud-edition">{snapshotsSettled ? snapshots.length : "…"} days · seven signals · one evolving form</p><div className="form-switch" role="group" aria-label="Geometry style">{(["gear","atom","classic"] as const).map(style=><button type="button" key={style} aria-pressed={formStyle===style} className={formStyle===style?"active":""} onClick={()=>{clearSelection();updateHoverCtx({type:"none"});setFormStyle(style);}}>{style==="gear"?"Gear":style==="atom"?"Atom":"Classic"}</button>)}</div><div className="view-tools"><button className="reset-view" type="button" title="Reset camera position, rotation and zoom" onClick={()=>{clearSelection();setResetVersion(v=>v+1);}}>↺ Reset view</button>
        {view==="detail"&&<button className="labels-toggle" type="button" role="switch" aria-checked={labelsVisible} aria-label="Show geometry labels" title={labelsVisible?"Hide geometry labels":"Show geometry labels"} onClick={()=>setLabelsVisible(v=>!v)}>
          <span>Labels</span><span className="labels-toggle-track" aria-hidden="true"><span/></span>
        </button>}
        </div>
      </div>

      {/* ═══ GRID VIEW SUBTITLE ═══ */}
      {view === "grid" && (
        <div className="hud grid-subtitle">
          {!snapshotsSettled
            ? "Loading historical snapshots…"
            : isMobile
              ? `${snapshots.length} snapshots · tap to select, tap again to explore`
              : `${snapshots.length} historical snapshots · scroll through time · click a day to explore`}
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
            aria-label="Grid view"
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
            aria-label="Toggle orbit animation"
            aria-pressed={rotationEnabled&&!pinnedGroup}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
              <circle cx="20" cy="9" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button className="panels-toggle" type="button" aria-pressed={panelsHidden} aria-label={panelsHidden?"Show side panels":"Hide side panels"} title={panelsHidden?"Show side panels":"Hide side panels"} onClick={()=>{setPanelsHidden(v=>!v);setSearchHelpOpen(false);}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16"/>{panelsHidden&&<path d="M5 12h14"/>}</svg>
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
        {searchHelpOpen && createPortal(
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
          </div>,
          document.body
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
                    <span className="tl-date">{snap.snapshotTime.slice(0, 10)}<span className="tl-category">{snap.category}</span></span>
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
            if(Math.abs(dy)>20)e.preventDefault();
            if (dy < -20) setMobileSheetExpanded(true);
            else if (dy > 20) setMobileSheetExpanded(false);
          }}
          onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setMobileSheetExpanded(v=>!v);}}}
          role="button"
          aria-expanded={mobileSheetExpanded}
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
          {view === "detail" && (baseSnapshot.narration) && (
            <div className="mobile-narration">
              <span className="mobile-narration-label">Context</span>
              <p>{baseSnapshot.context ?? baseSnapshot.narration}</p>
            </div>
          )}
          <ContextPanel formStyle={formStyle}
            snapshot={
              view === "grid"
                ? snapshots[gridHoverIdx ?? gridSelectedIdx ?? activeIdx]
                : s
            }
            hoverCtx={view === "grid" ? { type: "none" } : displayedCtx}
            blockRecords={blockDetails.date===activeDate?blockDetails.records:[]}
            blockDetailsError={blockDetailsError}
            pinned={inspection.pinned}
            onInspectBlock={(index)=>{
              const block=currentBlocks[index];if(!block)return;
              if(!pinnedGroup)preClickState.current={wasPlaying:playRef.current,wasRotating:rotationRef.current};
              const context:HoverContext={type:"block",block,index};
              updateHoverCtx(context);setPinnedCtx(context);setPinnedGroup("spine");setPlaying(false);setRotationEnabled(false);
            }}
            blocks={
              view === "grid"
                ? (snapshotsWithBlocks[gridHoverIdx ?? gridSelectedIdx ?? activeIdx]?.blocks ?? [])
                : currentBlocks
            }
            onSelect={(metric) => {
              if (view === "grid") {
                if((gridHoverIdx ?? gridSelectedIdx ?? activeIdx)!==activeIdx)pendingMetric.current=metric;
                setActiveIdx(gridHoverIdx ?? gridSelectedIdx ?? activeIdx);
                setView("detail");
              }
              setPlaying(false); setRotationEnabled(false);
              updateHoverCtx({type:metric}); setPinnedCtx({type:metric}); setPinnedGroup(metricGroups[metric]);
            }}
          />
        </div>
      </div>

      {/* ═══ NARRATION BUBBLE ═══ */}
      {view === "detail" && showNarration && (baseSnapshot.narration) && (
        <div className="narration-bar">
          <div className="narration-content">
            <span className="narration-label">{baseSnapshot.label}</span>
            <p className="narration-text">{baseSnapshot.context ?? baseSnapshot.narration}</p>
          </div>
          <button className="narration-close" onClick={() => setShowNarration(false)} type="button" title="Hide narration">✕</button>
        </div>
      )}

      {/* ═══ INFO / VISUAL GUIDE MODAL ═══ */}
      {showDataInfo && (
        <div className="guide-overlay" onClick={() => setShowDataInfo(false)}>
          <div className="guide-modal" role="dialog" aria-modal="true" aria-label="About the Bitcoin geometry" onKeyDown={e=>{if(e.key==="Escape")setShowDataInfo(false);}} onClick={(e) => e.stopPropagation()}>
            <div className="guide-tabs">
              <button className={`guide-tab ${showGuideTab === "about" ? "active" : ""}`} onClick={() => setShowGuideTab("about")} type="button">About</button>
              <button className={`guide-tab ${showGuideTab === "legend" ? "active" : ""}`} onClick={() => setShowGuideTab("legend")} type="button">Legend</button>
              <button className={`guide-tab ${showGuideTab === "visual" ? "active" : ""}`} onClick={() => setShowGuideTab("visual")} type="button">Guide</button>
              <button className={`guide-tab ${showGuideTab === "source" ? "active" : ""}`} onClick={() => setShowGuideTab("source")} type="button">Sources</button>
            </div>

            <GuideContent tab={showGuideTab} formStyle={formStyle} snapshot={snapshotsWithBlocks.find(x=>x.snapshotTime.startsWith("2024-04-20"))??snapshotsWithBlocks[0]} count={snapshots.length}/>

            <button className="guide-close" onClick={() => setShowDataInfo(false)} type="button">Done</button>
          </div>
        </div>
      )}
    </div>
    </GearDataContext.Provider>
  );
}

const legendDefinitions = [
  ["Blocks","One tooth per block, ordered by height. Classic makes a circular gear; Atom distributes the same teeth around a spherical nucleus. Directions are layout only."],
  ["Transactions","Ring 1, the smallest orbit. Non-coinbase transactions divided by the largest daily count in this release. The arc uses a shared linear scale."],
  ["Weight","Each tooth: 0.12 visibility stem + 1.35 × block weight / 4,000,000 WU. Width is fixed. The modern 4 MWU reference is used across all eras."],
  ["Fees","Ring 2. Sum of fees in the displayed blocks, in BTC, divided by this release’s largest daily total. This is total fees, not a fee rate."],
  ["Difficulty","Ring 3. log10(mean block difficulty) / log10(release maximum). Difficulty 1 produces no arc. This shared logarithmic scale makes long-term changes visible."],
  ["Hashrate","Ring 4, the outer orbit. CoinMetrics’ estimated daily EH/s divided by the release maximum. Tiny early estimates may be imperceptible; missing estimates have no arc."],
  ["Addresses","Dots: one per 1,000 active addresses in detail, or 8,000 in the grid, rounded down. Caps: 1,500 / 180. Addresses are not people; positions and motion are decorative."],
];
function GuideContent({tab,formStyle,snapshot,count}:{tab:"about"|"legend"|"visual"|"source";formStyle:FormStyle;snapshot:NetworkSnapshot;count:number}){
  const [signal,setSignal]=useState(0),[step,setStep]=useState(0),[source,setSource]=useState(0);
  const definitions=formStyle==="gear"?gearLegendDefinitions:legendDefinitions;
  if(tab==="legend")return <div className="guide-body compact-guide guide-anatomy">
    <h3>Anatomy of a day</h3>
    <LegendIllustration formStyle={formStyle} snapshot={snapshot}/>
    <div className="guide-choices signal-choices" role="group" aria-label="Signal definition">{definitions.map(([name],i)=><button key={name} type="button" aria-pressed={signal===i} onClick={()=>setSignal(i)}>{name}</button>)}</div>
    <p className="guide-definition" aria-live="polite">{definitions[signal][1]}</p>
  </div>;
  if(tab==="visual"){
    const steps=[
      ["Explore","Hover for the day at the lower left; click a shape to explore. In orbit view, click a component to open its figures. On phones, tap once to preview, again to open. Show panels for the timeline and search (“war”, “AI”, “2020-2022”). Play visits curated dates."],
      ["Inspect","With panels open, hover a component to preview its figures. Click to pin; hovering another object previews it without losing that pin. Move away to restore it. Previous / Next moves between blocks. Click the pinned object or empty space to release."],
      ["Navigate","In detail, drag to orbit and scroll or pinch to zoom. Use two fingers to pan. In the grid, scroll or swipe through rows. Reset view restores framing. Hide panels keeps Grid, Play and Orbit visible while giving the geometry more room."],
      ["Compare",formStyle==="gear"?"Gear joins each block to two inner bars: transactions and fees. Transaction length is linear; fees use log1p(BTC). Difficulty and hashrate fill the two outer rims on shared log and linear scales. Hovering a block with a visible bar reveals its connection. Start and End mark the open block sequence. These connections explain relationships, not payment paths or security scores.":"Atom and Classic use the same measurements. Transactions, fees and hashrate use shared linear scales; difficulty uses a logarithmic scale. Zero and missing data both have no arc; the numeric panel distinguishes them. Event-day differences do not establish cause and effect."],
    ];
    return <div className="guide-body compact-guide"><div className="guide-kicker">Using the visualization</div><h3>Explore at your own pace</h3><div className="guide-choices" role="group" aria-label="Guide topic">{steps.map(([name],i)=><button type="button" key={name} aria-pressed={step===i} onClick={()=>setStep(i)}>{name}</button>)}</div><div className="guide-topic"><span className="guide-step">0{step+1}</span><h4>{steps[step][0]}</h4><p>{steps[step][1]}</p></div><p className="guide-footnote">Light, color and motion give the form character. They do not add measurements.</p></div>;
  }
  if(tab==="source"){
    const sources=[
      ["Blocks",<><p>Block count, transactions, weight, fees and mean difficulty come from individual <a href="https://mempool.space/docs/api/rest" target="_blank" rel="noreferrer">mempool.space records</a>. Hashes and header timestamps are matched against Blockchain.com, with Blockstream boundary checks.</p><p>The daily window is [00:00, next 00:00) UTC, using miner-supplied header timestamps. Fees are summed as integer satoshis before conversion to BTC.</p></>],
      ["Estimates",<><p><a href="https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/mining/hash-rate" target="_blank" rel="noreferrer">CoinMetrics HashRate</a> infers hashrate from difficulty and block production; <a href="https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/addresses/active-addresses" target="_blank" rel="noreferrer">AdrActCnt</a> counts active addresses, not people.</p><p>These use <a href="https://gitbook-docs.coinmetrics.io/network-data/methodologies/normalizing-block-times" target="_blank" rel="noreferrer">normalized Median-Time-Past dates</a>, a different window from the block geometry. Missing observations stay unavailable; no replacement values are invented.</p></>],
      ["History",<><p>Each event’s source is linked in its date panel. The {count} dates cover Bitcoin milestones and wider history, with a latest-day reference. This is an editorial selection, not an objective ranking.</p><p>A source establishes an event or market observation; it does not establish a causal link to the geometry. A late-day event may be followed by changes on subsequent days. BigQuery has not been used in this release.</p></>],
    ];
    return <div className="guide-body compact-guide"><div className="guide-kicker">Evidence and definitions</div><h3>Trace every signal</h3><div className="guide-choices" role="group" aria-label="Source topic">{sources.map(([name],i)=><button type="button" key={String(name)} aria-pressed={source===i} onClick={()=>setSource(i)}>{name}</button>)}</div><div className="guide-topic source-topic">{sources[source][1]}</div><div className="guide-downloads"><a href="/data/provenance.json" target="_blank" rel="noreferrer">Provenance ↗</a><a href="/data/snapshots.json" target="_blank" rel="noreferrer">Daily data ↗</a><a href="/data/blocks.json" target="_blank" rel="noreferrer">Block data ↗</a></div></div>;
  }
  return <div className="guide-body compact-guide"><div className="guide-kicker">Bitcoin / A network in time</div><h3>A sculpture of the network</h3><p>Seven quantities become one evolving form: blocks, transactions, weight, fees, difficulty, hashrate and active addresses.</p><div className="guide-facts"><div><strong>{count}</strong><span>curated dates</span></div><div><strong>7</strong><span>data signals</span></div><div><strong>3</strong><span>visual styles</span></div></div><p>Move from Bitcoin’s genesis through protocol milestones, financial turning points, elections, conflicts, pandemics, AI and quantum developments.</p><p className="guide-footnote">Connected gear, Atom and Classic share the same observations. Connected gear reveals block-level relationships. Historical context is an invitation to compare, not proof that an event caused a network change.</p></div>;
}

/* ═══════════════════════════════════════════════════════
   CONTEXT PANEL — shows different data per hover target
   ═══════════════════════════════════════════════════════ */

function ContextPanel({formStyle,snapshot:s,hoverCtx,blocks,blockRecords,blockDetailsError,pinned,onInspectBlock,onSelect}:{
  formStyle:FormStyle;snapshot:NetworkSnapshot;hoverCtx:HoverContext;blocks:BlockTuple[];blockRecords:BlockRecord[];blockDetailsError:string|null;pinned:boolean;
  onInspectBlock:(index:number)=>void;onSelect:(id:MetricId)=>void;
}) {
  const gearData=useContext(GearDataContext);
  const meanWeight = blocks.length ? blocks.reduce((n,b)=>n+b[2],0)/blocks.length : s.meanBlockWeight;
  const metrics: {id:MetricId;label:string;shape:string;value:string;description:string}[] = [
    {id:"blocks",label:"Blocks",shape:"Center · tooth count",value:formatMetric(s.blockCount),description:"One tooth for every block on this header-timestamp UTC date, ordered by height."},
    {id:"transactions",label:"Transactions",shape:"Ring 1 · inner",value:formatMetric(s.transactionCount),description:`Non-coinbase transactions. Linear arc scale: 0–${formatMetric(s.scales.dailyTransactions)} per day.`},
    {id:"weight",label:"Block weight",shape:"Center · tooth length",value:formatMetric(meanWeight==null?null:meanWeight/1e6,3," MWU avg"),description:"The average is shown here; each tooth uses its own block’s weight. Length scales against 4 MWU, plus a small fixed visibility stem."},
    {id:"fees-total",label:"Fees",shape:"Ring 2",value:formatMetric(s.totalFeesBtc,4," BTC"),description:`Sum of fees across this day’s blocks. Linear arc scale: 0–${formatMetric(s.scales.feesBtc,4)} BTC.`},
    {id:"difficulty",label:"Difficulty",shape:"Ring 3 · tilted",value:formatMetric(s.difficulty,2),description:`Mean block difficulty. Logarithmic arc scale: difficulty 1–${formatMetric(s.scales.difficulty)}.`},
    {id:"hashrate",label:"Hashrate",shape:"Ring 4 · outer",value:formatMetric(s.networkHashrateEh,2," EH/s"),description:`CoinMetrics daily estimate. Linear arc scale: 0–${formatMetric(s.scales.hashrateEh,2)} EH/s; normalized Median-Time-Past day.`},
    {id:"addresses",label:"Active addresses",shape:"Dots",value:formatMetric(s.activeAddresses),description:"CoinMetrics active addresses, not people. Each dot represents 1,000 addresses in detail or 8,000 in the grid, rounded down; caps are 1,500 and 180 dots. Normalized Median-Time-Past day."},
  ];
  if(formStyle==="gear")metrics.forEach(m=>{m.shape=gearShapes[m.id];m.description=gearDescriptions[m.id];});
  const selected=metrics.find(m=>m.id===hoverCtx.type);
  const inspected=hoverCtx.type!=="none"&&hoverCtx.block ? hoverCtx : null;
  const relationKey=hoverCtx.type==="block"?"blocks":hoverCtx.type;
  const relation=formStyle==="gear"?gearRelations[relationKey]:null;
  const related=relationshipGroups(relationKey==="none"?null:metricGroups[relationKey as MetricId]);
  return <div className="ctx-content">
    <div className="ctx-eyebrow">{s.snapshotTime.slice(0,10)} UTC <span>{s.category ?? "Bitcoin"}</span></div>
    <div className="ctx-title">{s.label}</div>
    {formStyle==="gear"&&blocks.length>0&&<div className="gear-height-range">Height {blocks[0][0].toLocaleString()} → {blocks.at(-1)![0].toLocaleString()}</div>}
    {inspected?.block&&inspected.index!==undefined&&<BlockInspector itemName={formStyle==="gear"?"Block":"Tooth"} fallbackFees={formStyle==="gear"?gearData?.days[s.snapshotTime.slice(0,10)]?.feesSat[inspected.index]:undefined} block={inspected.block} index={inspected.index} count={blocks.length} record={blockRecords.find(b=>b.height===inspected.block![0])} error={blockDetailsError} pinned={pinned} onInspect={onInspectBlock}/>}
    <div className="metric-list">{metrics.map(m=>{const highlighted=selected?.id===m.id || (hoverCtx.type==='block' && (m.id==='blocks'||m.id==='weight'));return <button type="button" key={m.id} className={`metric-row ${highlighted?'is-selected':''} ${formStyle==='gear'&&related.includes(metricGroups[m.id])?'is-related':''}`} onClick={()=>onSelect(m.id)} aria-pressed={highlighted}>
      <span><span className="metric-name">{m.label}</span><span className="metric-shape">{m.shape}</span></span><span className="metric-value">{m.value}</span>
    </button>;})}</div>
    {selected && <div className="metric-explanation"><span className="guide-kicker">{selected.shape}</span><p>{selected.description}</p>{(selected.id==="blocks"||selected.id==="weight")&&blocks.length>0&&<button type="button" className="inspect-blocks" onClick={()=>onInspectBlock(0)}>Inspect individual blocks →</button>}</div>}

    {relation&&<div className="gear-relation"><span className="guide-kicker">Connected roles</span><h4>{relation.title}</h4><p>{relation.text}</p></div>}
    {!selected && hoverCtx.type!=='block' && <p className="metric-hint">{formStyle==="gear"?"Select a part to explore its role in the network.":"Select a signal to find its shape."}</p>}
    {!!s.contextSources?.length && <div className="context-citations">{s.contextSources.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer">Event source{(s.contextSources?.length??0)>1?` ${i+1}`:''} ↗</a>)}</div>}
  </div>;
}

function BlockInspector({itemName="Tooth",fallbackFees,block,index,count,record,error,pinned,onInspect}:{itemName?:string;fallbackFees?:number|null;block:BlockTuple;index:number;count:number;record?:BlockRecord;error:string|null;pinned:boolean;onInspect:(index:number)=>void}){
  const fees=record?record.totalFeesSat:fallbackFees;
  const figures=[
    ["Weight",`${block[2].toLocaleString('en-US')} WU`],
    ["Weight / 4 MWU",`${(block[2]/4000000*100).toFixed(4)}%`],
    ["Size",`${block[1].toLocaleString('en-US')} bytes`],
    ["Transactions",`${block[3].toLocaleString('en-US')} total`],
    ["Excluding coinbase",(block[3]-1).toLocaleString('en-US')],
    ...(fees!==undefined?[["Fees",fees===null?"Unavailable":`${(fees/1e8).toFixed(8)} BTC`]]:[]),
    ...(record?[
      ["Difficulty",record.difficulty.toLocaleString('en-US',{maximumFractionDigits:8})],
      ["Header time (UTC)",new Date(record.timestamp*1000).toISOString().slice(11,19)]
    ]:[])
  ];
  return <section className="block-inspector" aria-label="Individual block figures">
    <div className="block-inspector-kicker">{itemName} {index+1} / {count} <span>{pinned?'Pinned':'Hover · click to pin'}</span></div>
    <h3>Block #{block[0].toLocaleString('en-US')}</h3>
    <dl>{figures.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!record&&<p className="block-detail-status">{error??(fees===undefined?'Loading timestamp and fees…':'Loading timestamp and additional block details…')}</p>}
    <div className="block-inspector-actions"><button type="button" disabled={index===0} onClick={()=>onInspect(index-1)}>← Previous</button><button type="button" disabled={index===count-1} onClick={()=>onInspect(index+1)}>Next →</button>{record&&<a href={`https://mempool.space/block/${record.hash}`} target="_blank" rel="noreferrer">Verify block ↗</a>}</div>
  </section>;
}

/* ═══════════════════════════════════════════════════════
   3D SCENE — Per-block spine + ring arcs
   ═══════════════════════════════════════════════════════ */

interface SceneProps {
  snapshot: NetworkSnapshot;
  formStyle: FormStyle;
  blocks: BlockTuple[];
  activeGroup: string | null;
  frozen?: boolean;
  selectedBlockIndex?: number;
  rotationEnabled?: boolean;
  legendView?: boolean;
  onHover: (groupId: string | null) => void;
  onClick: (groupId: string) => void;
  onDeselect?: () => void;
  onBlockHover: (block: BlockTuple | null, index: number) => void;
  onRingHover: (type: string | null, idx?: number) => void;
  onMetricBlockHover?: (type:"transactions"|"fees-total",block:BlockTuple,index:number)=>void;
  showEndpointLabels?:boolean; showSignalLabels?:boolean;
}

/* ═══════════════════════════════════════════════════════
   CAMERA RIG — smoothly animates camera between grid and detail views
   ═══════════════════════════════════════════════════════ */

function CameraRig({ view, snapCount, focusIdx, searchActive }: { view: "grid" | "detail"; snapCount: number; focusIdx: number | null; gridOrbitEnabled: boolean; searchActive?: boolean }) {
  const { camera,size,gl }=useThree();
  const layout=useMemo(()=>gridLayout(size.width,size.height,snapCount),[size.width,size.height,snapCount]);
  const targetY=useRef(0);
  useLayoutEffect(()=>{
    if(view==="grid"){
      const row=searchActive?layout.firstRow:Math.max(layout.firstRow,Math.min(layout.lastRow,Math.floor((focusIdx??0)/layout.columns)));
      targetY.current=layout.rowY(row);
      resetCameraPose(camera as THREE.PerspectiveCamera,targetY.current,layout.distance,42,targetY.current);
    }else{
      // Fit within the actual free viewport, including narrow portrait phones.
      const tangent=Math.tan(36*Math.PI/360),aspect=size.width/size.height;
      const distance=Math.max(10,4.1/(tangent*Math.min(1,aspect)));
      resetCameraPose(camera as THREE.PerspectiveCamera,1.5,distance,36,0);
    }
  },[view,camera,layout,size.width,size.height,searchActive]);
  useEffect(()=>{
    if(view!=="grid"||focusIdx==null||searchActive)return;
    const row=Math.max(layout.firstRow,Math.min(layout.lastRow,Math.floor(focusIdx/layout.columns)));
    targetY.current=layout.rowY(row);
  },[view,focusIdx,searchActive,layout]);
  useEffect(()=>{
    if(view!=="grid")return;
    const canvas=gl.domElement;
    const clamp=(y:number)=>Math.max(layout.rowY(layout.lastRow),Math.min(layout.rowY(layout.firstRow),y));
    const worldPerPixel=2*layout.distance*Math.tan(21*Math.PI/180)/size.height;
    const wheel=(e:WheelEvent)=>{e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?size.height:1);targetY.current=clamp(targetY.current-pixels*worldPerPixel);};
    let touchY=0;
    const touchStart=(e:TouchEvent)=>{if(e.touches.length)touchY=e.touches[0].clientY;};
    const touchMove=(e:TouchEvent)=>{if(!e.touches.length)return;e.preventDefault();const y=e.touches[0].clientY;targetY.current=clamp(targetY.current-(touchY-y)*worldPerPixel);touchY=y;};
    canvas.addEventListener("wheel",wheel,{passive:false});
    canvas.addEventListener("touchstart",touchStart,{passive:true});
    canvas.addEventListener("touchmove",touchMove,{passive:false});
    return ()=>{canvas.removeEventListener("wheel",wheel);canvas.removeEventListener("touchstart",touchStart);canvas.removeEventListener("touchmove",touchMove);};
  },[view,gl,layout,size.height]);
  useFrame((_,delta)=>{
    if(view!=="grid")return;
    camera.position.set(0,THREE.MathUtils.lerp(camera.position.y,targetY.current,1-Math.exp(-10*delta)),layout.distance);
    camera.up.set(0,1,0);camera.lookAt(0,camera.position.y,0);
  });
  return null;
}

/* ═══════════════════════════════════════════════════════
   GRID SCENE — 5x5 landing page with simplified mini snapshots
   ═══════════════════════════════════════════════════════ */

function GridScene({ formStyle, snapshots, hoverIdx, selectedIdx, matchedIndices, legendHover, onHover, onSelect }: {
  formStyle:FormStyle;
  snapshots: NetworkSnapshot[];
  hoverIdx: number | null;
  selectedIdx: number | null;
  matchedIndices: Set<number> | null;
  legendHover: string | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}) {
  const {size}=useThree();
  const layout=gridLayout(size.width,size.height,matchedIndices?.size ?? snapshots.length);
  const COLS=layout.columns;
  const phaseOffsets=useMemo(()=>Array.from({length:snapshots.length},(_,i)=>Math.sin(i*1.618)*Math.PI*2),[snapshots.length]);
  const SPACING_X = 3.6; // world units between cells (horizontal)
  const SPACING_Y = 3.2; // world units between cells (vertical)
  // When filtering, repack matched cells into the top of the grid so the user
  // doesn't have to scroll. Map real index → display index (0, 1, 2, …) for
  // just the matched cells.
  const displayIndexMap = useMemo(() => {
    const m = new Map<number, number>();
    let d = 0;
    snapshots.forEach((_, i) => {
      if (matchedIndices === null || matchedIndices.has(i)) {
        m.set(i, d);
        d++;
      }
    });
    return m;
  }, [snapshots, matchedIndices]);
  const effectiveCount = matchedIndices !== null ? matchedIndices.size : snapshots.length;
  const ROWS = Math.max(1, Math.ceil(effectiveCount / COLS));


  return (
    <group>
      {/* Grid-wide lighting — shared across all cells */}
      {formStyle==="gear"&&<><hemisphereLight intensity={1.8} color="#fff2dd" groundColor="#4a3528"/><directionalLight position={[4,6,8]} intensity={2.5}/></>}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 10, 15]} intensity={6} color="#F7931A" distance={60} decay={1.5} />
      <pointLight position={[15, -5, 10]} intensity={4} color="#FFB547" distance={50} decay={1.5} />
      <pointLight position={[-15, 5, 10]} intensity={4} color="#B87206" distance={50} decay={1.5} />

      {snapshots.map((snap, i) => {
        const d = displayIndexMap.get(i);
        if (d === undefined) return null;
        const col = d % COLS;
        const row = Math.floor(d / COLS);
        const x = (col - (COLS - 1) / 2) * SPACING_X;
        const y = ((ROWS - 1) / 2 - row) * SPACING_Y;
        const isHovered = hoverIdx === i;
        const isSelected = selectedIdx === i;
        const dim = hoverIdx !== null
          ? (isHovered ? 1 : 0.25)
          : selectedIdx !== null
            ? (isSelected ? 1 : 0.45)
            : 1;
        // Selected cell is larger and pulses; hovered cell is larger.
        const baseScale = isSelected ? 0.36 : isHovered ? 0.32 : 0.28;

        return (
          <group
            key={snap.id}
            position={[x, y, 0]}
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
              scale={baseScale}
              rotation={[0, 0, phaseOffsets[i]]}
            >
              <MiniSnapshot formStyle={formStyle} snapshot={snap} opacity={dim} highlighted={isHovered || isSelected} legendHover={legendHover} />
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

function MiniSnapshot({ formStyle, snapshot: s, opacity: dim, highlighted, legendHover }: {
  formStyle:FormStyle;
  snapshot: NetworkSnapshot;
  opacity: number;
  highlighted: boolean;
  legendHover: string | null;
}) {
  if(formStyle==="gear")return <GearShape snapshot={s} mini opacity={dim} activeGroup={legendHover}/>;
  return <group>
    <MiniSpine formStyle={formStyle} blocks={s.blocks ?? []} opacity={dim} highlighted={highlighted || legendHover==="spine"}/>
    <CoreRings formStyle={formStyle} snapshot={s} activeGroup={legendHover} opacity={dim}/>
    <MiniParticles count={Math.min(Math.floor((s.activeAddresses??0)/s.scales.gridAddressesPerParticle),180)} opacity={dim} highlighted={legendHover==="particles"}/>
  </group>;
}

const MINI_PARTICLE_MAX = 180;

function MiniParticles({ count, opacity, highlighted = false }: { count: number; opacity: number; highlighted?: boolean }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(MINI_PARTICLE_MAX * 3);
    for (let i = 0; i < MINI_PARTICLE_MAX; i++) {
      // Distribute around rings — random angle, random radius in 1.8-4.0 range, random y
      const a = randomFor(i, 0) * Math.PI * 2;
      const r = 1.8 + randomFor(i, 1) * 2.2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = (randomFor(i, 2) - 0.5) * 4;
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
function MiniSpine({formStyle,blocks,opacity,highlighted}:{formStyle:FormStyle;blocks:BlockTuple[];opacity:number;highlighted:boolean}) {
  const mesh=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{if(mesh.current)setBlockInstances(mesh.current,blocks,formStyle);},[blocks,formStyle]);
  if(!blocks.length)return null;
  return <instancedMesh key={blocks.length} ref={mesh} args={[undefined,undefined,blocks.length]}>
    <boxGeometry args={[1,1,1]}/>
    {formStyle==="atom"?<meshToonMaterial color="white" emissive="#F7931A" emissiveIntensity={highlighted?.55:.14} transparent opacity={opacity}/>:<meshStandardMaterial color="white" emissive="#F7931A" emissiveIntensity={highlighted?.4:.1} metalness={.85} roughness={.15} transparent opacity={opacity}/>}
  </instancedMesh>;
}

function CoreRings({formStyle,snapshot:s,activeGroup,opacity=1,onHover,onClick,onRingHover}:{formStyle:FormStyle;snapshot:NetworkSnapshot;activeGroup:string|null;opacity?:number;onHover?:(id:string|null)=>void;onClick?:(id:string)=>void;onRingHover?:(id:string|null)=>void}) {
  const rings = coreRingSpecs(s,formStyle);
  return <>{rings.map(r=><group key={r.id} rotation={r.rotation}
    onPointerOver={onHover?e=>{e.stopPropagation();onHover(r.id);onRingHover?.(r.id);}:undefined}
    onPointerOut={onHover?()=>{onHover(null);onRingHover?.(null);}:undefined}
    onClick={onClick?e=>{e.stopPropagation();if(e.delta>5)return;onRingHover?.(r.id);onClick(r.id);}:undefined}>
    <ArcBand cartoon={formStyle==="atom"} radius={r.radius} thickness={0.065} depth={0.045} startAngle={0} endAngle={2*Math.PI*r.fill} color={formStyle==="atom"?"#F7931A":r.color} emissiveIntensity={activeGroup===r.id?1.15:0.48} opacity={opacity*(activeGroup===r.id?1:0.86)}/>
  </group>)}</>;
}


function PrimeRadiantScene({ formStyle, snapshot:s, blocks, activeGroup, frozen=false, selectedBlockIndex=-1, rotationEnabled=true, legendView=false, onHover, onClick, onBlockHover, onRingHover, onMetricBlockHover, showEndpointLabels=true, showSignalLabels=false }:SceneProps) {
  const sceneRef=useRef<THREE.Group>(null);
  const addressAnchor=useRef(new THREE.Vector3());
  const addressCount=Math.min(Math.floor((s.activeAddresses??0)/s.scales.detailAddressesPerParticle),MAX_PARTICLES);
  const annotations=useMemo(()=>formStyle!=="gear"&&showSignalLabels&&!legendView?legacySignalLabels(s,blocks,formStyle,addressCount,addressAnchor.current):[],[formStyle,showSignalLabels,legendView,s,blocks,addressCount]);
  const endpoints=useMemo(()=>formStyle!=="gear"&&showEndpointLabels&&!legendView?legacyEndpoints(blocks,formStyle):[],[formStyle,showEndpointLabels,legendView,blocks]);
  useFrame((_,delta)=>{if(sceneRef.current && rotationEnabled && !frozen && !legendView)sceneRef.current.rotation.y+=delta*0.08;});
  return <group ref={sceneRef} rotation={[-0.32,0.45,-0.12]} scale={0.85}>
    <ambientLight intensity={0.18}/>
    <pointLight position={[0,3,6]} intensity={5.5} color="#F7931A" distance={22} decay={1.8}/>
    <pointLight position={[6,1,2]} intensity={2} color="#FFCE85" distance={20}/>
    <pointLight position={[-4,-4,-3]} intensity={3} color="#B87206" distance={18}/>
    {formStyle==="gear"?<>
      <hemisphereLight intensity={1.8} color="#fff2dd" groundColor="#4a3528"/>
      <directionalLight position={[4,6,8]} intensity={2.5} color="#ffead5"/>
      <directionalLight position={[-5,-2,-4]} intensity={1.4} color="#b6c7dc"/>
      <GearShape snapshot={s} blocks={blocks} showEndpointLabels={legendView?false:showEndpointLabels} showSignalLabels={!legendView&&showSignalLabels} activeGroup={activeGroup} selectedBlockIndex={selectedBlockIndex} onHover={onHover} onClick={onClick} onBlockHover={onBlockHover} onRingHover={onRingHover} onMetricBlockHover={onMetricBlockHover}/>
    </>:<>
    {annotations.length>0&&<SignalLabels labels={annotations} root={sceneRef}/>}
    {endpoints.map(endpoint=><Html key={endpoint.role} position={endpoint.position} style={{pointerEvents:'none'}}>
      <span className={`gear-chain-label gear-chain-${endpoint.role}`}>{endpoint.role==='only'?'Only block':endpoint.role==='start'?'Start':'End'} <b>#{endpoint.height.toLocaleString('en-US')}</b></span>
    </Html>)}
    <BlockSpine formStyle={formStyle} blocks={blocks} highlighted={activeGroup==="spine"} selectedIndex={selectedBlockIndex} onHover={onHover} onClick={onClick} onBlockHover={onBlockHover}/>
    <CoreRings formStyle={formStyle} snapshot={s} activeGroup={activeGroup} onHover={onHover} onClick={onClick} onRingHover={onRingHover}/>
    <group onPointerOver={e=>{e.stopPropagation();onHover("particles");onRingHover("addresses");}} onPointerOut={()=>{onHover(null);onRingHover(null);}} onClick={e=>{e.stopPropagation();if(e.delta>5)return;onRingHover("addresses");onClick("particles");}}>
      <AddressParticles count={addressCount} labelAnchor={addressAnchor.current} paused={!rotationEnabled||frozen} highlighted={activeGroup==="particles"}/>
    </group>
    </>}
  </group>;
}

function LegendFraming(){
  const {camera,size}=useThree();
  useLayoutEffect(()=>{camera.position.z=Math.max(14,6.3/(size.width/size.height)/Math.tan(21*Math.PI/180));camera.updateProjectionMatrix();},[camera,size.width,size.height]);
  return null;
}

function LegendIllustration({formStyle,snapshot:s}:{formStyle:FormStyle;snapshot:NetworkSnapshot}) {
  const noop=()=>{};
  const gearData=useContext(GearDataContext);
  // Real fourth-halving measurements, rendered by the same scene as detail.
  const rotation=new THREE.Euler(-0.32,0.45,-0.12);
  const anchor=(p:[number,number,number])=>new THREE.Vector3(...p).applyEuler(rotation).multiplyScalar(.85).toArray() as [number,number,number];
  const ringPoint=(index:number):[number,number,number]=>{
    const ring=coreRingSpecs(s,formStyle)[index],a=2*Math.PI*ring.fill*.65;
    return new THREE.Vector3(Math.cos(a)*ring.radius,Math.sin(a)*ring.radius,0).applyEuler(new THREE.Euler(...ring.rotation)).toArray() as [number,number,number];
  };
  const legendIndex=Math.min(60,(s.blocks?.length??1)-1);
  const gearCore=useMemo(()=>{
    const day=gearData?.days[s.snapshotTime.slice(0,10)];
    return day&&s.blocks?.length===day.heights.length?buildGearGeometry(s.blocks,day.feesSat,gearData!.maxNonCoinbase,gearData!.maxBlockFeesSat):null;
  },[s,gearData]);
  useEffect(()=>()=>{gearCore?.rails.dispose();gearCore?.links.dispose();},[gearCore]);
  const endPoint=(matrices:THREE.Matrix4[]|undefined)=>matrices?.[legendIndex]?new THREE.Vector3(0,.4,0).applyMatrix4(matrices[legendIndex]).toArray() as [number,number,number]:[0,0,0] as [number,number,number];
  const rimPoint=(radius:number,fraction:number,z:number):[number,number,number]=>{const p=polygonPoint(radius,fraction);p[2]=z;return p;};
  const labels:{text:string;point:[number,number,number];end:[number,number,number]}[]=formStyle==="gear"?[
    {text:"Blocks · linked teeth",point:endPoint(gearCore?.bodyMatrices),end:[-4.4,2.8,0]},
    {text:"Weight · tooth length",point:endPoint(gearCore?.bodyMatrices),end:[-4.4,1.1,0]},
    {text:"Transactions · inner bars",point:endPoint(gearCore?.transactionMatrices),end:[-4.4,-.8,0]},
    {text:"Fees · paired bars",point:endPoint(gearCore?.feeMatrices),end:[-4.4,-2.5,0]},
    {text:"Difficulty · inner rim",point:rimPoint(2.55,.65*difficultyFill(s.difficulty,s.scales.difficulty),-.08),end:[4.4,2.4,0]},
    {text:"Hashrate · outer rim",point:rimPoint(2.83,.65*normalized(s.networkHashrateEh,s.scales.hashrateEh),-.15),end:[4.4,.5,0]},
    {text:"Addresses · center dots",point:addressPoint(10).toArray() as [number,number,number],end:[4.4,-2.2,0]},
  ]:[
    {text:"Blocks · center",point:[-0.6,0.6,0],end:[-4.4,2.8,0]},
    {text:"Weight · tooth length",point:[-1.25,0,0],end:[-4.4,1.1,0]},
    {text:"1 · Transactions",point:ringPoint(0),end:[-4.4,-0.8,0]},
    {text:"2 · Fees",point:ringPoint(1),end:[-4.4,-2.5,0]},
    {text:"3 · Difficulty",point:ringPoint(2),end:[4.4,2.4,0]},
    {text:"4 · Hashrate",point:ringPoint(3),end:[4.4,0.5,0]},
    {text:"Addresses · dots",point:[2,-1.8,1],end:[4.4,-2.2,0]},
  ];
  return <figure className="legend-figure" aria-label={formStyle==="gear"?"Labeled connected gear: block teeth connect to paired transaction and fee bars, central address dots, and protective difficulty and hashrate rims.":"Labeled Bitcoin geometry: blocks and weight form the gear, four rings encode transactions, fees, difficulty and hashrate, dots encode active addresses."}>
    <div className="legend-canvas"><Canvas camera={{position:[0,0,14],fov:42}} dpr={[1,2]}>
      <LegendFraming/>
      <PrimeRadiantScene formStyle={formStyle} snapshot={s} blocks={s.blocks??[]} activeGroup={null} frozen rotationEnabled={false} legendView onHover={noop} onClick={noop} onBlockHover={noop} onRingHover={noop}/>
      {labels.map(l=><group key={l.text}><Line points={[anchor(l.point),[l.end[0]*.72,l.end[1],0],l.end]} color="#a88a5b" lineWidth={.7} transparent opacity={.7}/><Html position={l.end} center><span className="shape-callout">{l.text}</span></Html></group>)}
    </Canvas></div>
    <figcaption>Fourth halving · 20 April 2024 · {formStyle} view · actual measurements.<br/>{formStyle==="gear"?"One connected form. Each highlighted relationship explains a protocol role.":"Arc lengths retain the measured values; rings need not be full."}</figcaption>
  </figure>;
}

/* ═══════════════════════════════════════════════════════
   ADDRESS PARTICLES — count = floor(activeAddresses / 1000)
   Data-honest: 0 addresses = 0 particles
   Uniform particle size: no claim about output ownership.
   ═══════════════════════════════════════════════════════ */

const MAX_PARTICLES = 1500;

function AddressParticles({ count, paused = false, highlighted = false, labelAnchor }: { count: number; paused?: boolean; highlighted?:boolean; labelAnchor?:THREE.Vector3 }) {
  const pointsRef = useRef<THREE.Points>(null);
  const dataRef = useRef<{ angles: Float32Array; speeds: Float32Array; radii: Float32Array; yOffsets: Float32Array; yDrift: Float32Array } | null>(null);

  useMemo(() => {
    const angles = new Float32Array(MAX_PARTICLES);
    const speeds = new Float32Array(MAX_PARTICLES);
    const radii = new Float32Array(MAX_PARTICLES);
    const yOffsets = new Float32Array(MAX_PARTICLES);
    const yDrift = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      angles[i] = randomFor(i, 0) * Math.PI * 2;
      speeds[i] = 0.05 + randomFor(i, 1) * 0.18;
      radii[i] = 1.5 + randomFor(i, 2) * 2.5; // spread across all ring radii
      yOffsets[i] = (randomFor(i, 3) - 0.5) * 4;
      yDrift[i] = (randomFor(i, 4) - 0.5) * 0.1;
    }
    dataRef.current = { angles, speeds, radii, yOffsets, yDrift };
  }, []);

  const positions = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  useLayoutEffect(()=>{
    if(!pointsRef.current)return;
    pointsRef.current.geometry.setDrawRange(0,count);
    pointsRef.current.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),5.5);
  },[count]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !dataRef.current || count === 0) return;
    const { angles, speeds, radii, yOffsets, yDrift } = dataRef.current;
    const pos = pointsRef.current.geometry.attributes.position;

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

    }
    if(labelAnchor)labelAnchor.fromBufferAttribute(pos,Math.min(10,count-1));
    pos.needsUpdate = true;
    pointsRef.current.geometry.setDrawRange(0, count);
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#FFCA6E"
        size={highlighted?0.065:0.035}
        transparent
        opacity={highlighted?1:0.55}
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
  const key = [radius, thickness, depth, startAngle, endAngle].join("_");
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

function ArcBand({ cartoon=false, radius, thickness, depth, startAngle, endAngle, color, emissiveIntensity, opacity }: {
  cartoon?:boolean;
  radius: number; thickness: number; depth: number;
  startAngle: number; endAngle: number;
  color: string; emissiveIntensity: number; opacity: number;
}) {
  const geo = useMemo(() => endAngle - startAngle >= 1e-6 ? makeArcGeo(radius, thickness, depth, startAngle, endAngle) : null, [radius, thickness, depth, startAngle, endAngle]);
  // Thicker invisible hit area for easier mouse interaction
  // Hit padding kept modest so background taps between rings aren't captured.
  const hitGeo = useMemo(() => endAngle - startAngle >= 1e-6 ? makeArcGeo(radius, Math.max(thickness * 1.8, 0.09), depth * 2, startAngle, endAngle) : null, [radius, thickness, depth, startAngle, endAngle]);

  if (!geo || !hitGeo || opacity <= 0) return null;
  return (
    <group>
      {/* Invisible hit mesh — fat target for raycasting */}
      <mesh geometry={hitGeo} dispose={null} position={[0, 0, -depth * 1.5]}>
        <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Visible arc */}
      <mesh geometry={geo} dispose={null} position={[0, 0, -depth / 2]}>
        {cartoon ? <meshToonMaterial color="#F7931A" emissive="#F7931A" emissiveIntensity={emissiveIntensity*.2} transparent={opacity<1} opacity={opacity} side={THREE.DoubleSide}/> : <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} metalness={.6} roughness={.18} transparent opacity={opacity} side={THREE.DoubleSide}/>}

      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   PER-BLOCK SPINE — InstancedMesh with real block data
   ═══════════════════════════════════════════════════════ */

function BlockSpine({formStyle,blocks,highlighted=false,selectedIndex=-1,onHover,onClick,onBlockHover}:{
  formStyle:FormStyle;blocks:BlockTuple[];highlighted?:boolean;selectedIndex?:number;
  onHover:(id:string|null)=>void;onClick:(id:string)=>void;onBlockHover:(block:BlockTuple|null,index:number)=>void;
}){
  const mesh=useRef<THREE.InstancedMesh>(null),hit=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    if(mesh.current)setBlockInstances(mesh.current,blocks,formStyle,false,selectedIndex);
    if(hit.current)setBlockInstances(hit.current,blocks,formStyle,true);
  },[blocks,formStyle,selectedIndex]);
  if(!blocks.length)return null;
  return <group>
    <instancedMesh key={`visible-${blocks.length}`} ref={mesh} args={[undefined,undefined,blocks.length]} raycast={()=>null}>
      <boxGeometry args={[1,1,1]}/>
      {formStyle==="atom"?<meshToonMaterial color="white" emissive="#F7931A" emissiveIntensity={highlighted?.35:.14}/>:<meshStandardMaterial color="white" emissive="#F7931A" emissiveIntensity={highlighted?.4:.1} metalness={.85} roughness={.1}/>}
    </instancedMesh>
    <instancedMesh key={`hit-${blocks.length}`} ref={hit} args={[undefined,undefined,blocks.length]}
      onPointerMove={e=>{
        e.stopPropagation();
        onHover("spine");
        if(e.instanceId!==undefined){onBlockHover(blocks[e.instanceId],e.instanceId);}
      }}
      onPointerOut={()=>{onHover(null);onBlockHover(null,0);}}
      onClick={e=>{
        e.stopPropagation();
        if(e.delta>5||e.instanceId===undefined)return;
        onHover("spine");onBlockHover(blocks[e.instanceId],e.instanceId);onClick("spine");
      }}>
      <boxGeometry args={[1,1,1]}/>
      <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide}/>
    </instancedMesh>
  </group>;
}

export default App;
