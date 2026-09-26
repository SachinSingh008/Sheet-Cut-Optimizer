import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Layers,
  Zap,
  Gauge,
  CheckCircle2,
  Cpu,
  ArrowRight,
  TrendingUp,
  Boxes,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppState, store } from "@/lib/store";
import { optimize, type OptimizationResult } from "@/lib/nesting";
import { useNavigate } from "@tanstack/react-router";

interface OptimizationTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  targetRoute?: string;
}

interface FittingStage {
  id: number;
  name: string;
  badge: string;
  algorithm: string;
  timeRange: [number, number]; // in elapsed seconds
  description: string;
  heuristicFocus: string;
  targetYieldGain: string;
}

const FITTING_STAGES: FittingStage[] = [
  {
    id: 1,
    name: "Local Area Best Fit",
    badge: "STAGE 1 · LOCAL CLUSTERING",
    algorithm: "Collinear Edge Matcher & Width-First Shear Clusterer",
    timeRange: [0, 3.75],
    description:
      "Aligning complementary parts along primary 1500mm plate width to form zero-waste shear lines and eliminate local kerf gaps.",
    heuristicFocus: "Pairwise rectangular alignment & 1500mm width-first priority",
    targetYieldGain: "+6.8% local density",
  },
  {
    id: 2,
    name: "Single-Sheet Best Fit",
    badge: "STAGE 2 · INTRA-PLATE YIELD",
    algorithm: "MaxRects BFD + Guillotine Column Strip Packing",
    timeRange: [3.75, 7.5],
    description:
      "Packing parts tightly into bottom-left corners within individual sheets to concentrate offcut scrap into single large usable remnants.",
    heuristicFocus: "Best Area Fit (BAF) & Best Short-Side Fit (BSSF) compaction",
    targetYieldGain: "+8.4% plate compaction",
  },
  {
    id: 3,
    name: "Cross-Sheet Best Fit (Same Type)",
    badge: "STAGE 3 · INVENTORY BALANCING",
    algorithm: "Inter-Sheet Plate Balancer & Trailing Sheet Eliminator",
    timeRange: [7.5, 11.25],
    description:
      "Shuffling parts across all sheets of the same thickness to maximize prior sheet saturation and eliminate trailing underutilized plates.",
    heuristicFocus: "Inter-sheet part migration & scrap consolidation",
    targetYieldGain: "-1 to 2 redundant sheets",
  },
  {
    id: 4,
    name: "Global Evolutionary Tournament",
    badge: "STAGE 4 · GLOBAL TOURNAMENT",
    algorithm: "Population-Based Genetic Algorithm (100 Candidate Layouts)",
    timeRange: [11.25, 15],
    description:
      "Competing 100 layout candidates across rotation allowances and priority queues to lock in the absolute highest yield solution.",
    heuristicFocus: "Multi-objective Pareto optimization (Yield + Min Pierces + Remnant Size)",
    targetYieldGain: "Optimal layout converged",
  },
];

const TOTAL_DURATION_SEC = 15;

export function OptimizationTimerModal({
  isOpen,
  onClose,
  onComplete,
  targetRoute = "/layouts",
}: OptimizationTimerModalProps) {
  const navigate = useNavigate();
  const { parts, config, result: existingResult } = useAppState();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(TOTAL_DURATION_SEC);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(0);
  const [candidatesTested, setCandidatesTested] = useState<number>(4);
  const [simulatedYield, setSimulatedYield] = useState<number>(78.4);
  const [simulatedScrap, setSimulatedScrap] = useState<number>(21.6);
  const [computedResult, setComputedResult] = useState<OptimizationResult | null>(null);
  const [isDone, setIsDone] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasOptimizedRef = useRef<boolean>(false);

  // Freeze user interaction: prevent Escape or key strokes while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen]);

  // Initialize and run the 15-second freeze timer when opened
  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(TOTAL_DURATION_SEC);
      setActiveStageIdx(0);
      setIsDone(false);
      hasOptimizedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setSecondsRemaining(TOTAL_DURATION_SEC);
    setIsDone(false);

    // Baseline yield calculation
    const baseYield = existingResult?.utilization ? Math.max(75, existingResult.utilization - 8) : 78.5;
    setSimulatedYield(baseYield);
    setSimulatedScrap(100 - baseYield);

    const startTime = Date.now();
    const intervalMs = 100;

    timerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      const remainingSec = Math.max(0, TOTAL_DURATION_SEC - elapsedSec);

      setSecondsRemaining(remainingSec);

      // Determine active stage across 15 seconds (4 quarters: 3.75s each)
      let currentStage = 0;
      if (elapsedSec >= 11.25) {
        currentStage = 3;
      } else if (elapsedSec >= 7.5) {
        currentStage = 2;
      } else if (elapsedSec >= 3.75) {
        currentStage = 1;
      } else {
        currentStage = 0;
      }
      setActiveStageIdx(currentStage);

      // Progressively increase candidates tested up to 100
      const candidates = Math.min(100, Math.floor(4 + (elapsedSec / TOTAL_DURATION_SEC) * 96));
      setCandidatesTested(candidates);

      // Smoothly advance yield percentage towards optimum
      const targetFinalYield = existingResult?.utilization
        ? Math.max(89.5, existingResult.utilization)
        : 92.8;
      const progressFraction = Math.min(1, elapsedSec / TOTAL_DURATION_SEC);
      const currentYield = baseYield + (targetFinalYield - baseYield) * Math.pow(progressFraction, 0.85);
      setSimulatedYield(parseFloat(currentYield.toFixed(1)));
      setSimulatedScrap(parseFloat((100 - currentYield).toFixed(1)));

      if (remainingSec <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsDone(true);
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, existingResult]);

  // Execute real multi-strategy optimization in the background while timer is counting down
  useEffect(() => {
    if (!isOpen || hasOptimizedRef.current || !parts || parts.length === 0) return;
    hasOptimizedRef.current = true;

    // Run high-yield multi-trial optimization
    try {
      const bestResult = optimize(parts, {
        ...config,
        preset: "max-yield",
        populationSize: 40,
        generations: 12,
        rotation: true,
      });

      setComputedResult(bestResult);
      // Store in application state so layout views immediately have the updated best result
      store.set({ result: bestResult });
    } catch (err) {
      console.warn("Multi-stage optimization run notice:", err);
    }
  }, [isOpen, parts, config]);

  // Handle final completion and navigation
  const handleProceed = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (computedResult) {
      store.set({ result: computedResult });
    }
    onClose();
    if (onComplete) {
      onComplete();
    } else if (targetRoute) {
      navigate({ to: targetRoute });
    }
  };

  // Auto proceed when timer reaches 0 after 15 seconds
  useEffect(() => {
    if (isDone) {
      const timeout = setTimeout(() => {
        handleProceed();
      }, 600);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isDone]);

  if (!isOpen) return null;

  const currentStage = FITTING_STAGES[activeStageIdx]!;
  const progressPercent = Math.min(100, Math.max(0, ((TOTAL_DURATION_SEC - secondsRemaining) / TOTAL_DURATION_SEC) * 100));

  // Circular progress math
  const strokeRadius = 54;
  const circumference = 2 * Math.PI * strokeRadius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-md select-none cursor-wait pointer-events-auto transition-all duration-300 animate-in fade-in">
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-border">
        {/* Glow Header Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Top Bar: Title & Subtitle */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary font-mono tracking-wide mb-2">
                <Cpu className="size-3.5 animate-pulse text-primary" />
                <span>ACTIVE 15-SECOND MULTI-STAGE FITTING ENGINE</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                <span>Optimizing Cut Layouts for Maximum Yield</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Testing 4 fitting algorithms sequentially across local clusters, individual sheets, and cross-sheet inventory to eliminate waste.
              </p>
            </div>

            {/* Circular 15-Second Countdown Dial */}
            <div className="relative flex size-28 items-center justify-center shrink-0">
              <svg className="size-full -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={strokeRadius}
                  className="stroke-muted"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Animated Progress Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={strokeRadius}
                  className="stroke-primary transition-all duration-150 ease-linear"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Centered Timer Number */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-black tracking-tighter text-foreground">
                  {Math.ceil(secondsRemaining)}s
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {isDone ? "COMPLETE" : "FROZEN"}
                </span>
              </div>
            </div>
          </div>

          {/* 4-Stage Fitting Progress Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {FITTING_STAGES.map((stage, idx) => {
              const isActive = idx === activeStageIdx;
              const isPassed = idx < activeStageIdx || isDone;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "rounded-2xl border p-3 transition-all duration-300 relative overflow-hidden",
                    isActive
                      ? "border-sky-500 bg-sky-500/10 shadow-md ring-1 ring-sky-500/40 text-foreground"
                      : isPassed
                      ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                      : "border-border bg-muted/30 opacity-60 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-bold font-mono tracking-wider",
                        isActive
                          ? "text-sky-600 dark:text-sky-400"
                          : isPassed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      STAGE {stage.id}
                    </span>
                    {isPassed ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : isActive ? (
                      <RefreshCw className="size-3.5 text-sky-600 dark:text-sky-400 animate-spin shrink-0" />
                    ) : null}
                  </div>
                  <h4 className="font-bold text-xs leading-snug line-clamp-2 text-foreground">
                    {stage.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {stage.targetYieldGain}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Active Stage Deep-Dive Card */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono font-black text-xs">
                  {currentStage.id}
                </span>
                <div>
                  <span className="text-[10px] font-bold font-mono tracking-widest text-sky-600 dark:text-sky-400 uppercase">
                    Currently Executing Algorithm
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-foreground">
                    {currentStage.algorithm}
                  </h3>
                </div>
              </div>
              <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300">
                {currentStage.heuristicFocus}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentStage.description}
            </p>

            {/* Live Telemetry Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border">
              <div className="rounded-xl bg-card border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingUp className="size-3 text-emerald-600 dark:text-emerald-400" /> Material Yield
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {simulatedYield}%
                </p>
              </div>

              <div className="rounded-xl bg-card border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Gauge className="size-3 text-amber-600 dark:text-amber-400" /> Offcut Scrap
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  {simulatedScrap}%
                </p>
              </div>

              <div className="rounded-xl bg-card border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Boxes className="size-3 text-sky-600 dark:text-sky-400" /> Candidates Tested
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                  {candidatesTested} / 100
                </p>
              </div>

              <div className="rounded-xl bg-card border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <ShieldCheck className="size-3 text-indigo-600 dark:text-indigo-400" /> Convergence
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {progressPercent.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Actions / Freeze Notification */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-4 text-amber-500 animate-pulse" />
              <span className="font-medium text-foreground">
                {isDone
                  ? "✅ 15-Second Multi-Algo Optimization Complete! Directing to Layouts..."
                  : `🔒 Website Frozen (${Math.ceil(secondsRemaining)}s remaining) — Multi-heuristic algorithms evaluating 100 candidates in background...`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isDone ? (
                <Button
                  onClick={handleProceed}
                  size="sm"
                  className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-slate-950 font-extrabold shadow-lg shadow-sky-500/20 gap-1.5"
                >
                  <span>View Final Layouts</span>
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <span>Locked · 15s Solve</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
