import { useState } from "react";
import { Layers, Plus, Pencil, Trash2, Tag, Ruler, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { store, useAppState } from "@/lib/store";
import { DEFAULT_PLATE_TYPES, type PlateTypeConfig } from "@/lib/nesting";

export function PlateTypeInventorySection() {
  const { config, result } = useAppState();
  const plateTypes = config.plateTypes ?? DEFAULT_PLATE_TYPES;

  const [editingItem, setEditingItem] = useState<PlateTypeConfig | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formAbbr, setFormAbbr] = useState("");
  const [formMinThk, setFormMinThk] = useState(0);
  const [formMaxThk, setFormMaxThk] = useState(100);
  const [formLength, setFormLength] = useState(6300);
  const [formWidth, setFormWidth] = useState(1500);
  const [formDesc, setFormDesc] = useState("");

  const openAddModal = () => {
    setFormName("");
    setFormAbbr("");
    setFormMinThk(0);
    setFormMaxThk(100);
    setFormLength(6300);
    setFormWidth(1500);
    setFormDesc("");
    setIsAdding(true);
  };

  const openEditModal = (pt: PlateTypeConfig) => {
    setEditingItem(pt);
    setFormName(pt.name);
    setFormAbbr(pt.abbreviations.join(", "));
    setFormMinThk(pt.minThickness);
    setFormMaxThk(pt.maxThickness);
    setFormLength(pt.sheetLength);
    setFormWidth(pt.sheetWidth);
    setFormDesc(pt.description || "");
  };

  const handleSave = () => {
    const abbrArray = formAbbr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!formName.trim()) {
      toast.error("Please enter a plate type name");
      return;
    }
    if (!abbrArray.length) {
      toast.error("Please specify at least one Excel abbreviation code");
      return;
    }

    if (editingItem) {
      store.updatePlateType(editingItem.id, {
        name: formName.trim(),
        abbreviations: abbrArray,
        minThickness: Number(formMinThk),
        maxThickness: Number(formMaxThk),
        sheetLength: Number(formLength),
        sheetWidth: Number(formWidth),
        description: formDesc.trim(),
      });
      toast.success(`${formName} updated`);
    } else if (isAdding) {
      const newPt: PlateTypeConfig = {
        id: `pt_${Date.now()}`,
        name: formName.trim(),
        abbreviations: abbrArray,
        minThickness: Number(formMinThk),
        maxThickness: Number(formMaxThk),
        sheetLength: Number(formLength),
        sheetWidth: Number(formWidth),
        description: formDesc.trim(),
      };
      store.addPlateType(newPt);
      toast.success(`${formName} added to inventory`);
    }

    setEditingItem(null);
    setIsAdding(false);
  };

  return (
    <div className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" />
            </span>
            <h3 className="text-lg font-bold text-foreground">Plate Types & Stock Dimensions Mapping</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign custom stock sheet dimensions ($L \times W$) per plate category & Excel BOM abbreviation (e.g. Chequered Plates, MS Plates, SAILMA).
          </p>
        </div>

        <Button onClick={openAddModal} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
          <Plus className="mr-1.5 size-4" /> Add Plate Type
        </Button>
      </div>

      {/* Inventory Table */}
      <div className="overflow-x-auto rounded-xl border bg-muted/20">
        <table className="w-full text-sm">
          <thead className="bg-muted/80 text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Plate Type Name</th>
              <th className="px-4 py-3 text-left">Excel BOM Codes</th>
              <th className="px-4 py-3 text-left">Thk Range</th>
              <th className="px-4 py-3 text-left">Stock Sheet Size ($L \times W$)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-sans">
            {plateTypes.map((pt) => {
              const matchingSheets = result?.sheets.filter((s) => 
                s.sheetLength === pt.sheetLength && s.sheetWidth === pt.sheetWidth && s.thickness >= pt.minThickness && s.thickness <= pt.maxThickness
              ) ?? [];
              const ptSheetsNeeded = matchingSheets.length;

              return (
                <tr key={pt.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{pt.name}</span>
                      {ptSheetsNeeded > 0 && (
                        <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold px-2 py-0.5">
                          {ptSheetsNeeded} {ptSheetsNeeded === 1 ? "Sheet Needed" : "Sheets Needed"}
                        </span>
                      )}
                    </div>
                    {pt.description && <span className="text-[11px] text-muted-foreground font-normal block mt-0.5">{pt.description}</span>}
                  </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {pt.abbreviations.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-soft text-primary font-mono text-xs font-bold"
                      >
                        <Tag className="size-3" /> {code}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3.5 tabular-nums text-xs font-medium">
                  {pt.minThickness === 0 && pt.maxThickness >= 100
                    ? "All thicknesses"
                    : `${pt.minThickness} mm - ${pt.maxThickness} mm`}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-foreground bg-muted/80 px-2.5 py-1 rounded-lg border">
                    <Ruler className="size-3.5 text-primary" /> {pt.sheetLength} × {pt.sheetWidth} mm
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(pt)}>
                      <Pencil className="size-4" />
                    </Button>
                    {plateTypes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          store.removePlateType(pt.id);
                          toast.success(`${pt.name} removed`);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={!!editingItem || isAdding} onOpenChange={(o) => !o && (setEditingItem(null), setIsAdding(false))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${editingItem.name}` : "Add New Plate Type"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="pt-name">Plate Type Name</Label>
              <Input
                id="pt-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Chequered Plate, MS Heavy Plate"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pt-abbr" className="flex justify-between">
                <span>Excel / BOM Abbreviation Codes</span>
                <span className="text-xs text-muted-foreground">Comma-separated</span>
              </Label>
              <Input
                id="pt-abbr"
                value={formAbbr}
                onChange={(e) => setFormAbbr(e.target.value)}
                placeholder="e.g. CHQ, CHEQ, CP, CHEQUERED"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pt-min">Min Thk (mm)</Label>
                <Input
                  id="pt-min"
                  type="number"
                  value={formMinThk}
                  onChange={(e) => setFormMinThk(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pt-max">Max Thk (mm)</Label>
                <Input
                  id="pt-max"
                  type="number"
                  value={formMaxThk}
                  onChange={(e) => setFormMaxThk(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pt-len">Stock Length (mm)</Label>
                <Input
                  id="pt-len"
                  type="number"
                  value={formLength}
                  onChange={(e) => setFormLength(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pt-wid">Stock Width (mm)</Label>
                <Input
                  id="pt-wid"
                  type="number"
                  value={formWidth}
                  onChange={(e) => setFormWidth(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pt-desc">Description / Notes</Label>
              <Input
                id="pt-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional notes for shop floor"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => (setEditingItem(null), setIsAdding(false))}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Plate Type</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
