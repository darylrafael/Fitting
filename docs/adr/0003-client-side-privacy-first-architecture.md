# ADR 0003: Client-Side, Zero-Marginal-Cost Privacy Architecture

* **Status:** Accepted  
* **Date:** 2026-10-26  
* **Deciders:** Founding Engineering Team  
* **Context:** Operating Economics, Latency, and Privacy Regulations

---

## Context & Problem Statement
State-of-the-art Generative AI Try-On solutions (e.g., diffusion models like IDM-VTON, CatVTON, or enterprise solutions from Google/Walmart) run on centralized cloud servers equipped with high-end GPUs (NVIDIA A100/H100).
This approach presents three critical bottlenecks for independent e-commerce merchants:
1. **Per-Inference Cost:** Each try-on generation costs approximately \$0.02 to \$0.05. If 100,000 shoppers try on 10 items a month, the merchant incurs a \$20,000 to \$50,000 monthly cloud bill.
2. **High Latency:** Diffusion generation requires 2 to 8 seconds per static pose, making interactive live motion impossible.
3. **Data Privacy (GDPR/Biometric Regulations):** Sending live camera streams or photos of users in personal environments to third-party cloud servers triggers severe compliance hurdles and customer distrust.

## Decision (WHAT)
Execute 100% of the computer vision, skeletal tracking, and 3D rendering pipeline **client-side on the user's mobile device or browser**:
1. Camera video feed never leaves the browser's memory (`HTMLVideoElement` / `ImageBitmap`).
2. Sizing calculations and anthropometric measurements are computed ephemerally in RAM and discarded when the session ends.
3. The backend is restricted purely to static asset serving (GLTF models, textures) cached on CDN/Object Storage (Cloudflare R2).

## Rationale & Justification (WHY)
1. **Zero Marginal Infrastructure Cost:** The marginal cloud cost per user session is effectively \$0.00 (only static asset bandwidth of ~1.5 MB).
2. **Instant Interactive Feedback:** Zero network round-trip delay allows live motion tracking and responsive posture changes.
3. **Unassailable Privacy Posture:** No user photos or video streams ever touch a server. Compliance with GDPR, CCPA, and biometric data privacy laws is structurally guaranteed by design.

## Consequences & Mitigations
* **Client Hardware Constraints:** Inferencing on budget mobile devices can cause battery drain and thermal throttling.
* **Mitigation:** We mandate rigorous profiling in Gate 0 (Spike S2) on real iPhone hardware, use lightweight float16 models (`pose_landmarker_lite`), and provide automatic framerate throttling if device thermal limits are approached.
