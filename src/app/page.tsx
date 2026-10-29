"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { usePoseTracker } from "../hooks/usePoseTracker";
import { PerformanceHUD } from "../components/PerformanceHUD";
import { SkeletonCanvas } from "../components/SkeletonCanvas";
import { Camera, ShieldCheck, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

export default function BenchmarkPage() {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { isReady, activeDelegate, error, landmarks, stats, startTracking, stopTracking } =
    usePoseTracker(videoRef);

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

        {hasStarted && (
          <SkeletonCanvas
            landmarks={landmarks}
            width={dimensions.width}
            height={dimensions.height}
          />
        )}

        {/* Start / Loading Overlay */}
        {!hasStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 bg-zinc-950/85">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400 shadow-inner">
              <Camera className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-mono mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Gate 0: Spike S2</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-100">Fitting Benchmark</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Evaluates MediaPipe Pose Landmarker inside a Web Worker on physical iPhone Safari.
                Pass criteria: <b className="text-zinc-200">≥20 pose updates/s for 5 mins</b>.
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
              {isReady ? "Launch Camera & Start 5-Min Test" : "Initializing Web Worker..."}
            </button>
          </div>
        )}

        {/* In-viewport Controls */}
        {hasStarted && (
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={toggleCamera}
              className="p-3 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700/60 text-zinc-200 hover:text-white active:scale-95 shadow-lg"
              title="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Footer telemetry and compliance notes */}
      <footer className="w-full max-w-md flex flex-col items-center gap-1.5 text-center text-zinc-500 text-[11px] font-mono mt-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>100% on-device inference. Zero video data transmitted.</span>
        </div>
        <div className="text-[10px] text-zinc-600">
          Target Hardware: Physical iPhone (iOS 17+) over HTTPS
        </div>
      </footer>
    </main>
  );
}
