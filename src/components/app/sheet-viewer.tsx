import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Move, Info, Layers, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type NestedSheet, type PlacedPart, computeSheetUtilizedDimensions } from "@/lib/nesting";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function SheetViewer({ sheet }: { sheet: NestedSheet }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotateView, setRotateView] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<PlacedPart | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const utilized = useMemo(() => computeSheetUtilizedDimensions(sheet, 5), [sheet]);

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const p of sheet.placed) {
      if (!map.has(p.part.item)) {
        map.set(p.part.item, PALETTE[i % PALETTE.length] as string);
        i++;
      }
    }
    return map;
  }, [sheet]);

  const legend = [...colorFor.entries()].slice(0, 10);
  const activePart = hover || (selected ? sheet.placed.find((p) => p.key === selected) : null);

  const partCounts = useMemo(() => {
    const counts = new Map<string, { count: number; area: number; w: number; h: number }>();
    for (const p of sheet.placed) {
      const existing = counts.get(p.part.item) || { count: 0, area: 0, w: p.w, h: p.h };
      counts.set(p.part.item, {
        count: existing.count + 1,
        area: existing.area + p.w * p.h,
        w: p.w,
        h: p.h,
      });
    }
    return [...counts.entries()];
  }, [sheet]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft flex flex-col">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b bg-muted/40 px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground font-mono text-xs font-bold">
            PL
          </span>
          <span className="text-sm font-bold text-foreground">
            Sheet {sheet.id} · {sheet.material} · PL {sheet.thickness}mm THK
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-3 py-1 text-xs font-bold font-mono">
            Req Cut: {utilized.requiredCutSizeStr}
          </span>
          <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1 text-xs font-bold font-mono">
            Remnant: {utilized.primaryRemnant.formatted}
          </span>
          <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-extrabold font-mono">
            {sheet.utilization.toFixed(1)}% Used
          </span>
          <span className="rounded-full bg-muted text-muted-foreground border px-3 py-1 text-xs font-mono">
            {(100 - sheet.utilization).toFixed(1)}% Waste
          </span>
        </div>
      </div>

      {/* Middle Container: Main Cutout Canvas + RIGHT SIDEBAR */}
      <div className="flex flex-col xl:flex-row min-h-[500px]">
        {/* CENTER MAIN CUTOUT CANVAS */}
        <div
          className="relative flex-1 cursor-grab overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 active:cursor-grabbing min-h-[440px] flex items-center justify-center"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
          }}
          onPointerUp={() => (dragRef.current = null)}
          onPointerLeave={() => {
            dragRef.current = null;
            setHover(null);
          }}
        >
          <div className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-black/70 border border-slate-300 dark:border-white/20 px-3 py-1 text-[11px] font-mono text-slate-800 dark:text-slate-300 backdrop-blur-sm shadow-xs">
            <Move className="size-3 text-sky-600 dark:text-sky-400" /> Click part to inspect · Drag to pan canvas
          </div>

          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotateView ? 90 : 0}deg)`,
              transformOrigin: "center",
              transition: dragRef.current ? "none" : "transform 0.2s ease-out",
            }}
            className="w-full"
          >
            <svg
              viewBox={`0 0 ${sheet.sheetLength} ${sheet.sheetWidth}`}
              className="h-auto w-full max-h-[520px]"
              style={{ aspectRatio: `${sheet.sheetLength} / ${sheet.sheetWidth}` }}
            >
              <defs>
                <pattern id="viewer-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#64748b" strokeWidth="1" strokeOpacity="0.25" />
                </pattern>
              </defs>

              {/* Plate Background */}
              <rect
                x={0}
                y={0}
                width={sheet.sheetLength}
                height={sheet.sheetWidth}
                className="fill-slate-200 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600"
                strokeWidth={6}
              />
              <rect
                x={0}
                y={0}
                width={sheet.sheetLength}
                height={sheet.sheetWidth}
                fill="url(#viewer-grid)"
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
                    stroke="#38bdf8"
                    strokeWidth={4}
                    strokeDasharray="12 8"
                  />
                  {sheet.sheetLength - utilized.usedLength > 15 ? (
                    <rect
                      x={utilized.usedLength}
                      y={0}
                      width={sheet.sheetLength - utilized.usedLength}
                      height={sheet.sheetWidth}
                      fill="rgba(245, 158, 11, 0.08)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="6 6"
                    />
                  ) : null}
                </g>
              ) : null}

              {sheet.placed.map((p, i) => {
                const isSel = selected === p.key;
                const isHov = hover?.key === p.key;

                return (
                  <g key={p.key}>
                    <motion.rect
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.005, 0.5), duration: 0.2 }}
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={p.h}
                      rx={3}
                      fill={colorFor.get(p.part.item)}
                      fillOpacity={isSel || isHov ? 0.95 : 0.75}
                      stroke={isSel ? "#ffffff" : isHov ? "#38bdf8" : "#0f172a"}
                      strokeWidth={isSel ? 8 : isHov ? 5 : 2}
                      className="cursor-pointer"
                      onMouseEnter={() => setHover(p)}
                      onMouseLeave={() => setHover(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(isSel ? null : p.key);
                      }}
                    />
                    {p.w >= 30 && p.h >= 16 ? (
                      <g className="pointer-events-none">
                        <text
                          x={p.x + p.w / 2}
                          y={p.y + p.h / 2 - (p.h >= 45 && p.w >= 60 ? 6 : 0)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          fontSize={Math.max(9, Math.min(p.w / (Math.max(p.part.item.length, 3) * 0.65), p.h / 2.2, 26))}
                          fontWeight="900"
                          fontFamily="sans-serif"
                          stroke="#000000"
                          strokeWidth={1.5}
                          paintOrder="stroke fill"
                        >
                          {p.part.item}
                        </text>
                        {p.h >= 45 && p.w >= 60 ? (
                          <text
                            x={p.x + p.w / 2}
                            y={p.y + p.h / 2 + 8}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#cbd5e1"
                            fontSize={Math.max(8, Math.min(p.w / 10, p.h / 4.5, 14))}
                            fontWeight="700"
                            fontFamily="sans-serif"
                            stroke="#000000"
                            strokeWidth={1}
                            paintOrder="stroke fill"
                          >
                            {p.w}×{p.h}
                          </text>
                        ) : null}
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* ATTACHED RIGHT SIDEBAR */}
        <aside className="w-full xl:w-80 border-t xl:border-t-0 xl:border-l bg-card p-4 space-y-4 flex flex-col shrink-0 max-h-[580px] overflow-y-auto">
          {/* Section 1: Sheet Specs */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center gap-2 border-b pb-2">
              <Layers className="size-4 text-primary" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                Plate Specifications
              </h4>
            </div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs font-mono">
              <dt className="text-muted-foreground font-sans">Stock Size</dt>
              <dd className="font-bold text-right text-foreground">{sheet.sheetLength} × {sheet.sheetWidth} mm</dd>
              <dt className="text-sky-600 dark:text-sky-400 font-sans font-semibold">Required Cut</dt>
              <dd className="font-bold text-right text-sky-600 dark:text-sky-400 font-mono">{utilized.requiredCutSizeStr}</dd>
              <dt className="text-amber-600 dark:text-amber-400 font-sans font-semibold">Remnant Offcut</dt>
              <dd className="font-bold text-right text-amber-600 dark:text-amber-400 font-mono">{utilized.primaryRemnant.formatted}</dd>
              <dt className="text-muted-foreground font-sans">Material</dt>
              <dd className="font-bold text-right text-foreground">{sheet.material}</dd>
              <dt className="text-muted-foreground font-sans">Thickness</dt>
              <dd className="font-bold text-right text-primary">{sheet.thickness} mm</dd>
              <dt className="text-muted-foreground font-sans">Parts Placed</dt>
              <dd className="font-bold text-right text-foreground">{sheet.placed.length} pcs</dd>
            </dl>
          </div>

          {/* Section 2: Active / Selected Part Inspector */}
          <div className="rounded-xl border bg-card p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Info className="size-4 text-sky-500" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Part Inspector
                </h4>
              </div>
              {activePart ? (
                <span className="text-[10px] bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 rounded">
                  Active
                </span>
              ) : null}
            </div>

            {activePart ? (
              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-bold text-sm text-foreground">{activePart.part.item}</p>
                  <p className="text-[11px] text-muted-foreground">{activePart.part.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                  <div className="rounded border bg-muted/40 p-2">
                    <p className="text-[9px] text-muted-foreground font-sans uppercase">Dimensions</p>
                    <p className="font-bold text-foreground">{activePart.w} × {activePart.h} mm</p>
                  </div>
                  <div className="rounded border bg-muted/40 p-2">
                    <p className="text-[9px] text-muted-foreground font-sans uppercase">Position (X, Y)</p>
                    <p className="font-bold text-foreground">({activePart.x}, {activePart.y})</p>
                  </div>
                  <div className="rounded border bg-muted/40 p-2">
                    <p className="text-[9px] text-muted-foreground font-sans uppercase">Area</p>
                    <p className="font-bold text-foreground">{((activePart.w * activePart.h) / 1e6).toFixed(3)} m²</p>
                  </div>
                  <div className="rounded border bg-muted/40 p-2">
                    <p className="text-[9px] text-muted-foreground font-sans uppercase">Rotation</p>
                    <p className="font-bold text-foreground">{activePart.rotated ? "90° Rotated" : "Standard"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2 text-center">
                Hover over or click any part on the diagram to inspect exact dimensions and placement coordinates.
              </p>
            )}
          </div>

          {/* Section 3: Nested Parts Breakdown List */}
          <div className="rounded-xl border bg-card p-3.5 space-y-2 flex-1 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                Parts Breakdown ({partCounts.length} types)
              </h4>
              <span className="text-[10px] text-muted-foreground font-mono">{sheet.placed.length} total parts</span>
            </div>
            <ul className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 text-xs">
              {partCounts.map(([item, meta]) => (
                <li key={item} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-xs shrink-0" style={{ background: colorFor.get(item) }} />
                    <span className="font-semibold text-foreground">{item}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">{meta.w}×{meta.h}</span>
                    <span className="font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded">×{meta.count}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* ATTACHED BOTTOM SIDEBAR */}
      <div className="border-t bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* View Zoom & Navigation Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))} className="h-8 text-xs">
            <ZoomIn className="mr-1 size-3.5" /> Zoom In
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} className="h-8 text-xs">
            <ZoomOut className="mr-1 size-3.5" /> Zoom Out
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRotateView((r) => !r)} className="h-8 text-xs">
            <RotateCw className="mr-1 size-3.5" /> Rotate 90°
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setRotateView(false);
            }}
            className="h-8 text-xs"
          >
            <Maximize2 className="mr-1 size-3.5" /> Reset View
          </Button>
          <span className="font-mono text-muted-foreground text-[11px] ml-1">
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Part Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {legend.map(([item, color]) => (
            <span key={item} className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-2.5 rounded-xs" style={{ background: color }} />
              <span className="text-foreground">{item}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-xs bg-slate-700" /> Skeleton Waste
          </span>
        </div>
      </div>
    </div>
  );
}

export function SheetThumbnail({
  sheet,
  active,
  onClick,
}: {
  sheet: NestedSheet;
  active: boolean;
  onClick: () => void;
}) {
  const utilized = useMemo(() => computeSheetUtilizedDimensions(sheet, 5), [sheet]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left cursor-pointer rounded-xl border-2 bg-card p-3 transition-all flex items-center gap-3",
        active
          ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary/30"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <div className="relative shrink-0 rounded border bg-slate-900 p-1">
        <svg
          viewBox={`0 0 ${sheet.sheetLength} ${sheet.sheetWidth}`}
          className="h-12 w-24"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width={sheet.sheetLength} height={sheet.sheetWidth} fill="#1e293b" />
          {sheet.placed.map((p) => (
            <rect
              key={p.key}
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              fill="var(--primary)"
              fillOpacity={0.7}
            />
          ))}
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-sm text-foreground">Sheet {sheet.id}</span>
          <span className={cn(
            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
            active ? "bg-primary text-primary-foreground border-primary" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          )}>
            {sheet.utilization.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {sheet.material} · {sheet.thickness}mm · {sheet.placed.length} parts
        </p>
        <p className="text-[11px] font-mono font-medium text-sky-600 dark:text-sky-400 truncate mt-0.5">
          Req: {utilized.requiredCutSizeStr}
        </p>
      </div>
    </button>
  );
}

