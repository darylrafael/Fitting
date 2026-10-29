# ADR 0001: Decoupled Web Worker Pose Tracking Pipeline

* **Status:** Accepted  
* **Date:** 2026-10-26  
* **Deciders:** Founding Engineering Team  
* **Context:** Real-Time Computer Vision & UI Responsiveness

---

## Context & Problem Statement
In real-time web-based virtual try-on, two resource-intensive loops compete for compute:
1. **The 3D Rendering & UI Loop:** Needs to run at a consistent 60 FPS (16.6ms per frame) to prevent visual stutter and input lag.
2. **The Pose Estimation Pipeline:** Google MediaPipe Pose Landmarker inference takes 25ms to 50ms per frame depending on device GPU/WASM capabilities.

If both loops run synchronously on JavaScript's single main thread, the pose inference will freeze the UI thread on every frame, causing frame drops down to 15–20 FPS, unresponsive touch inputs, and catastrophic camera lag.

## Decision (WHAT)
We isolate the entire Computer Vision pipeline inside a dedicated **Web Worker**:
1. Video frames from the HTML5 `<video>` element are captured via `createImageBitmap()` on the main thread and transferred with zero-copy transfer semantics (`[bitmap]`) to the worker.
2. The Web Worker instantiates `@mediapipe/tasks-vision` via WebAssembly (WASM) with `delegate: "GPU"` (falling back to `"CPU"` if WebGPU/WebGL context fails).
3. The main thread runs independently at 60 FPS using `requestAnimationFrame`, smoothly interpolating 3D bone positions between pose updates received from the worker.

## Rationale & Justification (WHY)
1. **Thread Isolation:** Long-running neural network inference in the worker never blocks DOM events, user touch interactions, or WebGL draw calls.
2. **Decoupled Update Rates:** WebGL can render at 60 FPS while the pose estimation updates at 20–30 Hz. Linear interpolation (LERP) and OneEuroFilter bridge the timing gap, delivering smooth visual motion.
3. **Memory Efficiency:** Transferring `ImageBitmap` transfers ownership of the underlying buffer to the worker without expensive structured cloning or memory copying.

## Consequences & Mitigations
* **Overhead:** Transferring bitmaps introduces an asynchronous IPC message round-trip latency (~1–3ms).
* **Mitigation:** The 3ms IPC overhead is negligible compared to the 30ms main-thread freeze that would occur without the worker.
* **Fallback Strategy:** If an older mobile browser fails to support `createImageBitmap` in workers, the worker reports an error and gracefully degrades to lightweight CPU landmarking.
