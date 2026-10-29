// Polyfill DOM globals before importing MediaPipe in Web Worker environment
/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof (globalThis as any).OffscreenCanvas !== "undefined") {
  const ocProto = (globalThis as any).OffscreenCanvas.prototype;
  if (!ocProto.getContextSafariWebGL2Fixed) {
    ocProto.getContextSafariWebGL2Fixed = function (ver: any, attrs: any) {
      return this.getContext(ver, attrs);
    };
  }
}

function createMockCanvas(width = 256, height = 256) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    if (!(canvas as any).getContextSafariWebGL2Fixed) {
      (canvas as any).getContextSafariWebGL2Fixed = function (ver: any, attrs: any) {
        return canvas.getContext(ver, attrs);
      };
    }
    return canvas;
  }
  return {
    width,
    height,
    style: {},
    getContext: () => null,
    getContextSafariWebGL2Fixed: () => null,
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (typeof (globalThis as any).HTMLCanvasElement === "undefined") {
  (globalThis as any).HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined" ? OffscreenCanvas : class {};
}

if (typeof (globalThis as any).document === "undefined") {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      const lower = (tag || "").toLowerCase();
      if (lower === "canvas") {
        return createMockCanvas();
      }
      return {
        style: {},
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    },
    getElementsByTagName: (tag: string) => {
      const lower = (tag || "").toLowerCase();
      if (lower === "canvas") {
        return [createMockCanvas()];
      }
      return [];
    },
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).screen === "undefined") {
  (globalThis as any).screen = { width: 1280, height: 720 };
}

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseWorkerInput } from "../types/pose";

let poseLandmarker: PoseLandmarker | null = null;
let isBusy = false;

self.onmessage = async (e: MessageEvent<PoseWorkerInput>) => {
  const data = e.data;

  if (data.type === "INIT") {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
      );

      const modelUrl =
        data.modelType === "lite"
          ? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
          : "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

      try {
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
      } catch (gpuErr: any) {
        if (data.delegate === "GPU") {
          console.warn("GPU delegate failed in worker, falling back to CPU:", gpuErr);
          poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          self.postMessage({ type: "READY", delegate: "CPU" });
        } else {
          throw gpuErr;
        }
      }
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
