import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface GarmentInstance {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  shoulderDistance: number; // reference shoulder seam distance in model units
  torsoHeight: number;      // reference shoulder-to-hem height in model units
  collarOffset: number;     // reference shoulder-to-collar height in model units
}

/**
 * Creates a tailored procedural fallback garment while 3D GLTF asset loads.
 */
export function createFallbackGarment(): GarmentInstance {
  const group = new THREE.Group();
  group.name = "Garment_Fallback";

  // Biacromial reference dimensions measured from shirt.glb
  const shoulderDist = 0.3527;
  const torsoH = 0.5712;
  const collarH = 0.0360;

  // Manifold contour mesh
  const geom = new THREE.CylinderGeometry(
    shoulderDist * 0.48, // top radius
    shoulderDist * 0.44, // bottom radius
    torsoH,
    32,
    16,
    true
  );
  // Flatten slightly front-to-back
  geom.scale(1.0, 1.0, 0.45);
  // Shift so top is at collar line and center is at shoulder midpoint
  geom.translate(0, -torsoH * 0.5, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, material);
  group.add(mesh);

  return {
    group,
    mesh,
    material,
    shoulderDistance: shoulderDist,
    torsoHeight: torsoH,
    collarOffset: collarH,
  };
}

/**
 * Loads the retail 3D T-shirt model from GLB asset.
 * Calibrates origin to the midpoint between the shoulder seams.
 */
export async function loadGarmentModel(
  url = "/models/shirt.glb"
): Promise<GarmentInstance> {
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        let shirtMesh: THREE.Mesh | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !shirtMesh) {
            shirtMesh = child as THREE.Mesh;
          }
        });

        if (!shirtMesh) {
          console.warn("[Fitting] No mesh found in GLTF, using fallback.");
          resolve(createFallbackGarment());
          return;
        }

        // Calibrated biacromial reference values measured from shirt.glb
        const shoulderDistance = 0.3527;
        const torsoHeight = 0.5712;
        const collarOffset = 0.0360;

        // Clone geometry and material for clean standalone lifecycle
        const geometry = (shirtMesh as THREE.Mesh).geometry.clone();
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0x27272a,
          roughness: 0.85,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "RetailTShirtMesh";
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Offset mesh so that (0, 0, 0) of parent group is EXACTLY the biacromial midpoint:
        // Midpoint of acromion in raw model coordinates: X = 0.0013, Y = 0.2193, Z = -0.0226
        mesh.position.set(-0.0013, -0.2193, 0.0226);

        const group = new THREE.Group();
        group.name = "Garment_Retail3D";
        group.add(mesh);

        resolve({
          group,
          mesh,
          material,
          shoulderDistance,
          torsoHeight,
          collarOffset,
        });
      },
      undefined,
      (err) => {
        console.error("[Fitting] Failed to load 3D GLTF garment model:", err);
        resolve(createFallbackGarment());
      }
    );
  });
}
