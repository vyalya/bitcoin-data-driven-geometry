# The Bitcoin Network as Data Driven Geometry

An interactive 3D visualization of the Bitcoin network across 25 historically significant snapshot dates, from Genesis (January 2009) through the 2025 market correction. Every shape, ring, particle, and block maps to real on-chain data published through Strategy Mosaic — nothing is decorative.

**Powered by Strategy Mosaic**

![The Bitcoin Network as Data Driven Geometry](image.png)

## What You're Looking At

### Center Spine — Blocks
Each cuboid is one real Bitcoin block mined that day. Width = block weight (wider = fuller block, up to 4 MWU). Brightness = transaction count (brighter gold/white = more transactions, dimmer amber = fewer). Hover to highlight individual blocks at 2.5x scale. Click to pin and inspect.

### Horizontal Rings — Transaction Metrics
- **Fee Tiers** (r=2.2): Four arc segments showing fee distribution across sat/vB tiers. Thickness scales with fee pressure.
- **Settlement** (r=2.8): Arc length represents block production health. Full circle = blocks arriving on schedule. Shrinks under stress.
- **Congestion** (r=3.3): Red arc. Length and intensity scale with network congestion score. Barely visible when mempool is clear, expands during heavy load.
- **BTC Volume** (r=3.8): Gold arc proportional to daily BTC transferred relative to the 4.6M BTC/day peak (2021 ATH).

### Vertical Rings — Security Metrics
- **Hashrate** (YZ plane, r=2.5): Arc proportional to network hashrate vs 906 EH/s peak. Grows from invisible at Genesis to nearly full circle at peak security.
- **Difficulty** (XZ plane, r=3.0): Log-scaled arc representing mining difficulty (1 to 150 trillion). Adjusts every 2,016 blocks.

### Floating Particles — Active Addresses
Each particle represents ~1,000 unique active addresses on that day. Genesis = zero particles. Bull market peaks = over 1,400 glowing dots. Larger particles indicate whale activity (outputs over 100 BTC).

## Data Architecture

```
Google BigQuery (crypto_bitcoin)     Blockchain & Mempool Extracts
       |                                       |
       |   blocks, transactions, addresses,    |   hashrate, difficulty, fee pressure,
       |   outputs, fees, transfer volumes     |   congestion, mempool, mining pools
       |                                       |
       +-------------------+-------------------+
                           |
                  Strategy Mosaic
                  (Semantic Layer)
                           |
            Single certified model —
            one source of truth
                           |
                    Visualization
```

**100% Mosaic-sourced.** Every value rendered in this visualization — block heights, hashrate, difficulty, mempool, fee pressure, congestion, block stress, network health, active addresses, BTC transferred, whale concentration, mining pool shares, and per-block spine data — is pulled directly from Strategy Mosaic's unified semantic layer. No hardcoded values. Strategy Mosaic provides a unified semantic layer over these raw sources, delivering a single source of truth and consistent business logic across all 25 historical snapshots.

## Features

- **25 Historical Snapshots**: Genesis Era, Pizza Day, 2011 Bubble, Mt. Gox Collapse, halvings, bull runs, COVID crash, ETF approval, and more
- **6 What-If Sliders**: Hashrate, Difficulty, Active Addresses, Fee Pressure, Congestion, Block Stress — each maps to a distinct visual element
- **Click-to-Pin**: Click any shape to freeze the scene. KPIs lock, rotation and playback pause. Adjust What-If sliders freely. Click again (or click empty space) to resume with prior state restored.
- **Animated Transitions**: Ring parameters smoothly lerp between snapshots (~3s). Blocks fade in. Particles adjust count.
- **Ambient Rotation**: Slow orbital rotation (~78s per revolution) with toggle control. Full 360° manual orbit via drag (no polar constraints).
- **Per-Snapshot Narration**: Historical context appears as a narration bubble for each event
- **Interactive Legend**: Click the Legend button to open an overlay. Hover any legend row to highlight the matching shape in the 3D scene.
- **Info Panel**: Data sources and visual guide explaining every ring, particle, and interaction

## Visual Effects

- Bloom with mipmap blur (6 levels)
- Chromatic aberration (subtle, radially modulated)
- Vignette (cinematic edge darkening)
- Beveled arc geometry for ring depth
- Cinematic 4-point lighting (key, fill, rim, core)
- Health-driven core light pulse
- Full retina rendering (DPR 2x)

## Tech Stack

- **React 19** + **TypeScript 5.9**
- **React Three Fiber 9** (Three.js declarative)
- **drei 10** (OrbitControls)
- **postprocessing** (Bloom, Vignette, ChromaticAberration)
- **Vite 7** (build tooling)

## Run Locally

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
# Production build
npm run build

# Serve locally
npx serve dist

# Temporary public URL via Cloudflare Tunnel
npx serve dist -l 4999 &
cloudflared tunnel --url http://localhost:4999
```

## Design Principles

1. **Every shape = real data** — No decorative geometry. If it renders, it maps to a metric from Mosaic.
2. **Honest granularity** — Don't subdivide beyond the data. Don't interpolate where there are no values.
3. **Orange/amber palette only** — Brand consistency across all visual elements.
4. **Elegant, Accurate, Usable, Insightful, Immersive** — The five pillars guiding every design decision.

## What This Is Not

- Not price prediction or trading signals
- Not investment advice
- Not a real-time feed (historical snapshots only)
- Not decorative data art — every pixel traces to a number

## Project Structure

```
src/
  App.tsx              — Full application (~1050 lines): 3D scene, UI panels, narration
  types.ts             — NetworkSnapshot type with all data fields
  styles.css           — Complete styling
  data/
    blockData.ts       — Per-block arrays for all 25 dates (from GBQ)
    mosaicSnapshots.ts — 25 snapshots with network metrics + GBQ address/value data
```
