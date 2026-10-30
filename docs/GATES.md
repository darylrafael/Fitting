# Fitting — Engineering & Quality Gates Contract

> **Document Version:** 1.0.0  
> **Status:** Active & Enforced  
> **Rule:** Criteria in this document are objective and non-negotiable. No milestone can be declared "Complete" or "Proper" without verifiable measurements logged on physical hardware.

---

## Gate 0: Existential Risk Spikes (Weeks 1–2)

**Objective:** De-risk the three failure modes that would invalidate the entire technical thesis.

### Spike S1: Ingestion & UV Mapping Fidelity
* **Hypothesis:** 2D flat-lay catalog imagery can be mapped onto a canonical 3D archetype mesh with semi-manual keypoints without looking like a deformed sticker.
* **Pass Bar:**
  - 10 curated benchmark garments mapped to the base T-shirt archetype.
  - At least 7 out of 10 garments rated "Acceptable or Realistic" by 5 external reviewers viewing at arm's length on a mobile screen.
* **Kill/Pivot Condition:** If < 7 pass, drop automatic/semi-automatic retail ingestion. Pivot to hand-authored 3D digital apparel or hybrid server-side diffusion synthesis.

### Spike S2: Mobile Safari Pose Pipeline Stability
* **Hypothesis:** Google MediaPipe Pose Landmarker running inside a Web Worker via WebAssembly can maintain stable tracking on physical iPhone Safari without crashing or thermal throttling.
* **Pass Bar:**
  - Sustained $\ge 20$ pose updates/second over 5 continuous minutes.
  - Zero browser tab crashes, zero WebGL/GPU context losses.
  - Device remains responsive with UI render loop locked at $\ge 50$ FPS.
* **Test Hardware:** Physical iPhone over local HTTPS.
* **Status:** **PASSED (2026-10-29)**
  - Measured UI Render: Locked at 60 FPS.
  - Measured Pose Inference: Sustained green ($\ge 20$ Hz) without crashes.
  - Architecture: Web Worker decoupled IPC with `OffscreenCanvas` Safari WebGL2 polyfill.
* **Kill/Pivot Condition:** (Overridden by Pass) No pivot required. Proceed to Spike S3.

### Spike S3: Skinned Mesh Tracking & Motion Smoothness
* **Hypothesis:** A rigged 3D garment mesh can track upper-body landmarks smoothly without visible jitter or unnatural popping during rapid movement.
* **Pass Bar:**
  - 60 FPS viewport rendering with OneEuroFilter smoothing and linear landmark interpolation.
  - Zero-heap allocation vector pipeline avoiding GC stutters.
  - Subjective motion smoothness approved on physical hardware across yaw rotation, shoulder tilting, and seated framing.
* **Status:** **IMPLEMENTED & IN PHYSICAL VERIFICATION (2026-10-30)**
  - Mesh: Replaced flawed procedural cylinders with canonical retail 3D T-shirt asset (`shirt.glb`, 10,513 vertices, manifold PBR fabric).
  - Pivot: Calibrated to shoulder seam midpoint, ensuring garment collar naturally frames suprasternal notch.
  - Solver: Biomechanical Euler YXZ rotation solver with OneEuroFilter3D smoothing (0.45px simulated alignment error).
  - Safety Guards: Added chin occlusion guard (prevents collar from covering chin) and zero-GC memory optimization.
* **Kill/Pivot Condition:** If skeletal skinning fails to conceal landmark latency, implement inertial damping physics in vertex shader.

---

## Gate 1: Portfolio MVP (Weeks 3–8)

**Objective:** Deliver a production-grade, public-facing web experience that proves deep engineering competency.

* **Criteria:**
  - Public HTTPS URL running on mobile Safari, mobile Chrome, and desktop.
  - 10 fully styled, rights-cleared garments (Upper body: T-shirts, Long sleeves, Open Cardigans).
  - Multi-layering support (Inner Croptop/T-shirt + Outer Cardigan) with zero mesh clipping.
  - Hand/Arm occlusion pass (user's limbs render in front of clothing).
  - Public telemetry overlay toggle (real-time FPS, Pose Hz, latency ms).
  - 0 TypeScript compilation errors, 0 runtime console errors during normal interaction.

---

## Gate 2: Sizing Accuracy & Market Validation (Weeks 9–12)

**Objective:** Validate whether metric sizing recommendations provide genuine value or induce returns.

* **Criteria:**
  - Metric measurement validation study ($N \ge 30$ human participants).
  - Measured shoulder-width error must be strictly $< 2.0\text{ cm}$ (less than half the delta between Uniqlo S, M, and L sizes).
  - If error $\ge 2.0\text{ cm}$, the feature must be labeled strictly as an *"Approximate Fit Hint"* with explicit disclaimers, or cut from product claims.
  - Customer discovery: 15 documented interviews with e-commerce boutique owners and technical leads.

---

## Gate 3: Commercial Track Decision (Week 12)

| Track | Evidence Required | Strategic Action |
| :--- | :--- | :--- |
| **Track A (Portfolio)** | Gate 1 passed. Strong technical case study & video. | Open-source core engine, publish engineering blog post. Target high-caliber graphics/CV engineering roles. |
| **Track B (Agency / Custom Build)** | 1+ paying commercial client or 3 qualified enterprise inquiries. | Package engine as a white-label embed for boutique fashion brands. |
| **Track C (SaaS Product)** | 2+ store pilots committed with measurable conversion lift. | Deploy automated cloud ingestion pipeline (BiRefNet + FastAPI) and self-serve merchant portal. |
