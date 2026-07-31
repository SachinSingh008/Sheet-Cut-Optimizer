import React, { useState } from "react";
import { Plus, Trash2, Check, AlertTriangle, Sparkles, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { store } from "@/lib/store";
import type { Part } from "@/lib/mock-data";
import { toast } from "sonner";

interface EditableBomTableProps {
  initialParts: Part[];
  onSave?: (parts: Part[]) => void;
  onCancel?: () => void;
  isOcrResult?: boolean;
}

export function EditableBomTable({
  initialParts,
  onSave,
  onCancel,
  isOcrResult = false,
}: EditableBomTableProps) {
  const [parts, setParts] = useState<Part[]>(
    initialParts.length > 0
      ? initialParts
      : [
          {
            id: `p-new-1-${Date.now()}`,
            item: "P-001",
            description: "WEB PLATE",
            material: "IS:2062 E250A",
            thickness: 10,
            length: 1200,
            width: 600,
            qty: 2,
          },
        ]
  );

  const handleUpdatePart = (id: string, field: keyof Part, value: any) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          [field]: field === "thickness" || field === "length" || field === "width" || field === "qty" ? Number(value) || 0 : value,
        };
      })
    );
  };

  const handleAddRow = () => {
    const newId = `p-add-${Date.now()}`;
    const nextNum = parts.length + 1;
    setParts((prev) => [
      ...prev,
      {
        id: newId,
        item: `P-${String(nextNum).padStart(3, "0")}`,
        description: "FLANGE / GUSSET PLATE",
        material: "IS:2062 E250A",
        thickness: 10,
        length: 1000,
        width: 500,
        qty: 1,
      },
    ]);
    toast.info("Added new empty row to BOM table");
  };

  const handleDeleteRow = (id: string) => {
    if (parts.length <= 1) {
      toast.error("BOM table must contain at least one component.");
      return;
    }
    setParts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = () => {
    // Validate
    const invalidRows = parts.filter((p) => !p.length || !p.width || p.length <= 0 || p.width <= 0 || !p.qty || p.qty <= 0);
    if (invalidRows.length > 0) {
      toast.error("Some rows contain invalid length, width or quantity.", {
        description: "Please correct zero or negative values before saving.",
      });
      return;
    }

    // Save to global store
    store.set({ parts, result: null });
    toast.success(`Successfully saved ${parts.length} components to workbench!`, {
      description: "You can now run sheet cut optimization.",
    });

    if (onSave) onSave(parts);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-soft space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <span>{isOcrResult ? "Extracted OCR Bill of Materials (Editable)" : "Edit Parts & Dimensions Table"}</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {parts.length} Items
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Review, edit, or add missing fabrication plate dimensions before optimizing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddRow} className="border-dashed">
            <Plus className="mr-1.5 size-4" /> Add Row
          </Button>

          <Button size="sm" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-soft">
            <Check className="mr-1.5 size-4" /> Save BOM & Proceed
          </Button>

          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Editable Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-muted/80 text-muted-foreground font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2.5 w-12">#</th>
              <th className="px-3 py-2.5 min-w-[110px]">Item Mark</th>
              <th className="px-3 py-2.5 min-w-[160px]">Description</th>
              <th className="px-3 py-2.5 min-w-[140px]">Material Grade</th>
              <th className="px-3 py-2.5 w-24">Thk (mm)</th>
              <th className="px-3 py-2.5 w-28">Length (mm)</th>
              <th className="px-3 py-2.5 w-28">Width (mm)</th>
              <th className="px-3 py-2.5 w-20">Qty</th>
              <th className="px-3 py-2.5 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parts.map((p, idx) => {
              const isLengthErr = p.length > 12000 || p.length <= 0;
              const isWidthErr = p.width > 3000 || p.width <= 0;

              return (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono font-bold text-muted-foreground">{idx + 1}</td>

                  {/* Item Mark */}
                  <td className="px-2 py-1.5">
                    <Input
                      value={p.item}
                      onChange={(e) => handleUpdatePart(p.id, "item", e.target.value)}
                      className="h-8 font-mono text-xs font-semibold"
                    />
                  </td>

                  {/* Description */}
                  <td className="px-2 py-1.5">
                    <Input
                      value={p.description}
                      onChange={(e) => handleUpdatePart(p.id, "description", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>

                  {/* Material */}
                  <td className="px-2 py-1.5">
                    <Input
                      value={p.material}
                      onChange={(e) => handleUpdatePart(p.id, "material", e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </td>

                  {/* Thickness */}
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={p.thickness}
                      onChange={(e) => handleUpdatePart(p.id, "thickness", e.target.value)}
                      className="h-8 font-mono text-xs text-right"
                    />
                  </td>

                  {/* Length */}
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={p.length}
                      onChange={(e) => handleUpdatePart(p.id, "length", e.target.value)}
                      className={`h-8 font-mono text-xs text-right ${
                        isLengthErr ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold" : ""
                      }`}
                    />
                  </td>

                  {/* Width */}
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={p.width}
                      onChange={(e) => handleUpdatePart(p.id, "width", e.target.value)}
                      className={`h-8 font-mono text-xs text-right ${
                        isWidthErr ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold" : ""
                      }`}
                    />
                  </td>

                  {/* Qty */}
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={p.qty}
                      onChange={(e) => handleUpdatePart(p.id, "qty", e.target.value)}
                      className="h-8 font-mono text-xs text-right font-bold"
                    />
                  </td>

                  {/* Delete Button */}
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRow(p.id)}
                      className="size-8 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
