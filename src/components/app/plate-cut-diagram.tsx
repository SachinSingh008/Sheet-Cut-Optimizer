import { useState, useMemo, useRef, useEffect } from "react";
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Type,
  Minus,
  Plus,
  Move,
  Sparkles,
} from "lucide-react";
import { PlateTypeInventorySection } from "@/components/app/plate-type-inventory";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type NestedSheet, type OptimizationResult, computeSheetUtilizedDimensions } from "@/lib/nesting";
import { useAppState } from "@/lib/store";
import { ThicknessLengthSummaryTable } from "@/components/app/thickness-length-summary-table";

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

function ThicknessGroupCanvas({
  categoryName,
  thickness,
  sheets,
  result,
  itemColors,
  textSizeScale,
  onTextScaleChange,
}: {
  categoryName: string;
  thickness: number;
  sheets: NestedSheet[];
  result: OptimizationResult;
  itemColors: Map<string, string>;
  textSizeScale: number;
  onTextScaleChange: (newScale: number) => void;
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
    setZoomScale((s) => Math.max(0.4, Number((s - 0.25).toFixed(2))));
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoomScale((s) => Math.min(4, Math.max(0.4, Number((s + delta).toFixed(2)))));
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
      {/* Selected Part Callout Banner */}
      {selectedPart ? (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono font-bold text-primary">
              Sheet {selectedPart.sheetId} · {selectedPart.part.part.item}
            </span>
            : <strong>Length: {selectedPart.part.w.toLocaleString()} mm</strong> ×{" "}
            <strong>Width: {selectedPart.part.h.toLocaleString()} mm</strong>
            <span className="text-muted-foreground ml-2">
              (Material: {selectedPart.part.part.material} | Position: X={selectedPart.part.x}mm, Y=
              {selectedPart.part.y}mm | {selectedPart.part.rotated ? "Rotated 90°" : "Standard"})
            </span>
          </div>
          <button
            onClick={() => setSelectedPartKey(null)}
            className="text-muted-foreground hover:text-foreground font-bold text-xs cursor-pointer ml-3 shrink-0"
          >
            ✕ Clear
          </button>
        </div>
      ) : null}

      {/* DEDICATED SCROLLABLE CANVAS VIEWPORT WITH HORIZONTAL BOTTOM BAR AND VERTICAL SIDEBAR */}
      <div className="relative rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-md">
        {/* Top Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-4 py-2.5 rounded-t-2xl">
          {/* Left Info Badge */}
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
            <span className="bg-primary text-white font-extrabold px-2.5 py-0.5 rounded text-[11px]">
              THK {thickness}mm
            </span>
            <span>{categoryName}</span>
            <span className="text-slate-400">|</span>
            <span>
              {sheets.length} {sheets.length === 1 ? "Sheet" : "Sheets Stacked"} (
              {sheets.map((s) => s.id).join(", ")})
            </span>
          </div>

          {/* Right Viewport Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Text Size Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-300 dark:border-slate-600">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-1.5 flex items-center gap-1">
                <Type className="size-3.5" /> Text Size:
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onTextScaleChange(Math.max(0.5, Number((textSizeScale - 0.15).toFixed(2))))}
                className="size-6 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600"
                title="Decrease Text Size (-)"
              >
                <Minus className="size-3" />
              </Button>
              <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 px-1 min-w-[38px] text-center">
                {Math.round(textSizeScale * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onTextScaleChange(Math.min(3.0, Number((textSizeScale + 0.15).toFixed(2))))}
                className="size-6 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600"
                title="Increase Text Size (+)"
              >
                <Plus className="size-3" />
              </Button>
              <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-600 mx-0.5" />
              {[0.8, 1.0, 1.35, 1.75, 2.2].map((preset) => (
                <button
                  key={preset}
                  onClick={() => onTextScaleChange(preset)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer",
                    textSizeScale === preset
                      ? "bg-primary text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  )}
                >
                  {preset * 100}%
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-300 dark:border-slate-600">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomIn}
                className="size-6 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600"
                title="Zoom In (+)"
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomOut}
                className="size-6 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600"
                title="Zoom Out (-)"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 px-1 min-w-[36px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleResetZoomPan}
                className="size-6 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600"
                title="Reset View / Fit to Screen"
              >
                <Maximize2 className="size-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE VIEWPORT CONTAINER WITH NATIVE HORIZONTAL & VERTICAL SCROLLBARS */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "relative w-full max-h-[720px] overflow-x-auto overflow-y-auto p-6 select-none transition-cursor",
            "scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-600 scrollbar-track-slate-200 dark:scrollbar-track-slate-800",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ touchAction: "none" }}
        >
          {/* SVG CUTTING DIAGRAM CANVAS */}
          <svg
            viewBox={`-60 -60 ${maxW + 150} ${totalH + 60}`}
            className="w-full h-auto min-w-[850px] rounded overflow-visible transition-transform duration-75"
          >
            <defs>
              <pattern
                id={`light-grid-cat-${thickness}`}
                width="100"
                height="100"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 100 0 L 0 0 0 100"
                  fill="none"
                  stroke="#d9aba0"
                  strokeWidth="1.5"
                  strokeOpacity="0.35"
                />
              </pattern>
              <pattern
                id={`scrap-hatch-cat-${thickness}`}
                width="20"
                height="20"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="20"
                  stroke="#b86f5e"
                  strokeWidth="2"
                  strokeOpacity="0.25"
                />
              </pattern>
            </defs>

            {/* Transform Group for Zoom & Drag-Pan */}
            <g
              transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomScale})`}
              style={{ transformOrigin: `${maxW / 2}px 0px` }}
            >
              {sheets.map((sheet, sIdx) => {
                const offsetY = sheets
                  .slice(0, sIdx)
                  .reduce((sum, s) => sum + s.sheetWidth + spacingY, 0);
                const remnantOffcuts = computeRemnantOffcuts(sheet);
                const kerf = result.config.kerf ?? 5;
                const utilized = computeSheetUtilizedDimensions(sheet, kerf);

                return (
                  <g key={sheet.id} transform={`translate(0, ${offsetY})`}>
                    {/* Sheet Header Banner inside SVG */}
                    <rect
                      x={-10}
                      y={-48}
                      width={sheet.sheetLength + 20}
                      height={38}
                      fill="#0f172a"
                      rx={6}
                    />
                    <text
                      x={12}
                      y={-24}
                      fill="#ffffff"
                      fontSize={15 * textSizeScale}
                      fontWeight="800"
                      fontFamily="sans-serif"
                    >
                      SHEET {sheet.id} OF {sheets.length} · {sheet.material} · THICKNESS:{" "}
                      {sheet.thickness} mm · STOCK: {sheet.sheetLength.toLocaleString()} ×{" "}
                      {sheet.sheetWidth.toLocaleString()} mm ({sheet.utilization.toFixed(1)}% yield)
                    </text>
                    {sheet.placed.length > 0 ? (
                      <text
                        x={sheet.sheetLength + 10}
                        y={-24}
                        textAnchor="end"
                        fill="#38bdf8"
                        fontSize={14 * textSizeScale}
                        fontWeight="800"
                        fontFamily="sans-serif"
                      >
                        REQUIRED CUT: {utilized.requiredCutSizeStr} · REMNANT: {utilized.primaryRemnant.formatted}
                      </text>
                    ) : null}

                    {/* Main Stock Plate Background */}
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
                      fill={`url(#light-grid-cat-${thickness})`}
                    />

                    {/* Edge Trim Allowance Dashed Line */}
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

                    {/* Active Utilized / Required Cut Bounding Box */}
                    {sheet.placed.length > 0 ? (
                      <g pointerEvents="none">
                        <rect
                          x={0}
                          y={0}
                          width={Math.min(utilized.usedLength, sheet.sheetLength)}
                          height={Math.min(utilized.usedWidth, sheet.sheetWidth)}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={3}
                          strokeDasharray="10 6"
                        />
                        <rect
                          x={2}
                          y={Math.max(2, Math.min(utilized.usedWidth, sheet.sheetWidth) - 24)}
                          width={Math.min(280, Math.min(utilized.usedLength, sheet.sheetLength) - 4)}
                          height={22}
                          fill="#1e3a8a"
                          fillOpacity={0.92}
                          rx={4}
                        />
                        <text
                          x={8}
                          y={Math.max(2, Math.min(utilized.usedWidth, sheet.sheetWidth) - 24) + 15}
                          fill="#93c5fd"
                          fontSize={12 * textSizeScale}
                          fontWeight="900"
                          fontFamily="sans-serif"
                        >
                          REQUIRED CUT: {utilized.requiredCutSizeStr}
                        </text>
                      </g>
                    ) : null}

                    {/* 1. SCRAP / REMNANT OFFCUT ZONES */}
                    {remnantOffcuts.map((o) => {
                      const edgeFontSize = Math.max(12, Math.min(o.w / 12, o.h / 12, 28)) * textSizeScale;

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
                            fill={`url(#scrap-hatch-cat-${thickness})`}
                          />

                          {o.w > 60 ? (
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

                          {o.h > 40 ? (
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
                              fontSize={Math.max(11, Math.min(o.w / 16, o.h / 10, 22)) * textSizeScale}
                              fontWeight="bold"
                              fontFamily="sans-serif"
                            >
                              REMAINING REMNANT ({o.w.toLocaleString()} × {o.h.toLocaleString()} mm)
                            </text>
                          ) : null}
                        </g>
                      );
                    })}

                    {/* 2. PLACED CUT PARTS WITH HIGH VISIBILITY CAD EDGE DIMENSIONS */}
                    {sheet.placed.map((p) => {
                      const color = itemColors.get(p.part.item) || "#93c5fd";
                      const isSelected = selectedPartKey === p.key;

                      const baseItemFontSize = Math.max(9, Math.min(p.w / (Math.max(p.part.item.length, 3) * 0.65), p.h / 2.5, 38));
                      const baseEdgeFontSize = Math.max(9, Math.min(p.w / 9, p.h / 5, 24));

                      const itemFontSize = baseItemFontSize * textSizeScale;
                      const edgeFontSize = baseEdgeFontSize * textSizeScale;

                      const showHoriz = p.w >= 45 && p.h >= 35;
                      const showVert = p.h >= 45 && p.w >= 35;

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

                          {/* Top Horizontal Edge Width Dimension Text */}
                          {showHoriz ? (
                            <text
                              x={p.x + p.w / 2}
                              y={p.y + Math.min(22, p.h / 3.2)}
                              textAnchor="middle"
                              fill="#0f172a"
                              fontSize={edgeFontSize}
                              fontWeight="900"
                              fontFamily="sans-serif"
                              stroke="#ffffff"
                              strokeWidth={1.5}
                              paintOrder="stroke fill"
                            >
                              {p.w.toLocaleString()}
                            </text>
                          ) : null}

                          {/* Left Vertical Edge Length Dimension Text */}
                          {showVert ? (
                            <text
                              x={p.x + Math.min(22, p.w / 3.2)}
                              y={p.y + p.h / 2}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#0f172a"
                              fontSize={edgeFontSize}
                              fontWeight="900"
                              fontFamily="sans-serif"
                              stroke="#ffffff"
                              strokeWidth={1.5}
                              paintOrder="stroke fill"
                              transform={`rotate(-90, ${p.x + Math.min(22, p.w / 3.2)}, ${p.y + p.h / 2})`}
                            >
                              {p.h.toLocaleString()}
                            </text>
                          ) : null}

                          {/* Center Item Mark & Dimension Subtext */}
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
                            strokeWidth={2}
                            paintOrder="stroke fill"
                          >
                            {p.part.item}
                          </text>

                          {/* Secondary Dimension Callout inside Part when space permits */}
                          {p.w > 120 && p.h > 70 ? (
                            <text
                              x={p.x + p.w / 2}
                              y={p.y + p.h / 2 + (showHoriz ? 8 : 0) + itemFontSize * 0.85}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#0f172a"
                              fontSize={Math.max(10, edgeFontSize * 0.8)}
                              fontWeight="700"
                              fontFamily="monospace"
                              stroke="#ffffff"
                              strokeWidth={1}
                              paintOrder="stroke fill"
                            >
                              {p.w} × {p.h} mm
                            </text>
                          ) : null}
                        </g>
                      );
                    })}

                    {/* 3. OUTER BOUNDARY DIMENSION LINES & ARROWS */}
                    <line
                      x1={0}
                      y1={sheet.sheetWidth + 25}
                      x2={sheet.sheetLength}
                      y2={sheet.sheetWidth + 25}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <line
                      x1={0}
                      y1={sheet.sheetWidth + 15}
                      x2={0}
                      y2={sheet.sheetWidth + 35}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <line
                      x1={sheet.sheetLength}
                      y1={sheet.sheetWidth + 15}
                      x2={sheet.sheetLength}
                      y2={sheet.sheetWidth + 35}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <text
                      x={sheet.sheetLength / 2}
                      y={sheet.sheetWidth + 48}
                      textAnchor="middle"
                      fill="#dc2626"
                      fontSize={22 * textSizeScale}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      STOCK LENGTH: {sheet.sheetLength.toLocaleString()} mm
                    </text>

                    <line
                      x1={sheet.sheetLength + 25}
                      y1={0}
                      x2={sheet.sheetLength + 25}
                      y2={sheet.sheetWidth}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <line
                      x1={sheet.sheetLength + 15}
                      y1={0}
                      x2={sheet.sheetLength + 35}
                      y2={0}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <line
                      x1={sheet.sheetLength + 15}
                      y1={sheet.sheetWidth}
                      x2={sheet.sheetLength + 35}
                      y2={sheet.sheetWidth}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <text
                      x={sheet.sheetLength + 50}
                      y={sheet.sheetWidth / 2}
                      textAnchor="middle"
                      fill="#dc2626"
                      fontSize={22 * textSizeScale}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      transform={`rotate(90, ${sheet.sheetLength + 50}, ${sheet.sheetWidth / 2})`}
                    >
                      STOCK BREADTH: {sheet.sheetWidth.toLocaleString()} mm
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Viewport Scroll & Navigation Hint Footer Bar */}
        <div className="flex items-center justify-between border-t border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-4 py-2 text-[11px] font-mono text-slate-600 dark:text-slate-300 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <Move className="size-3.5 text-primary" />
            <span>
              Use <strong>Horizontal Scrollbar (Bottom)</strong> & <strong>Vertical Scrollbar (Right)</strong> or Drag to view full plate length.
            </span>
          </div>
          <span>Ctrl + Wheel to Zoom in/out</span>
        </div>
      </div>
    </div>
  );
}

export function PlateCutDiagramSection({ result }: { result: OptimizationResult | null }) {
  const { isOptimizing, progress, progressMessage } = useAppState();
  const [textSizeScale, setTextSizeScale] = useState(1.0);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | "all">("all");

  if (isOptimizing) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
        <Sparkles className="size-5 mx-auto text-primary animate-spin" />
        <h4 className="text-sm font-bold text-foreground">
          AI Cutting Layouts In Progress ({progress}%)...
        </h4>
        <p className="text-xs text-muted-foreground font-mono">
          {progressMessage || "Calculating optimal cut placements..."}
        </p>
        <div className="max-w-md mx-auto h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
      </div>
    );
  }

  if (!result || !result.sheets.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center bg-card/60">
        <p className="text-muted-foreground text-sm">No optimization result generated yet.</p>
      </div>
    );
  }

  // Group sheets by plate material category, thickness & stock size
  const sheetsByGroup = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        categoryName: string;
        isChq: boolean;
        thickness: number;
        sheetLength: number;
        sheetWidth: number;
        sheets: NestedSheet[];
      }
    >();

    for (const s of result.sheets) {
      const isChq = /chq|cheq|chequered|checkered|3502/i.test(`${s.material}`);
      const categoryName = isChq
        ? `Chequered Plate ${s.thickness}mm`
        : `Normal Mild Steel Plate ${s.thickness}mm`;
      const key = `${isChq ? "chq" : "ms"}-${s.thickness}-${s.sheetLength}x${s.sheetWidth}`;

      let existing = map.get(key);
      if (!existing) {
        existing = {
          key,
          categoryName,
          isChq,
          thickness: s.thickness,
          sheetLength: s.sheetLength,
          sheetWidth: s.sheetWidth,
          sheets: [],
        };
        map.set(key, existing);
      }
      existing.sheets.push(s);
    }

    return [...map.values()].sort((a, b) => a.thickness - b.thickness || (a.isChq ? -1 : 1));
  }, [result.sheets]);

  const itemColors = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const sheet of result.sheets) {
      for (const p of sheet.placed) {
        if (!map.has(p.part.item)) {
          map.set(p.part.item, LIGHT_COLOR_PALETTE[idx % LIGHT_COLOR_PALETTE.length]!);
          idx++;
        }
      }
    }
    return map;
  }, [result.sheets]);

  return (
    <div className="mt-6 space-y-6">
      {/* Executive Plate Cut Length & Procurement Summary Table */}
      <ThicknessLengthSummaryTable
        sheets={result.sheets}
        kerf={result.config.kerf}
        title="Plate Cut Length & Procurement Summary"
        subtitle="Exact required plate cut lengths and totals grouped by plate thickness"
      />

      {/* Header & Controls Bar */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary font-bold text-xs">
                CAD
              </span>
              <h3 className="font-bold text-lg text-foreground">
                Plate Cutting Layout Diagrams
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-visibility CAD plate layouts with exact cut dimensions, item marks, scrap offcuts, and text scaling controls.
            </p>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
            Plate Category:
          </span>

          <button
            onClick={() => setActiveGroupFilter("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
              activeGroupFilter === "all"
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All Plate Categories</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] tabular-nums font-mono",
                activeGroupFilter === "all"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {result.sheets.length} Sheets
            </span>
          </button>

          {sheetsByGroup.map((g) => (
            <button
              key={g.key}
              onClick={() => setActiveGroupFilter(g.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
                activeGroupFilter === g.key
                  ? g.isChq
                    ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                    : "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>
                {g.isChq ? "🟡 CHQ" : "🔵 Normal"} {g.thickness}mm ({g.sheetLength}×{g.sheetWidth})
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] tabular-nums font-mono",
                  activeGroupFilter === g.key
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {g.sheets.length} {g.sheets.length === 1 ? "sheet" : "sheets"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* RENDER DEDICATED DIAGRAM CANVASES PER CATEGORY GROUP */}
      <div className="space-y-8">
        {sheetsByGroup
          .filter((g) => activeGroupFilter === "all" || activeGroupFilter === g.key)
          .map((g) => (
            <div key={g.key} className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
              {/* Category Group Header Banner */}
              <div className="flex items-center justify-between border-b pb-3 bg-muted/40 p-3.5 rounded-xl border">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-lg font-mono font-bold text-xs px-2.5 py-1 ${
                      g.isChq
                        ? "bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {g.isChq ? "CHEQUERED PLATE" : "STANDARD MS PLATE"}: {g.thickness} mm
                  </span>
                  <span className="rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs px-2.5 py-1 shadow-xs">
                    QTY REQUIRED: {g.sheets.length} {g.sheets.length === 1 ? "SHEET" : "SHEETS"}
                  </span>
                  <h4 className="font-bold text-sm text-foreground">
                    ({g.sheetLength.toLocaleString()} × {g.sheetWidth.toLocaleString()} mm Stock Plate)
                  </h4>
                </div>
                <span className="text-xs font-bold text-muted-foreground font-mono">
                  Sheet IDs: {g.sheets.map((s) => s.id).join(", ")}
                </span>
              </div>

              {/* Full Width High Visibility CAD Layout Canvas */}
              <ThicknessGroupCanvas
                categoryName={g.categoryName}
                thickness={g.thickness}
                sheets={g.sheets}
                result={result}
                itemColors={itemColors}
                textSizeScale={textSizeScale}
                onTextScaleChange={setTextSizeScale}
              />

              {/* Plate Types & Stock Dimensions Mapping for this Specific Plate Category */}
              <PlateTypeInventorySection
                filterCategory={g.isChq ? "chq" : "normal"}
                className="mt-6 border-muted bg-muted/10 shadow-none"
              />
            </div>
          ))}
      </div>
    </div>
  );
}
