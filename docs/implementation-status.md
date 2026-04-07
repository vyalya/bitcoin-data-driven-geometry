# Bitcoin Network Digital Twin

## Implementation Status

## Current State

The repository currently contains:

- product and technical specs
- Snowflake/Mosaic-oriented data design
- source strategy guidance
- visual direction guidance
- visual-to-data mapping rules
- a mock-first React + React Three Fiber prototype

## Current Prototype Scope

The prototype is intentionally mock-first and does not yet connect to Strategy Mosaic or Snowflake.

It currently demonstrates:

- split-screen application shell
- right-side semantic command panel
- left-side WebGL hero scene
- mocked historical and simulation snapshots
- data-shaped fee buckets, ring bands, and mining pool nodes
- a default zoomed-out composition with user-controlled zoom

## Current Visual Model

The scene is built around a front-facing Bitcoin network instrument:

- a central settlement spine
- concentric segmented data rings
- fee-band orbital layers
- a mempool particle field
- miner nodes around the perimeter

Each of these is intended to map to real or simulation-manipulated data.

## What Is Working

- the scene now reads more like a single analytical object rather than scattered primitives
- the visual language is warmer and more Bitcoin-native
- the default framing shows the overall structure before the user zooms
- the implementation preserves the rule that meaningful scene elements correspond to data-shaped structures

## What Is Not Yet There

The prototype is still not at true hi-fidelity quality.

It still needs:

- more refined materials and lighting
- more elegant linework and segmentation
- subtler and more premium motion behavior
- better depth layering and atmospheric polish
- tighter visual restraint so fewer marks do more work

## Data Integrity Rule

The current design direction keeps one rule above all others:

Every meaningful visual element should correspond to:

- a real observed measure
- a real aggregated bucket
- a real entity
- or a simulation-transformed version of the same baseline data

No major visual system should exist purely as decoration.

## Next Recommended Pass

The next implementation pass should focus almost entirely on the hero scene:

1. improve material and glow quality
2. refine ring geometry and instrumentation detail
3. make motion more elegant and less busy
4. keep the full structure visible by default
5. preserve strict visual-to-data mapping

## Run

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
```
