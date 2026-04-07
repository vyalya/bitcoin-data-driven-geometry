# Bitcoin Network Digital Twin

## User Interaction and Flow Spec

## 1. Purpose

This product is an immersive, high-fidelity digital twin of the Bitcoin network. It combines:

- A WebGL simulation canvas for visualizing the network as a living system
- A conversational orchestrator that explains, filters, and runs simulations
- A governed data layer rooted primarily in Strategy Mosaic historical intelligence

The experience should feel elegant, accurate, immersive, usable, and insightful.

This product is explicitly focused on network technical analysis and simulation. It is not a price prediction, trading, or day-trading tool.

This spec is intentionally versioned as a living document. It defines a strong V1 without overcommitting to interactions that require data or infrastructure we do not yet have.

## 2. Product Principles

- Truth before spectacle: visuals should be driven by real Bitcoin data wherever possible
- Simulation is explicit: the user must always know whether they are seeing historical playback, current state, or a projected scenario
- The scene is exploratory, not decorative: every visual element should map to meaningful network concepts
- Chat is an orchestrator, not a novelty: it should control views, run scenarios, and explain observed changes
- Progressive depth: users can start with a cinematic overview and drill into blocks, fees, miners, mempool conditions, and scenarios
- Analysis over prediction: the system should help users understand network structure, stress, and behavior, not forecast price

## 2.1 Non-Goals

- No price prediction
- No day-trading workflows
- No buy/sell signaling
- No candle-chart-first experience
- No implied investment advice

## 3. Primary User Modes

### 3.1 Observe

The user watches the network state evolve over time using historical or near-current data.

Examples:

- "Show me the network during the 2021 bull market"
- "Replay the last 30 days of fee pressure"
- "Zoom out and show miner concentration by pool"

### 3.2 Investigate

The user asks questions, clicks objects, applies filters, and inspects details.

Examples:

- "Why did the mempool spike here?"
- "Which pools gained share over the last 12 months?"
- "What changed around the last halving?"

This mode is the core of network technical analysis. The goal is to surface structural behavior, congestion, resilience, and operational change across the Bitcoin network.

### 3.3 Simulate

The user runs scenario-based projections rooted in historical distributions and semantic logic.

Examples:

- "Simulate a 25% hashrate drop"
- "What if average fees double for 72 hours?"
- "What happens if block production slows by 15%?"

### 3.4 Present

The user uses the product as a demo or executive storytelling tool.

Examples:

- Guided camera tours
- Saved viewpoints
- Narrated scenarios
- Clean kiosk mode with chat minimized

## 4. Core Screen Model

## 4.1 Main Layout

- Left: primary WebGL visualization canvas
- Right: collapsible orchestrator panel
- Bottom: timeline and simulation state rail
- Top: lightweight command/status bar

## 4.2 Layout Goals

- The visualization should dominate the experience
- The chat should feel operational, like mission control
- Controls should remain available without cluttering the scene
- Important state labels must always be visible: Data Mode, Time Window, Scenario Mode, Confidence/Source

## 5. Experience States

At all times the interface should clearly show one of these states:

### 5.1 Historical Playback

The scene is rendering from historical data snapshots.

UI labels:

- `Historical`
- Date/time range
- Snapshot interval

### 5.2 Current Estimate

The scene is rendering the latest available state, composed from Mosaic plus supplemental feeds if enabled.

UI labels:

- `Current Estimate`
- Last updated timestamp
- Source mix indicator

### 5.3 Simulation

The scene is rendering a projected or hypothetical state.

UI labels:

- `Simulation`
- Scenario name
- Base state timestamp
- Assumption summary

### 5.4 Blended Mode

The scene combines historical baselines with a scenario overlay.

UI labels:

- `Historical + Simulation Overlay`
- Delta metric summary

## 6. Visualization Model

The Bitcoin network twin should use a small number of visually distinctive, semantically meaningful layers.

### 6.1 The Immutable Spine

Represents confirmed blockchain progression.

Behavior:

- Blocks are rendered as geometric units along a central chain or spatial backbone
- New block arrival during playback appears as an attach/build animation
- Block attributes affect appearance: fee level, block size, subsidy era, confirmation cadence

Primary user value:

- Makes block production and blockchain progression legible

### 6.2 The Mempool Storm

Represents unconfirmed transaction pressure.

Behavior:

- Particle field or volumetric cloud around the spine
- Density maps to mempool size or transaction count
- Color/heat maps to fee pressure and congestion
- Motion expresses urgency, competition, and churn

Primary user value:

- Makes fee market conditions intuitive

### 6.3 Miner Constellation

Represents mining pools or broader hashrate distribution.

Behavior:

- Network nodes positioned in a ring, globe, or graph layout
- Node scale and pulse map to hashrate share
- Connectivity or influence arcs show share, concentration, or inferred geography
- Pool/offline events visibly dim or remove nodes

Primary user value:

- Makes mining concentration and resilience intuitive

### 6.4 Network Health Overlay

Represents higher-order governed metrics.

Possible overlays:

- Security margin
- Congestion index
- Fee pressure
- Block interval stress
- Decentralization score

Primary user value:

- Gives a concise operational reading of the network

## 6.5 Technical Analysis Overlay

Represents analysis-specific highlights generated by the orchestrator.

Possible overlays:

- congestion hotspots
- miner concentration warnings
- abnormal block interval periods
- fee regime changes
- resilience/stress deltas
- historical analog highlights

Primary user value:

- Helps the user see why a pattern matters without reducing the experience to conventional dashboards

## 6.6 Analysis Lens Modes

The user should be able to shift the same scene into different analytical lenses without changing the conceptual model.

Suggested lenses:

- `Network Health`
- `Mempool and Fees`
- `Mining and Hashrate`
- `Block Production`
- `Resilience and Stress`
- `Historical Comparison`

Each lens changes:

- emphasized metrics
- labels and overlays
- color priorities
- recommended prompts

## 7. Primary User Flows

## 7.1 Flow A: Landing and Orientation

Goal: orient a first-time user within 30-60 seconds.

1. User lands on the app.
2. The canvas opens in an attract mode with slow ambient motion and current or featured historical state.
3. A short onboarding overlay explains the three core layers: blockchain, mempool, miners.
4. The right panel shows starter prompts.
5. The user either:
   - clicks `Start Exploring`
   - chooses a featured scenario
   - types a question

Success criteria:

- The user understands what the main visual layers mean
- The user knows chat can control the scene
- The user sees whether the view is historical, current estimate, or simulation

## 7.2 Flow B: Ask and Visualize

Goal: let the user ask a natural-language question and immediately see the scene respond.

1. User asks: "Show me the network during the last halving."
2. The orchestrator parses intent into:
   - time window
   - viewpoint
   - metrics to emphasize
3. The scene animates into the selected time/state.
4. The right panel returns:
   - a concise answer
   - source summary
   - any assumptions
5. Relevant metrics appear as chips or overlay cards.

Success criteria:

- The scene changes in a visible, satisfying way
- The explanation is grounded in real data
- The user can inspect or refine the answer without starting over

Typical network technical analysis prompts:

- "Show me where congestion built up during this period"
- "Highlight abnormal block production intervals"
- "Explain why fees accelerated here"
- "Compare miner concentration now versus one year ago"
- "Show network stress during the last halving window"

## 7.3 Flow C: Click-to-Inspect

Goal: turn visual curiosity into analysis.

1. User clicks a block, pool node, or dense mempool region.
2. A detail card opens in-context or in the side panel.
3. The card shows:
   - object identity
   - key metrics
   - change over time
   - related actions
4. The user can pivot from the object.

Pivot examples:

- `Show trend`
- `Compare to previous period`
- `Highlight related entities`
- `Use as simulation input`

Success criteria:

- Clicking is useful, not gimmicky
- Detail cards are concise but drillable

## 7.4 Flow D: Run a Simulation

Goal: make scenarios feel serious, legible, and reversible.

1. User enters a prompt such as "Simulate a 20% drop in hashrate over 14 days."
2. The orchestrator interprets the request and proposes a scenario card before execution.
3. The scenario card shows:
   - scenario name
   - baseline date or period
   - manipulated variables
   - duration
   - confidence note
4. User confirms or edits the scenario.
5. The system computes and returns:
   - narrative explanation
   - structured delta payload for the scene
6. The scene transitions to simulation mode with visual changes and delta overlays.
7. The user can scrub the scenario timeline, compare baseline vs simulated, and save/share the view.

Success criteria:

- The user understands what is real versus projected
- Deltas are visible in both text and visuals
- Reverting to baseline is one click

Supported simulation families should stay network-focused:

- hashrate shock
- mempool growth shock
- fee pressure increase
- block cadence slowdown
- miner concentration change

## 7.5 Flow E: Compare States

Goal: help users understand change, not just state.

1. User selects two periods or a baseline plus simulation.
2. The scene enters compare mode.
3. The UI offers:
   - side-by-side metric cards
   - visual diff highlights
   - toggle between absolute and relative change
4. The orchestrator summarizes key differences.

Success criteria:

- Comparison feels analytic rather than purely cinematic

## 8. Right Panel: Orchestrator UX

The right panel is the operator console.

## 8.1 Core Responsibilities

- Interpret natural language
- Generate scene actions
- Explain what changed
- Surface data provenance and assumptions
- Manage simulation lifecycle
- Surface network-technical insights in plain language

## 8.2 Message Types

- Answer: response to a user question
- Action confirmation: proposed view or scenario before execution
- Simulation result: explains outputs and deltas
- Source note: identifies data source and recency
- Constraint notice: explains when realtime precision is not available

## 8.3 Suggested Starter Prompts

- "Show me Bitcoin during the last halving"
- "Replay the biggest fee spike in the last 5 years"
- "Highlight miner concentration by pool"
- "Simulate a 15% hashrate drop"
- "Explain what I am seeing"
- "Show me where network stress is building"
- "Compare block production stress across major events"
- "Highlight structural changes in miner distribution"

## 8.4 Trust UX

Each orchestrator response should expose:

- Whether the answer is from historical data, near-current data, or simulation
- Which metrics were used
- When data was last refreshed
- Any assumptions or fallback sources

## 9. Timeline and Playback UX

The bottom rail controls time.

## 9.1 Timeline Features

- Play/pause historical playback
- Jump to significant network events
- Adjust playback speed
- Switch granularity where supported
- Scrub through time

## 9.2 Milestone Markers

Examples:

- Halvings
- Major fee spikes
- Miner migration periods
- ETF-related periods of demand shock
- All-time mempool congestion events

## 9.3 Time Granularity

V1 should support coarse but useful granularity:

- Daily
- 4-hour
- Hourly for selected metrics if available

Avoid pretending to have tick-level fidelity unless it truly exists.

## 10. Controls and Commands

Users should be able to control the twin through both UI and chat.

## 10.1 Direct UI Controls

- Camera presets
- Layer toggles
- Metric selector
- Time range selector
- Compare mode toggle
- Simulation mode toggle

## 10.2 Chat-Driven Commands

Examples:

- "Zoom to miner activity"
- "Emphasize fee pressure"
- "Compare now to the 2024 halving month"
- "Reset to baseline"
- "Highlight periods of abnormal congestion"
- "Filter to network health metrics only"
- "Show the biggest structural shifts in this window"

Chat actions should visibly map to interface changes so users learn the system.

## 10.3 Analysis Actions

The interface should support analysis-first actions beyond generic filtering.

Examples:

- `Highlight anomaly`
- `Explain this region`
- `Compare to historical analog`
- `Show causal metrics`
- `Run scenario from this state`
- `Pin this metric`

These actions should be accessible from:

- chat responses
- detail cards
- context menus on selected objects

## 11. Information Design

The interface should keep textual overlays minimal and high-signal.

## 11.1 Always-Visible Status

- Mode
- Time reference
- Primary metric focus
- Data freshness

## 11.2 On-Demand Detail

- Object cards
- Metric drilldowns
- Source/provenance panel
- Simulation assumptions panel

## 11.3 Analysis Readouts

When the orchestrator highlights a technical-analysis finding, the interface should expose:

- what changed
- why it matters
- which metrics support the interpretation
- whether the finding is observed, derived, or simulated
- what related comparisons the user can run next

## 12. Design Requirements

## 12.1 Visual Tone

- Premium and restrained
- Dark, spatial backdrop with precise luminous accents
- Motion that feels purposeful, not noisy
- Typography and HUD elements that feel like analytical instrumentation, not a video game

## 12.2 Usability Rules

- Never rely on color alone for critical meaning
- Keep camera movement smooth and recoverable
- Make every simulation reversible
- Preserve orientation during large scene transitions
- Provide reduced-motion mode

## 13. Accessibility and Inclusivity

- Keyboard access for core controls
- Text alternatives for major visual states
- High-contrast metric cards
- Colorblind-safe palettes for congestion and health indicators
- Reduced-motion setting for particle-heavy visuals

## 14. V1 Scope

V1 should prioritize a convincing, truthful demo over total feature breadth.

### In Scope

- Split-screen layout
- One strong main scene with the three core layers
- Historical playback from curated Bitcoin datasets
- Chat-driven scene control
- Basic click-to-inspect
- A limited set of named simulations
- Compare baseline versus scenario
- Network technical analysis prompts and overlays
- Historical analog and anomaly highlighting

### Out of Scope for V1

- Full freeform agent autonomy
- True low-latency realtime digital twin behavior
- Exhaustive transaction-level rendering at full network scale
- Multi-user collaboration
- Mobile-first parity
- Price analysis and trading workflows

## 14.1 Supported Analysis Questions for V1

The first version should answer a constrained but useful set of network analysis questions.

Examples:

- Where is congestion increasing?
- How does fee pressure compare to similar historical periods?
- Is block production behaving abnormally?
- How concentrated is mining activity in this period?
- What network stresses appear before or during major events?
- How does this simulated shock change network health?

## 15. V2 Evolution Paths

- Multi-scene modes: blockchain, mining, fee market, geographic view
- Saved stories and guided tours
- More sophisticated scenario builder
- Direct MCP-based semantic introspection where available
- Operator presets for conference/demo mode
- Exportable snapshots and narrated replays

## 16. Open Questions

- Which Bitcoin dimensions are definitely available in Mosaic versus supplemental sources?
- How often can Strategy Mosaic-backed data refresh practically occur for this experience?
- Which simulations are deterministic, and which are explanatory approximations?
- Do we want one canonical scene or multiple dedicated views with shared semantics?
- Is the first audience technical, executive, or conference/general?

## 17. Product Framing

Recommended framing:

`An AI-assisted digital twin for Bitcoin network technical analysis and simulation, rooted in real historical data.`

## 18. Initial Recommendation

For the first build, optimize around one memorable loop:

1. Load into a beautiful current-or-historical network view
2. Ask a question in chat
3. Watch the twin reframe and explain itself
4. Run one serious simulation
5. Compare projected effects to baseline

If that loop feels truthful and cinematic, the rest of the product can evolve around it.
