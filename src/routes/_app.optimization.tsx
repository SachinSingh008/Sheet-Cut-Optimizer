import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  RotateCcw,
  Gauge,
  Recycle,
  Boxes,
  IndianRupee,
  TrendingUp,
  ArrowRight,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { store, useAppState } from "@/lib/store";
import { ALGORITHMS, SHEET_SIZES } from "@/lib/mock-data";
import { optimize } from "@/lib/nesting";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/optimization")({
  head: () => ({
    meta: [
      { title: "Optimization — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Configure stock sheet size, kerf, trim and nesting algorithm, then run AI plate optimization.",
      },
      { property: "og:title", content: "Optimization — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Configure stock sheet size, kerf, trim and nesting algorithm, then run AI plate optimization.",
      },
    ],
  }),
  component: OptimizationPage,
});

function OptimizationPage() {
  const { parts, config, result } = useAppState();
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      store.set({ result: optimize(parts, config) });
      setRunning(false);
      toast.success("Optimization complete", { description: "Cut layouts are ready to review." });
    }, 1400);
  };

  if (!parts.length) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 4" title="Optimization" />
        <EmptyState
          title="Load a BOM to optimize"
          description="The nesting engine needs parsed parts before it can generate cutting layouts."
          action={<Button onClick={() => store.loadDemo()}>Load demo</Button>}
        />
      </PageTransition>
    );
  }

  const sheetValue = `${config.sheetLength}x${config.sheetWidth}`;

  return (
    <PageTransition>
      <PageHeader
        eyebrow="STEP 4"
        title="Optimization setup"
        description="Tune the machine parameters. The engine groups by grade and thickness, then nests parts to maximise plate yield."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-card p-6 shadow-soft lg:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
              <Cpu className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Configuration</h2>
              <p className="text-sm text-muted-foreground">Applies to all thickness groups</p>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-3">
              <Label>Stock sheet size</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {SHEET_SIZES.map((s) => {
                  const active = config.sheetLength === s.length && config.sheetWidth === s.width;
                  return (
                    <button
                      key={s.label}
                      onClick={() =>
                        store.set({
                          config: { ...config, sheetLength: s.length, sheetWidth: s.width },
                        })
                      }
                      className={cn(
                        "cursor-pointer rounded-xl border p-4 text-left transition-all",
                        active
                          ? "border-primary bg-primary-soft shadow-soft"
                          : "hover:border-primary/50 hover:bg-muted/50",
                      )}
                    >
                      <p className={cn("font-semibold", active && "text-primary")}>{s.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {((s.length * s.width) / 1_000_000).toFixed(2)} m² plate
                      </p>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" value={sheetValue} readOnly />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="kerf">Kerf allowance (mm)</Label>
                <Input
                  id="kerf"
                  type="number"
                  step="0.5"
                  value={config.kerf}
                  onChange={(e) =>
                    store.set({ config: { ...config, kerf: Number(e.target.value) } })
                  }
                />
                <p className="text-xs text-muted-foreground">Plasma / oxy-fuel cut width</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trim">Edge trim (mm)</Label>
                <Input
                  id="trim"
                  type="number"
                  value={config.trim}
                  onChange={(e) =>
                    store.set({ config: { ...config, trim: Number(e.target.value) } })
                  }
                />
                <p className="text-xs text-muted-foreground">Clamping / mill-edge allowance</p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Optimization algorithm</Label>
              <Select
                value={config.algorithm}
                onValueChange={(v) => store.set({ config: { ...config, algorithm: v } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALGORITHMS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="font-medium">Rotation allowed</p>
                <p className="text-sm text-muted-foreground">
                  Permit 90° part rotation (disable for directional / rolled plate)
                </p>
              </div>
              <Switch
                checked={config.rotation}
                onCheckedChange={(v) => store.set({ config: { ...config, rotation: v } })}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={run} disabled={running}>
                <Sparkles /> {running ? "Nesting parts…" : "Run optimization"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  store.set({
                    config: {
                      sheetLength: 3000,
                      sheetWidth: 1500,
                      kerf: 3,
                      trim: 10,
                      rotation: true,
                      algorithm: "maxrects",
                    },
                    result: null,
                  });
                  toast("Configuration reset to defaults");
                }}
              >
                <RotateCcw /> Reset
              </Button>
            </div>
          </div>
        </motion.div>

        <div>
          <AnimatePresence mode="wait">
            {running ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid gap-4 sm:grid-cols-2"
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border bg-card p-5 shadow-soft">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-4 h-8 w-32" />
                    <Skeleton className="mt-3 h-3 w-20" />
                  </div>
                ))}
              </motion.div>
            ) : result ? (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard label="Material utilization" value={result.utilization} decimals={1} suffix=" %" icon={Gauge} tone="success" hint="Plate area converted to parts" />
                  <StatCard label="Scrap" value={result.scrap} decimals={1} suffix=" %" icon={Recycle} tone="danger" delay={0.05} hint="Offcut & skeleton" />
                  <StatCard label="Sheets required" value={result.sheetCount} icon={Boxes} delay={0.1} hint={`${config.sheetLength} × ${config.sheetWidth} mm`} />
                  <StatCard label="Material cost" value={result.cost} prefix="₹ " icon={IndianRupee} tone="warning" delay={0.15} hint="At current grade rates" />
                </div>
                <div className="mt-4">
                  <StatCard label="Estimated savings" value={result.savings} prefix="₹ " icon={TrendingUp} tone="accent" delay={0.2} hint="Versus manual nesting baseline" />
                </div>
                <Button asChild size="lg" className="mt-6 w-full">
                  <Link to="/layouts">
                    View cut layouts <ArrowRight />
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid h-full min-h-[320px] place-items-center rounded-2xl border border-dashed bg-card/60 p-8 text-center"
              >
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Sparkles className="size-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">Results appear here</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    Run the optimizer to compute utilization, scrap, sheet count and cost for{" "}
                    {parts.reduce((s, p) => s + p.qty, 0)} parts.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
