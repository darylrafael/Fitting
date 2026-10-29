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

export interface BenchmarkStats {
  renderFps: number;
  poseHz: number;
  latencyMs: number;
  totalPoses: number;
  startTime: number;
  elapsedSec: number;
  isPassed: boolean;
}
