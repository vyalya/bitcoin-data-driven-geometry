# Bitcoin Network Digital Twin

## Technical Spec

## 1. Purpose

This document defines an initial technical architecture for a high-fidelity Bitcoin Network Digital Twin that combines:

- WebGL-based visualization
- LLM-orchestrated interaction and simulation
- Strategy Mosaic as the governed semantic intelligence layer
- Supplemental Bitcoin data sources where Mosaic is not sufficient

This spec is designed to evolve. It aims to support a credible V1 on local development hardware while preserving a path to greater fidelity and scale.

The system is explicitly for Bitcoin network technical analysis and simulation. It is not a system for price prediction, trading signals, or day-trading workflows.

## 2. Product Constraints

## 2.1 Data Reality

Strategy Mosaic is not primarily a realtime provider. It is strongest when:

- Modeling governed business logic
- Serving historical intelligence from warehouses and data lakes
- Providing semantically stable access to curated metrics

Therefore:

- The twin should be built on historical and interval-based snapshots first
- Near-current state should be treated as an estimate assembled from latest available snapshots and optional supplemental feeds
- "Realtime" should only be claimed where latency and update cadence are truly known

## 2.2 Development Environment

Local environment:

- Headless Mac mini M4
- 16 GB RAM
- 256 GB SSD

Implications:

- Prefer efficient scene complexity over brute-force geometry counts
- Pre-aggregate and cache data before it reaches the browser
- Avoid trying to render every transaction individually at full historical scale
- Keep local services lightweight and composable

## 3. Technical Goals

- High visual fidelity without fake data
- Clear separation between semantic data logic and rendering logic
- An orchestrator that can drive both chat and simulation commands
- Evolving data pipeline that can begin with batch snapshots and later add faster feeds
- A system that Claude can efficiently help implement in slices
- Strong support for network-state analysis, anomaly detection, comparison, and scenario explanation

## 3.1 Non-Goals

- No price forecasting pipeline
- No market technical indicators focused on trading
- No broker, exchange, or execution integrations
- No recommendation engine for investment actions

## 4. Proposed Architecture

The system should be split into five layers.

## 4.1 Presentation Layer

Responsibilities:

- React application shell
- WebGL rendering
- HUD, timeline, overlays, side panel chat
- Scene state and interaction state

Recommended stack:

- React
- TypeScript
- Vite
- `@react-three/fiber`
- `@react-three/drei`
- Zustand or a similarly lightweight state store
- Tailwind or CSS modules for panel/HUD styling

Why:

- React Three Fiber is productive for iterative scene building
- TypeScript helps stabilize the contract between simulation payloads and rendering
- Vite keeps local iteration fast on modest hardware

## 4.2 Orchestration Layer

Responsibilities:

- Accept natural-language user requests
- Classify intent: explain, focus, compare, simulate, inspect
- Resolve requests into semantic queries and simulation jobs
- Return both narrative text and structured scene updates

Recommended stack:

- Python
- FastAPI
- Pydantic
- Async job execution where needed

Why:

- Python is practical for both LLM orchestration and data work
- It aligns with your note that Strategy can use Python as a data source
- FastAPI is simple, structured, and Claude-friendly to implement

## 4.3 Semantic/Data Access Layer

Responsibilities:

- Access Strategy Mosaic via JDBC and/or MCP
- Normalize Mosaic responses into application-facing models
- Apply governed metric definitions and dimension mappings

Capabilities:

- Historical queries
- Interval aggregations
- Dimension filtering
- Governed metric retrieval

Non-goals:

- Raw browser-side JDBC access
- Exposing Mosaic-specific complexity directly to the front end

## 4.4 Supplemental Data Layer

Responsibilities:

- Fill gaps where Mosaic data is absent, delayed, or impractical
- Provide optional current-state signals
- Supply network-native metrics not yet modeled in Mosaic

Possible sources:

- Public blockchain datasets
- Bitcoin node-derived snapshots
- Mempool and fee APIs
- Mining pool and hashrate datasets

Guideline:

- Use supplemental sources only when necessary and label them clearly in provenance metadata

## 4.5 Storage and Caching Layer

Responsibilities:

- Persist precomputed snapshots for playback
- Cache simulation inputs and outputs
- Support fast scene loading without re-querying all upstream systems

Recommended options for V1:

- DuckDB for local analytics and snapshot generation
- Parquet for historical snapshot files
- SQLite or Postgres for app metadata if needed

Why:

- DuckDB + Parquet is ideal for historical analytical slices on a local machine
- It reduces load on Mosaic during iterative development

## 5. High-Level Runtime Flow

## 5.1 Historical Playback Request

1. User requests a time window or selects a milestone.
2. Front end asks orchestration API for a scene dataset.
3. API pulls from snapshot cache first.
4. If unavailable, API queries Mosaic/supplemental sources, materializes a normalized snapshot, and caches it.
5. API returns:
   - scene payload
   - metric summary
   - provenance metadata
6. Front end animates the scene.

## 5.2 Simulation Request

1. User submits a scenario in chat.
2. Orchestrator parses intent and builds a simulation spec.
3. The system validates whether the scenario is:
   - supported deterministic simulation
   - heuristic/explanatory simulation
   - not yet supported
4. Orchestrator queries baseline state.
5. Simulation engine transforms the baseline according to scenario rules.
6. API returns:
   - natural-language explanation
   - structured delta payload
   - assumption/confidence metadata
7. Front end switches to simulation mode and renders the delta.

## 6. Data Model

The app should use an application-level canonical model regardless of upstream source.

## 6.1 Core Semantic Entities

- `NetworkSnapshot`
- `BlockSeries`
- `MempoolSnapshot`
- `MiningPoolSnapshot`
- `MetricSeries`
- `ScenarioDefinition`
- `ScenarioResult`
- `ProvenanceRecord`

## 6.2 Example Canonical Types

```ts
type ProvenanceRecord = {
  source: "mosaic" | "supplemental" | "derived";
  datasetName: string;
  refreshedAt: string;
  latencyClass: "historical" | "interval-current" | "approximate";
};

type NetworkSnapshot = {
  snapshotTime: string;
  mode: "historical" | "current_estimate" | "simulation";
  blocks: BlockPoint[];
  mempool: MempoolSnapshot;
  miningPools: MiningPoolSnapshot[];
  metrics: Record<string, number>;
  provenance: ProvenanceRecord[];
};
```

## 6.3 Suggested Bitcoin Metrics for V1

Historical backbone metrics:

- Block height
- Block timestamp
- Block interval
- Total fees per block
- Average fee rate
- Mempool size
- Mempool transaction count
- Estimated hashrate
- Difficulty
- Mining pool share
- Block subsidy era / halving epoch

Derived/guided metrics:

- Fee pressure index
- Congestion score
- Block production stress
- Miner concentration score
- Network health score

Analysis-support metrics:

- abnormal block interval score
- mempool acceleration
- fee regime classification
- miner share change rate
- resilience-under-shock score
- historical analog similarity score

These derived metrics should be governed in Mosaic when feasible, or mirrored exactly in the Python layer until they can be formalized upstream.

## 6.4 Analysis-Focused Capabilities

The canonical model should support these analytical behaviors in V1:

- detect stress and congestion conditions
- compare periods and regimes
- highlight anomalies and structural shifts
- annotate likely drivers using governed metrics
- generate scene overlays tied to analytical findings

These are distinct from prediction. The system is explaining network behavior, not forecasting asset price.

## 7. Simulation Model

V1 should avoid pretending to simulate Bitcoin consensus at a protocol-accurate level. Instead, it should support bounded, explainable scenario models.

## 7.1 Simulation Categories

### A. Playback-Based Counterfactuals

Use historical analogs to show "similar past conditions."

Example:

- "Show conditions similar to past high-fee periods"

### B. Deterministic Transformations

Apply explicit parameter changes to governed metrics.

Examples:

- Increase mempool depth by 30%
- Reduce hashrate by 20%
- Slow average block cadence by 10%

### C. Heuristic Scenario Models

Use rules and approximations to estimate likely downstream effects.

Examples:

- Lower hashrate implies slower block production until adjustment
- Higher fee pressure implies denser, hotter mempool visuals
- Greater miner concentration implies lower resilience score

## 7.1.1 Supported Network Technical Analysis Use Cases

The simulation and query stack should support a focused set of analysis tasks:

- explain congestion build-up
- identify abnormal production intervals
- compare miner concentration across periods
- assess resilience under hashrate shocks
- compare network stress before and after major events
- find historical analog states from the stored history

## 7.2 Simulation Contract

Every scenario should produce:

- `scenario_id`
- `baseline_snapshot_time`
- `simulation_window`
- `manipulated_variables`
- `derived_impacts`
- `confidence_level`
- `warnings`
- `scene_delta`

## 7.3 Trust Rules

- Never label heuristic output as prediction without qualification
- Separate observed data from simulated values in both API and UI
- Include assumptions in the simulation payload
- Never imply trading or investment guidance from network-state analysis

## 8. Front-End System Design

## 8.1 Application Zones

- `SceneCanvas`
- `ControlHUD`
- `TimelineRail`
- `ChatPanel`
- `InspectorPanel`
- `GlobalStatusBar`
- `AnalysisOverlayPanel`

## 8.2 Scene Composition

Suggested render modules:

- `BlockchainSpineLayer`
- `MempoolStormLayer`
- `MinerConstellationLayer`
- `MetricOverlayLayer`
- `AnalysisHighlightLayer`
- `CameraDirector`
- `PostProcessingPipeline`

## 8.2.1 Analysis Overlay Responsibilities

The analysis layer should render:

- anomaly highlights
- stress hotspots
- historical comparison markers
- selected metric emphasis
- simulation deltas

These overlays should be data-driven and toggleable so the user can distinguish the base scene from analytical interpretation.

## 8.3 Rendering Strategy

Use GPU-friendly primitives and instancing where possible.

Recommendations:

- Instanced meshes for blocks/nodes
- GPU particles for mempool field if needed
- Adjustable quality presets
- Frustum culling and level-of-detail controls
- Keep post-processing tasteful and optional

## 8.4 Performance Budgets for V1

Target:

- Stable interaction on local dev machine
- 30-60 FPS on desktop under normal scene load
- Initial load under a few seconds for default scene

Guardrails:

- Default to aggregated visual representations
- Limit visible history window in-scene
- Stream or page large historical ranges instead of loading all-time data at once

## 9. API Design

The front end should consume simple, explicit contracts.

## 9.1 Core Endpoints

- `GET /api/scene/default`
- `POST /api/scene/query`
- `POST /api/chat`
- `POST /api/simulations/run`
- `GET /api/simulations/:id`
- `GET /api/metrics/catalog`
- `GET /api/events/milestones`
- `POST /api/analysis/explain`
- `POST /api/analysis/compare`
- `POST /api/analysis/anomalies`

## 9.2 Example `POST /api/chat` Response

```json
{
  "message": "Fee pressure increased sharply in this period. I updated the scene to emphasize mempool congestion and block fee intensity.",
  "actions": [
    {
      "type": "set_time_range",
      "payload": {
        "start": "2024-04-15T00:00:00Z",
        "end": "2024-05-01T00:00:00Z"
      }
    },
    {
      "type": "set_focus",
      "payload": {
        "layer": "mempool",
        "metric": "fee_pressure_index"
      }
    }
  ],
  "scenePayload": {
    "snapshotTime": "2024-04-20T12:00:00Z",
    "mode": "historical"
  },
  "provenance": [
    {
      "source": "mosaic",
      "datasetName": "btc_network_daily",
      "refreshedAt": "2026-04-07T12:00:00Z",
      "latencyClass": "historical"
    }
  ]
}
```

## 10. Orchestrator Design

The orchestrator should behave as an action planner, not just a chatbot.

## 10.1 Responsibilities

- Intent detection
- Parameter extraction
- Query planning
- Simulation validation
- Provenance assembly
- Scene-action generation
- Network-analysis explanation generation
- Analytical highlight planning

## 10.2 Suggested Internal Pipeline

1. User utterance received
2. Classify intent
3. Resolve entities and metrics
4. Check data availability
5. Build execution plan
6. Query/compute
7. Return narrative + scene payload

Suggested intent classes for V1:

- `explain_state`
- `highlight_stress`
- `compare_periods`
- `inspect_entity`
- `run_simulation`
- `find_analog`

## 10.3 Recommended Safety Boundaries

- Restrict scenario generation to known supported templates in V1
- Require explicit source labeling
- Fail gracefully when a question exceeds available data fidelity
- Reject or reframe requests that imply price prediction or trading advice

## 11. Strategy Mosaic Integration

The Mosaic integration should be isolated behind a small adapter.

## 11.1 Adapter Responsibilities

- Execute semantic queries through JDBC or MCP
- Translate governed metric names to canonical API fields
- Return normalized tabular or structured outputs

## 11.2 Interface Shape

Example Python interface:

```python
class MosaicAdapter:
    async def get_metric_series(self, metric_name: str, filters: dict, grain: str): ...
    async def get_snapshot(self, snapshot_time: str, dimensions: dict): ...
    async def list_entities(self, entity_type: str, filters: dict): ...
```

## 11.3 Key Design Choice

Do not let Mosaic-specific schemas leak into WebGL code. The browser should consume a stable application model only.

## 12. Data Acquisition Strategy

Because the experience should be rooted in at least 10 years of Bitcoin network history, data ingestion needs to be deliberate.

## 12.1 Recommended Historical Coverage

- Minimum: last 10 years
- Preferred: full available history for core block and difficulty metrics
- Higher-resolution windows only where they materially improve the story

## 12.2 Suggested Ingestion Phases

### Phase 1: Curated Historical Backbone

Ingest the minimum viable dataset needed for:

- block progression
- fees
- mempool
- hashrate/difficulty
- mining pool distribution

Store as:

- Parquet partitions
- DuckDB analytical views
- Mosaic-modeled semantic objects where ready

Phase 1 should optimize specifically for network analysis queries and scene generation, not for raw market charting.

### Phase 2: Interval-Current Updates

Add periodic refresh jobs for:

- recent mempool state
- recent fee metrics
- current/latest block info
- recent mining pool share estimates

Suggested cadence:

- 5 min
- 15 min
- hourly

depending on source and cost

### Phase 3: Provenance Unification

Ensure every metric used in scene rendering carries provenance and refresh metadata.

## 13. Testing Strategy

## 13.1 Front-End Testing

- Unit tests for scene state transforms
- Visual regression for HUD/panel states
- Interaction tests for chat-to-scene actions

## 13.2 API Testing

- Contract tests for scene payloads
- Orchestrator intent routing tests
- Simulation output validation

## 13.3 Data Testing

- Snapshot completeness checks
- Metric sanity bounds
- Provenance presence checks
- Historical continuity tests

## 13.4 Experience Testing

- Does the user always know which mode they are in?
- Do scene changes clearly reflect the requested action?
- Are simulations clearly distinguished from observations?

## 13.5 Analysis Testing

- Do anomaly highlights correspond to known historical conditions?
- Are derived analysis metrics stable across re-runs?
- Do compare-mode outputs match source aggregates?
- Are unsupported predictive/trading requests safely reframed?

## 14. Deployment and Local Dev

## 14.1 Local Dev Topology

- Front end on Vite dev server
- Python FastAPI service locally
- DuckDB/Parquet local data store
- Mosaic connection behind adapter

## 14.2 Resource Guidance

For the Mac mini setup:

- Precompute historical scene snapshots
- Keep default scene compact
- Add quality tiers for particles and post-processing
- Use smaller demo datasets during active front-end iteration

## 15. Phased Delivery Plan

## Phase 0: Spec and Data Validation

- Confirm target metrics
- Confirm what Mosaic can expose today
- Identify supplemental sources
- Define canonical application model
- Define supported network-analysis questions

## Phase 1: Foundational Demo

- Split layout
- Basic chat panel
- One strong scene
- Historical playback
- Static milestone events
- Analysis overlays for congestion, stress, and miner concentration

## Phase 2: Semantic Integration

- Mosaic adapter
- Governed metric mapping
- Provenance-aware payloads
- Click-to-inspect details
- Analysis endpoints and intent routing

## Phase 3: Scenario Engine

- Supported scenario templates
- Simulation payloads
- Compare mode
- Saveable scenario presets
- historical analog retrieval

## Phase 4: Fidelity Upgrade

- Better particles and lighting
- richer milestone narratives
- more refined camera direction
- interval-current update pipeline

## 16. Risks and Mitigations

## 16.1 Risk: Overpromising Realtime Fidelity

Mitigation:

- Build around historical and interval-based truth
- Label current views as estimates when appropriate

## 16.2 Risk: Too Much Raw Data for Browser Rendering

Mitigation:

- Aggregate aggressively
- Precompute scene-friendly snapshots
- Use level-of-detail and time-windowing

## 16.3 Risk: LLM Makes Unsupported Simulation Claims

Mitigation:

- Constrain V1 to scenario templates
- Return explicit confidence and assumptions

## 16.5 Risk: Product Drifts Toward Generic Trading Tool

Mitigation:

- Keep price and trading out of the canonical model
- Scope prompts, endpoints, and UI labels around network-state analysis
- Make non-goals explicit in docs and implementation

## 16.4 Risk: Upstream Semantic Model Is Incomplete

Mitigation:

- Mirror missing calculations in Python temporarily
- Keep the canonical API model stable

## 17. Recommended Initial Build Decisions

If starting immediately, I recommend:

1. Build the front end as React + React Three Fiber + TypeScript + Zustand
2. Build the orchestrator as FastAPI + Pydantic
3. Use DuckDB + Parquet for local historical snapshots
4. Start with daily and hourly aggregates, not full raw-chain rendering
5. Implement only 3-5 supported simulation templates in V1
6. Treat Mosaic as the semantic brain for governed metrics, with supplemental feeds clearly isolated
7. Build analysis-first endpoints before adding more visual complexity

## 18. Open Questions

- What exact Bitcoin datasets can be sourced into Mosaic first?
- Will the first milestone use JDBC, MCP, or both?
- Which metrics matter most for the initial story: fees, hashrate, miner concentration, mempool, or all of them?
- How much of the simulation logic belongs in Mosaic versus Python?
- Is the first deliverable a polished conference demo, an exploratory internal prototype, or a reusable product foundation?

## 19. Recommendation Summary

The best V1 architecture is not a realtime twin in the strict sense. It is a semantically governed historical-and-interval digital twin with a strong simulation layer and a premium WebGL front end.

More specifically, it should be an analysis-first twin:

- explain network state
- compare historical regimes
- surface structural change
- run bounded network simulations
- avoid trading or price-prediction scope entirely

That framing matches:

- what Mosaic is best at
- what your local hardware can support
- what can be built credibly and iteratively with Claude doing implementation

It will still feel high-fidelity, as long as the product is explicit about time, provenance, and simulation boundaries.
