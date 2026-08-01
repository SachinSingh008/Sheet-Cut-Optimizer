import { useMemo } from "react";
import {
  BrainCircuit,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  Square,
  Scaling,
  ArrowRightLeft,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { store, useAppState } from "@/lib/store";
import { ALGORITHMS } from "@/lib/mock-data";
import { analyzeBOMCharacteristics, selectAdaptiveAlgorithm } from "@/lib/nesting";
import type { OptimizationResult } from "@/lib/nesting";

const CHARACTERISTIC_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: typeof Scaling }
> = {
  "mostly-long": {
    label: "Mostly Long Parts",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    icon: Scaling,
  },
  "mostly-squares": {
    label: "Mostly Squares",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    icon: Square,
  },
  "tiny-parts": {
    label: "Tiny Parts",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: Minimize2,
  },
  "large-plates": {
    label: "Large Plates",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    icon: Maximize2,
  },
  "mixed-parts": {
    label: "Mixed Parts",
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/30",
    icon: ArrowRightLeft,
  },
};

export function AdaptiveEngineCard({ result }: { result: OptimizationResult | null }) {
  const { parts, config } = useAppState();

  const bomAnalysis = useMemo(() => {
    if (result?.bomAnalysis) return result.bomAnalysis;
    return analyzeBOMCharacteristics(parts, config.sheetLength, config.sheetWidth);
  }, [result?.bomAnalysis, parts, config.sheetLength, config.sheetWidth]);

  const decisionLogic = useMemo(() => {
    if (result?.decisionLogic) return result.decisionLogic;
    return selectAdaptiveAlgorithm(bomAnalysis, config.algorithm);
  }, [result?.decisionLogic, bomAnalysis, config.algorithm]);

  const style = CHARACTERISTIC_STYLES[bomAnalysis.characteristic] || CHARACTERISTIC_STYLES["mixed-parts"]!;
  const CharacteristicIcon = style.icon;

  const isAutoMode = config.algorithm === "auto";

  return (
    <Card className="overflow-hidden border bg-card p-6 shadow-soft rounded-2xl space-y-5">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold shadow-xs">
            <BrainCircuit className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base text-foreground tracking-tight">
                Adaptive Optimization Engine
              </h3>
              <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-[10px] uppercase px-2 py-0.5">
                <Sparkles className="mr-1 size-3" /> AI Decision Logic
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated heuristic selection based on real-time Bill of Materials (BOM) feature analysis.
            </p>
          </div>
        </div>

        {/* Heuristic Selector Override */}
        <div className="flex items-center gap-2 shrink-0">
          <Sliders className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Heuristic Mode:</span>
          <Select
            value={config.algorithm}
            onValueChange={(val) => {
              store.set({ config: { ...config, algorithm: val } });
              if (parts.length > 0) {
                store.runOptimization();
              }
            }}
          >
            <SelectTrigger className="h-8 w-[210px] text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALGORITHMS.map((alg) => (
                <SelectItem key={alg.value} value={alg.value} className="text-xs">
                  {alg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Grid: Characteristic Badge & Decision Rationale */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: BOM Characteristic Classification Card */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border p-4.5 bg-muted/20 space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                BOM Classification
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {bomAnalysis.totalPiecesCount} Total Pieces ({bomAnalysis.totalPartsCount} Items)
              </span>
            </div>

            <div className={`flex items-center gap-3 rounded-xl border p-3 ${style.bg} ${style.border}`}>
              <CharacteristicIcon className={`size-6 shrink-0 ${style.text}`} />
              <div>
                <h4 className={`font-extrabold text-sm ${style.text}`}>
                  {bomAnalysis.characteristicLabel}
                </h4>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  Avg Aspect Ratio: <strong>{bomAnalysis.avgAspectRatio} : 1</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3 space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Active Strategy Engine
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <span className="font-bold text-xs text-foreground">
                  {decisionLogic.algorithmLabel}
                </span>
              </div>
              {isAutoMode ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                  <CheckCircle2 className="mr-1 size-3" /> Auto Selected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-mono">
                  Manual Override
                </Badge>
              )}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-2 rounded-lg border leading-tight">
              {decisionLogic.heuristicStrategy}
            </p>
          </div>
        </div>

        {/* Right Column: Detailed Decision Logic Explanation */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border p-4.5 bg-card space-y-4 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <Zap className="size-4 text-amber-500" />
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                Automated Decision Rationale & Explanation
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="font-semibold text-foreground text-xs leading-relaxed">
                  <strong>Primary Rationale:</strong> {decisionLogic.primaryReason}
                </p>
              </div>

              <div className="rounded-lg bg-muted/30 border p-3">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <strong>Algorithmic Explanation:</strong> {decisionLogic.explanation}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Distribution Cards Grid */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t">
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Long Parts</p>
              <p className="font-extrabold text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                {Math.round(bomAnalysis.longPartsRatio * 100)}%
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Square Parts</p>
              <p className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                {Math.round(bomAnalysis.squarePartsRatio * 100)}%
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Large Plates</p>
              <p className="font-extrabold text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                {Math.round(bomAnalysis.largePartsRatio * 100)}%
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Tiny Parts</p>
              <p className="font-extrabold text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {Math.round(bomAnalysis.tinyPartsRatio * 100)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
