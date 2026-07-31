import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, FileBarChart2 } from "lucide-react";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { SheetViewer, SheetThumbnail } from "@/components/app/sheet-viewer";
import { Button } from "@/components/ui/button";
import { store, useAppState } from "@/lib/store";
import { optimize } from "@/lib/nesting";

export const Route = createFileRoute("/_app/layouts")({
  head: () => ({
    meta: [
      { title: "Cut Layouts — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Interactive nesting visualization: inspect every part on every plate, with zoom, pan and waste areas.",
      },
      { property: "og:title", content: "Cut Layouts — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Interactive nesting visualization: inspect every part on every plate, with zoom, pan and waste areas.",
      },
    ],
  }),
  component: LayoutsPage,
});

function LayoutsPage() {
  const { result, parts, config } = useAppState();
  const [index, setIndex] = useState(0);

  if (!result) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 5" title="Cut layouts" />
        <EmptyState
          title="No layouts generated"
          description="Run the optimizer to generate nested cutting layouts for every stock plate."
          action={
            <div className="flex gap-3">
              {parts.length ? (
                <Button onClick={() => store.set({ result: optimize(parts, config) })}>
                  <Sparkles /> Run optimization
                </Button>
              ) : (
                <Button onClick={() => store.loadDemo()}>Load demo</Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/optimization">Configure</Link>
              </Button>
            </div>
          }
        />
      </PageTransition>
    );
  }

  const sheet = result.sheets[Math.min(index, result.sheets.length - 1)]!;

  return (
    <PageTransition>
      <PageHeader
        eyebrow="STEP 5"
        title="Cut layouts"
        description={`${result.sheets.length} nested plates · ${result.utilization.toFixed(1)}% average utilization · ${result.scrap.toFixed(1)}% scrap.`}
        actions={
          <Button asChild size="lg">
            <Link to="/reports">
              <FileBarChart2 /> Open reports
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <div>
          <SheetViewer sheet={sheet} />

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
            >
              <ChevronLeft /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Sheet {index + 1} of {result.sheets.length}
            </span>
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.min(i + 1, result.sheets.length - 1))}
              disabled={index >= result.sheets.length - 1}
            >
              Next <ChevronRight />
            </Button>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {result.sheets.map((s, i) => (
              <SheetThumbnail key={s.id} sheet={s} active={i === index} onClick={() => setIndex(i)} />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h3 className="font-semibold">Sheet details</h3>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Sheet ID", sheet.id],
                ["Material", sheet.material],
                ["Thickness", `PL ${sheet.thickness} THK`],
                ["Stock size", `${sheet.sheetLength} × ${sheet.sheetWidth} mm`],
                ["Parts nested", `${sheet.placed.length}`],
                ["Utilization", `${sheet.utilization.toFixed(1)}%`],
                ["Waste", `${(100 - sheet.utilization).toFixed(1)}%`],
                ["Kerf", `${result.config.kerf} mm`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h3 className="font-semibold">Parts on this plate</h3>
            <ul className="mt-3 max-h-[320px] space-y-2 overflow-auto text-sm">
              {[...new Set(sheet.placed.map((p) => p.part.item))].map((item) => {
                const count = sheet.placed.filter((p) => p.part.item === item).length;
                return (
                  <li key={item} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="font-medium">{item}</span>
                    <span className="tabular-nums text-muted-foreground">× {count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </PageTransition>
  );
}
