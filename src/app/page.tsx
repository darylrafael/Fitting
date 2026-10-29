"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { usePoseTracker } from "../hooks/usePoseTracker";
import { PerformanceHUD } from "../components/PerformanceHUD";
import { SkeletonCanvas } from "../components/SkeletonCanvas";
import { ThreeCanvas } from "../components/ThreeCanvas";
import {
  Camera,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Layers,
  Eye,
  Grid,
} from "lucide-react";

const GARMENT_COLORS = [
  { name: "Charcoal", value: "#27272a" },
  { name: "Navy", value: "#1e293b" },
  { name: "White", value: "#f1f5f9" },
  { name: "Sage", value: "#365314" },
];

export default function BenchmarkPage() {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Spike S3 3D Viewport Controls
  const [showGarment, setShowGarment] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isWireframe, setIsWireframe] = useState(false);
  const [selectedColor, setSelectedColor] = useState(GARMENT_COLORS[0].value);

  const { isReady, activeDelegate, error, landmarks, stats, startTracking, stopTracking } =
    usePoseTracker(videoRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  const startCamera = useCallback(async () => {
    setPermissionError(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setDimensions({
              width: videoRef.current?.videoWidth || 640,
              height: videoRef.current?.videoHeight || 480,
            });
            setHasStarted(true);
            startTracking();
          });
        };
      }
    } catch (err: any) {
      setPermissionError(err?.message || "Camera access permission denied.");
    }
  }, [cameraFacing, startTracking]);

  const toggleCamera = () => {
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
  };

  useEffect(() => {
    if (hasStarted) {
      startCamera();
    }
  }, [cameraFacing]);

  useEffect(() => {
    return () => {
      stopTracking();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopTracking]);

  if (!mounted) {
    return (
      <main className="relative flex flex-col items-center justify-center min-h-screen bg-black px-4 py-4 select-none">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative flex flex-col items-center justify-between min-h-screen bg-black px-4 py-4 select-none">
      {/* Telemetry HUD */}
      <PerformanceHUD
        stats={stats}
        isReady={isReady}
        activeDelegate={activeDelegate}
        passBarHz={20}
      />

      {/* Main Viewport Container */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${
            hasStarted ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* 3D WebGL Garment Layer (Spike S3) */}
        {hasStarted && (
          <ThreeCanvas
            landmarks={landmarks}
            width={dimensions.width}
            height={dimensions.height}
            showGarment={showGarment}
            isWireframe={isWireframe}
            garmentColor={selectedColor}
          />
        )}

        {/* 2D Skeleton Overlay (Optional Debug) */}
        {hasStarted && showSkeleton && (
          <SkeletonCanvas
            landmarks={landmarks}
            width={dimensions.width}
            height={dimensions.height}
          />
        )}

        {/* Start / Loading Overlay */}
        {!hasStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 bg-zinc-950/85 z-30">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400 shadow-inner">
              <Camera className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-mono mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Gate 0: Spike S3</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-100">Fitting 3D Try-On</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Real-time 3D parametric T-Shirt skinning with OneEuroFilter smoothing at 60 FPS.
              </p>
            </div>

            {permissionError && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-left max-w-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{permissionError}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs text-left max-w-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Worker error: {error}</span>
              </div>
            )}

            <button
              onClick={startCamera}
              disabled={!isReady}
              className="mt-2 px-6 py-3.5 bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {isReady ? "Launch Camera & Try On 3D" : "Initializing Web Worker..."}
            </button>
          </div>
        )}

        {/* In-viewport Interactive Controls (Spike S3) */}
        {hasStarted && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
            {/* Color Swatches */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 shadow-lg">
              {GARMENT_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelectedColor(c.value)}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    selectedColor === c.value
                      ? "border-sky-400 scale-110 shadow-md shadow-sky-500/30"
                      : "border-zinc-700/60 opacity-80"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            {/* View Mode Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsWireframe((prev) => !prev)}
                className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${
                  isWireframe
                    ? "bg-sky-500 text-zinc-950 border-sky-400"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700/60"
                }`}
                title="Toggle Wireframe"
              >
                <Grid className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowSkeleton((prev) => !prev)}
                className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${
                  showSkeleton
                    ? "bg-sky-500 text-zinc-950 border-sky-400"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700/60"
                }`}
                title="Toggle Skeleton"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                onClick={toggleCamera}
                className="p-2.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700/60 text-zinc-200 hover:text-white active:scale-95 shadow-lg"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer telemetry and compliance notes */}
      <footer className="w-full max-w-md flex flex-col items-center gap-1.5 text-center text-zinc-500 text-[11px] font-mono mt-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>OneEuroFilter 60 FPS Skinned Mesh Pipeline</span>
        </div>
        <div className="text-[10px] text-zinc-600">
          Target: Spike S3 Rigged Parametric Archetype
        </div>
      </footer>
    </main>
  );
}
