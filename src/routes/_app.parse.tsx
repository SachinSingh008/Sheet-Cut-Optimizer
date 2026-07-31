import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { store, useAppState } from "@/lib/store";
import { partWeight, type Part } from "@/lib/mock-data";
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
  const { parts } = useAppState();
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "item", dir: 1 });
  const [editing, setEditing] = useState<Part | null>(null);

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
          description="Upload a BOM first, or load the sample bridge fabrication project to see parsed line items."
          action={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => store.loadDemo()}>
                Load demo
              </Button>
              <Button asChild>
                <Link to="/upload">Go to upload</Link>
              </Button>
            </div>
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
      <PageHeader
        eyebrow="STEP 2"
        title="Parse results"
        description="Every extracted line item, validated against plate-cutting rules. Fix flagged rows before nesting."
        actions={
          <Button asChild size="lg">
            <Link to="/thickness">
              Thickness groups <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total parts" value={totalPieces} icon={PackageSearch} hint={`${parts.length} BOM lines`} />
        <StatCard label="Unique materials" value={materials.length} icon={Boxes} tone="accent" delay={0.05} hint={materials.join(" · ")} />
        <StatCard label="Plate types" value={thicknesses} icon={Layers3} tone="warning" delay={0.1} hint="Distinct thicknesses" />
        <StatCard label="Estimated weight" value={weight} suffix=" kg" icon={Weight} tone="success" delay={0.15} hint="Net cut weight" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-soft"
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
          <span className="text-sm text-muted-foreground">{rows.length} rows</span>
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
                    <span className="inline-flex items-center gap-2">
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
                  <td className="px-4 py-3 tabular-nums font-medium">{p.qty}</td>
                  <td className="px-4 py-3 tabular-nums">{partWeight(p).toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          store.removePart(p.id);
                          toast.success(`${p.item} removed`);
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

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
