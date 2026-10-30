import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface GarmentInstance {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  shoulderDistance: number; // reference shoulder crest span in model units
  torsoHeight: number;      // reference shoulder-to-hem height in model units
  collarOffset: number;     // reference shoulder-to-collar height in model units
  occluderMesh?: THREE.Mesh; // anatomical depth occluder to expose real webcam neck
}

/**
 * Creates an anatomical neck occluder mesh.
 * Renders into the WebGL depth buffer only (colorWrite: false, depthWrite: true)
 * at renderOrder = 0. This naturally occludes the inside back wall of the garment
 * behind the user's real neck while keeping the canvas 100% transparent for the webcam video,
 * without slicing or clipping the shoulders and sleeves.
 */
function createNeckOccluder(): THREE.Mesh {
  const geom = new THREE.CylinderGeometry(0.065, 0.075, 0.22, 24, 1);
  // Center along the anatomical neck column above shoulder crest midpoint
  geom.translate(0, 0.07, 0.005);

  const mat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = "AnatomicalNeckOccluder";
  mesh.renderOrder = 0;
  return mesh;
}

/**
 * Creates a tailored procedural fallback garment while 3D GLTF asset loads.
 */
export function createFallbackGarment(): GarmentInstance {
  const group = new THREE.Group();
  group.name = "Garment_Fallback";

  // Calibrated reference dimensions matching shirt.glb
  const shoulderDist = 0.307;
  const torsoH = 0.582;
  const collarH = 0.027;

  // Manifold contour mesh
  const geom = new THREE.CylinderGeometry(
    shoulderDist * 0.48, // top radius
    shoulderDist * 0.44, // bottom radius
    torsoH,
    32,
    16,
    true
  );
  geom.scale(1.0, 1.0, 0.45);
  geom.translate(0, -torsoH * 0.5, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.renderOrder = 1;
  group.add(mesh);

  const occluderMesh = createNeckOccluder();
  group.add(occluderMesh);

  return {
    group,
    mesh,
    material,
    shoulderDistance: shoulderDist,
    torsoHeight: torsoH,
    collarOffset: collarH,
    occluderMesh,
  };
}

/**
 * Loads the retail 3D T-shirt model from GLB asset.
 * Calibrates origin to the midpoint between the shoulder crest seams.
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

        // Rigorously measured anatomical dimensions of shirt.glb:
        // - Shoulder crest span (left to right seam): 0.3066
        // - Torso height (shoulder crest to hem): 0.5816
        // - Collar back offset above shoulder crest: 0.0268
        const shoulderDistance = 0.307;
        const torsoHeight = 0.582;
        const collarOffset = 0.027;

        // Clone geometry and compute clean vertex normals
        const geometry = (shirtMesh as THREE.Mesh).geometry.clone();
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0x27272a,
          roughness: 0.85,
          metalness: 0.04,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "RetailTShirtMesh";
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.renderOrder = 1;

        // Offset mesh so that (0, 0, 0) of parent group is EXACTLY the Shoulder Crest Midpoint:
        // X = -0.0018, Y = -0.2297, Z = 0.0238
        mesh.position.set(-0.0018, -0.2297, 0.0238);

        const group = new THREE.Group();
        group.name = "Garment_Retail3D";

        // Add anatomical neck occluder first (renderOrder = 0)
        const occluderMesh = createNeckOccluder();
        group.add(occluderMesh);

        // Add retail t-shirt mesh (renderOrder = 1)
        group.add(mesh);

        resolve({
          group,
          mesh,
          material,
          shoulderDistance,
          torsoHeight,
          collarOffset,
          occluderMesh,
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
