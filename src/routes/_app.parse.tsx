import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Trash2,
  Pencil,
  AlertTriangle,
  ArrowUpDown,
  PackageSearch,
  Layers3,
  Boxes,
  Weight,
  ArrowRight,
  FileText,
  Printer,
  XCircle,
  Scissors,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { store, useAppState } from "@/lib/store";
import { partWeight, partArea, type Part } from "@/lib/mock-data";
import { type RejectedPart } from "@/lib/excel-parser";
import { PlateCutDiagramSection } from "@/components/app/plate-cut-diagram";
import { PlateTypeInventorySection } from "@/components/app/plate-type-inventory";
import { PdfLayoutReport } from "@/components/app/pdf-layout-report";
import { EditableBomTable } from "@/components/app/editable-bom-table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/parse")({
  head: () => ({
    meta: [
      { title: "Parse Results — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Review, search, filter and edit every extracted plate line item before nesting.",
      },
      { property: "og:title", content: "Parse Results — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Review, search, filter and edit every extracted plate line item before nesting.",
      },
    ],
  }),
  component: ParsePage,
});

type SortKey = "item" | "material" | "thickness" | "length" | "width" | "qty" | "weight";

function ParsePage() {
  const { parts, rejectedParts, result, config } = useAppState();
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "item", dir: 1 });
  const [editing, setEditing] = useState<Part | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showEditTable, setShowEditTable] = useState(false);

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

  const materials = useMemo(() => [...new Set(parts.map((p) => p.material))], [parts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = parts.filter(
      (p) =>
        (material === "all" || p.material === material) &&
        (!q ||
          `${p.item} ${p.description} ${p.material} ${p.thickness}`.toLowerCase().includes(q)),
    );
    return [...filtered].sort((a, b) => {
      const va = sort.key === "weight" ? partWeight(a) : a[sort.key];
      const vb = sort.key === "weight" ? partWeight(b) : b[sort.key];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [parts, query, material, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));

  if (!parts.length) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 2" title="Parse results" />
        <EmptyState
          title="Nothing parsed yet"
          description="Upload an Excel (.xlsx, .xls) or CSV fabrication bill of materials to view parsed line items."
          action={
            <Button asChild size="lg">
              <Link to="/upload">Upload Excel BOM</Link>
            </Button>
          }
        />
      </PageTransition>
    );
  }

  const totalPieces = parts.reduce((s, p) => s + p.qty, 0);
  const weight = parts.reduce((s, p) => s + partWeight(p), 0);
  const thicknesses = new Set(parts.map((p) => p.thickness)).size;

  const columns: Array<{ key: SortKey | null; label: string; className?: string }> = [
    { key: "item", label: "Item" },
    { key: null, label: "Description", className: "min-w-[220px]" },
    { key: "material", label: "Material" },
    { key: "thickness", label: "Thk (mm)" },
    { key: "length", label: "Length" },
    { key: "width", label: "Width" },
    { key: "qty", label: "Qty" },
    { key: "weight", label: "Weight (kg)" },
  ];

  return (
    <PageTransition>
      {showPdfModal && result && (
        <PdfLayoutReport result={result} onClose={() => setShowPdfModal(false)} />
      )}

      <PageHeader
        eyebrow="STEP 2"
        title="Parse Results"
        description="Validated BOM line items with interactive plate cut diagrams and cutting instructions."
        actions={
          <div className="flex items-center gap-3">
            {result && (
              <Button
                size="lg"
                onClick={() => setShowPdfModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft"
              >
                <FileText className="mr-1.5 size-4" /> Download / Export PDF
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/layouts">
                View Cut Layouts <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* Top 4 Metric Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total parts"
          value={totalPieces.toLocaleString()}
          icon={PackageSearch}
          hint={`${parts.length} BOM lines`}
        />
        <StatCard
          label="Unique materials"
          value={materials.length}
          icon={Boxes}
          tone="accent"
          delay={0.05}
          hint={materials.join(" · ")}
        />
        <StatCard
          label="Plate types"
          value={thicknesses}
          icon={Layers3}
          tone="warning"
          delay={0.1}
          hint="Distinct thicknesses"
        />
        <StatCard
          label="Estimated weight"
          value={`${Math.round(weight).toLocaleString()} kg`}
          icon={Weight}
          tone="success"
          delay={0.15}
          hint="Net cut weight"
        />
      </div>

      {/* Verification & Material Grade Nesting Strategy Toggle */}
      <div className="rounded-2xl border border-slate-300 bg-slate-50/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                BOM Verification & Material Grade Strategy
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Configure whether material grades should be separated onto different sheets or combined together by thickness to minimize overall sheet consumption.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-slate-400 shadow-sm transition-all select-none shrink-0">
            <input
              type="checkbox"
              checked={config.groupByMaterial ?? false}
              onChange={(e) => {
                store.set({
                  config: { ...config, groupByMaterial: e.target.checked },
                });
                toast.success(
                  e.target.checked
                    ? "Strategy: Nesting on SEPARATE sheets by material grade"
                    : "Strategy: COMBINING all grades on same thickness sheet (Minimizes sheet count)"
                );
              }}
              className="size-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Consider grade of material (if any)?
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {config.groupByMaterial ? "Yes — Separate sheets per grade" : "No — Combine all grades in same sheet"}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Plate Cutting Diagram Section (What, Where & How to Cut) */}
      <PlateCutDiagramSection result={result} />

      {/* Plate Types & Excel BOM Abbreviation Stock Size Inventory */}
      <PlateTypeInventorySection />

      {/* Followed by the Parsed Line Items Table */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-foreground">Extracted BOM Line Items</h3>
          <p className="text-xs text-muted-foreground">Search, filter, or edit part dimensions before final layout release.</p>
        </div>

        <Button
          variant={showEditTable ? "secondary" : "outline"}
          onClick={() => setShowEditTable(!showEditTable)}
        >
          <Pencil className="mr-1.5 size-4" />
          {showEditTable ? "View Static Table" : "Edit BOM Table (Inline)"}
        </Button>
      </div>

      {showEditTable ? (
        <EditableBomTable
          initialParts={parts}
          onSave={() => setShowEditTable(false)}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="overflow-hidden rounded-2xl border bg-card shadow-soft"
        >
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search item, description, material…"
              className="pl-9"
            />
          </div>
          <Select value={material} onValueChange={setMaterial}>
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All materials</SelectItem>
              {materials.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-medium text-muted-foreground">{rows.length} rows</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.label}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                      c.className,
                    )}
                  >
                    {c.key ? (
                      <button
                        onClick={() => toggleSort(c.key as SortKey)}
                        className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
                      >
                        {c.label}
                        <ArrowUpDown className="size-3" />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-t transition-colors hover:bg-muted/40",
                    p.invalid && "bg-destructive/8",
                  )}
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      {p.invalid ? (
                        <AlertTriangle className="size-4 text-destructive" aria-label={p.invalid} />
                      ) : null}
                      {p.item}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.description}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
                      {p.material}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.thickness}</td>
                  <td className="px-4 py-3 tabular-nums">{p.length}</td>
                  <td className="px-4 py-3 tabular-nums">{p.width}</td>
                  <td className="px-4 py-3 tabular-nums font-bold">{p.qty}</td>
                  <td className="px-4 py-3 tabular-nums font-mono">{partWeight(p).toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          store.removePart(p.id);
                          toast.success(`${p.item} removed`);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      )}

      {/* REJECTED / UNPARSEABLE ITEMS TABLE — PLACED JUST BELOW MAIN BOM CONTENT */}
      {rejectedParts.length > 0 && (
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-soft space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-destructive/20 pb-4">
            <div>
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" />
                <h3 className="font-bold text-base">
                  Rejected & Excluded Line Items ({rejectedParts.length} Items Excluded)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Items missing cut dimensions or exceeding maximum stock sheet limits. Use <strong>Auto-Split</strong> or <strong>Edit Details</strong> to restore them into nesting.
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
                                store.splitOversizedPart(r.id, 6000);
                                toast.success("Auto-Split Applied!", {
                                  description: `Split ${r.item} into 6,000mm standard stock segments (3x 6000mm + 1x 2000mm) and moved to nesting.`,
                                });
                              }}
                            >
                              <Scissors className="size-3" /> Auto-Split (6m)
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
              onClick={() => {
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
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
            >
              <Plus className="size-4" /> Save & Move to Nesting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.item}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["length", "Length (mm)"],
                  ["width", "Width (mm)"],
                  ["thickness", "Thickness (mm)"],
                  ["qty", "Quantity"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="grid gap-2">
                  <Label htmlFor={k}>{label}</Label>
                  <Input
                    id={k}
                    type="number"
                    value={editing[k]}
                    onChange={(e) =>
                      setEditing({ ...editing, [k]: Number(e.target.value) } as Part)
                    }
                  />
                </div>
              ))}
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editing) {
                  store.updatePart(editing.id, {
                    ...editing,
                    invalid: editing.width >= 100 ? null : editing.invalid ?? null,
                  });
                  toast.success(`${editing.item} updated`);
                }
                setEditing(null);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
