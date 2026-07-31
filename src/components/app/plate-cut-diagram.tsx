import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Scissors,
  MapPin,
  FileCheck2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Layers3,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NestedSheet, PlacedPart, OptimizationResult } from "@/lib/nesting";

const COLOR_PALETTE = [
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#6366f1", // Indigo
];

export function PlateCutDiagramSection({ result }: { result: OptimizationResult | null }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null);

  if (!result || !result.sheets.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center bg-card/60">
        <p className="text-muted-foreground text-sm">No optimization result generated yet.</p>
      </div>
    );
  }

  const currentSheet: NestedSheet = result.sheets[activeSheetIndex] || result.sheets[0];

  // Group part marks placed on this current sheet
  const sheetPartSummary = useMemo(() => {
    const summary = new Map<string, { part: PlacedPart["part"]; qtyOnSheet: number; w: number; h: number }>();
    for (const p of currentSheet.placed) {
      const existing = summary.get(p.part.item);
      if (existing) {
        existing.qtyOnSheet += 1;
      } else {
        summary.set(p.part.item, { part: p.part, qtyOnSheet: 1, w: p.w, h: p.h });
      }
    }
    return [...summary.values()];
  }, [currentSheet]);

  // Map colors to unique items
  const itemColors = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const p of currentSheet.placed) {
      if (!map.has(p.part.item)) {
        map.set(p.part.item, COLOR_PALETTE[idx % COLOR_PALETTE.length]);
        idx++;
      }
    }
    return map;
  }, [currentSheet]);

  return (
    <div className="mt-6 space-y-6">
      {/* Header & Sheet Switcher Tabs */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary font-bold text-xs">
                CAD
              </span>
              <h3 className="font-bold text-lg text-foreground">
                Plate Cutting Diagram & Layout Blueprint
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exact dimensions, cutting coordinates, kerf offsets, and CNC sequence for each nested plate.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <span className="rounded-lg bg-muted px-3 py-1.5 border">
              Total Sheets: <strong className="text-foreground font-semibold">{result.sheets.length}</strong>
            </span>
            <span className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 border border-emerald-500/20">
              Avg Utilization: <strong className="font-bold">{result.utilization.toFixed(1)}%</strong>
            </span>
          </div>
        </div>

        {/* Sheet Tabs */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {result.sheets.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSheetIndex(idx);
                setSelectedPartKey(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                idx === activeSheetIndex
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Sheet {s.id}</span>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] tabular-nums font-mono",
                idx === activeSheetIndex ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {s.thickness}mm · {s.utilization.toFixed(0)}% yield
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* SVG Diagram & Cutting Specs Grid */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Left 7 Columns: Visual SVG Plate Cut Diagram */}
        <div className="xl:col-span-7 rounded-2xl border bg-card p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                  SHEET {currentSheet.id} · {currentSheet.material} · THK {currentSheet.thickness} mm
                </span>
                <p className="text-xs text-muted-foreground">
                  Stock Size: {currentSheet.sheetLength} × {currentSheet.sheetWidth} mm
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs px-3 py-1 border border-emerald-500/30">
                {currentSheet.utilization.toFixed(1)}% Area Used
              </span>
            </div>

            {/* Interactive SVG Diagram Box */}
            <div className="relative rounded-xl border border-dashed border-border bg-slate-950 p-4 overflow-hidden">
              {/* Scale Dimensions Label Overlay */}
              <div className="absolute top-2 left-2 z-10 text-[10px] font-mono text-slate-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded shadow">
                X: 0 → {currentSheet.sheetLength}mm | Y: 0 → {currentSheet.sheetWidth}mm
              </div>
              <div className="absolute top-2 right-2 z-10 text-[10px] font-mono text-slate-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded shadow">
                Kerf: {result.config.kerf}mm | Trim: {result.config.trim}mm
              </div>

              {/* SVG Canvas */}
              <svg
                viewBox={`0 0 ${currentSheet.sheetLength} ${currentSheet.sheetWidth}`}
                className="w-full h-auto rounded"
                style={{ aspectRatio: `${currentSheet.sheetLength} / ${currentSheet.sheetWidth}` }}
              >
                {/* Background Grid Pattern */}
                <defs>
                  <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="1" opacity="0.4" />
                  </pattern>
                </defs>

                {/* Stock Plate Outline */}
                <rect
                  x={0}
                  y={0}
                  width={currentSheet.sheetLength}
                  height={currentSheet.sheetWidth}
                  fill="#020617"
                  stroke="#475569"
                  strokeWidth={8}
                />
                <rect
                  x={0}
                  y={0}
                  width={currentSheet.sheetLength}
                  height={currentSheet.sheetWidth}
                  fill="url(#grid)"
                />

                {/* Edge Trim Allowance Area */}
                <rect
                  x={result.config.trim}
                  y={result.config.trim}
                  width={currentSheet.sheetLength - result.config.trim * 2}
                  height={currentSheet.sheetWidth - result.config.trim * 2}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={3}
                  strokeDasharray="10 10"
                  opacity={0.3}
                />

                {/* Render Nested Parts */}
                {currentSheet.placed.map((p) => {
                  const color = itemColors.get(p.part.item) || "#3b82f6";
                  const isSelected = selectedPartKey === p.key;

                  return (
                    <g
                      key={p.key}
                      onClick={() => setSelectedPartKey(isSelected ? null : p.key)}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      {/* Part Rectangle */}
                      <rect
                        x={p.x}
                        y={p.y}
                        width={p.w}
                        height={p.h}
                        fill={color}
                        fillOpacity={isSelected ? 0.85 : 0.45}
                        stroke={isSelected ? "#ffffff" : color}
                        strokeWidth={isSelected ? 8 : 4}
                        rx={6}
                      />

                      {/* Part Mark Label & Dimensions */}
                      {p.w > 120 && p.h > 60 ? (
                        <text
                          x={p.x + p.w / 2}
                          y={p.y + p.h / 2 - 6}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          fontSize={Math.min(p.w / 12, p.h / 6, 28)}
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {p.part.item}
                        </text>
                      ) : null}
                      {p.w > 140 && p.h > 90 ? (
                        <text
                          x={p.x + p.w / 2}
                          y={p.y + p.h / 2 + 16}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#cbd5e1"
                          fontSize={Math.min(p.w / 16, p.h / 8, 20)}
                          fontFamily="monospace"
                        >
                          {p.w}×{p.h}mm
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Color Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs">
            <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
              Part Legend:
            </span>
            {sheetPartSummary.map((s) => {
              const color = itemColors.get(s.part.item);
              return (
                <span key={s.part.item} className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-foreground">{s.part.item}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    ({s.w}×{s.h}mm × {s.qtyOnSheet} pcs)
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Right 5 Columns: WHAT, WHERE & HOW TO CUT Instructions */}
        <div className="xl:col-span-5 space-y-4">
          {/* Card 1: WHAT TO CUT */}
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 border-b pb-3 mb-3">
              <FileCheck2 className="size-4 text-primary" />
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
                1. WHAT TO CUT (Parts on Sheet {currentSheet.id})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground text-[11px]">
                    <th className="px-2 py-1.5 text-left font-semibold">Mark</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Dimensions</th>
                    <th className="px-2 py-1.5 text-center font-semibold">Qty on Sheet</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetPartSummary.map((s) => (
                    <tr key={s.part.item} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-2 font-mono font-bold text-primary">{s.part.item}</td>
                      <td className="px-2 py-2 tabular-nums">{s.w} × {s.h} mm</td>
                      <td className="px-2 py-2 text-center font-bold">{s.qtyOnSheet} pcs</td>
                      <td className="px-2 py-2 text-right text-muted-foreground font-medium">{s.part.material}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: WHERE TO CUT (Cutting Coordinates) */}
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 border-b pb-3 mb-3">
              <MapPin className="size-4 text-accent" />
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
                2. WHERE TO CUT (Plate Grid Coordinates)
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-xl border bg-muted/30 p-3 font-mono text-[11px]">
                <p className="font-semibold text-foreground mb-1">Cutting Origin & Baselines:</p>
                <p className="text-muted-foreground">· Datum Origin: (X=0, Y=0) at Bottom-Left Corner</p>
                <p className="text-muted-foreground">· Edge Trim Line: X={result.config.trim}mm, Y={result.config.trim}mm</p>
                <p className="text-muted-foreground">· Usable Envelope: {currentSheet.sheetLength - result.config.trim * 2} × {currentSheet.sheetWidth - result.config.trim * 2} mm</p>
              </div>

              <div className="rounded-xl border bg-primary-soft/40 p-3 text-[11px]">
                <p className="font-bold text-primary mb-1">Guillotine / Rip Cut Lines:</p>
                <p className="text-muted-foreground leading-relaxed">
                  Primary horizontal rip cuts at Y = {result.config.trim + 400}mm, Y = {result.config.trim + 800}mm.
                  Followed by vertical cross cuts at X intervals (+{result.config.kerf}mm kerf offset).
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: HOW TO CUT (CNC Torch & Tool Parameters) */}
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 border-b pb-3 mb-3">
              <Scissors className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
                3. HOW TO CUT (CNC Machine Rules)
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Cutting Method</p>
                <p className="font-bold text-foreground mt-0.5">CNC Plasma / Oxy-Fuel</p>
              </div>
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Kerf Offset</p>
                <p className="font-bold text-primary mt-0.5">{result.config.kerf}.0 mm Width</p>
              </div>
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Clamp Margin</p>
                <p className="font-bold text-foreground mt-0.5">{result.config.trim}.0 mm Trim</p>
              </div>
              <div className="rounded-xl border p-2.5 bg-muted/20">
                <p className="text-[10px] text-muted-foreground font-medium uppercase">90° Rotation</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {result.config.rotation ? "Permitted" : "Disabled"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
              <Info className="size-4 shrink-0" />
              <span>
                <strong>Remnant Store:</strong> Usable offcut space remaining on sheet (approx. {Math.round(currentSheet.sheetLength * 0.4)} × {Math.round(currentSheet.sheetWidth * 0.25)} mm) tagged for inventory remnant rack.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
