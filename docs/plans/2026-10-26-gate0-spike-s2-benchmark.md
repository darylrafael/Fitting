# Fitting — Gate 0: Spike S2 (iPhone Safari Pose Benchmark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a standalone, zero-bloat benchmark web page for "Fitting" that runs Google MediaPipe Pose Landmarker inside a Web Worker on physical iPhone Safari, logging continuous pose updates, frame rate, latency, and thermal stability over a 5-minute sustained test.

**Architecture:** A lightweight Next.js 15 client where raw video frames from `getUserMedia` are transferred as `ImageBitmap` to a dedicated Web Worker running `@mediapipe/tasks-vision` WASM. The main thread remains decoupled to achieve unblocked 60 FPS UI rendering, while an interactive Performance HUD logs real-time metrics (Pose Hz, Render FPS, Latency ms) to verify the Gate 0 Pass Bar (>20 pose updates/sec sustained for 5 minutes).

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, `@mediapipe/tasks-vision`, Lucide React.

## Global Constraints

- **Platform:** Web application accessible on iOS Safari and desktop browsers over HTTPS.
- **Hardware Target:** Physical iPhone on local network via Next.js experimental HTTPS (`next dev --experimental-https`).
- **Performance Bar (Spike S2):** Sustained $\ge 20$ pose updates/second for 5 continuous minutes without crashing or severe thermal throttling.
- **Zero Heavy 3D in Spike S2:** No Three.js or heavy assets yet — isolate and measure the Computer Vision pipeline first.
- **Strict Typing:** All TypeScript files must compile with 0 errors on `npm run build`.

---

### Task 1: Project Scaffolding & Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`

**Interfaces:**
- Produces: Clean Next.js 15 base app with Tailwind CSS and experimental HTTPS run script.

- [ ] **Step 1: Initialize project directory and create package.json**

Create `package.json` at `c:\Users\Lenovo\Downloads\Fitting\package.json`:

```json
{
  "name": "fitting",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "dev:https": "next dev --experimental-https",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.14",
    "clsx": "^2.1.1",
    "lucide-react": "^0.453.0",
    "next": "^15.0.0",
    "react": "^19.0.0-rc-66855b96-20241025",
    "react-dom": "^19.0.0-rc-66855b96-20241025",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^19.0.0-rc.1",
    "@types/react-dom": "^19.0.0-rc.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create Next.js and Tailwind configuration files**

Create `next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `tailwind.config.ts` and `postcss.config.mjs`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: Create base App layout and styling**

Create `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #09090b;
  --foreground: #fafafa;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
  overflow-x: hidden;
}
```

Create `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fitting — S2 Benchmark",
  description: "Real-time on-device virtual try-on pose benchmark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Install dependencies and verify clean package setup**
Run: `npm install` inside `c:\Users\Lenovo\Downloads\Fitting`
Expected: Dependencies installed without errors.

---

### Task 2: MediaPipe Assets & Web Worker Pipeline

**Files:**
- Create: `public/mediapipe/pose_landmarker_lite.task` (or configure remote CDN fallback)
- Create: `src/workers/pose.worker.ts`
- Create: `src/types/pose.ts`

**Interfaces:**
- Produces: Type definitions for landmark messages and Web Worker message protocol.
- Consumes: Worker input `{ type: "PROCESS_FRAME", bitmap: ImageBitmap, timestamp: number }`.
- Emits: Worker output `{ type: "POSE_RESULT", landmarks: NormalizedLandmark[], latencyMs: number, timestamp: number }`.

- [ ] **Step 1: Create Pose Types**

Create `src/types/pose.ts`:
```typescript
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseMessageInit {
  type: "INIT";
  delegate: "GPU" | "CPU";
  modelType: "lite" | "full";
}

export interface PoseMessageFrame {
  type: "PROCESS_FRAME";
  bitmap: ImageBitmap;
  timestamp: number;
}

export type PoseWorkerInput = PoseMessageInit | PoseMessageFrame;

export interface PoseWorkerResult {
  type: "POSE_RESULT";
  landmarks: Landmark[] | null;
  latencyMs: number;
  timestamp: number;
}

export interface PoseWorkerReady {
  type: "READY";
  delegate: "GPU" | "CPU";
}

export interface PoseWorkerError {
  type: "ERROR";
  message: string;
}

export type PoseWorkerOutput = PoseWorkerResult | PoseWorkerReady | PoseWorkerError;
```

- [ ] **Step 2: Implement MediaPipe Pose Web Worker**

Create `src/workers/pose.worker.ts`:
```typescript
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseWorkerInput } from "../types/pose";

let poseLandmarker: PoseLandmarker | null = null;
let isBusy = false;

self.onmessage = async (e: MessageEvent<PoseWorkerInput>) => {
  const data = e.data;

  if (data.type === "INIT") {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      const modelUrl =
        data.modelType === "lite"
          ? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
          : "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: data.delegate,
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      self.postMessage({ type: "READY", delegate: data.delegate });
    } catch (err: any) {
      self.postMessage({
        type: "ERROR",
        message: err?.message || "Failed to initialize PoseLandmarker",
      });
    }
    return;
  }

  if (data.type === "PROCESS_FRAME") {
    if (!poseLandmarker || isBusy) {
      data.bitmap.close();
      return;
    }

    isBusy = true;
    const start = performance.now();

    try {
      const results = poseLandmarker.detectForVideo(data.bitmap, data.timestamp);
      const latencyMs = performance.now() - start;

      const landmarks =
        results.landmarks && results.landmarks.length > 0
          ? results.landmarks[0]
          : null;

      self.postMessage({
        type: "POSE_RESULT",
        landmarks,
        latencyMs,
        timestamp: data.timestamp,
      });
    } catch (err: any) {
      self.postMessage({
        type: "ERROR",
        message: err?.message || "Inference error",
      });
    } finally {
      data.bitmap.close();
      isBusy = false;
    }
  }
};
```

---

### Task 3: Camera Hook & Web Worker Integration

**Files:**
- Create: `src/hooks/usePoseTracker.ts`

**Interfaces:**
- Consumes: `<video>` element reference.
- Produces: `{ isReady, error, landmarks, stats: { fps, poseHz, latencyMs }, startTracking, stopTracking }`.

- [ ] **Step 1: Implement usePoseTracker custom hook**

Create `src/hooks/usePoseTracker.ts`:
```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import { Landmark, PoseWorkerOutput } from "../types/pose";

export interface BenchmarkStats {
  renderFps: number;
  poseHz: number;
  latencyMs: number;
  totalPoses: number;
  startTime: number;
  elapsedSec: number;
}

export function usePoseTracker(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [stats, setStats] = useState<BenchmarkStats>({
    renderFps: 0,
    poseHz: 0,
    latencyMs: 0,
    totalPoses: 0,
    startTime: 0,
    elapsedSec: 0,
  });

  const poseCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastSampleTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/pose.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<PoseWorkerOutput>) => {
      const data = e.data;
      if (data.type === "READY") {
        setIsReady(true);
      } else if (data.type === "POSE_RESULT") {
        poseCountRef.current++;
        setLandmarks(data.landmarks);
        setStats((prev) => ({
          ...prev,
          latencyMs: Math.round(data.latencyMs),
          totalPoses: prev.totalPoses + 1,
        }));
      } else if (data.type === "ERROR") {
        setError(data.message);
      }
    };

    worker.postMessage({ type: "INIT", delegate: "GPU", modelType: "lite" });

    return () => {
      worker.terminate();
    };
  }, []);

  const sendFrame = useCallback(() => {
    if (!isTrackingRef.current || !videoRef.current || !workerRef.current) return;
    const video = videoRef.current;

    frameCountRef.current++;
    const now = performance.now();
    const dt = now - lastSampleTimeRef.current;

    if (dt >= 1000) {
      setStats((prev) => ({
        ...prev,
        renderFps: Math.round((frameCountRef.current * 1000) / dt),
        poseHz: Math.round((poseCountRef.current * 1000) / dt),
        elapsedSec: prev.startTime ? Math.floor((now - prev.startTime) / 1000) : 0,
      }));
      frameCountRef.current = 0;
      poseCountRef.current = 0;
      lastSampleTimeRef.current = now;
    }

    if (video.readyState >= 2 && video.videoWidth > 0) {
      createImageBitmap(video)
        .then((bitmap) => {
          workerRef.current?.postMessage(
            {
              type: "PROCESS_FRAME",
              bitmap,
              timestamp: now,
            },
            [bitmap]
          );
        })
        .catch(() => {});
    }

    animationFrameRef.current = requestAnimationFrame(sendFrame);
  }, [videoRef]);

  const startTracking = useCallback(() => {
    isTrackingRef.current = true;
    lastSampleTimeRef.current = performance.now();
    setStats((prev) => ({ ...prev, startTime: performance.now() }));
    animationFrameRef.current = requestAnimationFrame(sendFrame);
  }, [sendFrame]);

  const stopTracking = useCallback(() => {
    isTrackingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  return {
    isReady,
    error,
    landmarks,
    stats,
    startTracking,
    stopTracking,
  };
}
```

---

### Task 4: Performance HUD & Skeleton Overlay

**Files:**
- Create: `src/components/PerformanceHUD.tsx`
- Create: `src/components/SkeletonCanvas.tsx`

**Interfaces:**
- Produces: Live debug metrics overlay with 5-minute countdown and pass bar indicators.

- [ ] **Step 1: Implement Performance HUD**

Create `src/components/PerformanceHUD.tsx`:
```tsx
import React from "react";
import { BenchmarkStats } from "../hooks/usePoseTracker";
import { Activity, Cpu, ShieldCheck, Flame } from "lucide-react";

interface PerformanceHUDProps {
  stats: BenchmarkStats;
  isReady: boolean;
  passBarHz: number;
}

export function PerformanceHUD({ stats, isReady, passBarHz }: PerformanceHUDProps) {
  const isPassing = stats.poseHz >= passBarHz;
  const targetMinutes = 5;
  const targetSeconds = targetMinutes * 60;
  const progressPct = Math.min(100, Math.round((stats.elapsedSec / targetSeconds) * 100));

  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
      <div className="flex items-center justify-between bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-zinc-100">FITTING S2</span>
          </div>
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Render: <b className="text-zinc-100">{stats.renderFps}</b> fps</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>Pose: </span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded ${
                isPassing ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {stats.poseHz} Hz
            </span>
          </div>
          <div className="text-zinc-400">
            Latency: <b className="text-zinc-200">{stats.latencyMs}ms</b>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-zinc-300">5-Min Stress Test:</span>
          <span className="text-zinc-400">
            {Math.floor(stats.elapsedSec / 60)}:
            {(stats.elapsedSec % 60).toString().padStart(2, "0")} / 05:00
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-zinc-400 text-[10px]">{progressPct}%</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement Skeleton Overlay Canvas**

Create `src/components/SkeletonCanvas.tsx`:
```tsx
import React, { useEffect, useRef } from "react";
import { Landmark } from "../types/pose";

interface SkeletonCanvasProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
}

// MediaPipe upper body connections
const CONNECTIONS = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], [23, 24], // torso
];

export function SkeletonCanvas({ landmarks, width, height }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;

    // Draw connections
    for (const [i, j] of CONNECTIONS) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a && b && (a.visibility ?? 1) > 0.4 && (b.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      }
    }

    // Draw joint points
    ctx.fillStyle = "#f43f5e";
    for (const pt of landmarks) {
      if ((pt.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, [landmarks, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full object-cover"
    />
  );
}
```

---

### Task 5: Main Benchmark View & Physical Testing Integration

**Files:**
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: Complete responsive page that starts camera, requests user permission, runs benchmark, and shows pass/fail verdict.

- [ ] **Step 1: Implement Main Benchmark Page**

Create `src/app/page.tsx`:
```tsx
"use client";

import React, { useRef, useState, useEffect } from "react";
import { usePoseTracker } from "../hooks/usePoseTracker";
import { PerformanceHUD } from "../components/PerformanceHUD";
import { SkeletonCanvas } from "../components/SkeletonCanvas";
import { Camera, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function BenchmarkPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  const { isReady, error, landmarks, stats, startTracking, stopTracking } =
    usePoseTracker(videoRef);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setDimensions({
            width: videoRef.current?.videoWidth || 640,
            height: videoRef.current?.videoHeight || 480,
          });
          setHasStarted(true);
          startTracking();
        };
      }
    } catch (err: any) {
      alert("Camera permission denied: " + err.message);
    }
  };

  useEffect(() => {
    return () => {
      stopTracking();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopTracking]);

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden select-none">
      <PerformanceHUD stats={stats} isReady={isReady} passBarHz={20} />

      <div className="relative w-full max-w-lg aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover -scale-x-100 ${
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

        {!hasStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 bg-zinc-950/80">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Fitting S2 Benchmark</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                Tests Google MediaPipe in a Web Worker on physical Safari. Target: ≥20 updates/sec for 5 mins.
              </p>
            </div>
            <button
              onClick={startCamera}
              disabled={!isReady}
              className="mt-2 px-6 py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold rounded-xl text-sm transition-all shadow-lg shadow-sky-500/20 active:scale-95"
            >
              {isReady ? "Launch Camera & Start 5-Min Test" : "Loading MediaPipe Worker..."}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>100% on-device processing. No video leaves your browser.</span>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build and verify zero compilation errors**
Run: `npm run build`
Expected: Build succeeds with `Compiled successfully` and 0 TypeScript errors.

- [ ] **Step 3: Verification on Physical iPhone**
1. Run local HTTPS server: `npm run dev:https`
2. Open the reported local network HTTPS link (or Cloudflare tunnel URL) on iPhone Safari.
3. Grant camera permission.
4. Run for 5 minutes and observe:
   - Does Pose Hz stay $\ge 20$?
   - Does iPhone get uncomfortably hot?
   - Any crashes or frozen video frames?
