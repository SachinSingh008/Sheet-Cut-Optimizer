import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Layers3, ArrowRight, Weight, Hash } from "lucide-react";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { PlateTypeInventorySection } from "@/components/app/plate-type-inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { store, useAppState } from "@/lib/store";
import { groupByThickness, partWeight, type ThicknessGroup } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/thickness")({
  head: () => ({
    meta: [
      { title: "Thickness Groups — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Plates grouped by thickness so each stock plate is nested with compatible parts only.",
      },
      { property: "og:title", content: "Thickness Groups — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Plates grouped by thickness so each stock plate is nested with compatible parts only.",
      },
    ],
  }),
  component: ThicknessPage,
});

function ThicknessPage() {
  const { parts, result } = useAppState();
  const groups = groupByThickness(parts);
  const [open, setOpen] = useState<ThicknessGroup | null>(null);

  if (!parts.length) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 3" title="Thickness groups" />
        <EmptyState
          title="No parts to group"
          description="Upload an Excel BOM to view parts grouped by thickness."
          action={
            <Button asChild size="lg">
              <Link to="/upload">Upload Excel BOM</Link>
            </Button>
          }
        />
      </PageTransition>
    );
  }

  const maxPieces = Math.max(...groups.map((g) => g.pieces));

  return (
    <PageTransition>
      <PageHeader
        eyebrow="STEP 3"
        title="Thickness Groups & Plate Stock Mapping"
        description="Parts are bucketed by plate thickness and grade — each bucket is nested onto its own stock plates according to assigned plate type stock sizes."
        actions={
          <Button asChild size="lg">
            <Link to="/layouts">
              View Cut Layouts <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g, i) => {
          const matchingSheets = result?.sheets.filter((s) => s.thickness === g.thickness) ?? [];
          const sheetsNeeded = matchingSheets.length;

          return (
            <motion.button
              key={g.thickness}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              whileHover={{ y: -4 }}
              onClick={() => setOpen(g)}
              className="cursor-pointer rounded-2xl border bg-card p-6 text-left shadow-soft transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-semibold tracking-tight">PL {g.thickness} THK</p>
                    {sheetsNeeded > 0 && (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5">
                        {sheetsNeeded} {sheetsNeeded === 1 ? "Sheet Needed" : "Sheets Needed"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {g.parts.length} BOM lines · {g.pieces} parts
                    {sheetsNeeded > 0 ? ` · ${sheetsNeeded} ${sheetsNeeded === 1 ? "sheet" : "sheets"} required` : ""}
                  </p>
                </div>
                <span className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
                  <Layers3 className="size-5" />
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(g.pieces / maxPieces) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.15 + i * 0.05 }}
                  className="h-full rounded-full bg-brand-gradient"
                />
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Hash className="size-4" /> {g.pieces} pcs
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Weight className="size-4" /> {g.weight.toFixed(0)} kg
                  </span>
                </div>
                {sheetsNeeded > 0 && (
                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {sheetsNeeded} {sheetsNeeded === 1 ? "Sheet" : "Sheets"}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Plate Types & Excel Abbreviation Stock Size Management Section */}
      <PlateTypeInventorySection />

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 flex-wrap">
              <span>PL {open?.thickness} THK — parts</span>
              {open && (result?.sheets.filter((s) => s.thickness === open.thickness).length ?? 0) > 0 ? (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5">
                  {result?.sheets.filter((s) => s.thickness === open.thickness).length} {result?.sheets.filter((s) => s.thickness === open.thickness).length === 1 ? "Sheet Needed" : "Sheets Needed"}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {open?.pieces} pieces across {open?.parts.length} BOM lines ·{" "}
              {open?.weight.toFixed(0)} kg
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  {["Item", "Description", "Material", "Size (mm)", "Qty", "Weight"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {open?.parts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{p.item}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.description}</td>
                    <td className="px-4 py-2.5">{p.material}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {p.length} × {p.width}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{p.qty}</td>
                    <td className="px-4 py-2.5 tabular-nums">{partWeight(p).toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
