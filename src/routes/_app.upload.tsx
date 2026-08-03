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
import { EditableBomTable } from "@/components/app/editable-bom-table";
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
  const [showEditTable, setShowEditTable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isDeepOptimizing, setIsDeepOptimizing] = useState(false);
  const [optStep, setOptStep] = useState(0);

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
    setIsDeepOptimizing(true);
    setOptStep(1);

    setTimeout(() => setOptStep(2), 600);
    setTimeout(() => setOptStep(3), 1200);
    setTimeout(() => setOptStep(4), 1800);

    setTimeout(() => {
      store.runOptimization();
      setIsDeepOptimizing(false);
      toast.success("Deep Optimization Complete!", {
        description: "Simulated 100+ annealing trials & post-recompaction. Generated lowest sheet count layout.",
      });
      navigate({ to: "/parse" });
    }, 2400);
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
      <PageHeader
        eyebrow="STEP 1"
        title="Upload Fabrication BOM or OCR Blueprint"
        description="Select or drop your Excel (.xlsx, .csv) or Image/PDF drawing blueprints for OCR extraction. Review and edit plate dimensions in the table before optimizing."
      />

      {/* Upload Drop Zone */}
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
          "relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed bg-card px-6 py-12 text-center transition-all sm:py-16 shadow-soft",
          dragging ? "border-primary bg-primary-soft shadow-lift" : "hover:border-primary/60 hover:bg-primary-soft/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.bmp,.webp,.pdf"
          onChange={(e) => processSelectedFile(e.target.files?.[0])}
        />
        <motion.div
          animate={dragging ? { y: -8, scale: 1.06 } : { y: [0, -6, 0] }}
          transition={dragging ? { duration: 0.2 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-brand-gradient shadow-lift"
        >
          <UploadCloud className="size-8 text-primary-foreground" />
        </motion.div>
        <h3 className="relative mt-4 text-lg font-semibold">
          {dragging ? "Drop your file here" : "Click to select or drag & drop Excel, Image, or PDF Drawing"}
        </h3>
        <p className="relative mt-1 text-xs text-muted-foreground">
          Supports .xlsx, .xls, .csv, .jpg, .png, .webp & .pdf steel fabrication drawings & BOM blueprints
        </p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-2">
          {accepted.map((a) => (
            <span
              key={a.label}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
            >
              <a.icon className="size-3.5 text-emerald-600" /> {a.label}
            </span>
          ))}
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

      {/* Extracted BOM Data Table & Verification View */}
      <AnimatePresence>
        {file && (parts.length > 0 || rejectedParts.length > 0) && !parsing ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-6"
          >
            {/* File Info Summary Header */}
            <div className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                    <CheckCircle2 className="size-6" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)} · {file.type.toUpperCase()} · Extracted {parts.length} Valid Items ({rejectedParts.length} Excluded)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant={showEditTable ? "secondary" : "outline"}
                    onClick={() => setShowEditTable(!showEditTable)}
                  >
                    <Pencil className="mr-1.5 size-4" />
                    {showEditTable ? "View Static Table" : "Edit BOM Table (Inline)"}
                  </Button>
                  <Button variant="outline" onClick={() => store.reset()}>
                    <RotateCcw className="mr-1.5 size-4" /> Reset & Clear
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleProceedNext}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft"
                  >
                    Next — Proceed to Optimization <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                </div>
              </div>

              {/* Extraction Metrics */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 text-xs">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-muted-foreground font-medium">Valid Nesting Items</p>
                  <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">{parts.length}</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-muted-foreground font-medium">Excluded / Invalid Items</p>
                  <p className={cn("mt-1 text-lg font-bold", rejectedParts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                    {rejectedParts.length}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-muted-foreground font-medium">Total Quantity to Cut</p>
                  <p className="mt-1 text-lg font-bold text-primary">
                    {parts.reduce((sum, p) => sum + p.qty, 0).toLocaleString()} pcs
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-muted-foreground font-medium">Estimated Net Weight</p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {Math.round(parts.reduce((sum, p) => sum + partWeight(p), 0)).toLocaleString()} kg
                  </p>
                </div>
              </div>
            </div>

            {/* Editable BOM Table View */}
            {showEditTable ? (
              <EditableBomTable
                initialParts={parts}
                onSave={() => setShowEditTable(false)}
                isOcrResult={file.type === "PNG" || file.type === "JPG" || file.type === "PDF" || file.type === "OCR"}
              />
            ) : (
              /* Static Extracted BOM Data Table for User Verification */
              <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Table2 className="size-5 text-primary" />
                      <h3 className="font-bold text-base text-foreground">
                        Verify Extracted BOM Content ({parts.length} Valid Items)
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Inspect valid plate items below. Click <strong>Edit BOM Table</strong> above to change any cell directly.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEditTable(true)}
                    >
                      <Pencil className="mr-1.5 size-4" /> Edit Values
                    </Button>
                    <Button
                      size="default"
                      onClick={handleProceedNext}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0"
                    >
                      Next <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </div>
                </div>

              {/* Extraction Disclaimer Note & Material Grade Strategy */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                  <Info className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Verification Disclaimer Note:</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      Automated Excel extractors can occasionally misinterpret non-standard header titles or merged cells. Please verify that <strong>Item Marks</strong>, <strong>Material Grades</strong>, <strong>Thickness (mm)</strong>, <strong>Dimensions ($L \times W$)</strong>, and <strong>Quantities</strong> match your original bill of materials carefully before proceeding.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 p-3.5 text-xs">
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
                      <span className="font-bold text-foreground">
                        Consider grade of material (if any)?
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                        {config.groupByMaterial
                          ? "Yes — Separate sheets per material grade (e.g. IS:2062 vs SAILMA 350HI)."
                          : "No — Combine all grades with identical thickness on same sheet to minimize sheet count."}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Extracted Valid Line Items Table */}
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold">
                    <tr className="border-b">
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Item Mark</th>
                      <th className="px-3 py-2.5 text-left">Description</th>
                      <th className="px-3 py-2.5 text-left">Material Grade</th>
                      <th className="px-3 py-2.5 text-right">Thk (mm)</th>
                      <th className="px-3 py-2.5 text-right">Length (mm)</th>
                      <th className="px-3 py-2.5 text-right">Width (mm)</th>
                      <th className="px-3 py-2.5 text-center font-bold">Qty</th>
                      <th className="px-3 py-2.5 text-right">Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p, idx) => (
                      <tr key={p.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-foreground">{p.item}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className="rounded bg-primary-soft px-1.5 py-0.5 text-primary text-[11px]">
                            {p.material}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{p.thickness}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.length}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.width}</td>
                        <td className="px-3 py-2 text-center tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                          {p.qty}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono">
                          {partWeight(p).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* REJECTED / UNPARSEABLE ITEMS TABLE — PLACED JUST BELOW VERIFY EXTRACTED BOM CONTENT */}
            {rejectedParts.length > 0 && (
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
                                      store.splitOversizedPart(r.id, 6300);
                                      toast.success("Auto-Split Applied!", {
                                        description: `Split ${r.item} into 6,300mm standard stock segments and moved to nesting.`,
                                      });
                                    }}
                                  >
                                    <Scissors className="size-3" /> Auto-Split (6.3m)
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
            )}

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
              Have you verified whether all content and dimensions have been extracted properly from your Excel BOM file?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-bold flex items-center gap-1.5">
              <Info className="size-4 shrink-0" /> Small Verification Note:
            </p>
            <p className="mt-1 text-[11px] leading-relaxed">
              Extractor algorithms can occasionally make mistakes or misalign columns if the Excel headers vary. Kindly double-check your total items, plate thickness values, and quantities carefully before nesting.
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

      {/* Deep Optimization Progress Loader Modal */}
      <Dialog open={isDeepOptimizing} onOpenChange={() => {}}>
        <DialogContent className="max-w-md border-emerald-500/30 bg-slate-950 text-white dark:bg-slate-950">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-4 ring-emerald-500/10 animate-pulse">
              <Sparkles className="size-7 animate-spin text-emerald-400" />
            </div>
            <DialogTitle className="text-center text-xl font-extrabold text-white">
              Running Deep Multi-Pass Optimization...
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-400 mt-1">
              Executing 100+ stochastic annealing permutations & post-pass scrap compaction to achieve the absolute lowest sheet count.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2.5 text-xs">
              <div className={cn("flex items-center gap-2.5 transition-colors", optStep >= 1 ? "text-emerald-400 font-semibold" : "text-slate-500")}>
                <span className={cn("size-2 rounded-full", optStep >= 1 ? "bg-emerald-400 animate-ping" : "bg-slate-700")} />
                <span>1. Analyzing BOM thickness & material grade buckets</span>
              </div>
              <div className={cn("flex items-center gap-2.5 transition-colors", optStep >= 2 ? "text-emerald-400 font-semibold" : "text-slate-500")}>
                <span className={cn("size-2 rounded-full", optStep >= 2 ? "bg-emerald-400 animate-ping" : "bg-slate-700")} />
                <span>2. Simulating 100+ stochastic item placement permutations</span>
              </div>
              <div className={cn("flex items-center gap-2.5 transition-colors", optStep >= 3 ? "text-emerald-400 font-semibold" : "text-slate-500")}>
                <span className={cn("size-2 rounded-full", optStep >= 3 ? "bg-emerald-400 animate-ping" : "bg-slate-700")} />
                <span>3. Evaluating Best Short Side (BSSF) & Guillotine splits</span>
              </div>
              <div className={cn("flex items-center gap-2.5 transition-colors", optStep >= 4 ? "text-emerald-400 font-semibold" : "text-slate-500")}>
                <span className={cn("size-2 rounded-full", optStep >= 4 ? "bg-emerald-400 animate-ping" : "bg-slate-700")} />
                <span>4. Squeezing remnants & eliminating extra sheets</span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: "0%" }}
                animate={{ width: `${(optStep / 4) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
