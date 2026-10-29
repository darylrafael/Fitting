# Fitting — Gate 0: Spike S3 (3D Mesh Skinning & Motion Tracking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a real-time Three.js WebGL viewport over the camera feed that renders a rigged 3D T-shirt archetype, skinning it to user skeletal landmarks at 60 FPS with OneEuroFilter smoothing to eliminate landmark jitter.

**Architecture:** Video stream and MediaPipe Web Worker remain decoupled as validated in Spike S2. A Three.js WebGL canvas is composited with alpha transparency directly over the mirrored video feed. A specialized `RigSolver` consumes smoothed 3D landmarks via a calibrated `OneEuroFilter`, computes bone transforms (torso position, orientation quaternions, shoulder span scale, arm rotations), and drives a rigged 3D T-shirt SkinnedMesh in real time.

**Tech Stack:** Next.js 15, Three.js (`three`), `@types/three`, MediaPipe Tasks-Vision (WASM in Web Worker), TypeScript, Tailwind CSS.

## Global Constraints

- **Platform:** Web application accessible on iOS mobile browsers and desktop browsers over HTTPS.
- **Hardware Target:** Physical iPhone on local network via Next.js HTTPS.
- **Performance Bar (Spike S3):** Viewport render loop locked at 60 FPS; zero visible jitter during static poses; responsive tracking (<50ms motion-to-photon latency) during arm movement and torso turning.
- **Strict Typing:** All TypeScript files must compile with 0 errors on `npm run build`.

---

### Task 1: Install Three.js & Implement OneEuroFilter

**Files:**
- Modify: `package.json`
- Create: `src/utils/oneEuroFilter.ts`

**Interfaces:**
- Produces: `OneEuroFilter3D` class for smooth 3D vector filtering:
  - `filter(x: number, y: number, z: number, timestamp: number): { x: number, y: number, z: number }`

- [ ] **Step 1: Install `three` and `@types/three`**
Run: `npm install three && npm install -D @types/three`

- [ ] **Step 2: Implement OneEuroFilter**
Create `src/utils/oneEuroFilter.ts`:
Implements the 1€ Filter (Casiez et al., CHI 2012) which dynamically adapts the low-pass filter cutoff frequency based on movement speed: low cutoff at low speeds (zero jitter) and high cutoff at high speeds (zero lag).

- [ ] **Step 3: Verify TypeScript compilation**
Run: `npx tsc --noEmit`

---

### Task 2: Parametric 3D T-Shirt Archetype Mesh & Bone Rig

**Files:**
- Create: `src/engine/tshirtArchetype.ts`

**Interfaces:**
- Produces: `createTShirtSkinnedMesh(): { mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, bones: Record<string, THREE.Bone> }`
- Rig Hierarchy:
  - Root -> Hips -> Spine -> Neck
  - Spine -> LeftShoulder -> LeftUpperArm
  - Spine -> RightShoulder -> RightUpperArm

- [ ] **Step 1: Implement Procedural Rigged T-Shirt Generator**
Create `src/engine/tshirtArchetype.ts` generating a cylindrical torso + sleeve geometry with PBR fabric material, vertex bone indices, and skin weights mapped to Spine, Shoulders, and UpperArms.

- [ ] **Step 2: Verify geometry integrity**
Ensure bounds, normals, and bone bind poses are correctly computed via `mesh.bind(skeleton)`.

---

### Task 3: Landmark-to-Bone Rig Solver

**Files:**
- Create: `src/engine/rigSolver.ts`

**Interfaces:**
- Consumes: MediaPipe upper-body landmarks (11: left_shoulder, 12: right_shoulder, 13: left_elbow, 14: right_elbow, 23: left_hip, 24: right_hip).
- Produces: `updateRig(skeleton, landmarks, viewportWidth, viewportHeight, timestamp)`

- [ ] **Step 1: Implement Coordinate Mapping & Quaternions**
Calculate:
- Torso center position in Three.js world space.
- Scale multiplier based on user shoulder span.
- Torso rotation quaternion from shoulder tilt and spine vector.
- Arm orientation quaternions relative to shoulder joints.

- [ ] **Step 2: Apply OneEuroFilter to bone positions & rotations**
Smooth incoming landmark positions before updating bone matrices to prevent high-frequency shaking.

---

### Task 4: Three.js Overlay Viewport Component

**Files:**
- Create: `src/components/ThreeCanvas.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `landmarks: Landmark[] | null`, `width: number`, `height: number`
- Produces: Transparent WebGL overlay rendering the 3D T-shirt at 60 FPS over the video element.

- [ ] **Step 1: Implement ThreeCanvas Component**
Create `src/components/ThreeCanvas.tsx`:
- Perspective camera matching mobile sensor FOV (~60°).
- Alpha-enabled WebGLRenderer (`alpha: true, antialias: true`).
- Directional + Ambient lighting setup.
- Render loop running via `requestAnimationFrame` at native display rate.

- [ ] **Step 2: Integrate into Benchmark View**
Update `src/app/page.tsx` to mount `ThreeCanvas` alongside camera feed and HUD, with a toggle for Skeleton vs 3D Garment view.

---

### Task 5: Build Verification & Physical Device Validation

- [ ] **Step 1: Run production build**
Run: `npm run build`
Expected: 0 errors, clean static compilation.

- [ ] **Step 2: Test on physical iPhone**
Verify:
1. Does the 3D T-shirt render on top of the user's torso?
2. Does the shirt follow body turning and arm movements smoothly?
3. Does the Render FPS stay at 60 FPS?
4. Is jitter eliminated when standing still?
