import React, { useRef } from "react";
import { Printer, Download, FileText, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OptimizationResult, NestedSheet } from "@/lib/nesting";
import { generateCuttingSequence, type CuttingOperation } from "@/lib/cutting-sequence";
import { partWeight } from "@/lib/mock-data";

interface PdfLayoutReportProps {
  result: OptimizationResult;
  onClose?: () => void;
}

export function PdfLayoutReport({ result, onClose }: PdfLayoutReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  // Group sheets by thickness ascending
  const sheetsByThickness = React.useMemo(() => {
    const map = new Map<number, NestedSheet[]>();
    for (const s of result.sheets) {
      if (!map.has(s.thickness)) {
        map.set(s.thickness, []);
      }
      map.get(s.thickness)!.push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([thickness, sheets]) => ({ thickness, sheets }));
  }, [result.sheets]);

  const totalUsedAreaMm2 = result.sheets.reduce((acc, s) => acc + s.usedArea, 0);
  const totalSheetAreaMm2 = result.sheets.reduce((acc, s) => acc + s.sheetLength * s.sheetWidth, 0);
  const totalWastedAreaMm2 = totalSheetAreaMm2 - totalUsedAreaMm2;
  const avgUtilization = (totalUsedAreaMm2 / totalSheetAreaMm2) * 100;
  const avgWasted = 100 - avgUtilization;

  // Calculate total cuts & cut lengths
  let totalCuts = 0;
  let totalCutLengthMm = 0;
  for (const s of result.sheets) {
    const placed = s.placed;
    totalCuts += placed.length * 2; // horizontal and vertical cut per placed part
    totalCutLengthMm += placed.reduce((sum, p) => sum + p.w + p.h, 0);
  }

  // Summary panels string (e.g., "100×280 x1 \ 162×398 x1 ...")
  const panelSummaryMap = new Map<string, number>();
  for (const s of result.sheets) {
    for (const p of s.placed) {
      const key = `${p.w}×${p.h}`;
      panelSummaryMap.set(key, (panelSummaryMap.get(key) || 0) + 1);
    }
  }
  const panelSummaryStr = [...panelSummaryMap.entries()]
    .map(([dim, qty]) => `${dim} x${qty}`)
    .join(" \\ ");

  const stockSheetSummaryStr = `${result.config.sheetLength}×${result.config.sheetWidth} x${result.sheets.length}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md print:bg-white print:static print:inset-auto print:block">
      {/* Sticky Top Action Header — Stays fixed on top when scrolling */}
      <div className="sticky top-0 z-50 shrink-0 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 sm:px-8 py-3 shadow-xl print:hidden flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200">
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
          )}
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Cut List Optimizer PDF Report</span>
            </h2>
            <p className="text-[11px] text-slate-400 hidden sm:block">Print-ready PDF layout formatted exactly to specification</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md">
            <Printer className="mr-1.5 size-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Main Scrollable Printable Canvas Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible">
        <div
          ref={reportRef}
          id="pdf-print-area"
          className="mx-auto max-w-[1000px] bg-white text-slate-900 p-8 shadow-2xl rounded-none print:shadow-none print:m-0 print:w-full print:p-4 font-sans text-xs"
          style={{ minHeight: "1000px" }}
        >
          {/* Document Header */}
          <div className="border-b-2 border-slate-300 pb-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">SteelNest AI — CutList Optimizer</h1>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Powered by 1810 Systems</span>
            </div>

            <div className="grid grid-cols-12 gap-4 text-[11px] leading-relaxed">
              {/* Left Main Details */}
              <div className="col-span-6 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Used stock sheets</span>
                  <span className="font-mono font-bold text-slate-900">{result.sheets.length} ({sheetsByThickness.length} thickness groups)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total used area</span>
                  <span className="font-mono text-slate-900">{Math.round(totalUsedAreaMm2)} mm² <strong className="text-slate-700">{avgUtilization.toFixed(0)}%</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total wasted area</span>
                  <span className="font-mono text-slate-900">{Math.round(totalWastedAreaMm2)} mm² {avgWasted.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total cuts</span>
                  <span className="font-mono text-slate-900">{totalCuts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total cut length</span>
                  <span className="font-mono text-slate-900">{totalCutLengthMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Cut / blade / kerf thickness</span>
                  <span className="font-mono text-slate-900">{result.config.kerf} mm</span>
                </div>
              </div>

              {/* Right Summary Details */}
              <div className="col-span-6 space-y-2 border-l border-slate-200 pl-4">
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Panels:</span>
                  <p className="text-[10px] text-slate-600 font-mono leading-normal break-words max-h-16 overflow-hidden">
                    {panelSummaryStr}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Stock sheets:</span>
                  <p className="text-[10px] text-slate-800 font-mono font-semibold">
                    {stockSheetSummaryStr}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sheets Section — Grouped by Thickness */}
          <div className="space-y-10">
            {sheetsByThickness.map(({ thickness, sheets }) => (
              <div key={thickness} className="space-y-6 print:break-before-auto">
                {/* THICKNESS SECTION HEADING */}
                <div className="border-b-2 border-slate-900 bg-slate-900 text-white p-3 shadow-md flex flex-wrap items-center justify-between rounded-md print:break-after-avoid">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-base tracking-wider uppercase bg-amber-400 text-slate-950 px-3 py-1 rounded font-mono">
                      THICKNESS {thickness}mm
                    </span>
                    <span className="font-bold text-sm text-slate-200">
                      Material Grade: {sheets[0]?.material || "IS:2062"}
                    </span>
                  </div>
                  <div className="text-right text-xs font-mono font-semibold text-slate-300">
                    Total Sheets Required: <strong className="text-amber-400">{sheets.length} {sheets.length === 1 ? "SHEET" : "SHEETS"}</strong> ({sheets.map((s) => s.id).join(", ")})
                  </div>
                </div>

                {/* Individual Sheets in this Thickness Group */}
                <div className="space-y-8">
                  {sheets.map((sheet) => {
                    const sheetAreaMm2 = sheet.sheetLength * sheet.sheetWidth;
                    const sheetWastedMm2 = sheetAreaMm2 - sheet.usedArea;
                    const sheetUtil = (sheet.usedArea / sheetAreaMm2) * 100;
                    const sheetWaste = 100 - sheetUtil;
                    const sheetCuts = sheet.placed.length * 2;
                    const sheetCutLen = sheet.placed.reduce((sum, p) => sum + p.w + p.h, 0);

                    // Group panel quantities for this sheet
                    const sheetPanelQtyMap = new Map<string, number>();
                    for (const p of sheet.placed) {
                      const key = `${p.w}×${p.h}`;
                      sheetPanelQtyMap.set(key, (sheetPanelQtyMap.get(key) || 0) + 1);
                    }

                    // Generate Production Cut Sequence Table data using cutting-sequence engine
                    const seqResult = generateCuttingSequence(sheet);

                    return (
                      <div key={sheet.id} className="grid grid-cols-12 gap-6 pt-4 border-t border-slate-300 print:break-inside-avoid">
                        {/* Left Column (Details & Tables) */}
                        <div className="col-span-4 space-y-4">
                          {/* Table 1: Stock Sheet Metrics */}
                          <table className="w-full text-[11px] border border-slate-300 border-collapse">
                            <thead>
                              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                                <th className="px-2 py-1 text-left" colSpan={2}>
                                  Stock sheet {sheet.id} ({sheet.sheetLength}×{sheet.sheetWidth} - {sheet.thickness}mm)
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium">Used area</td>
                                <td className="px-2 py-1 text-right font-mono text-slate-900">{Math.round(sheet.usedArea)} mm² {sheetUtil.toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium">Wasted area</td>
                                <td className="px-2 py-1 text-right font-mono text-slate-900">{Math.round(sheetWastedMm2)} mm² {sheetWaste.toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium">Total Cut Operations</td>
                                <td className="px-2 py-1 text-right font-mono text-slate-900">{seqResult.operations.length}</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium font-semibold text-slate-800">Total cut length</td>
                                <td className="px-2 py-1 text-right font-mono text-slate-900 font-bold">{seqResult.totalCutLength.toLocaleString()} mm</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium text-rose-600">Rapid Traverse Air-Cut</td>
                                <td className="px-2 py-1 text-right font-mono text-rose-600 font-semibold">{seqResult.totalRapidTraverse.toLocaleString()} mm</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium text-emerald-700">Common / Strip Cut Saved</td>
                                <td className="px-2 py-1 text-right font-mono text-emerald-700 font-bold">+{seqResult.savedCutLength.toLocaleString()} mm</td>
                              </tr>
                              <tr>
                                <td className="px-2 py-1 text-slate-600 font-medium">Panels Nested</td>
                                <td className="px-2 py-1 text-right font-mono text-slate-900">{sheet.placed.length}</td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Table 2: Panel Qty */}
                          <table className="w-full text-[11px] border border-slate-300 border-collapse">
                            <thead>
                              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                                <th className="px-2 py-1 text-left">Panel</th>
                                <th className="px-2 py-1 text-right">Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono">
                              {[...sheetPanelQtyMap.entries()].map(([dim, qty]) => (
                                <tr key={dim}>
                                  <td className="px-2 py-1 text-slate-800">{dim}</td>
                                  <td className="px-2 py-1 text-right text-slate-900 font-bold">{qty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Table 3: Ordered Production Cut List */}
                          <table className="w-full text-[9.5px] border border-slate-300 border-collapse">
                            <thead>
                              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                                <th className="px-1 py-1 text-left">#</th>
                                <th className="px-1 py-1 text-left">Stage</th>
                                <th className="px-1 py-1 text-left">Pierce (X,Y)</th>
                                <th className="px-1 py-1 text-left">Operation Cut Instruction</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono">
                              {seqResult.operations.slice(0, 15).map((op: CuttingOperation) => (
                                <tr key={op.sequenceNumber}>
                                  <td className="px-1 py-0.5 font-bold text-slate-800">#{op.sequenceNumber}</td>
                                  <td className="px-1 py-0.5 text-slate-700 font-semibold">Stg {op.segment.guillotineStage}</td>
                                  <td className="px-1 py-0.5 text-slate-900 font-medium">({op.piercePoint.x},{op.piercePoint.y})</td>
                                  <td className="px-1 py-0.5 text-slate-600 text-[9px] leading-tight">{op.instruction}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Right Column (Vector CAD Plate Drawing) */}
                        <div className="col-span-8 flex flex-col justify-start">
                          <div className="relative border border-slate-400 bg-white p-6 shadow-sm">
                            {/* SVG Plate Visualizer with Red Dimension Lines */}
                            <svg
                              viewBox={`-40 -40 ${sheet.sheetLength + 90} ${sheet.sheetWidth + 90}`}
                              className="w-full h-auto overflow-visible"
                            >
                              {/* Stock Plate Outline */}
                              <rect
                                x={0}
                                y={0}
                                width={sheet.sheetLength}
                                height={sheet.sheetWidth}
                                fill="#f8fafc"
                                stroke="#334155"
                                strokeWidth={2}
                              />

                              {/* Red Dimension Line — Bottom (Length) */}
                              <line
                                x1={0}
                                y1={sheet.sheetWidth + 25}
                                x2={sheet.sheetLength}
                                y2={sheet.sheetWidth + 25}
                                stroke="#ef4444"
                                strokeWidth={1.5}
                              />
                              <line x1={0} y1={sheet.sheetWidth + 15} x2={0} y2={sheet.sheetWidth + 35} stroke="#ef4444" strokeWidth={1.5} />
                              <line x1={sheet.sheetLength} y1={sheet.sheetWidth + 15} x2={sheet.sheetLength} y2={sheet.sheetWidth + 35} stroke="#ef4444" strokeWidth={1.5} />
                              <text
                                x={sheet.sheetLength / 2}
                                y={sheet.sheetWidth + 42}
                                textAnchor="middle"
                                fill="#ef4444"
                                fontSize={20}
                                fontWeight="bold"
                                fontFamily="sans-serif"
                              >
                                {sheet.sheetLength} mm
                              </text>

                              {/* Red Dimension Line — Right Side (Width) */}
                              <line
                                x1={sheet.sheetLength + 25}
                                y1={0}
                                x2={sheet.sheetLength + 25}
                                y2={sheet.sheetWidth}
                                stroke="#ef4444"
                                strokeWidth={1.5}
                              />
                              <line x1={sheet.sheetLength + 15} y1={0} x2={sheet.sheetLength + 35} y2={0} stroke="#ef4444" strokeWidth={1.5} />
                              <line x1={sheet.sheetLength + 15} y1={sheet.sheetWidth} x2={sheet.sheetLength + 35} y2={sheet.sheetWidth} stroke="#ef4444" strokeWidth={1.5} />
                              <text
                                x={sheet.sheetLength + 45}
                                y={sheet.sheetWidth / 2}
                                textAnchor="middle"
                                fill="#ef4444"
                                fontSize={20}
                                fontWeight="bold"
                                fontFamily="sans-serif"
                                transform={`rotate(90, ${sheet.sheetLength + 45}, ${sheet.sheetWidth / 2})`}
                              >
                                {sheet.sheetWidth} mm
                              </text>

                              {/* Render Nested Parts */}
                              {sheet.placed.map((p, pIdx) => {
                                // Soft pastel colors matching reference drawing
                                const pastelFills = [
                                  "#cbd5e1", // Slate
                                  "#fbcfe8", // Pink
                                  "#fed7aa", // Orange
                                  "#d9f99d", // Lime
                                  "#ccfbf1", // Teal
                                  "#e0e7ff", // Indigo
                                ];
                                const fillColor = pastelFills[pIdx % pastelFills.length];

                                return (
                                  <g key={p.key}>
                                    {/* Part Fill & Border */}
                                    <rect
                                      x={p.x}
                                      y={p.y}
                                      width={p.w}
                                      height={p.h}
                                      fill={fillColor}
                                      stroke="#475569"
                                      strokeWidth={1.5}
                                    />

                                    {/* Center Item Mark Label */}
                                    <text
                                      x={p.x + p.w / 2}
                                      y={p.y + p.h / 2 - (Math.min(p.w / 8, p.h / 5, 24) * 0.7)}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      fill="#0f172a"
                                      fontSize={Math.max(12, Math.min(p.w / 7, p.h / 4, 36))}
                                      fontWeight="bold"
                                      fontFamily="sans-serif"
                                    >
                                      {p.part.item}
                                    </text>

                                    {/* Explicit Length & Breadth Dimension Label */}
                                    <text
                                      x={p.x + p.w / 2}
                                      y={p.y + p.h / 2 + (Math.min(p.w / 8, p.h / 5, 24) * 0.7)}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      fill="#0284c7"
                                      fontSize={Math.max(10, Math.min(p.w / 9, p.h / 5, 28))}
                                      fontWeight="bold"
                                      fontFamily="monospace"
                                    >
                                      {p.w} × {p.h} mm
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
