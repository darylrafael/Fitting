# Fitting — Real-Time On-Device Virtual Try-On Engine

[![Status](https://img.shields.io/badge/Status-Gate%200%20(Spike%20S2%20PASSED)-emerald.svg)](docs/GATES.md)
[![Repository](https://img.shields.io/badge/GitHub-darylrafael%2FFitting-blue.svg)](https://github.com/darylrafael/Fitting)
[![Platform](https://img.shields.io/badge/Platform-Web%20(iOS%20Safari%20%7C%20Chrome)-emerald.svg)]()

> A client-side, zero-marginal-cost 3D/AR virtual try-on engine for retail e-commerce catalogs. Operates at locked 60 FPS viewport rendering with decoupled Web Worker computer vision tracking and multi-layering support.

---

## 1. Architectural Highlights

- **100% On-Device Processing:** Camera stream and biometric estimation remain exclusively inside the client's browser memory. Zero server-side inference cost (\$0.00/session).
- **Decoupled Worker Architecture:** Neural network pose inference runs asynchronously in a dedicated Web Worker via WebAssembly, guaranteeing unblocked 60 FPS UI and WebGL rendering.
- **Parametric Base Archetypes:** Eliminates per-SKU 3D CAD modeling by projecting 2D flat-lay retail imagery onto rigged 3D base meshes with metric blendshapes.
- **Normal Extrusion Layering:** Prevents mesh interpenetration (croptop + cardigan) via vertex shader displacement without the instability of mobile cloth simulation.

For detailed design specifications, see:
- [System Architecture](docs/realtime-vton-architecture.md)
- [Quality & Engineering Gates](docs/GATES.md)
- [Architecture Decision Records (ADRs)](docs/adr/)

---

## 2. Current Cycle: Gate 0 (Spike S2)

We are currently executing **Spike S2: Mobile Safari Pose Pipeline Stability**.

### Pass Bar
- $\ge 20$ pose updates/second sustained over a 5-minute continuous run on physical iPhone Safari.
- Zero crashes, zero WebGL context losses, and stable thermal response.

---

## 3. Getting Started

### Prerequisites
- Node.js $\ge 20.0.0$
- npm $\ge 10.0.0$

### Local Development (with HTTPS for Physical iPhone Testing)
Physical iOS Safari requires HTTPS to access camera streams (`getUserMedia`).

```bash
# 1. Install dependencies
npm install

# 2. Start local HTTPS server
npm run dev:https

# 3. Open the reported HTTPS address on your iPhone connected to the same Wi-Fi network.
```

---

## 4. Repository Structure

```
Fitting/
├── docs/
│   ├── adr/                      # Architectural Decision Records
│   │   ├── 0001-decoupled-web-worker-tracking-pipeline.md
│   │   ├── 0002-parametric-archetypes-and-normal-extrusion.md
│   │   └── 0003-client-side-privacy-first-architecture.md
│   ├── plans/                    # Bite-sized cycle implementation plans
│   ├── GATES.md                  # Non-negotiable acceptance criteria & pass bars
│   └── realtime-vton-architecture.md
├── src/
│   ├── app/                      # Next.js 15 App Router
│   ├── components/               # Telemetry HUD & Viewport canvases
│   ├── hooks/                    # Camera & Pose tracking hooks
│   ├── types/                    # Protocol and landmark typings
│   └── workers/                  # Dedicated Web Workers (MediaPipe WASM)
├── public/                       # Static assets & WASM models
└── package.json
```
