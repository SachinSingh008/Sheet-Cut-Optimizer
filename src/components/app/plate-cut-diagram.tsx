import { useState, useMemo, useRef, useEffect } from "react";
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
  ChevronLeft,
  Info,
  Ruler,
  Move,
  RefreshCw,
  Layers,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { NestedSheet, PlacedPart, OptimizationResult } from "@/lib/nesting";

const LIGHT_COLOR_PALETTE = [
  "#93c5fd", // Soft Blue
  "#a5f3fc", // Soft Cyan
  "#6ee7b7", // Soft Mint / Emerald
  "#c4b5fd", // Soft Lavender / Purple
  "#fde047", // Soft Amber / Yellow
  "#f9a8d4", // Soft Pink
  "#a5b4fc", // Soft Indigo
];

/** Compute major clean rectangular scrap / remnant offcut blocks on a sheet */
function computeRemnantOffcuts(sheet: NestedSheet) {
  const offcuts: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];
  if (!sheet.placed || sheet.placed.length === 0) {
    offcuts.push({ id: "offcut-full", x: 0, y: 0, w: sheet.sheetLength, h: sheet.sheetWidth });
    return offcuts;
  }

  const maxX = Math.max(...sheet.placed.map((p) => p.x + p.w));
  const maxY = Math.max(...sheet.placed.map((p) => p.y + p.h));

  const rightW = sheet.sheetLength - maxX;
  const topH = sheet.sheetWidth - maxY;

  // Primary right continuous rectangular offcut
  if (rightW > 15) {
    offcuts.push({
      id: "offcut-right-full",
      x: maxX,
      y: 0,
      w: rightW,
      h: sheet.sheetWidth,
    });
  }

  // Primary top continuous rectangular offcut over packed region
  if (topH > 15 && maxX > 0) {
    offcuts.push({
      id: "offcut-top-packed",
      x: 0,
      y: maxY,
      w: Math.min(maxX, sheet.sheetLength),
      h: topH,
    });
  }

  return offcuts;
}

/** 
 * Single Div Canvas for All Sheets of the Same Thickness Grade
 * Renders all sheets of the same thickness inside a SINGLE div container.
 */
function ThicknessGroupCanvas({
  thickness,
  sheets,
  result,
  itemColors,
}: {
  thickness: number;
  sheets: NestedSheet[];
  result: OptimizationResult;
  itemColors: Map<string, string>;
}) {
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const maxW = useMemo(() => Math.max(...sheets.map((s) => s.sheetLength)), [sheets]);
  const spacingY = 220; // Vertical spacing between stacked sheets
  const totalH = useMemo(
    () => sheets.reduce((sum, s) => sum + s.sheetWidth + spacingY, 0),
    [sheets, spacingY]
  );

  // Find currently selected part across all sheets in this group
  const selectedPart = useMemo(() => {
    if (!selectedPartKey) return null;
    for (const s of sheets) {
      const p = s.placed.find((item) => item.key === selectedPartKey);
      if (p) return { part: p, sheetId: s.id };
    }
    return null;
  }, [selectedPartKey, sheets]);

  const handleResetZoomPan = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomScale((s) => Math.min(4, Number((s + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))));
  };

  // Non-passive wheel event listener: Normal scroll pans vertically inside diagram div, Ctrl+Scroll zooms, Shift+Scroll pans horizontally
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Scroll: Zoom In / Out
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoomScale((s) => Math.min(4, Math.max(0.4, Number((s + delta).toFixed(2)))));
      } else if (e.shiftKey) {
        // Shift + Scroll: Horizontal Pan inside diagram
        setPanOffset((prev) => ({ x: prev.x - e.deltaY, y: prev.y }));
      } else {
        // Normal Scroll: Vertical Pan top-to-bottom inside diagram div
        setPanOffset((prev) => ({ x: prev.x, y: prev.y - e.deltaY }));
      }
    };

    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelNative);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div className="space-y-4">
      {/* Selected Part Callout Pill */}
      {selectedPart ? (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs flex items-center justify-between">
          <div>
            <span className="font-mono font-bold text-primary">Sheet {selectedPart.sheetId} · {selectedPart.part.part.item}</span>:{" "}
            <strong>Length: {selectedPart.part.w.toLocaleString()} mm</strong> × <strong>Breadth: {selectedPart.part.h.toLocaleString()} mm</strong>
            <span className="text-muted-foreground ml-2">
              (Position: X={selectedPart.part.x}mm, Y={selectedPart.part.y}mm | {selectedPart.part.rotated ? "Rotated 90°" : "Standard"})
            </span>
          </div>
          <button
            onClick={() => setSelectedPartKey(null)}
            className="text-muted-foreground hover:text-foreground font-bold text-xs"
          >
            ✕ Clear
          </button>
        </div>
      ) : null}

      {/* SINGLE DIV CANVAS FOR ALL SHEETS OF THIS THICKNESS */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "relative rounded-xl border border-slate-400 bg-slate-200 p-6 overflow-hidden shadow-inner select-none transition-cursor",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{ touchAction: "none" }}
      >
        {/* Top Floating Info Badges */}
        <div className="absolute top-3 left-3 z-20 text-[11px] font-mono font-bold text-slate-800 bg-white/95 border border-slate-400 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2">
          <span className="bg-primary text-white font-extrabold px-2 py-0.5 rounded text-[10px]">
            THK {thickness}mm
          </span>
          <span>
            {sheets.length} {sheets.length === 1 ? "SHEET" : "SHEETS STACKED"} ({sheets.map((s) => s.id).join(", ")})
          </span>
          <span className="text-slate-400">|</span>
          <span>Kerf: {result.config.kerf}mm · Trim: {result.config.trim}mm</span>
        </div>

        {/* Floating Controls */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-slate-300 p-1.5 rounded-xl shadow-md">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleZoomIn}
            className="size-7 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            title="Zoom In (+)"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleZoomOut}
            className="size-7 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            title="Zoom Out (-)"
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-[11px] font-mono font-bold text-slate-700 px-1">
            {Math.round(zoomScale * 100)}%
          </span>
          <div className="h-4 w-px bg-slate-300 mx-0.5" />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleResetZoomPan}
            className="size-7 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            title="Reset View / Fit to Screen"
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>

        {/* Pan & Zoom Instruction */}
        <div className="absolute bottom-3 left-3 z-20 text-[10px] font-mono text-slate-600 bg-white/90 border border-slate-300 px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
          <Move className="size-3 text-slate-500" />
          <span>Scroll wheel / Drag to Navigate inside diagram | <strong>Ctrl + Scroll</strong> to Zoom</span>
        </div>

        {/* SINGLE UNIFIED SVG CANVAS CONTAINING ALL SHEETS OF THIS THICKNESS */}
        <svg
          viewBox={`-60 -60 ${maxW + 150} ${totalH + 60}`}
          className="w-full h-auto rounded overflow-visible transition-transform duration-75"
        >
          <defs>
            <pattern id={`light-grid-thk-${thickness}`} width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d9aba0" strokeWidth="1.5" strokeOpacity="0.35" />
            </pattern>
            <pattern id={`scrap-hatch-thk-${thickness}`} width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="20" stroke="#b86f5e" strokeWidth="2" strokeOpacity="0.25" />
            </pattern>
          </defs>

          {/* Transform Group for Zoom & Pan across ALL sheets of this thickness */}
          <g
            transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomScale})`}
            style={{ transformOrigin: `${maxW / 2}px 0px` }}
          >
            {sheets.map((sheet, sIdx) => {
              const offsetY = sheets.slice(0, sIdx).reduce((sum, s) => sum + s.sheetWidth + spacingY, 0);
              const remnantOffcuts = computeRemnantOffcuts(sheet);

              return (
                <g key={sheet.id} transform={`translate(0, ${offsetY})`}>
                  {/* Sheet Header Banner inside Canvas */}
                  <rect
                    x={-10}
                    y={-45}
                    width={sheet.sheetLength + 20}
                    height={34}
                    fill="#0f172a"
                    rx={6}
                  />
                  <text
                    x={12}
                    y={-23}
                    fill="#ffffff"
                    fontSize={16}
                    fontWeight="800"
                    fontFamily="sans-serif"
                  >
                    SHEET {sheet.id} OF {sheets.length} · {sheet.material} · THICKNESS: {sheet.thickness} mm (TOTAL REQ: {sheets.length} {sheets.length === 1 ? "SHEET" : "SHEETS"}) · STOCK SIZE: {sheet.sheetLength.toLocaleString()} × {sheet.sheetWidth.toLocaleString()} mm ({sheet.utilization.toFixed(1)}% yield)
                  </text>

                  {/* Main Stock Plate Fill (10x Lighter Soft Warm Steel Redox Brown) & Border */}
                  <rect
                    x={0}
                    y={0}
                    width={sheet.sheetLength}
                    height={sheet.sheetWidth}
                    fill="#f5e8e3"
                    stroke="#a65342"
                    strokeWidth={6}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={sheet.sheetLength}
                    height={sheet.sheetWidth}
                    fill={`url(#light-grid-thk-${thickness})`}
                  />

                  {/* Edge Trim Allowance Line */}
                  <rect
                    x={result.config.trim}
                    y={result.config.trim}
                    width={sheet.sheetLength - result.config.trim * 2}
                    height={sheet.sheetWidth - result.config.trim * 2}
                    fill="none"
                    stroke="#b86f5e"
                    strokeWidth={2}
                    strokeDasharray="8 8"
                  />

                  {/* 1. SCRAP / REMNANT OFFCUT ZONES IN CONTINUOUS BROWN STEEL PLATE */}
                  {remnantOffcuts.map((o) => {
                    const edgeFontSize = Math.max(12, Math.min(o.w / 12, o.h / 12, 28));
                    const showHorizEdge = o.w > 60;
                    const showVertEdge = o.h > 40;

                    return (
                      <g key={o.id}>
                        <rect
                          x={o.x}
                          y={o.y}
                          width={o.w}
                          height={o.h}
                          fill="rgba(166, 83, 66, 0.06)"
                          stroke="#a65342"
                          strokeWidth={2}
                          strokeDasharray="6 6"
                        />
                        <rect
                          x={o.x}
                          y={o.y}
                          width={o.w}
                          height={o.h}
                          fill={`url(#scrap-hatch-thk-${thickness})`}
                        />

                        {showHorizEdge ? (
                          <text
                            x={o.x + o.w / 2}
                            y={o.y + Math.min(22, o.h / 3)}
                            textAnchor="middle"
                            fill="#7c2d1e"
                            fontSize={edgeFontSize}
                            fontWeight="700"
                            fontFamily="sans-serif"
                          >
                            {o.w.toLocaleString()}
                          </text>
                        ) : null}

                        {showVertEdge ? (
                          <text
                            x={o.x + Math.min(20, o.w / 3)}
                            y={o.y + o.h / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#7c2d1e"
                            fontSize={edgeFontSize}
                            fontWeight="700"
                            fontFamily="sans-serif"
                            transform={`rotate(-90, ${o.x + Math.min(20, o.w / 3)}, ${o.y + o.h / 2})`}
                          >
                            {o.h.toLocaleString()}
                          </text>
                        ) : null}

                        {o.w > 120 && o.h > 80 ? (
                          <text
                            x={o.x + o.w / 2}
                            y={o.y + o.h / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#7c2d1e"
                            fontSize={Math.max(11, Math.min(o.w / 16, o.h / 10, 22))}
                            fontWeight="bold"
                            fontFamily="sans-serif"
                          >
                            OFFCUT / SCRAP ({o.w.toLocaleString()} × {o.h.toLocaleString()} mm)
                          </text>
                        ) : null}
                      </g>
                    );
                  })}

                  {/* 2. NESTED CUT PARTS WITH CAD EDGE DIMENSIONS */}
                  {sheet.placed.map((p) => {
                    const color = itemColors.get(p.part.item) || "#93c5fd";
                    const isSelected = selectedPartKey === p.key;

                    const itemFontSize = Math.max(13, Math.min(p.w / 8, p.h / 4, 38));
                    const edgeFontSize = Math.max(11, Math.min(p.w / 10, p.h / 6, 26));

                    const showHoriz = p.w > 50;
                    const showVert = p.h > 35;

                    return (
                      <g
                        key={p.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPartKey(isSelected ? null : p.key);
                        }}
                        className="cursor-pointer transition-opacity hover:opacity-95"
                      >
                        <rect
                          x={p.x}
                          y={p.y}
                          width={p.w}
                          height={p.h}
                          fill={color}
                          fillOpacity={isSelected ? 0.95 : 0.85}
                          stroke={isSelected ? "#0f172a" : "#1e293b"}
                          strokeWidth={isSelected ? 6 : 3}
                          rx={2}
                        />

                        {showHoriz ? (
                          <text
                            x={p.x + p.w / 2}
                            y={p.y + Math.min(20, p.h / 3.5)}
                            textAnchor="middle"
                            fill="#0f172a"
                            fontSize={edgeFontSize}
                            fontWeight="800"
                            fontFamily="sans-serif"
                            stroke="#ffffff"
                            strokeWidth={1}
                            paintOrder="stroke fill"
                          >
                            {p.w.toLocaleString()}
                          </text>
                        ) : null}

                        {showVert ? (
                          <text
                            x={p.x + Math.min(20, p.w / 3.5)}
                            y={p.y + p.h / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#0f172a"
                            fontSize={edgeFontSize}
                            fontWeight="800"
                            fontFamily="sans-serif"
                            stroke="#ffffff"
                            strokeWidth={1}
                            paintOrder="stroke fill"
                            transform={`rotate(-90, ${p.x + Math.min(20, p.w / 3.5)}, ${p.y + p.h / 2})`}
                          >
                            {p.h.toLocaleString()}
                          </text>
                        ) : null}

                        <text
                          x={p.x + p.w / 2}
                          y={p.y + p.h / 2 + (showHoriz ? 8 : 0)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#0f172a"
                          fontSize={itemFontSize}
                          fontWeight="900"
                          fontFamily="sans-serif"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          paintOrder="stroke fill"
                        >
                          {p.part.item}
                        </text>
                      </g>
                    );
                  })}

                  {/* 3. OUTER BOUNDS FOR THIS SHEET */}
                  <line
                    x1={0}
                    y1={sheet.sheetWidth + 25}
                    x2={sheet.sheetLength}
                    y2={sheet.sheetWidth + 25}
                    stroke="#dc2626"
                    strokeWidth={2}
                  />
                  <line x1={0} y1={sheet.sheetWidth + 15} x2={0} y2={sheet.sheetWidth + 35} stroke="#dc2626" strokeWidth={2} />
                  <line x1={sheet.sheetLength} y1={sheet.sheetWidth + 15} x2={sheet.sheetLength} y2={sheet.sheetWidth + 35} stroke="#dc2626" strokeWidth={2} />
                  <text
                    x={sheet.sheetLength / 2}
                    y={sheet.sheetWidth + 45}
                    textAnchor="middle"
                    fill="#dc2626"
                    fontSize={20}
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    COMPLETE SHEET LENGTH: {sheet.sheetLength.toLocaleString()} mm
                  </text>

                  <line
                    x1={sheet.sheetLength + 25}
                    y1={0}
                    x2={sheet.sheetLength + 25}
                    y2={sheet.sheetWidth}
                    stroke="#dc2626"
                    strokeWidth={2}
                  />
                  <line x1={sheet.sheetLength + 15} y1={0} x2={sheet.sheetLength + 35} y2={0} stroke="#dc2626" strokeWidth={2} />
                  <line x1={sheet.sheetLength + 15} y1={sheet.sheetWidth} x2={sheet.sheetLength + 35} y2={sheet.sheetWidth} stroke="#dc2626" strokeWidth={2} />
                  <text
                    x={sheet.sheetLength + 48}
                    y={sheet.sheetWidth / 2}
                    textAnchor="middle"
                    fill="#dc2626"
                    fontSize={20}
                    fontWeight="bold"
                    fontFamily="sans-serif"
                    transform={`rotate(90, ${sheet.sheetLength + 48}, ${sheet.sheetWidth / 2})`}
                  >
                    COMPLETE SHEET BREADTH: {sheet.sheetWidth.toLocaleString()} mm
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

export function PlateCutDiagramSection({ result }: { result: OptimizationResult | null }) {
  const [activeThicknessFilter, setActiveThicknessFilter] = useState<number | "all">("all");

  if (!result || !result.sheets.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center bg-card/60">
        <p className="text-muted-foreground text-sm">No optimization result generated yet.</p>
      </div>
    );
  }

  // Group sheets by thickness ascending
  const sheetsByThickness = useMemo(() => {
    const map = new Map<number, NestedSheet[]>();
    for (const s of result.sheets) {
      if (!map.has(s.thickness)) {
        map.set(s.thickness, []);
      }
      map.get(s.thickness)!.push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([thickness, sheets]) => ({ thickness, sheets }));
  }, [result.sheets]);

  const itemColors = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const sheet of result.sheets) {
      for (const p of sheet.placed) {
        if (!map.has(p.part.item)) {
          map.set(p.part.item, LIGHT_COLOR_PALETTE[idx % LIGHT_COLOR_PALETTE.length]);
          idx++;
        }
      }
    }
    return map;
  }, [result.sheets]);

  return (
    <div className="mt-6 space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary font-bold text-xs">
                CAD
              </span>
              <h3 className="font-bold text-lg text-foreground">
                Plate Cutting Diagram & Blueprint
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              All stock sheets of the same thickness rendered in a single interactive canvas view.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <span className="rounded-lg bg-muted px-3 py-1.5 border">
              Total Sheets: <strong className="text-foreground font-semibold">{result.sheets.length}</strong>
            </span>
            <span className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 border border-emerald-500/20">
              Avg Utilization: <strong className="font-bold">{result.utilization.toFixed(1)}%</strong>
            </span>
          </div>
        </div>

        {/* Thickness Filter Tabs */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
            Plate Thickness:
          </span>

          <button
            onClick={() => setActiveThicknessFilter("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
              activeThicknessFilter === "all"
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All Thicknesses</span>
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] tabular-nums font-mono",
              activeThicknessFilter === "all" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
            )}>
              {result.sheets.length} Sheets
            </span>
          </button>

          {sheetsByThickness.map(({ thickness, sheets }) => (
            <button
              key={thickness}
              onClick={() => setActiveThicknessFilter(thickness)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
                activeThicknessFilter === thickness
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{thickness}mm Plates</span>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] tabular-nums font-mono",
                activeThicknessFilter === thickness ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {sheets.length} {sheets.length === 1 ? "sheet" : "sheets"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* RENDER ALL SHEETS OF THE SAME THICKNESS INSIDE A SINGLE CANVAS DIV */}
      <div className="space-y-8">
        {sheetsByThickness
          .filter(({ thickness }) => activeThicknessFilter === "all" || activeThicknessFilter === thickness)
          .map(({ thickness, sheets }) => (
            <div key={thickness} className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
              {/* Thickness Section Header Banner */}
              <div className="flex items-center justify-between border-b pb-3 bg-muted/40 p-3.5 rounded-xl border">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-lg bg-primary text-primary-foreground font-mono font-bold text-xs px-2.5 py-1">
                    THICKNESS: {thickness} mm
                  </span>
                  <span className="rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs px-2.5 py-1 shadow-xs">
                    QTY REQUIRED: {sheets.length} {sheets.length === 1 ? "SHEET" : "SHEETS"}
                  </span>
                  <h4 className="font-bold text-sm text-foreground">
                    ({sheets[0]?.sheetLength.toLocaleString()} × {sheets[0]?.sheetWidth.toLocaleString()} mm Stock Plate)
                  </h4>
                </div>
                <span className="text-xs font-bold text-muted-foreground font-mono">
                  Sheet IDs: {sheets.map((s) => s.id).join(", ")}
                </span>
              </div>

              {/* Grid: Left Column = Single Div Canvas for All Sheets of this Thickness, Right Column = Parts Table */}
              <div className="grid gap-6 xl:grid-cols-12">
                {/* SINGLE DIV CANVAS CONTAINER FOR ALL SHEETS OF THIS THICKNESS */}
                <div className="xl:col-span-7">
                  <ThicknessGroupCanvas
                    thickness={thickness}
                    sheets={sheets}
                    result={result}
                    itemColors={itemColors}
                  />
                </div>

                {/* Parts & Machine Parameters Table (Right 5 Columns) */}
                <div className="xl:col-span-5 space-y-4">
                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-2 mb-2">
                      <FileCheck2 className="size-4 text-primary" />
                      <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                        Parts Overview ({thickness}mm Grade)
                      </h4>
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground text-[11px]">
                            <th className="px-2 py-1.5 text-left font-semibold">Sheet</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Mark</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Length × Breadth</th>
                            <th className="px-2 py-1.5 text-center font-semibold">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheets.flatMap((s) => {
                            const summary = new Map<string, { part: PlacedPart["part"]; qtyOnSheet: number; w: number; h: number }>();
                            for (const p of s.placed) {
                              const existing = summary.get(p.part.item);
                              if (existing) existing.qtyOnSheet += 1;
                              else summary.set(p.part.item, { part: p.part, qtyOnSheet: 1, w: p.w, h: p.h });
                            }
                            return [...summary.values()].map((item) => ({ sheetId: s.id, ...item }));
                          }).map((s, idx) => (
                            <tr key={`${s.sheetId}-${s.part.item}-${idx}`} className="border-b hover:bg-muted/30">
                              <td className="px-2 py-1.5 font-mono text-muted-foreground font-bold">{s.sheetId}</td>
                              <td className="px-2 py-1.5 font-mono font-bold text-primary">{s.part.item}</td>
                              <td className="px-2 py-1.5 font-semibold text-foreground">
                                {s.w.toLocaleString()} × {s.h.toLocaleString()} mm
                              </td>
                              <td className="px-2 py-1.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                {s.qtyOnSheet} pcs
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2 text-xs">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Scissors className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                        CNC Cutting Rules
                      </h5>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg border p-2 bg-muted/20">
                        <p className="text-[9px] text-muted-foreground font-medium uppercase">Kerf Offset</p>
                        <p className="font-bold text-primary mt-0.5">{result.config.kerf}.0 mm</p>
                      </div>
                      <div className="rounded-lg border p-2 bg-muted/20">
                        <p className="text-[9px] text-muted-foreground font-medium uppercase">Clamp Margin</p>
                        <p className="font-bold text-foreground mt-0.5">{result.config.trim}.0 mm</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
