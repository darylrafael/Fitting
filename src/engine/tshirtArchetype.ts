import * as THREE from "three";

export interface TShirtArchetypeModel {
  group: THREE.Group;
  torsoMesh: THREE.Mesh;
  collarMesh: THREE.Mesh;
  leftSleevePivot: THREE.Group;
  rightSleevePivot: THREE.Group;
  leftSleeveMesh: THREE.Mesh;
  rightSleeveMesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
}

/**
 * Creates a tailored 3D retail T-Shirt archetype.
 * Features:
 * - Single continuous manifold torso surface with chest contour and waist taper.
 * - 3D collar ribbing.
 * - Dynamic armhole-pivoted sleeves for left and right arms.
 */
export function createRetailTShirtArchetype(): TShirtArchetypeModel {
  const group = new THREE.Group();
  group.name = "TShirtArchetype";

  // Base reference dimensions in normalized model space:
  // Reference half-width at chest: 90 units
  // Reference height from collar to hem: 220 units
  // Reference chest depth: 32 units
  const W = 90;
  const H = 220;
  const D = 32;

  // 1. Torso Geometry: 18 vertical slices x 28 radial points
  const radialSegs = 28;
  const heightSegs = 18;
  const torsoPos: number[] = [];
  const torsoUv: number[] = [];
  const torsoIndices: number[] = [];

  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs; // 0 = collar line, 1 = bottom hem
    const y = -v * H;

    // Silhouette contour: broader at shoulders, tailored waist, slight hem flare
    let w = W;
    if (v < 0.25) {
      w = W * (0.86 + (1.0 - v / 0.25) * 0.14);
    } else if (v < 0.7) {
      const t = (v - 0.25) / 0.45;
      w = W * (0.86 - t * 0.08);
    } else {
      const t = (v - 0.7) / 0.3;
      w = W * (0.78 + t * 0.04);
    }

    const d = D * (0.88 + (1.0 - v) * 0.22);

    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const angle = u * Math.PI * 2;

      let x = Math.sin(angle) * w;
      let z = Math.cos(angle) * d;
      let curY = y;

      // Collar dip at the front neckline
      if (v < 0.3) {
        const frontProximity = Math.max(0, Math.cos(angle));
        if (frontProximity > 0.3) {
          const depthFactor = (frontProximity - 0.3) / 0.7;
          curY -= depthFactor * 22 * (1.0 - v / 0.3);
          z -= depthFactor * 10 * (1.0 - v / 0.3);
        }
      }

      torsoPos.push(x, curY, z);
      torsoUv.push(u, v);
    }
  }

  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const p1 = j * (radialSegs + 1) + i;
      const p2 = p1 + 1;
      const p3 = (j + 1) * (radialSegs + 1) + i;
      const p4 = p3 + 1;

      torsoIndices.push(p1, p3, p2);
      torsoIndices.push(p2, p3, p4);
    }
  }

  const torsoGeo = new THREE.BufferGeometry();
  torsoGeo.setAttribute("position", new THREE.Float32BufferAttribute(torsoPos, 3));
  torsoGeo.setAttribute("uv", new THREE.Float32BufferAttribute(torsoUv, 2));
  torsoGeo.setIndex(torsoIndices);
  torsoGeo.computeVertexNormals();

  // Modern matte fabric PBR material
  const material = new THREE.MeshStandardMaterial({
    color: 0x27272a, // Charcoal
    roughness: 0.85,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const torsoMesh = new THREE.Mesh(torsoGeo, material);
  torsoMesh.name = "Torso";
  group.add(torsoMesh);

  // 2. Collar Trim (Ribbed neckline)
  const collarGeo = new THREE.TorusGeometry(28, 3.5, 12, 32);
  collarGeo.rotateX(Math.PI / 2);
  collarGeo.scale(1.25, 0.75, 0.9);
  collarGeo.translate(0, -5, -3);
  const collarMesh = new THREE.Mesh(collarGeo, material);
  collarMesh.name = "Collar";
  group.add(collarMesh);

  // 3. Left Sleeve (Pivoted at Left Shoulder)
  const leftSleevePivot = new THREE.Group();
  leftSleevePivot.name = "LeftSleevePivot";
  leftSleevePivot.position.set(W * 0.88, -12, 0);

  const sleeveLength = 80;
  const sleeveTopRadius = 26;
  const sleeveBottomRadius = 22;
  const sleeveGeo = new THREE.CylinderGeometry(
    sleeveBottomRadius,
    sleeveTopRadius,
    sleeveLength,
    20,
    8,
    true
  );
  sleeveGeo.translate(0, -sleeveLength / 2, 0);

  // Flatten sleeve cross-section slightly
  const sPos = sleeveGeo.attributes.position;
  for (let k = 0; k < sPos.count; k++) {
    sPos.setZ(k, sPos.getZ(k) * 0.78);
  }
  sleeveGeo.computeVertexNormals();

  const leftSleeveMesh = new THREE.Mesh(sleeveGeo, material);
  leftSleeveMesh.name = "LeftSleeveMesh";
  leftSleevePivot.add(leftSleeveMesh);
  group.add(leftSleevePivot);

  // 4. Right Sleeve (Pivoted at Right Shoulder)
  const rightSleevePivot = new THREE.Group();
  rightSleevePivot.name = "RightSleevePivot";
  rightSleevePivot.position.set(-W * 0.88, -12, 0);

  const rightSleeveMesh = new THREE.Mesh(sleeveGeo.clone(), material);
  rightSleeveMesh.name = "RightSleeveMesh";
  rightSleevePivot.add(rightSleeveMesh);
  group.add(rightSleevePivot);

  return {
    group,
    torsoMesh,
    collarMesh,
    leftSleevePivot,
    rightSleevePivot,
    leftSleeveMesh,
    rightSleeveMesh,
    material,
  };
}
