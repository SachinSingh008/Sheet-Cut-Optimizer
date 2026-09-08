import React, { useRef, useState } from "react";
import { Printer, ArrowLeft, ZoomIn, ZoomOut, Type, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OptimizationResult, NestedSheet } from "@/lib/nesting";
import { generateCuttingSequence } from "@/lib/cutting-sequence";
import { useAppState } from "@/lib/store";

interface PdfLayoutReportProps {
  result: OptimizationResult;
  onClose?: () => void;
}

export function PdfLayoutReport({ result, onClose }: PdfLayoutReportProps) {
  const { file } = useAppState();
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfTextScale, setPdfTextScale] = useState<number>(1.2); // Default text scale
  const [orientation, setOrientation] = useState<"standing" | "sleeping">("standing"); // Standing vertical by default

  // Group sheets by Material Category + Thickness + Stock Dimensions
  const sheetsByGroup = React.useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        categoryName: string;
        isChq: boolean;
        thickness: number;
        material: string;
        sheetLength: number;
        sheetWidth: number;
        sheets: NestedSheet[];
      }
    >();

    for (const s of result.sheets) {
      const isChq = /chq|cheq|chequered|checkered|3502/i.test(`${s.material}`);
      const categoryName = isChq
        ? `Chequered Plate ${s.thickness}mm`
        : `Normal Mild Steel Plate ${s.thickness}mm`;
      const key = `${isChq ? "chq" : "ms"}-${s.thickness}-${s.sheetLength}x${s.sheetWidth}`;

      let existing = map.get(key);
      if (!existing) {
        existing = {
          key,
          categoryName,
          isChq,
          thickness: s.thickness,
          material: s.material,
          sheetLength: s.sheetLength,
          sheetWidth: s.sheetWidth,
          sheets: [],
        };
        map.set(key, existing);
      }
      existing.sheets.push(s);
    }

    return [...map.values()].sort((a, b) => a.thickness - b.thickness || (a.isChq ? -1 : 1));
  }, [result.sheets]);

  const totalUsedAreaMm2 = result.sheets.reduce((acc, s) => acc + s.usedArea, 0);
  const totalSheetAreaMm2 = result.sheets.reduce((acc, s) => acc + s.sheetLength * s.sheetWidth, 0);
  const totalWastedAreaMm2 = totalSheetAreaMm2 - totalUsedAreaMm2;
  const avgUtilization = (totalUsedAreaMm2 / totalSheetAreaMm2) * 100;
  const avgWasted = 100 - avgUtilization;

  let totalCutLengthMm = 0;
  for (const s of result.sheets) {
    totalCutLengthMm += s.placed.reduce((sum, p) => sum + p.w + p.h, 0);
  }

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

  const stockSheetSummaryStr = sheetsByGroup
    .map((g) => `${g.categoryName} (${g.sheetLength}×${g.sheetWidth}) x${g.sheets.length}`)
    .join(" | ");

  const handlePrint = () => {
    window.print();
  };

  const scalePresets = [0.8, 1.0, 1.2, 1.5, 1.8, 2.2];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md pdf-report-overlay print:static print:inset-auto print:block print:bg-white print:overflow-visible print:h-auto print:w-full">
      {/* Sticky Top Action Header */}
      <div className="sticky top-0 z-50 shrink-0 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 sm:px-8 py-3 shadow-xl print:hidden flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <ArrowLeft className="mr-1.5 size-4" /> Back to Layouts
            </Button>
          )}
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Cut List Optimizer PDF Report {file?.name ? `— ${file.name}` : ""}</span>
            </h2>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {file?.name ? `Source: ${file.name} · ` : ""}Standing vertical plate drawings (1250×6000mm) · Maximum drawing area & legibility
            </p>
          </div>
        </div>

        {/* Dynamic Controls: Orientation & PDF Text Scale */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Orientation Toggle */}
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 rounded-lg">
            <RotateCw className="size-3.5 text-amber-400 mr-1" />
            <span className="text-xs font-semibold text-slate-300 mr-1">Plate Mode:</span>
            <button
              onClick={() => setOrientation("standing")}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors ${
                orientation === "standing"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Standing ↕ (Vertical)
            </button>
            <button
              onClick={() => setOrientation("sleeping")}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors ${
                orientation === "sleeping"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Sleeping ↔ (Horizontal)
            </button>
          </div>

          {/* Text Size Controls */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
            <Type className="size-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300 mr-1">Text Size:</span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 h-7 w-7 text-slate-300 hover:bg-slate-700 hover:text-white"
              onClick={() => setPdfTextScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(1))))}
              title="Decrease text size"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <div className="flex items-center gap-1">
              {scalePresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPdfTextScale(preset)}
                  className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded transition-colors ${
                    Math.abs(pdfTextScale - preset) < 0.05
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {Math.round(preset * 100)}%
                </button>
              ))}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 h-7 w-7 text-slate-300 hover:bg-slate-700 hover:text-white"
              onClick={() => setPdfTextScale((s) => Math.min(3.0, Number((s + 0.1).toFixed(1))))}
              title="Increase text size"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </div>

          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
          >
            <Printer className="mr-1.5 size-4" /> Print / Save PDF ({result.sheets.length} Sheets)
          </Button>
        </div>
      </div>

      {/* Main Printable Canvas Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible print:block print:h-auto print:max-h-none print:w-full">
        <div
          ref={reportRef}
          id="pdf-print-area"
          className="mx-auto max-w-[1100px] bg-white text-slate-900 p-6 shadow-2xl rounded-none print:shadow-none print:m-0 print:w-full print:p-2 font-sans text-xs print:block print:h-auto print:overflow-visible"
        >
          {/* Cover Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  SteelNest AI — Industrial Fabrication Cut List Report
                </h1>
                {file?.name ? (
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    Source Document / Model: <span className="font-mono text-slate-900 font-bold">{file.name}</span> ({result.sheets.length} Sheets Nested)
                  </p>
                ) : null}
              </div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Powered by 1810 Systems
              </span>
            </div>

            <div className="grid grid-cols-12 gap-3 text-[10.5px] leading-snug">
              <div className="col-span-6 space-y-0.5">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total Stock Sheets</span>
                  <span className="font-mono font-bold text-slate-900">
                    {result.sheets.length} Sheets ({sheetsByGroup.length} Material Groups)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total Used Area / Yield</span>
                  <span className="font-mono text-slate-900">
                    {Math.round(totalUsedAreaMm2).toLocaleString()} mm²{" "}
                    <strong className="text-emerald-700">{avgUtilization.toFixed(1)}% Yield</strong>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Total Scrap Area</span>
                  <span className="font-mono text-slate-900">
                    {Math.round(totalWastedAreaMm2).toLocaleString()} mm² ({avgWasted.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Kerf / Blade Allowance</span>
                  <span className="font-mono text-slate-900">{result.config.kerf} mm</span>
                </div>
              </div>

              <div className="col-span-6 space-y-1 border-l border-slate-200 pl-3">
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Nested Panel Breakdown:</span>
                  <p className="text-[9.5px] text-slate-600 font-mono leading-normal break-words max-h-12 overflow-hidden">
                    {panelSummaryStr}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Stock Sheet Inventory:</span>
                  <p className="text-[9.5px] text-slate-800 font-mono font-semibold">
                    {stockSheetSummaryStr}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grouped Sheets Section */}
          <div className="space-y-6">
            {sheetsByGroup.map((group, groupIdx) => (
              <div
                key={group.key}
                className={`space-y-3 ${groupIdx > 0 ? "print:break-before-page" : ""}`}
              >
                {/* Category Banner */}
                <div
                  className={`border-b-2 px-3 py-2 shadow-xs flex flex-wrap items-center justify-between rounded print:break-after-avoid ${
                    group.isChq
                      ? "bg-amber-950 text-white border-amber-600"
                      : "bg-slate-900 text-white border-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-extrabold text-[11px] tracking-wider uppercase px-2.5 py-0.5 rounded font-mono ${
                        group.isChq ? "bg-amber-400 text-slate-950" : "bg-blue-400 text-slate-950"
                      }`}
                    >
                      {group.isChq ? "CHEQUERED PLATE" : "STANDARD MS PLATE"}: {group.thickness}mm
                    </span>
                    <span className="font-bold text-xs text-slate-200">
                      Stock Sheet Size: {group.sheetLength} × {group.sheetWidth} mm
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-mono font-semibold text-slate-300">
                    Total Sheets:{" "}
                    <strong className="text-amber-300">{group.sheets.length} {group.sheets.length === 1 ? "SHEET" : "SHEETS"}</strong> (
                    {group.sheets.map((s) => s.id).join(", ")})
                  </div>
                </div>

                {/* SIDE-BY-SIDE GRID FOR STANDING VERTICAL SHEETS */}
                <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 items-start">
                  {group.sheets.map((sheet) => {
                    const sheetAreaMm2 = sheet.sheetLength * sheet.sheetWidth;
                    const sheetWastedMm2 = sheetAreaMm2 - sheet.usedArea;
                    const sheetUtil = (sheet.usedArea / sheetAreaMm2) * 100;
                    const sheetWaste = 100 - sheetUtil;

                    const sheetPanelQtyMap = new Map<string, number>();
                    for (const p of sheet.placed) {
                      const key = `${p.w}×${p.h}`;
                      sheetPanelQtyMap.set(key, (sheetPanelQtyMap.get(key) || 0) + 1);
                    }

                    const seqResult = generateCuttingSequence(sheet);

                    // Compute dimensions based on Standing (vertical) vs Sleeping (horizontal) orientation
                    const isStanding = orientation === "standing";
                    
                    // Standing mode: X = Sheet Width (1250), Y = Sheet Length (6000)
                    // Sleeping mode: X = Sheet Length (6000), Y = Sheet Width (1250)
                    const svgW = isStanding ? sheet.sheetWidth : sheet.sheetLength;
                    const svgH = isStanding ? sheet.sheetLength : sheet.sheetWidth;

                    return (
                      <div
                        key={sheet.id}
                        className="border border-slate-400 rounded bg-white p-3 space-y-2 shadow-xs print:break-inside-avoid"
                      >
                        {/* Sheet Title Bar */}
                        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 bg-slate-100 -mx-3 -mt-3 p-2.5 rounded-t font-mono">
                          <span className="font-bold text-xs text-slate-900">
                            Sheet {sheet.id} ({sheet.sheetLength}×{sheet.sheetWidth} - {group.isChq ? "CHQ" : "MS"})
                          </span>
                          <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                            {sheetUtil.toFixed(1)}% Yield
                          </span>
                        </div>

                        {/* TABLE ON LEFT, DIAGRAM ON RIGHT */}
                        <div className="grid grid-cols-12 gap-3 items-start pt-1">
                          {/* LEFT COLUMN: METRICS & CUT PART TABLES */}
                          <div className="col-span-5 space-y-2.5">
                            <table className="w-full text-[10px] border border-slate-300 border-collapse">
                              <thead>
                                <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                                  <th className="px-1.5 py-0.5 text-left" colSpan={2}>
                                    Sheet Specs
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 font-mono">
                                <tr>
                                  <td className="px-1.5 py-0.5 text-slate-600 font-medium">Used Yield</td>
                                  <td className="px-1.5 py-0.5 text-right font-bold text-emerald-700">
                                    {sheetUtil.toFixed(1)}%
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-1.5 py-0.5 text-slate-600 font-medium">Scrap Area</td>
                                  <td className="px-1.5 py-0.5 text-right text-rose-700 font-semibold">
                                    {sheetWaste.toFixed(1)}%
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-1.5 py-0.5 text-slate-600 font-medium">Parts Count</td>
                                  <td className="px-1.5 py-0.5 text-right font-bold text-slate-900">
                                    {sheet.placed.length} Pcs
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-1.5 py-0.5 text-slate-600 font-medium">Cut Length</td>
                                  <td className="px-1.5 py-0.5 text-right text-slate-900 font-semibold text-[9px]">
                                    {seqResult.totalCutLength.toLocaleString()}mm
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Cut Parts Quantity Summary Table */}
                            <table className="w-full text-[9.5px] border border-slate-300 border-collapse">
                              <thead>
                                <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                                  <th className="px-1.5 py-0.5 text-left">Nested Size</th>
                                  <th className="px-1.5 py-0.5 text-right">Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 font-mono text-[9px]">
                                {[...sheetPanelQtyMap.entries()].map(([dim, qty]) => (
                                  <tr key={dim}>
                                    <td className="px-1.5 py-0.5 text-slate-800 font-medium">{dim} mm</td>
                                    <td className="px-1.5 py-0.5 text-right text-slate-900 font-bold">x{qty}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* RIGHT COLUMN: STANDING VERTICAL VECTOR CAD BLUEPRINT */}
                          <div className="col-span-7">
                            <div className="relative border-2 border-slate-800 bg-white p-2 shadow-xs rounded flex justify-center">
                              <svg
                                viewBox={`-50 -50 ${svgW + 100} ${svgH + 100}`}
                                className="w-full h-auto overflow-visible"
                                style={{ maxHeight: isStanding ? "420px" : "auto" }}
                              >
                                {/* Stock Plate Outer Outline */}
                                <rect
                                  x={0}
                                  y={0}
                                  width={svgW}
                                  height={svgH}
                                  fill="#f8fafc"
                                  stroke="#0f172a"
                                  strokeWidth={3}
                                />

                                {/* Top/Horizontal Dimension Line (Width if standing, Length if sleeping) */}
                                <line
                                  x1={0}
                                  y1={-25}
                                  x2={svgW}
                                  y2={-25}
                                  stroke="#dc2626"
                                  strokeWidth={2}
                                />
                                <line x1={0} y1={-35} x2={0} y2={-15} stroke="#dc2626" strokeWidth={2} />
                                <line x1={svgW} y1={-35} x2={svgW} y2={-15} stroke="#dc2626" strokeWidth={2} />
                                <text
                                  x={svgW / 2}
                                  y={-38}
                                  textAnchor="middle"
                                  fill="#dc2626"
                                  fontSize={(isStanding ? 48 : 28) * pdfTextScale}
                                  fontWeight="extrabold"
                                  fontFamily="sans-serif"
                                >
                                  {(isStanding ? sheet.sheetWidth : sheet.sheetLength).toLocaleString()} mm
                                </text>

                                {/* Right/Vertical Dimension Line (Length if standing, Width if sleeping) */}
                                <line
                                  x1={svgW + 25}
                                  y1={0}
                                  x2={svgW + 25}
                                  y2={svgH}
                                  stroke="#dc2626"
                                  strokeWidth={2}
                                />
                                <line x1={svgW + 15} y1={0} x2={svgW + 35} y2={0} stroke="#dc2626" strokeWidth={2} />
                                <line x1={svgW + 15} y1={svgH} x2={svgW + 35} y2={svgH} stroke="#dc2626" strokeWidth={2} />
                                <text
                                  x={svgW + 48}
                                  y={svgH / 2}
                                  textAnchor="middle"
                                  fill="#dc2626"
                                  fontSize={(isStanding ? 48 : 28) * pdfTextScale}
                                  fontWeight="extrabold"
                                  fontFamily="sans-serif"
                                  transform={`rotate(90, ${svgW + 48}, ${svgH / 2})`}
                                >
                                  {(isStanding ? sheet.sheetLength : sheet.sheetWidth).toLocaleString()} mm
                                </text>

                                {/* Render Nested Parts with Orientation Mapping */}
                                {sheet.placed.map((p, pIdx) => {
                                  const pastelFills = [
                                    "#cbd5e1", // Slate
                                    "#fbcfe8", // Pink
                                    "#fed7aa", // Orange
                                    "#d9f99d", // Lime
                                    "#ccfbf1", // Teal
                                    "#e0e7ff", // Indigo
                                  ];
                                  const fillColor = pastelFills[pIdx % pastelFills.length];

                                  // Standing mode transforms:
                                  // X' = p.y, Y' = p.x, W' = p.h, H' = p.w
                                  const px = isStanding ? p.y : p.x;
                                  const py = isStanding ? p.x : p.y;
                                  const pw = isStanding ? p.h : p.w;
                                  const ph = isStanding ? p.w : p.h;

                                  const baseItemFontSize = Math.max(16, Math.min(pw / 6.5, ph / 4, 52));
                                  const baseDimFontSize = Math.max(14, Math.min(pw / 8, ph / 4.8, 40));

                                  const itemFontSize = baseItemFontSize * pdfTextScale;
                                  const dimFontSize = baseDimFontSize * pdfTextScale;

                                  return (
                                    <g key={p.key}>
                                      {/* Part Rect */}
                                      <rect
                                        x={px}
                                        y={py}
                                        width={pw}
                                        height={ph}
                                        fill={fillColor}
                                        stroke="#1e293b"
                                        strokeWidth={2}
                                      />

                                      {/* Item Mark Center Text */}
                                      <text
                                        x={px + pw / 2}
                                        y={py + ph / 2 - itemFontSize * 0.55}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill="#0f172a"
                                        fontSize={itemFontSize}
                                        fontWeight="extrabold"
                                        fontFamily="sans-serif"
                                        stroke="#ffffff"
                                        strokeWidth={1.5}
                                        paintOrder="stroke fill"
                                      >
                                        {p.part.item}
                                      </text>

                                      {/* Cut Size W × H Text */}
                                      <text
                                        x={px + pw / 2}
                                        y={py + ph / 2 + dimFontSize * 0.55}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill="#0369a1"
                                        fontSize={dimFontSize}
                                        fontWeight="bold"
                                        fontFamily="monospace"
                                        stroke="#ffffff"
                                        strokeWidth={1.5}
                                        paintOrder="stroke fill"
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
