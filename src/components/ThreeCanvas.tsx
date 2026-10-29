"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Landmark } from "../types/pose";
import { createTShirtArchetype, TShirtRig } from "../engine/tshirtArchetype";
import { RigSolver } from "../engine/rigSolver";

interface ThreeCanvasProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  showGarment?: boolean;
  isWireframe?: boolean;
  garmentColor?: string;
}

export function ThreeCanvas({
  landmarks,
  width,
  height,
  showGarment = true,
  isWireframe = false,
  garmentColor = "#27272a",
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rigRef = useRef<TShirtRig | null>(null);
  const solverRef = useRef<RigSolver>(new RigSolver());
  const landmarksRef = useRef<Landmark[] | null>(landmarks);
  const animFrameIdRef = useRef<number | null>(null);

  // Keep landmarksRef up-to-date without triggering recreation of Three.js context
  landmarksRef.current = landmarks;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();

    const fov = 60;
    const aspect = width / height;
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
    camera.position.set(0, 0, 2.0); // Z = 2.0m calibrated to RigSolver planeHeight

    // 2. WebGLRenderer with Alpha
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Studio Lighting (Key, Fill, Rim)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(1.5, 2.5, 2.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.0);
    fillLight.position.set(-1.5, 1.0, 1.5);
    scene.add(fillLight);

    // 4. Create and add 3D T-Shirt SkinnedMesh
    const rig = createTShirtArchetype();
    scene.add(rig.mesh);
    rigRef.current = rig;

    // 5. Render Loop (60 FPS)
    const renderLoop = (timestamp: number) => {
      if (rigRef.current) {
        if (showGarment) {
          solverRef.current.update(
            rigRef.current,
            landmarksRef.current,
            width / height,
            timestamp
          );
        } else {
          rigRef.current.mesh.visible = false;
        }
      }

      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
      solverRef.current.reset();
    };
  }, [width, height, showGarment]);

  // Update Material Properties dynamically
  useEffect(() => {
    if (rigRef.current) {
      const mat = rigRef.current.mesh.material as THREE.MeshStandardMaterial;
      mat.wireframe = isWireframe;
      mat.color.set(garmentColor);
      mat.needsUpdate = true;
    }
  }, [isWireframe, garmentColor]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-15 w-full h-full"
    />
  );
}
