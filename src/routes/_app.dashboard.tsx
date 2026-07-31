import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Boxes,
  Gauge,
  Layers3,
  PackageSearch,
  Recycle,
  Sparkles,
  UploadCloud,
  Weight,
} from "lucide-react";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { useAppState, store } from "@/lib/store";
import { groupByThickness, partWeight } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Live overview of your steel plate nesting session: parts, thickness groups, utilization and scrap.",
      },
      { property: "og:title", content: "Dashboard — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Live overview of your steel plate nesting session: parts, thickness groups, utilization and scrap.",
      },
    ],
  }),
  component: DashboardPage,
});

const steps = [
  { to: "/upload", title: "Upload BOM", text: "Excel, CSV, PDF or a scanned drawing.", icon: UploadCloud },
  { to: "/parse", title: "Review parts", text: "Validate materials, sizes and quantities.", icon: PackageSearch },
  { to: "/optimization", title: "Run nesting", text: "Configure kerf, trim and algorithm.", icon: Sparkles },
  { to: "/layouts", title: "Cut layouts", text: "Inspect every sheet and export.", icon: Layers3 },
] as const;

function DashboardPage() {
  const { parts, result } = useAppState();
  const groups = groupByThickness(parts);
  const totalPieces = parts.reduce((s, p) => s + p.qty, 0);
  const weight = parts.reduce((s, p) => s + partWeight(p), 0);

  return (
    <PageTransition>
      <PageHeader
        eyebrow="WORKSPACE OVERVIEW"
        title="Project dashboard"
        description="Everything about the current nesting session in one place. No account, no storage — close the tab and it's gone."
        actions={
          parts.length ? (
            <Button asChild size="lg">
              <Link to="/optimization">
                Run optimization <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" variant="outline" onClick={() => store.loadDemo()}>
                Load demo project
              </Button>
              <Button asChild size="lg">
                <Link to="/upload">
                  <UploadCloud /> Upload Excel
                </Link>
              </Button>
            </>
          )
        }
      />

      {parts.length === 0 ? (
        <EmptyState
          title="No BOM loaded yet"
          description="Upload a fabrication BOM or load the sample bridge project to explore the full optimization workflow."
          action={
            <Button onClick={() => store.loadDemo()} size="lg">
              <Sparkles /> Try the demo project
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="BOM line items" value={parts.length} icon={PackageSearch} hint={`${totalPieces} pieces to cut`} />
            <StatCard label="Thickness groups" value={groups.length} icon={Layers3} tone="accent" hint="Grouped for plate nesting" delay={0.05} />
            <StatCard label="Net part weight" value={weight} decimals={0} suffix=" kg" icon={Weight} tone="warning" hint="Excluding scrap allowance" delay={0.1} />
            <StatCard
              label="Utilization"
              value={result?.utilization ?? 0}
              decimals={1}
              suffix=" %"
              icon={Gauge}
              tone="success"
              hint={result ? `${result.sheetCount} sheets required` : "Run optimization to calculate"}
              delay={0.15}
            />
          </div>

          {result ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Scrap" value={result.scrap} decimals={1} suffix=" %" icon={Recycle} tone="danger" hint="Offcut area across all sheets" />
              <StatCard label="Sheets required" value={result.sheetCount} icon={Boxes} tone="primary" hint={`${result.config.sheetLength} × ${result.config.sheetWidth} mm stock`} delay={0.05} />
              <StatCard label="Estimated savings" value={result.savings} prefix="₹ " icon={Sparkles} tone="success" hint="Versus manual shop-floor nesting" delay={0.1} />
            </div>
          ) : null}
        </>
      )}

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Workflow</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.to}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              whileHover={{ y: -4 }}
            >
              <Link
                to={s.to}
                className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift"
              >
                <span className="mb-4 grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
                  STEP {i + 1}
                </span>
                <span className="mt-1 font-semibold">{s.title}</span>
                <span className="mt-1 text-sm text-muted-foreground">{s.text}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
