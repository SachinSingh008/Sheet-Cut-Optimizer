import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NestedSheet, PlacedPart } from "@/lib/nesting";

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

  const legend = [...colorFor.entries()].slice(0, 8);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <span className="mr-auto px-2 text-sm font-medium">
          Sheet {sheet.id} · {sheet.material} · PL {sheet.thickness} THK
        </span>
        <span className="rounded-full bg-success/12 px-3 py-1 text-xs font-semibold text-success">
          {sheet.utilization.toFixed(1)}% used
        </span>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))} aria-label="Zoom in">
          <ZoomIn />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} aria-label="Zoom out">
          <ZoomOut />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setRotateView((r) => !r)} aria-label="Rotate view">
          <RotateCw />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setRotateView(false);
          }}
          aria-label="Fit to view"
        >
          <Maximize2 />
        </Button>
      </div>

      <div
        className="relative cursor-grab overflow-hidden bg-muted/40 p-6 active:cursor-grabbing"
        onPointerDown={(e) => {
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
        <div className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Move className="size-3" /> drag to pan · buttons to zoom
        </div>

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotateView ? 90 : 0}deg)`,
            transformOrigin: "center",
            transition: dragRef.current ? "none" : "transform 0.2s ease-out",
          }}
        >
          <svg
            viewBox={`0 0 ${sheet.sheetLength} ${sheet.sheetWidth}`}
            className="h-auto w-full"
            style={{ aspectRatio: `${sheet.sheetLength} / ${sheet.sheetWidth}` }}
          >
            <rect
              x={0}
              y={0}
              width={sheet.sheetLength}
              height={sheet.sheetWidth}
              fill="var(--muted)"
              stroke="var(--border)"
              strokeWidth={6}
            />
            {sheet.placed.map((p, i) => {
              const isSel = selected === p.key;
              return (
                <motion.rect
                  key={p.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.006, 0.6), duration: 0.25 }}
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  rx={4}
                  fill={colorFor.get(p.part.item)}
                  fillOpacity={isSel ? 0.95 : 0.65}
                  stroke={isSel ? "var(--foreground)" : "var(--card)"}
                  strokeWidth={isSel ? 10 : 4}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected(isSel ? null : p.key)}
                />
              );
            })}
          </svg>
        </div>

        {hover ? (
          <div className="pointer-events-none absolute right-4 bottom-4 z-10 rounded-xl border bg-popover/95 p-3 text-xs shadow-lift backdrop-blur">
            <p className="text-sm font-semibold">{hover.part.item}</p>
            <p className="mt-0.5 text-muted-foreground">{hover.part.description}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Dimensions</dt>
              <dd className="tabular-nums">
                {hover.w} × {hover.h} mm{hover.rotated ? " (rot.)" : ""}
              </dd>
              <dt className="text-muted-foreground">Quantity</dt>
              <dd className="tabular-nums">{hover.part.qty}</dd>
              <dt className="text-muted-foreground">Area</dt>
              <dd className="tabular-nums">{((hover.w * hover.h) / 1e6).toFixed(3)} m²</dd>
              <dt className="text-muted-foreground">Material</dt>
              <dd>{hover.part.material}</dd>
            </dl>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t p-4 text-xs">
        {legend.map(([item, color]) => (
          <span key={item} className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: color }} />
            {item}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="size-3 rounded-sm bg-muted ring-1 ring-border" /> Waste / skeleton
        </span>
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
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer rounded-xl border-2 bg-card p-2 transition-all",
        active ? "border-primary shadow-soft" : "border-border hover:border-primary/50",
      )}
    >
      <svg
        viewBox={`0 0 ${sheet.sheetLength} ${sheet.sheetWidth}`}
        className="h-14 w-28"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width={sheet.sheetLength} height={sheet.sheetWidth} fill="var(--muted)" />
        {sheet.placed.map((p) => (
          <rect
            key={p.key}
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            fill="var(--primary)"
            fillOpacity={0.6}
          />
        ))}
      </svg>
      <span className="mt-1 block text-[11px] font-medium">{sheet.id}</span>
    </button>
  );
}
