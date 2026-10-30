"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Landmark } from "../types/pose";
import {
  createRetailTShirtArchetype,
  TShirtArchetypeModel,
} from "../engine/tshirtArchetype";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<TShirtArchetypeModel | null>(null);
  const solverRef = useRef<RigSolver>(new RigSolver());
  const landmarksRef = useRef<Landmark[] | null>(landmarks);
  const animFrameIdRef = useRef<number | null>(null);

  landmarksRef.current = landmarks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    // 1. Scene & Calibrated 1:1 Orthographic Camera
    // Maps screen pixels [0..width, 0..height] directly to Three.js space
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, width, height, 0, -1000, 1000);
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);

    // 2. High-Performance WebGLRenderer with Alpha
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // 3. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(width * 0.3, height * 0.8, 400);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.1);
    fillLight.position.set(-width * 0.3, height * 0.2, 300);
    scene.add(fillLight);

    // 4. Create Tailored T-Shirt Archetype
    const model = createRetailTShirtArchetype();
    scene.add(model.group);
    modelRef.current = model;

    // 5. Render Loop (Synchronized at 60 FPS)
    const renderLoop = (timestamp: number) => {
      if (modelRef.current) {
        if (showGarment) {
          solverRef.current.update(
            modelRef.current,
            landmarksRef.current,
            width,
            height,
            timestamp
          );
        } else {
          modelRef.current.group.visible = false;
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
      renderer.dispose();
      scene.clear();
      solverRef.current.reset();
    };
  }, [width, height, showGarment]);

  // Dynamic Material Updates (Color & Wireframe toggle)
  useEffect(() => {
    if (modelRef.current) {
      const mat = modelRef.current.material;
      mat.wireframe = isWireframe;
      mat.color.set(garmentColor);
      mat.needsUpdate = true;
    }
  }, [isWireframe, garmentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-15 w-full h-full object-cover -scale-x-100"
    />
  );
}
