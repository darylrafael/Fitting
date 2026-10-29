import { useEffect, useRef, useState, useCallback } from "react";
import { Landmark, PoseWorkerOutput, BenchmarkStats } from "../types/pose";

export function usePoseTracker(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeDelegate, setActiveDelegate] = useState<"GPU" | "CPU">("GPU");
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [stats, setStats] = useState<BenchmarkStats>({
    renderFps: 0,
    poseHz: 0,
    latencyMs: 0,
    totalPoses: 0,
    startTime: 0,
    elapsedSec: 0,
    isPassed: false,
  });

  const isWorkerBusyRef = useRef(false);
  const poseCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastSampleTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);

  useEffect(() => {
    // Instantiate Web Worker with module syntax supported by Webpack
    const worker = new Worker(
      new URL("../workers/pose.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<PoseWorkerOutput>) => {
      const data = e.data;
      if (data.type === "READY") {
        setIsReady(true);
        setActiveDelegate(data.delegate);
      } else if (data.type === "POSE_RESULT") {
        isWorkerBusyRef.current = false;
        poseCountRef.current++;
        setLandmarks(data.landmarks);
        setStats((prev) => ({
          ...prev,
          latencyMs: Math.round(data.latencyMs),
          totalPoses: prev.totalPoses + 1,
        }));
      } else if (data.type === "ERROR") {
        isWorkerBusyRef.current = false;
        setError(data.message);
      }
    };

    worker.onerror = (err) => {
      console.error("Worker execution error:", err);
      setError(err.message || "Web Worker execution error");
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
      const currentFps = Math.round((frameCountRef.current * 1000) / dt);
      const currentHz = Math.round((poseCountRef.current * 1000) / dt);

      setStats((prev) => {
        const elapsed = prev.startTime ? Math.floor((now - prev.startTime) / 1000) : 0;
        return {
          ...prev,
          renderFps: currentFps,
          poseHz: currentHz,
          elapsedSec: elapsed,
          isPassed: elapsed >= 300 && currentHz >= 20,
        };
      });

      frameCountRef.current = 0;
      poseCountRef.current = 0;
      lastSampleTimeRef.current = now;
    }

    // Only dispatch frame if worker is idle and video has valid dimension
    if (!isWorkerBusyRef.current && video.readyState >= 2 && video.videoWidth > 0) {
      isWorkerBusyRef.current = true;
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
        .catch(() => {
          isWorkerBusyRef.current = false;
        });
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
      animationFrameRef.current = null;
    }
  }, []);

  return {
    isReady,
    activeDelegate,
    error,
    landmarks,
    stats,
    startTracking,
    stopTracking,
  };
}
