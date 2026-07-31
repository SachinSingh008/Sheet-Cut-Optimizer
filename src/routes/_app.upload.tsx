import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useRef, useState } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Table2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTransition } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { store, useAppState } from "@/lib/store";
import { MOCK_PARTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({
    meta: [
      { title: "Upload BOM — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Drag and drop Excel, CSV, PDF or drawing images to extract your steel plate bill of materials.",
      },
      { property: "og:title", content: "Upload BOM — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Drag and drop Excel, CSV, PDF or drawing images to extract your steel plate bill of materials.",
      },
    ],
  }),
  component: UploadPage,
});

const accepted = [
  { icon: FileSpreadsheet, label: "XLSX / XLS" },
  { icon: Table2, label: "CSV" },
  { icon: FileText, label: "PDF" },
  { icon: ImageIcon, label: "PNG / JPG" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function UploadPage() {
  const navigate = useNavigate();
  const { file } = useAppState();
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setProgress(0);
    let p = 0;
    const timer = setInterval(() => {
      p += Math.random() * 18 + 6;
      if (p >= 100) {
        p = 100;
        clearInterval(timer);
        setUploading(false);
        store.setFile({
          name: f.name,
          size: f.size,
          type: f.name.split(".").pop() ?? "file",
          rows: MOCK_PARTS.length,
          materials: new Set(MOCK_PARTS.map((x) => x.material)).size,
        });
        toast.success("File uploaded", { description: `${f.name} is ready to parse.` });
      }
      setProgress(Math.round(p));
    }, 180);
  }, []);

  const parse = () => {
    setParsing(true);
    setTimeout(() => {
      store.parse();
      setParsing(false);
      toast.success("BOM parsed", { description: `${MOCK_PARTS.length} line items detected.` });
      navigate({ to: "/parse" });
    }, 1200);
  };

  return (
    <PageTransition>
      <PageHeader
        eyebrow="STEP 1"
        title="Upload your BOM"
        description="Drop a fabrication bill of materials and our parser extracts plate sizes, grades, thickness and quantities automatically."
        actions={
          <Button variant="outline" onClick={() => store.loadDemo()}>
            <Sparkles /> Use sample BOM
          </Button>
        }
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center transition-all sm:py-24",
          dragging ? "border-primary bg-primary-soft shadow-lift" : "hover:border-primary/60 hover:bg-primary-soft/40",
        )}
      >
        <div className="pointer-events-none absolute inset-0 grid-blueprint opacity-40" />
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
          onChange={(e) => handleFiles(e.target.files?.[0])}
        />
        <motion.div
          animate={dragging ? { y: -8, scale: 1.06 } : { y: [0, -6, 0] }}
          transition={dragging ? { duration: 0.2 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative mx-auto grid size-20 place-items-center rounded-3xl bg-brand-gradient shadow-lift"
        >
          <UploadCloud className="size-9 text-primary-foreground" />
        </motion.div>
        <h3 className="relative mt-6 text-xl font-semibold">
          {dragging ? "Release to upload" : "Drag & drop your file here"}
        </h3>
        <p className="relative mt-2 text-sm text-muted-foreground">
          or click to browse — max 25 MB per file
        </p>
        <div className="relative mt-7 flex flex-wrap justify-center gap-2">
          {accepted.map((a) => (
            <span
              key={a.label}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              <a.icon className="size-3.5" /> {a.label}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {uploading ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border bg-card p-6 shadow-soft"
          >
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Uploading & scanning…</span>
              <span className="tabular-nums text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="mt-3" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {file && !uploading ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border bg-card p-6 shadow-soft"
          >
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(file.size)} · {file.type.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { k: "File size", v: formatBytes(file.size) },
                { k: "Format", v: file.type.toUpperCase() },
                { k: "Rows detected", v: `${file.rows}` },
                { k: "Materials detected", v: `${file.materials}` },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border bg-background p-4">
                  <p className="text-xs font-medium text-muted-foreground">{s.k}</p>
                  <p className="mt-1 text-lg font-semibold">{s.v}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={parse} disabled={parsing}>
                {parsing ? "Parsing BOM…" : "Parse BOM"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => store.reset()}>
                <RotateCcw /> Reset
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </PageTransition>
  );
}
