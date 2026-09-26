import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  Table2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scissors,
  Pencil,
  Trash2,
  Plus,
  Sparkles,
  FileText,
  FileImage,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTransition } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { store, useAppState } from "@/lib/store";
import { parseExcelFile, type RejectedPart } from "@/lib/excel-parser";
import { processDocumentOcr, type OcrProgress } from "@/lib/ocr-parser";
import { ExcelWorkbook } from "@/components/app/excel-workbook";
import { OptimizationTimerModal } from "@/components/app/optimization-timer-modal";
import { partWeight, type Part } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({
    meta: [
      { title: "Upload BOM & OCR Blueprint — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Upload Excel (.xlsx, .xls, .csv) or Image/PDF blueprints for deep OCR extraction & editable BOM tables.",
      },
      { property: "og:title", content: "Upload BOM & OCR Blueprint — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Upload Excel (.xlsx, .xls, .csv) or Image/PDF blueprints for deep OCR extraction & editable BOM tables.",
      },
    ],
  }),
  component: UploadPage,
});

const accepted = [
  { icon: FileSpreadsheet, label: "Excel (.xlsx, .xls)" },
  { icon: Table2, label: "CSV (.csv)" },
  { icon: FileImage, label: "Image Blueprint (OCR)" },
  { icon: FileText, label: "PDF Drawing (OCR)" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function UploadPage() {
  const navigate = useNavigate();
  const { file, parts, rejectedParts, config } = useAppState();
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);

  // Restore Modal State
  const [restoringRejected, setRestoringRejected] = useState<RejectedPart | null>(null);
  const [restoreForm, setRestoreForm] = useState({
    item: "",
    description: "",
    material: "IS:2062 E250A",
    thickness: 10,
    length: 1000,
    width: 500,
    qty: 1,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const processSelectedFile = useCallback(
    async (selectedFile: File | undefined) => {
      if (!selectedFile) return;
      setErrorMsg(null);
      setParsing(true);
      setOcrProgress(null);

      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      const isOcr = ["jpg", "jpeg", "png", "bmp", "webp", "pdf"].includes(ext || "");
      const isExcel = ["xlsx", "xls", "csv"].includes(ext || "");

      if (!isExcel && !isOcr) {
        setParsing(false);
        setErrorMsg("Please select an Excel (.xlsx, .xls, .csv), Image (.png, .jpg), or PDF document.");
        toast.error("Unsupported file format", {
          description: "Please upload an Excel spreadsheet, Image, or PDF document.",
        });
        return;
      }

      if (isOcr) {
        try {
          const { parts: ocrParts } = await processDocumentOcr(selectedFile, (progress) => {
            setOcrProgress(progress);
          });

          const fileInfo = {
            name: selectedFile.name,
            size: selectedFile.size,
            type: (ext || "OCR").toUpperCase(),
            rows: ocrParts.length,
            materials: new Set(ocrParts.map((p) => p.material)).size || 1,
          };

          store.setParsedParts(fileInfo, ocrParts, []);
          setParsing(false);
          setOcrProgress(null);

          toast.success("OCR Image Processing Complete!", {
            description: `Extracted ${ocrParts.length} components using deep optical recognition. You can edit the table below if needed.`,
          });
        } catch (ocrErr: any) {
          setParsing(false);
          setOcrProgress(null);
          const msg = ocrErr?.message || "OCR extraction failed. Please try uploading a clearer image.";
          setErrorMsg(msg);
          toast.error("OCR Extraction Error", { description: msg });
        }
        return;
      }

      try {
        const { parts: parsedParts, rejectedParts: parsedRejected, materialsCount } = await parseExcelFile(selectedFile);

        const fileInfo = {
          name: selectedFile.name,
          size: selectedFile.size,
          type: (ext || "XLSX").toUpperCase(),
          rows: parsedParts.length + parsedRejected.length,
          materials: materialsCount,
        };

        store.setParsedParts(fileInfo, parsedParts, parsedRejected);
        setParsing(false);

        toast.success("Excel BOM Processed!", {
          description: `Extracted ${parsedParts.length} valid plate items. ${parsedRejected.length ? `${parsedRejected.length} items excluded.` : ""}`,
        });
      } catch (err: any) {
        setParsing(false);
        const msg = err?.message || "Failed to parse Excel file. Please check sheet column headers.";
        setErrorMsg(msg);
        toast.error("Excel Parsing Error", { description: msg });
      }
    },
    [],
  );

  const handleProceedNext = () => {
    setShowVerifyModal(true);
  };

  const confirmAndNavigate = () => {
    setShowVerifyModal(false);
    setShowTimerModal(true);
  };

  const handleSaveRestoredPart = () => {
    if (!restoringRejected) return;
    if (restoreForm.length <= 0 || restoreForm.width <= 0) {
      toast.error("Invalid dimensions", { description: "Length and Width must be greater than 0 mm." });
      return;
    }

    const restoredPart: Part = {
      id: `part-restored-${Date.now()}`,
      item: restoreForm.item || restoringRejected.item,
      description: restoreForm.description || restoringRejected.description,
      material: restoreForm.material || restoringRejected.material,
      thickness: Number(restoreForm.thickness) || 10,
      length: Number(restoreForm.length),
      width: Number(restoreForm.width),
      qty: Number(restoreForm.qty) || 1,
    };

    store.restoreRejectedPart(restoringRejected.id, restoredPart);
    toast.success(`Restored ${restoredPart.item}`, {
      description: "Dimensions added! Moved component to valid nesting line items.",
    });
    setRestoringRejected(null);
  };

  return (
    <PageTransition>
      <OptimizationTimerModal
        isOpen={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        targetRoute="/layouts"
      />

      <PageHeader
        eyebrow="STEP 1"
        title="Fabrication BOM Entry & Drawing Upload"
        description="Copy & paste directly into the interactive Excel workbook, drag to auto-fill values, or drop your Excel (.xlsx, .csv) / PDF & Image blueprint below."
      />

      {/* Upload Drop Zone & Highlighted Upload Button at Top */}
      <div className="relative mb-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            processSelectedFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed bg-card px-6 py-7 sm:py-8 transition-all shadow-soft group",
            dragging
              ? "border-primary bg-primary-soft shadow-lift"
              : "hover:border-primary/60 hover:bg-primary-soft/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.bmp,.webp,.pdf"
            onChange={(e) => processSelectedFile(e.target.files?.[0])}
          />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 text-left">
            <div className="flex items-center gap-4">
              <motion.div
                animate={dragging ? { y: -4, scale: 1.06 } : { y: [0, -3, 0] }}
                transition={dragging ? { duration: 0.2 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="grid size-14 place-items-center rounded-2xl bg-brand-gradient shadow-lift shrink-0"
              >
                <UploadCloud className="size-7 text-primary-foreground" />
              </motion.div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {dragging
                    ? "Drop your file here to auto-populate Excel table"
                    : "Click to select or drag & drop Excel, Image, or PDF Drawing"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Supports .xlsx, .xls, .csv, .jpg, .png, .webp & .pdf steel fabrication drawings & BOM blueprints
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {accepted.map((a) => (
                    <span
                      key={a.label}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs"
                    >
                      <a.icon className="size-3 text-emerald-600" /> {a.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Next to this: Small highlighted upload button */}
            <div className="shrink-0 flex items-center gap-2">
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/50 hover:ring-emerald-300 transition-all cursor-pointer flex items-center gap-2 shrink-0 animate-pulse hover:animate-none"
                title="Select Excel, CSV or Drawing from computer"
              >
                <UploadCloud className="size-4" />
                <span>Upload File</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Parsing Status Indicator */}
      <AnimatePresence>
        {parsing && !ocrProgress ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border bg-card p-6 shadow-soft flex items-center gap-4"
          >
            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <div>
              <p className="font-semibold text-foreground text-sm">Reading and Parsing Excel BOM...</p>
              <p className="text-xs text-muted-foreground">Extracting plate item marks, dimensions, material grades, and thickness.</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* OCR Step-by-Step Tile Progress Panel */}
      <AnimatePresence>
        {ocrProgress ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border bg-card shadow-soft overflow-hidden"
          >
            {/* Header */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-500/20 grid place-items-center text-amber-600 shrink-0">
                  <Sparkles className="size-5 animate-pulse" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">
                    Deep OCR Tile-Scanning in Progress
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
                    {ocrProgress.message}
                  </p>
                </div>
              </div>
              <span className="font-mono font-extrabold text-xl text-primary bg-primary-soft px-4 py-1.5 rounded-xl tabular-nums shrink-0">
                {ocrProgress.percent}%
              </span>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border">
                <motion.div
                  className="bg-brand-gradient h-full rounded-full shadow-lift"
                  animate={{ width: `${ocrProgress.percent}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>

              {/* Step indicators */}
              <div className="grid grid-cols-5 gap-2 text-[10px] text-center font-semibold">
                {[
                  { n: 1, label: "Render & Preprocess" },
                  { n: 2, label: "Init OCR Worker" },
                  { n: 3, label: "Tile Division" },
                  { n: 4, label: "Tile-by-Tile OCR Scan" },
                  { n: 5, label: "Parse & BOM Build" },
                ].map(({ n, label }) => {
                  const done    = ocrProgress.step > n;
                  const active  = ocrProgress.step === n;
                  return (
                    <div
                      key={n}
                      className={cn(
                        "p-2 rounded-xl border transition-all",
                        done   ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        active ? "border-amber-500  bg-amber-500/10  text-amber-700 dark:text-amber-400 animate-pulse" :
                                 "border-border text-muted-foreground"
                      )}
                    >
                      <div className="text-base mb-0.5">
                        {done ? "✓" : active ? "⟳" : String(n)}
                      </div>
                      <div className="leading-tight">{label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Tip box — shows scanning strategy when on step 4 */}
              {ocrProgress.step === 4 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs text-sky-800 dark:text-sky-300">
                  <Info className="size-4 shrink-0 mt-0.5 text-sky-500" />
                  <span>
                    <strong>Tile scanning active:</strong> the document has been divided into equal horizontal sections.
                    Each section is zoomed and scanned independently using dual PSM-6 + PSM-11 passes for
                    maximum accuracy — this may take 15–60 seconds depending on document size.
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>


      {/* Error Alert Box */}
      <AnimatePresence>
        {errorMsg ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 flex items-start gap-3 text-destructive"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Parsing / OCR Processing Notice</p>
              <p className="text-xs mt-0.5">{errorMsg}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Interactive Excel Workbook with Direct Paste & Drag-to-Fill & Auto-Populate from Uploaded File */}
      <ExcelWorkbook
        importedParts={parts}
        importedFileName={file?.name}
        onApplied={() => {
          setShowVerifyModal(true);
        }}
      />

      {/* REJECTED / UNPARSEABLE ITEMS TABLE (Only displayed if any items were excluded) */}
      <AnimatePresence>
        {file && rejectedParts.length > 0 && !parsing ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-6"
          >
            {/* REJECTED / UNPARSEABLE ITEMS TABLE */}
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-soft space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-destructive/20 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="size-5" />
                    <h3 className="font-bold text-base">
                      Rejected & Excluded Line Items ({rejectedParts.length} Items Excluded)
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Items missing cut dimensions or exceeding maximum stock sheet limits. Use <strong>Auto-Split</strong> or <strong>Add Dimensions</strong> to restore them into nesting.
                  </p>
                </div>

                <span className="rounded-full bg-destructive/15 text-destructive font-bold text-xs px-3 py-1 border border-destructive/30 shrink-0">
                  Action Required
                </span>
              </div>

                <div className="overflow-x-auto rounded-xl border border-destructive/20 bg-card">
                  <table className="w-full text-xs">
                    <thead className="bg-destructive/10 text-destructive uppercase font-semibold">
                      <tr className="border-b border-destructive/20">
                        <th className="px-3 py-2.5 text-left">#</th>
                        <th className="px-3 py-2.5 text-left">Item Mark</th>
                        <th className="px-3 py-2.5 text-left">Description</th>
                        <th className="px-3 py-2.5 text-left">Material Grade</th>
                        <th className="px-3 py-2.5 text-right">Raw Thk</th>
                        <th className="px-3 py-2.5 text-right">Raw Len</th>
                        <th className="px-3 py-2.5 text-right">Raw Wid</th>
                        <th className="px-3 py-2.5 text-center">Raw Qty</th>
                        <th className="px-3 py-2.5 text-left">Rejection Cause</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rejectedParts.map((r, idx) => {
                        const isOversized = /exceeds|20,?000|12,?000/i.test(r.reason);

                        return (
                          <tr key={r.id} className="border-b border-destructive/10 hover:bg-destructive/5">
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-bold text-foreground">{r.item}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.description}</td>
                            <td className="px-3 py-2 font-medium">{r.material}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.rawThk}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.rawLen}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.rawWid}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.rawQty}</td>
                            <td className="px-3 py-2 font-semibold text-destructive">
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="size-3.5 shrink-0" />
                                {r.reason}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isOversized ? (
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1"
                                    onClick={() => {
                                      const segLen = config.sheetLength || 6000;
                                      store.splitOversizedPart(r.id, segLen);
                                      toast.success("Auto-Split Applied!", {
                                        description: `Split ${r.item} into ${segLen}mm standard stock segments and moved to nesting.`,
                                      });
                                    }}
                                  >
                                    <Scissors className="size-3" /> Auto-Split ({((config.sheetLength || 6000) / 1000).toFixed(1)}m)
                                  </Button>
                                ) : null}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] font-semibold gap-1"
                                  onClick={() => {
                                    const len = parseFloat((r.rawLen || "").replace(/[^0-9.]/g, "")) || 1000;
                                    const wid = parseFloat((r.rawWid || "").replace(/[^0-9.]/g, "")) || 500;
                                    const thk = parseFloat((r.rawThk || "").replace(/[^0-9.]/g, "")) || 10;
                                    const qty = parseInt((r.rawQty || "").replace(/[^0-9]/g, ""), 10) || 1;

                                    setRestoreForm({
                                      item: r.item,
                                      description: r.description,
                                      material: r.material || "IS:2062 E250A",
                                      thickness: thk,
                                      length: len,
                                      width: wid,
                                      qty,
                                    });
                                    setRestoringRejected(r);
                                  }}
                                >
                                  <Pencil className="size-3" /> Edit Details
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    store.removeRejectedPart(r.id);
                                    toast.success(`${r.item} removed from rejected list.`);
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            {/* Bottom Action Row */}
            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={handleProceedNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft"
              >
                Next — Proceed to Optimization <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Verification Confirmation Modal Dialog */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
              <ShieldAlert className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Verify Extracted Content
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Please verify that all component names, dimensions, and quantities from your file are correctly detected.
            </DialogDescription>
          </DialogHeader>

          {/* Active File & Detected Parts Snapshot */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs border-b pb-2">
              <span className="flex items-center gap-1.5 font-bold text-foreground">
                <FileSpreadsheet className="size-4 text-emerald-600" />
                {file?.name || "BOM File"}
              </span>
              <span className="font-mono text-[11px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded font-bold">
                {parts.length} Items Detected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-muted-foreground font-sans">Total Qty:</span>{" "}
                <strong className="text-foreground">{parts.reduce((s, p) => s + p.qty, 0).toLocaleString()} pcs</strong>
              </div>
              <div>
                <span className="text-muted-foreground font-sans">Thicknesses:</span>{" "}
                <strong className="text-primary">{Array.from(new Set(parts.map((p) => `${p.thickness}mm`))).join(", ") || "-"}</strong>
              </div>
            </div>
            {/* Quick Part Marks Preview */}
            <div className="pt-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Detected Marks Sample:
              </p>
              <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                {parts.slice(0, 8).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded bg-background border px-1.5 py-0.5 text-[10px] font-mono text-foreground shadow-2xs"
                  >
                    <span className="font-bold text-primary">{p.item}</span>
                    <span className="text-muted-foreground text-[9px]">({p.length}×{p.width})</span>
                  </span>
                ))}
                {parts.length > 8 ? (
                  <span className="text-[10px] text-muted-foreground self-center pl-1 font-mono">
                    +{parts.length - 8} more
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-bold flex items-center gap-1.5">
              <Info className="size-4 shrink-0" /> Small Verification Note:
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              Kindly double-check your total items, plate thickness values, and quantities carefully before nesting.
            </p>
          </div>

          {/* Consider Grade of Material Checkbox */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.groupByMaterial ?? false}
                onChange={(e) => {
                  store.set({
                    config: { ...config, groupByMaterial: e.target.checked },
                  });
                  toast.success(
                    e.target.checked
                      ? "Nesting strategy: Nesting on SEPARATE sheets by material grade"
                      : "Nesting strategy: COMBINING all grades on same thickness sheet"
                  );
                }}
                className="mt-0.5 size-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">
                  Consider grade of material (if any)?
                </span>
                <span className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  {config.groupByMaterial
                    ? "Checked: Separate plates into distinct sheets by steel material grade (e.g. IS:2062, SS304, E250)."
                    : "Unchecked: Combine items with identical thickness on the same sheet regardless of grade to maximize yield."}
                </span>
              </div>
            </label>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowVerifyModal(false)}
              className="w-full sm:w-auto"
            >
              Go Back & Review Table
            </Button>
            <Button
              onClick={confirmAndNavigate}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <CheckCircle className="mr-1.5 size-4" /> Yes, I Verified — Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit & Restore Missing Dimensions Dialog */}
      <Dialog open={!!restoringRejected} onOpenChange={(o) => !o && setRestoringRejected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-primary" /> Edit & Restore Item Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add genuine plate dimensions (L x W) and thickness for <strong>{restoringRejected?.item}</strong> to move it into active nesting line items.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Item Mark / Tag</Label>
              <Input
                value={restoreForm.item}
                onChange={(e) => setRestoreForm({ ...restoreForm, item: e.target.value })}
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={restoreForm.description}
                onChange={(e) => setRestoreForm({ ...restoreForm, description: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Material Grade</Label>
                <Input
                  value={restoreForm.material}
                  onChange={(e) => setRestoreForm({ ...restoreForm, material: e.target.value })}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Thickness (mm)</Label>
                <Input
                  type="number"
                  value={restoreForm.thickness}
                  onChange={(e) => setRestoreForm({ ...restoreForm, thickness: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Length (mm)</Label>
                <Input
                  type="number"
                  value={restoreForm.length}
                  onChange={(e) => setRestoreForm({ ...restoreForm, length: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Width (mm)</Label>
                <Input
                  type="number"
                  value={restoreForm.width}
                  onChange={(e) => setRestoreForm({ ...restoreForm, width: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  value={restoreForm.qty}
                  onChange={(e) => setRestoreForm({ ...restoreForm, qty: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setRestoringRejected(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRestoredPart}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
            >
              <Plus className="size-4" /> Save & Move to Nesting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
