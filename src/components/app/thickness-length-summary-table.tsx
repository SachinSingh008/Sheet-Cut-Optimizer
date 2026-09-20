import React, { useMemo } from "react";
import { Layers, Ruler, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type NestedSheet,
  computeThicknessLengthSummary,
  type ExecutiveProcurementSummary,
} from "@/lib/nesting";

interface ThicknessLengthSummaryTableProps {
  sheets: NestedSheet[];
  kerf?: number;
  className?: string;
  title?: string;
  subtitle?: string;
  isPrintMode?: boolean;
}

/**
 * Executive Summary Table: Groups sheets by thickness and displays exact cut lengths needed.
 * Shows individual lengths needed (e.g. thk 8, qty 1, len 6300 & thk 8, qty 1, len 200)
 * along with the total combined length needed for each thickness group.
 */
export function ThicknessLengthSummaryTable({
  sheets,
  kerf = 5,
  className = "",
  title = "Executive Plate Cut Length & Procurement Summary",
  subtitle = "Exact plate lengths needed grouped and combined by thickness",
  isPrintMode = false,
}: ThicknessLengthSummaryTableProps) {
  const summary: ExecutiveProcurementSummary = useMemo(
    () => computeThicknessLengthSummary(sheets, kerf),
    [sheets, kerf]
  );

  if (!sheets || sheets.length === 0 || summary.groups.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5 shadow-soft print:shadow-none print:border-slate-900 print:rounded-none print:p-2",
        className
      )}
    >
      {/* Table Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3 print:pb-1.5 print:mb-2 border-border print:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary print:hidden">
            <Layers className="size-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-foreground print:text-slate-900 flex items-center gap-2">
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground print:text-slate-600">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Grand Total Metrics Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold font-mono print:border-slate-900 print:text-slate-900 print:bg-slate-100">
            <CheckCircle2 className="size-3.5 print:hidden" />
            Total: {summary.grandTotalSheets} {summary.grandTotalSheets === 1 ? "Sheet" : "Sheets"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30 px-2.5 py-1 text-xs font-extrabold font-mono print:border-slate-900 print:text-slate-900 print:bg-slate-100">
            <Ruler className="size-3.5 print:hidden" />
            Combined Length: {(summary.grandTotalLengthMm / 1000).toFixed(2)} m ({summary.grandTotalLengthMm.toLocaleString()} mm)
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-bold font-mono text-muted-foreground print:border print:border-slate-800 print:text-slate-900">
            Weight: {summary.grandTotalWeightKg.toLocaleString()} kg
          </span>
        </div>
      </div>

      {/* Structured Summary Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse print:text-[10px]">
          <thead>
            <tr className="border-b bg-muted/60 text-muted-foreground uppercase tracking-wider font-semibold text-[11px] print:bg-slate-200 print:text-slate-900 print:border-slate-900">
              <th className="px-3 py-2">Plate Thickness</th>
              <th className="px-3 py-2">Material Specification</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Length Needed</th>
              <th className="px-3 py-2 text-right">Plate Width</th>
              <th className="px-3 py-2 text-right">Total Combined Length</th>
              <th className="px-3 py-2 text-right">Est. Weight</th>
              <th className="px-3 py-2 text-right print:hidden">Sheet IDs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border print:divide-slate-300">
            {summary.groups.map((group) => {
              const thkLabel = group.isChq
                ? `🟡 Chequered PL ${group.thickness} mm`
                : `🔵 Standard MS PL ${group.thickness} mm`;

              return (
                <React.Fragment key={`${group.thickness}-${group.material}-${group.isChq ? "chq" : "ms"}`}>
                  {/* Category Rows */}
                  {group.items.map((item, idx) => {
                    return (
                      <tr
                        key={`${item.thickness}-${item.lengthNeeded}-${idx}`}
                        className="hover:bg-muted/40 transition-colors font-mono print:hover:bg-transparent"
                      >
                        <td className="px-3 py-2 font-bold text-foreground print:text-slate-900">
                          {idx === 0 ? thkLabel : ""}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground print:text-slate-800">
                          {idx === 0 ? item.material : ""}
                        </td>
                        <td className="px-3 py-2 text-center font-extrabold text-foreground print:text-slate-900">
                          <span className="inline-block rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-mono print:bg-transparent print:text-slate-900 print:p-0">
                            {item.qty} {item.qty === 1 ? "sheet" : "sheets"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-sky-600 dark:text-sky-400 print:text-slate-900">
                          {item.lengthNeeded.toLocaleString()} mm
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground print:text-slate-700">
                          {item.sheetWidth.toLocaleString()} mm
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-foreground print:text-slate-900">
                          {item.totalLengthMm.toLocaleString()} mm
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground print:text-slate-700">
                          {item.weightKg.toLocaleString()} kg
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-muted-foreground font-mono print:hidden">
                          {item.sheetIds.join(", ")}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Per-Thickness Subtotal Banner */}
                  <tr className="bg-primary-soft/30 dark:bg-primary/5 font-mono text-xs font-bold border-b-2 border-primary/20 print:bg-slate-100 print:border-slate-800">
                    <td colSpan={2} className="px-3 py-1.5 text-primary font-sans font-extrabold print:text-slate-900">
                      ↳ Combined for PL {group.thickness} mm {group.isChq ? "(CHQ)" : ""}:
                    </td>
                    <td className="px-3 py-1.5 text-center text-primary print:text-slate-900 font-extrabold">
                      {group.totalSheets} {group.totalSheets === 1 ? "sheet" : "sheets"}
                    </td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-muted-foreground print:text-slate-700 font-normal">
                      Combined Total Length:
                    </td>
                    <td className="px-3 py-1.5 text-right text-primary print:text-slate-900 font-extrabold text-sm">
                      {group.totalLengthNeededMm.toLocaleString()} mm
                    </td>
                    <td className="px-3 py-1.5 text-right text-primary print:text-slate-900 font-bold">
                      {group.totalWeightKg.toLocaleString()} kg
                    </td>
                    <td className="px-3 py-1.5 print:hidden" />
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Grand Total Footer */}
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-900 text-white font-mono font-bold text-xs print:bg-slate-200 print:text-slate-900 print:border-slate-900">
              <td colSpan={2} className="px-3 py-2.5 uppercase font-sans tracking-wide">
                Grand Total (All Plates Combined):
              </td>
              <td className="px-3 py-2.5 text-center text-amber-300 print:text-slate-900 font-extrabold text-sm">
                {summary.grandTotalSheets} Sheets
              </td>
              <td colSpan={2} className="px-3 py-2.5 text-right font-normal text-slate-300 print:text-slate-700">
                Total Linear Cut Length:
              </td>
              <td className="px-3 py-2.5 text-right text-amber-300 print:text-slate-900 font-extrabold text-sm">
                {summary.grandTotalLengthMm.toLocaleString()} mm
              </td>
              <td className="px-3 py-2.5 text-right text-white print:text-slate-900 font-bold">
                {summary.grandTotalWeightKg.toLocaleString()} kg
              </td>
              <td className="px-3 py-2.5 print:hidden" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
