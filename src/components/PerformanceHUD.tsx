import React from "react";
import { BenchmarkStats } from "../types/pose";
import { Activity, Cpu, Flame, CheckCircle, AlertTriangle } from "lucide-react";

interface PerformanceHUDProps {
  stats: BenchmarkStats;
  isReady: boolean;
  activeDelegate: "GPU" | "CPU";
  passBarHz: number;
}

export function PerformanceHUD({
  stats,
  isReady,
  activeDelegate,
  passBarHz,
}: PerformanceHUDProps) {
  const isPassing = stats.poseHz >= passBarHz;
  const targetMinutes = 5;
  const targetSeconds = targetMinutes * 60;
  const progressPct = Math.min(100, Math.round((stats.elapsedSec / targetSeconds) * 100));
  const isComplete = stats.elapsedSec >= targetSeconds;

  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
      {/* Top telemetry pill */}
      <div className="flex items-center justify-between bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isReady ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="font-bold text-zinc-100 tracking-wide">FITTING S2</span>
          </div>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>
              Render: <b className="text-zinc-100">{stats.renderFps}</b> fps
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
              activeDelegate === "GPU"
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {activeDelegate}
          </span>
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span
              className={`font-bold px-1.5 py-0.5 rounded ${
                isPassing
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              {stats.poseHz} Hz
            </span>
          </div>
          <div className="text-zinc-400 hidden sm:block">
            Latency: <b className="text-zinc-200">{stats.latencyMs}ms</b>
          </div>
        </div>
      </div>

      {/* 5-Min Gate 0 countdown & progress */}
      <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800/80 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono shadow-md">
        <div className="flex items-center gap-2">
          {isComplete ? (
            stats.isPassed ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )
          ) : (
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="text-zinc-300 font-medium">Gate 0 Test:</span>
          <span className="text-zinc-400">
            {Math.floor(stats.elapsedSec / 60)}:
            {(stats.elapsedSec % 60).toString().padStart(2, "0")} / 05:00
          </span>
          {isComplete && (
            <span
              className={`font-bold ml-1 px-1.5 py-0.2 rounded text-[10px] ${
                stats.isPassed
                  ? "bg-emerald-500 text-zinc-950"
                  : "bg-rose-500 text-zinc-950"
              }`}
            >
              {stats.isPassed ? "PASS (≥20 Hz)" : "FAIL (<20 Hz)"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20 sm:w-28 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete && !stats.isPassed ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-zinc-400 text-[10px]">{progressPct}%</span>
        </div>
      </div>
    </div>
  );
}
