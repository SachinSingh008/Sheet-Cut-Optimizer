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
  const { parts, result, config } = useAppState();
  const groups = groupByThickness(parts, config.plateTypes);
  const [open, setOpen] = useState<ThicknessGroup | null>(null);

  if (!parts.length) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 3" title="Thickness groups" />
        <EmptyState
          title="No parts to group"
          description="Upload an Excel BOM to view parts grouped by thickness and plate type."
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
  const chqGroups = groups.filter((g) => g.plateTypeId === "chq");
  const normalGroups = groups.filter((g) => g.plateTypeId !== "chq");

  const renderGroupCard = (g: (typeof groups)[0], i: number) => {
    const matchingSheets =
      result?.sheets.filter(
        (s) =>
          s.thickness === g.thickness &&
          s.sheetLength === g.sheetLength &&
          s.sheetWidth === g.sheetWidth
      ) ?? [];
    const sheetsNeeded = matchingSheets.length;

    return (
      <motion.button
        key={g.key}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05, duration: 0.4 }}
        whileHover={{ y: -4 }}
        onClick={() => setOpen(g)}
        className="cursor-pointer rounded-2xl border bg-card p-6 text-left shadow-soft transition-shadow hover:shadow-lift flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold tracking-tight text-foreground">
                  PL {g.thickness} THK
                </p>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                    g.plateTypeId === "chq"
                      ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {g.plateTypeId === "chq" ? "Chequered Plate" : "Standard Plate"}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-foreground">{g.plateTypeName}</p>
              <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                Stock Size: {g.sheetLength} × {g.sheetWidth} mm
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
              <Layers3 className="size-5" />
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {g.parts.length} BOM lines · {g.pieces} parts
            </span>
            {sheetsNeeded > 0 && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold px-2 py-0.5 ml-auto">
                {sheetsNeeded} {sheetsNeeded === 1 ? "Sheet Needed" : "Sheets Needed"}
              </span>
            )}
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(g.pieces / maxPieces) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.05 }}
              className="h-full rounded-full bg-brand-gradient"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm border-t pt-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Hash className="size-3.5" /> {g.pieces} pcs
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Weight className="size-3.5" /> {g.weight.toFixed(0)} kg
            </span>
          </div>
          {sheetsNeeded > 0 ? (
            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
              {sheetsNeeded} × [{g.sheetLength}×{g.sheetWidth}]
            </span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">
              {g.sheetLength}×{g.sheetWidth} mm
            </span>
          )}
        </div>
      </motion.button>
    );
  };

  return (
    <PageTransition>
      <PageHeader
        eyebrow="STEP 3"
        title="Thickness Groups & Stock Plate Allocation"
        description="Parts are segregated into dedicated sections by material type (Chequered vs Normal MS) — each section is allocated to its own designated stock sheet dimensions."
        actions={
          <Button asChild size="lg">
            <Link to="/layouts">
              View Cut Layouts <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-8">
        {/* CHEQUERED PLATES SECTION */}
        {chqGroups.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  CHQ
                </span>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Chequered Plates Section (IS 3502 Anti-Skid Stock)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Allocated exclusively to SAIL/Tata Chequered stock sheets (e.g. 6000 × 1250 mm)
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold px-3 py-1">
                {chqGroups.reduce((s, g) => s + g.pieces, 0)} Chequered Parts
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {chqGroups.map(renderGroupCard)}
            </div>

            {/* Plate Types & Stock Dimensions Mapping for Chequered Plates */}
            <PlateTypeInventorySection filterCategory="chq" className="mt-4 border-amber-500/20 bg-background/80" />
          </div>
        )}

        {/* NORMAL MILD STEEL PLATES SECTION */}
        {normalGroups.length > 0 && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                  MS
                </span>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Normal Mild Steel Plates Section (IS 2062 Standard Mill Stock)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Allocated to standard HR mill stock sheets (e.g. 6300 × 1500 mm)
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 text-xs font-bold px-3 py-1">
                {normalGroups.reduce((s, g) => s + g.pieces, 0)} Normal Parts
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {normalGroups.map(renderGroupCard)}
            </div>

            {/* Plate Types & Stock Dimensions Mapping for Normal MS Plates */}
            <PlateTypeInventorySection filterCategory="normal" className="mt-4 border-blue-500/20 bg-background/80" />
          </div>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 flex-wrap">
              <span>PL {open?.thickness} THK — {open?.plateTypeName}</span>
              {open &&
              (result?.sheets.filter(
                (s) =>
                  s.thickness === open.thickness &&
                  s.sheetLength === open.sheetLength &&
                  s.sheetWidth === open.sheetWidth
              ).length ?? 0) > 0 ? (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5">
                  {
                    result?.sheets.filter(
                      (s) =>
                        s.thickness === open.thickness &&
                        s.sheetLength === open.sheetLength &&
                        s.sheetWidth === open.sheetWidth
                    ).length
                  }{" "}
                  {result?.sheets.filter(
                    (s) =>
                      s.thickness === open.thickness &&
                      s.sheetLength === open.sheetLength &&
                      s.sheetWidth === open.sheetWidth
                  ).length === 1
                    ? "Sheet Needed"
                    : "Sheets Needed"}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Stock Plate Size: {open?.sheetLength} × {open?.sheetWidth} mm · {open?.pieces} pieces across {open?.parts.length} BOM lines ·{" "}
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
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{p.material}</span>
                    </td>
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
