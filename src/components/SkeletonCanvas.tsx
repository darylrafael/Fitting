import React, { useEffect, useRef } from "react";
import { Landmark } from "../types/pose";

interface SkeletonCanvasProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
}

// MediaPipe 33-point Pose upper body & torso connections
const CONNECTIONS: [number, number][] = [
  // Shoulders & Torso
  [11, 12], // left shoulder to right shoulder
  [11, 23], // left shoulder to left hip
  [12, 24], // right shoulder to right hip
  [23, 24], // hip span
  // Arms
  [11, 13], // left shoulder to left elbow
  [13, 15], // left elbow to left wrist
  [12, 14], // right shoulder to right elbow
  [14, 16], // right elbow to right wrist
  // Hands
  [15, 17], [15, 19], [15, 21], // left hand fingers
  [16, 18], [16, 20], [16, 22], // right hand fingers
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

    // Draw skeletal bones
    ctx.strokeStyle = "#38bdf8"; // Sky 400
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

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

    // Draw joint nodes
    for (let i = 0; i < landmarks.length; i++) {
      // Focus on upper body joints (0-24)
      if (i > 24) continue;
      const pt = landmarks[i];
      if ((pt.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = i === 11 || i === 12 ? "#34d399" : "#fb7185"; // Emerald for shoulders, rose for others
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }
  }, [landmarks, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full object-cover -scale-x-100"
    />
  );
}
