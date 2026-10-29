# ADR 0002: Parametric Garment Archetypes and Normal Extrusion Multi-Layering

* **Status:** Accepted  
* **Date:** 2026-10-26  
* **Deciders:** Founding Engineering Team  
* **Context:** 3D Garment Geometry, Asset Scaling & Multi-Layer Stacking

---

## Context & Problem Statement
Virtual try-on faces two severe geometric challenges in retail e-commerce:
1. **Catalog Scalability:** Fast-fashion catalogs add thousands of SKUs weekly. Requiring custom 3D CAD meshes for each SKU is economically unfeasible.
2. **Multi-Layer Interpenetration (Clipping):** When wearing multiple garments simultaneously (e.g., a fitted croptop under an open cardigan), standard skeletal skinning causes the inner garment's vertices to pierce through the outer garment during body twists and arm motions.

Traditional solutions like real-time Position-Based Dynamics (PBD) cloth simulation require high GPU compute, frequently explode upon collision, and cannot maintain 60 FPS on mobile web browsers.

## Decision (WHAT)
1. **Decouple Geometry from Texture:**
   - Maintain a constrained set of rigged 3D base meshes (*Parametric Archetypes*): T-Shirt, Long Sleeve, Croptop, Open Cardigan, Hoodie.
   - Retail items map their 2D catalog imagery onto the corresponding archetype's UV coordinate map.
   - Blendshapes on the archetype adjust physical dimensions (torso length, chest circumference, sleeve width) to match published retail size specifications.
2. **Normal Extrusion Layering:**
   - Avoid heavy physics engines entirely.
   - Implement geometric separation via custom vertex shader normal extrusion:
     $$\mathbf{v}_{\text{displaced}} = \mathbf{v}_{\text{base}} + (\mathbf{n} \cdot \delta_{\text{layer}})$$
   - Layer 0 (Inner/Croptop): $\delta = 0\text{ mm}$ (radial scale $1.000\times$).
   - Layer 1 (Mid/T-Shirt): $\delta = 5\text{ mm}$ (radial scale $1.035\times$).
   - Layer 2 (Outer/Cardigan): $\delta = 12\text{ mm}$ (radial scale $1.075\times$).

## Rationale & Justification (WHY)
1. **Locked 60 FPS on Mobile Hardware:** Vertex displacement in the shader executes in parallel on the GPU with $O(1)$ overhead per frame, consuming zero CPU cycles.
2. **Zero Risk of Cloth Explosion:** Unlike spring-mass physics, geometric extrusion is deterministic and impossible to collapse or glitch when tracking landmarks drop or jitter.
3. **Infinite Catalog Coverage:** New shirts or patterns only require texture ingestion and UV mapping, without touching 3D geometry.

## Consequences & Mitigations
* **Visual Limitation:** Outer garments do not dynamically drape or fold over complex posture collisions.
* **Mitigation:** We add subtle inertial sway to outer garments via an inertia vertex shader pass and restrict v1 scope to fitted and semi-fitted tops.
