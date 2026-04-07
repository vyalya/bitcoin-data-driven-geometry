# Bitcoin Network Digital Twin

An AI-assisted digital twin for Bitcoin network technical analysis and simulation, rooted in real historical data.

## Current Documentation

- [User Interaction and Flow Spec](./specs/user-interaction-flow.md)
- [Technical Spec](./specs/technical-spec.md)
- [Data Design](./docs/data-design.md)
- [Data Source Strategy](./docs/data-sources.md)
- [Visual Direction](./docs/visual-direction.md)
- [Visual-to-Data Mapping](./docs/visual-data-mapping.md)
- [Implementation Status](./docs/implementation-status.md)

## Product Direction

This project is focused on:

- Bitcoin network technical analysis
- historical and interval-based network intelligence
- high-fidelity WebGL visualization
- explainable scenario simulation
- Strategy Mosaic as a semantic intelligence layer where appropriate

This project is not focused on:

- price prediction
- day trading
- trading signals
- investment advice

## Initial Build Shape

- WebGL visualization on the left
- AI orchestrator/chat on the right
- historical playback and comparison
- bounded network simulations
- provenance-aware, real-data-driven scene updates

## Local App

The first implementation phase is mock-first and does not require Strategy Mosaic connectivity yet.

### Run

```bash
npm install
npm run dev
```

### Current Scope

- split-screen application shell
- mocked network snapshots
- lightweight WebGL scene
- scenario switching
- analysis-oriented side panel

## Notes

The specs in `specs/` are intended to evolve as implementation begins.
