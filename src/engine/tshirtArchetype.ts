import * as THREE from "three";

export interface TShirtRig {
  mesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bones: {
    root: THREE.Bone;
    hips: THREE.Bone;
    spine: THREE.Bone;
    neck: THREE.Bone;
    leftShoulder: THREE.Bone;
    leftUpperArm: THREE.Bone;
    rightShoulder: THREE.Bone;
    rightUpperArm: THREE.Bone;
  };
}

/**
 * Procedurally generates a rigged 3D T-shirt archetype mesh with bone weighting.
 * Parametric dimensions allow sizing adjustments to match physical garment specs.
 */
export function createTShirtArchetype(): TShirtRig {
  // 1. Build Bone Hierarchy
  // Standard human torso proportions in normalized 3D units (~1 unit = 1 meter)
  const root = new THREE.Bone();
  root.name = "root";

  const hips = new THREE.Bone();
  hips.name = "hips";
  hips.position.set(0, -0.3, 0);
  root.add(hips);

  const spine = new THREE.Bone();
  spine.name = "spine";
  spine.position.set(0, 0.3, 0);
  hips.add(spine);

  const neck = new THREE.Bone();
  neck.name = "neck";
  neck.position.set(0, 0.28, 0);
  spine.add(neck);

  const leftShoulder = new THREE.Bone();
  leftShoulder.name = "leftShoulder";
  leftShoulder.position.set(0.22, 0.24, 0);
  spine.add(leftShoulder);

  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = "leftUpperArm";
  leftUpperArm.position.set(0.18, -0.15, 0);
  leftShoulder.add(leftUpperArm);

  const rightShoulder = new THREE.Bone();
  rightShoulder.name = "rightShoulder";
  rightShoulder.position.set(-0.22, 0.24, 0);
  spine.add(rightShoulder);

  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = "rightUpperArm";
  rightUpperArm.position.set(-0.18, -0.15, 0);
  rightShoulder.add(rightUpperArm);

  // Bone Index Mapping:
  // 0: root, 1: hips, 2: spine, 3: neck, 4: leftShoulder, 5: leftUpperArm, 6: rightShoulder, 7: rightUpperArm
  const boneList = [
    root,
    hips,
    spine,
    neck,
    leftShoulder,
    leftUpperArm,
    rightShoulder,
    rightUpperArm,
  ];
  const skeleton = new THREE.Skeleton(boneList);

  // 2. Build T-Shirt Geometry (Torso + Sleeves)
  // Torso: Open tapered cylinder
  const torsoRadialSegments = 24;
  const torsoHeightSegments = 16;
  const torsoTopRadius = 0.25;
  const torsoBottomRadius = 0.26;
  const torsoHeight = 0.65;

  const torsoGeo = new THREE.CylinderGeometry(
    torsoTopRadius,
    torsoBottomRadius,
    torsoHeight,
    torsoRadialSegments,
    torsoHeightSegments,
    true // open ended for neck and waist
  );
  // Center torso around spine
  torsoGeo.translate(0, 0.05, 0);

  // Sleeves: angled cylinders
  const sleeveRadius = 0.11;
  const sleeveLength = 0.26;
  const sleeveSegments = 16;

  // Left sleeve
  const leftSleeveGeo = new THREE.CylinderGeometry(
    sleeveRadius * 1.15,
    sleeveRadius,
    sleeveLength,
    sleeveSegments,
    8,
    true
  );
  leftSleeveGeo.rotateZ(-Math.PI / 3.5);
  leftSleeveGeo.translate(0.31, 0.26, 0);

  // Right sleeve
  const rightSleeveGeo = new THREE.CylinderGeometry(
    sleeveRadius * 1.15,
    sleeveRadius,
    sleeveLength,
    sleeveSegments,
    8,
    true
  );
  rightSleeveGeo.rotateZ(Math.PI / 3.5);
  rightSleeveGeo.translate(-0.31, 0.26, 0);

  // Merge Torso + Left Sleeve + Right Sleeve into unified BufferGeometry
  const combinedGeo = mergeGeometries([torsoGeo, leftSleeveGeo, rightSleeveGeo]);

  // Flatten front/back slightly for natural oval chest cross-section
  const posAttr = combinedGeo.attributes.position;
  const vertex = new THREE.Vector3();
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);

    // Oval chest de-cylindrification (Z compression)
    vertex.z *= 0.65;
    posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);

    // Compute Skin Weights based on vertex coordinate zones
    const x = vertex.x;
    const y = vertex.y;

    if (x > 0.25 && y > 0.1) {
      // Left arm sleeve
      const armFactor = Math.min(1.0, Math.max(0.0, (x - 0.25) / 0.18));
      skinIndices.push(4, 5, 2, 0); // leftShoulder, leftUpperArm, spine, root
      skinWeights.push(1.0 - armFactor, armFactor, 0.0, 0.0);
    } else if (x < -0.25 && y > 0.1) {
      // Right arm sleeve
      const armFactor = Math.min(1.0, Math.max(0.0, (-x - 0.25) / 0.18));
      skinIndices.push(6, 7, 2, 0); // rightShoulder, rightUpperArm, spine, root
      skinWeights.push(1.0 - armFactor, armFactor, 0.0, 0.0);
    } else {
      // Main Torso
      // Height spans approximately y: -0.28 to +0.38
      const normY = (y + 0.28) / 0.66; // 0 at hips, 1 at collar

      if (normY < 0.35) {
        // Lower torso (hips to mid-spine)
        const t = normY / 0.35;
        skinIndices.push(1, 2, 0, 0); // hips, spine
        skinWeights.push(1.0 - t, t, 0.0, 0.0);
      } else if (normY < 0.75) {
        // Mid torso (spine dominant)
        const t = (normY - 0.35) / 0.4;
        skinIndices.push(2, 3, 0, 0); // spine, neck
        skinWeights.push(1.0 - t * 0.4, t * 0.4, 0.0, 0.0);
      } else {
        // Upper chest & collar
        const t = (normY - 0.75) / 0.25;
        if (x > 0.1) {
          skinIndices.push(4, 3, 2, 0); // leftShoulder, neck, spine
          skinWeights.push(0.5 * t, 0.3, 0.2, 0.0);
        } else if (x < -0.1) {
          skinIndices.push(6, 3, 2, 0); // rightShoulder, neck, spine
          skinWeights.push(0.5 * t, 0.3, 0.2, 0.0);
        } else {
          skinIndices.push(3, 2, 0, 0); // neck, spine
          skinWeights.push(0.8, 0.2, 0.0, 0.0);
        }
      }
    }
  }

  combinedGeo.computeVertexNormals();

  combinedGeo.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(skinIndices, 4)
  );
  combinedGeo.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(skinWeights, 4)
  );

  // 3. PBR Fabric Material
  // Neutral modern charcoal/slate knit material
  const material = new THREE.MeshStandardMaterial({
    color: 0x27272a, // zinc-800 tone
    roughness: 0.88,
    metalness: 0.04,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mesh = new THREE.SkinnedMesh(combinedGeo, material);
  mesh.add(root);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;

  return {
    mesh,
    skeleton,
    bones: {
      root,
      hips,
      spine,
      neck,
      leftShoulder,
      leftUpperArm,
      rightShoulder,
      rightUpperArm,
    },
  };
}

/**
 * Utility to merge multiple BufferGeometries without extra external dependencies
 */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalPositions = 0;
  let totalNormals = 0;
  let totalUvs = 0;
  let totalIndices = 0;

  for (const g of geos) {
    totalPositions += g.attributes.position.array.length;
    if (g.attributes.normal) totalNormals += g.attributes.normal.array.length;
    if (g.attributes.uv) totalUvs += g.attributes.uv.array.length;
    if (g.index) totalIndices += g.index.array.length;
  }

  const positions = new Float32Array(totalPositions);
  const normals = new Float32Array(totalNormals);
  const uvs = new Float32Array(totalUvs);
  const indices = new Uint32Array(totalIndices);

  let posOffset = 0;
  let normOffset = 0;
  let uvOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (const g of geos) {
    positions.set(g.attributes.position.array, posOffset);
    posOffset += g.attributes.position.array.length;

    if (g.attributes.normal) {
      normals.set(g.attributes.normal.array, normOffset);
      normOffset += g.attributes.normal.array.length;
    }

    if (g.attributes.uv) {
      uvs.set(g.attributes.uv.array, uvOffset);
      uvOffset += g.attributes.uv.array.length;
    }

    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++) {
        indices[indexOffset + i] = g.index.array[i] + vertexOffset;
      }
      indexOffset += g.index.array.length;
    }

    vertexOffset += g.attributes.position.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (totalNormals > 0) {
    merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }
  if (totalUvs > 0) {
    merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  if (totalIndices > 0) {
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  return merged;
}
