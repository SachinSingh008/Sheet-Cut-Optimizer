import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, FileBarChart2, FileText } from "lucide-react";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { PlateCutDiagramSection } from "@/components/app/plate-cut-diagram";
import { SheetViewer, SheetThumbnail } from "@/components/app/sheet-viewer";
import { PdfLayoutReport } from "@/components/app/pdf-layout-report";
import { Button } from "@/components/ui/button";
import { store, useAppState } from "@/lib/store";
import { optimize } from "@/lib/nesting";
import { AdaptiveEngineCard } from "@/components/app/adaptive-engine-card";
import { OptimizationTimerModal } from "@/components/app/optimization-timer-modal";

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
  const { result, parts, config, file, isOptimizing, progress, progressMessage } = useAppState();
  const [index, setIndex] = useState(0);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);

  if (isOptimizing) {
    return (
      <PageTransition>
        <PageHeader
          eyebrow="STEP 4"
          title={file?.name ? `Generating Cut Layouts — ${file.name}` : "Generating Cut Layouts..."}
          description="AI optimization engine is nesting parts onto standard stock plates..."
        />
        <div className="mt-8 mx-auto max-w-xl rounded-3xl border border-primary/25 bg-card/90 p-8 shadow-xl text-center space-y-5">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-4 ring-primary/5">
            <Sparkles className="size-8 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Generating Optimized Plate Layouts...
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {progressMessage || "Calculating optimal item placements..."}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-primary font-mono">{progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Using adaptive population-based genetic algorithm to minimize plate count and maximize yield.
          </p>
        </div>
      </PageTransition>
    );
  }

  if (!result) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 4" title="Cut Layouts" />
        <EmptyState
          title="No layouts generated"
          description="Load a BOM to generate nested cutting layouts for every stock plate."
          action={
            <div className="flex gap-3">
              {parts.length ? (
                <Button onClick={() => store.runOptimization()}>
                  <Sparkles className="mr-1.5 size-4" /> Generate Layouts
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/upload">Upload Excel BOM</Link>
                </Button>
              )}
            </div>
          }
        />
      </PageTransition>
    );
  }

  const sheet = result.sheets[Math.min(index, result.sheets.length - 1)]!;

  return (
    <PageTransition>
      {showPdfModal && <PdfLayoutReport result={result} onClose={() => setShowPdfModal(false)} />}
      <OptimizationTimerModal
        isOpen={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        targetRoute="/layouts"
      />

      <PageHeader
        eyebrow="STEP 4"
        title={file?.name ? `Cut Layouts & Plate Blueprints — ${file.name}` : "Cut Layouts & Plate Blueprints"}
        description={`${file?.name ? `${file.name} · ` : ""}${result.sheets.length} nested plates · ${result.utilization.toFixed(1)}% average utilization · ${result.scrap.toFixed(1)}% scrap.`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowTimerModal(true)}
              variant="outline"
              size="lg"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-bold"
            >
              <Sparkles className="mr-1.5 size-4 text-amber-500" /> Re-run 15s Optimization
            </Button>
            <Button
              size="lg"
              onClick={() => setShowPdfModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft"
            >
              <FileText className="mr-1.5 size-4" /> Export PDF
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/reports">
                <FileBarChart2 className="mr-1.5 size-4" /> Open Reports
              </Link>
            </Button>
          </div>
        }
      />

      {/* Adaptive Optimization Engine BOM Analysis & Decision Logic */}
      <div className="mt-6">
        <AdaptiveEngineCard result={result} />
      </div>

      {/* Main Interactive Diagram & Cut Sequence Instructions */}
      <PlateCutDiagramSection result={result} />

      {/* Zoomable & Draggable CAD Viewer Box */}
      <div className="mt-8 space-y-4">
        <div>
          <h3 className="font-bold text-lg text-foreground">Interactive CAD Blueprint Canvas</h3>
          <p className="text-xs text-muted-foreground">Inspect parts on every sheet with attached right & bottom analysis sidebars.</p>
        </div>

        {/* Layout Grid: Left = Vertically Stacked Sheets, Right = Sheet Canvas with Attached Sidebars */}
        <div className="grid gap-6 xl:grid-cols-12">
          {/* VERTICAL SHEET STACK SELECTOR (Left 3 Columns) */}
          <div className="xl:col-span-3 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Nested Stock Plates ({result.sheets.length})
              </h4>
              <span className="text-[11px] font-mono text-primary font-bold">
                Sheet {index + 1} / {result.sheets.length}
              </span>
            </div>

            {/* Vertically Stacked Sheet List (Categorized by Material Section) */}
            <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
              {(() => {
                const chqItems = result.sheets.map((s, i) => ({ s, i })).filter(({ s }) => /chq|cheq|chequered|3502/i.test(s.material));
                const normalItems = result.sheets.map((s, i) => ({ s, i })).filter(({ s }) => !/chq|cheq|chequered|3502/i.test(s.material));

                if (chqItems.length === 0 || normalItems.length === 0) {
                  return result.sheets.map((s, i) => (
                    <SheetThumbnail key={s.id} sheet={s} active={i === index} onClick={() => setIndex(i)} />
                  ));
                }

                return (
                  <>
                    {chqItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                          <span>🟡 Chequered Plates ({chqItems.length})</span>
                          <span>{chqItems[0]?.s.sheetLength}×{chqItems[0]?.s.sheetWidth}</span>
                        </div>
                        {chqItems.map(({ s, i }) => (
                          <SheetThumbnail key={s.id} sheet={s} active={i === index} onClick={() => setIndex(i)} />
                        ))}
                      </div>
                    )}

                    {normalItems.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between px-1 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-[11px]">
                          <span>🔵 Normal / MS Plates ({normalItems.length})</span>
                          <span>{normalItems[0]?.s.sheetLength}×{normalItems[0]?.s.sheetWidth}</span>
                        </div>
                        {normalItems.map(({ s, i }) => (
                          <SheetThumbnail key={s.id} sheet={s} active={i === index} onClick={() => setIndex(i)} />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                disabled={index === 0}
              >
                <ChevronLeft className="mr-1 size-3.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold"
                onClick={() => setIndex((i) => Math.min(i + 1, result.sheets.length - 1))}
                disabled={index >= result.sheets.length - 1}
              >
                Next <ChevronRight className="ml-1 size-3.5" />
              </Button>
            </div>
          </div>

          {/* MAIN CUTOUT CANVAS WITH ATTACHED RIGHT & BOTTOM SIDEBARS (Right 9 Columns) */}
          <div className="xl:col-span-9">
            <SheetViewer sheet={sheet} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
