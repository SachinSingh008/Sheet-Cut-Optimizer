import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Ruler,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { store, useAppState } from "@/lib/store";
import { type CustomStockSheetRule } from "@/lib/nesting";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CustomStockSheetPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

const PREDEFINED_STOCK_SIZES = [
  { label: "1500 × 6300 mm (Standard Mill)", width: 1500, length: 6300 },
  { label: "1500 × 6000 mm (Standard Workshop)", width: 1500, length: 6000 },
  { label: "1250 × 2500 mm (Compact Sheet 4'×8')", width: 1250, length: 2500 },
  { label: "1500 × 3000 mm (Medium Sheet 5'×10')", width: 1500, length: 3000 },
  { label: "2000 × 6000 mm (Wide Plate 2m)", width: 2000, length: 6000 },
  { label: "2500 × 12000 mm (Jumbo Heavy Plate)", width: 2500, length: 12000 },
];

/** Individual Editable Stock Sheet Row with direct manual typing and NO arrow spinners */
function StockSheetRowItem({
  rule,
  index,
  onUpdate,
  onDelete,
}: {
  rule: CustomStockSheetRule;
  index: number;
  onUpdate: (id: string, patch: Partial<CustomStockSheetRule>) => void;
  onDelete: (id: string) => void;
}) {
  const [material, setMaterial] = useState(rule.material);
  const [thk, setThk] = useState(rule.thickness != null ? String(rule.thickness) : "");
  const [width, setWidth] = useState(String(rule.sheetWidth));
  const [length, setLength] = useState(String(rule.sheetLength));

  // Sync from props only when external value actually changed and differs from local input
  useEffect(() => {
    setMaterial(rule.material);
  }, [rule.material]);

  useEffect(() => {
    const propThk = rule.thickness != null ? String(rule.thickness) : "";
    setThk((prev) => (prev === "" && rule.thickness === null ? "" : Number(prev) === rule.thickness ? prev : propThk));
  }, [rule.thickness]);

  useEffect(() => {
    const propWidth = String(rule.sheetWidth);
    setWidth((prev) => (Number(prev) === rule.sheetWidth ? prev : propWidth));
  }, [rule.sheetWidth]);

  useEffect(() => {
    const propLength = String(rule.sheetLength);
    setLength((prev) => (Number(prev) === rule.sheetLength ? prev : propLength));
  }, [rule.sheetLength]);

  const handleMaterialChange = (val: string) => {
    const clean = val.toUpperCase();
    setMaterial(clean);
    onUpdate(rule.id, { material: clean });
  };

  const handleThkChange = (val: string) => {
    // allow typing decimals and numbers without arrows
    const clean = val.replace(/[^0-9.]/g, "");
    setThk(clean);
    if (clean === "") {
      onUpdate(rule.id, { thickness: null });
    } else {
      const num = parseFloat(clean);
      if (!isNaN(num) && num > 0) {
        onUpdate(rule.id, { thickness: num });
      }
    }
  };

  const handleWidthChange = (val: string) => {
    // allow typing integer dimensions without arrows
    const clean = val.replace(/[^0-9]/g, "");
    setWidth(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0) {
      onUpdate(rule.id, { sheetWidth: num });
    }
  };

  const handleWidthBlur = () => {
    if (!width || parseInt(width, 10) <= 0) {
      const fallback = rule.sheetWidth || 1500;
      setWidth(String(fallback));
      onUpdate(rule.id, { sheetWidth: fallback });
    }
  };

  const handleLengthChange = (val: string) => {
    // allow typing integer dimensions without arrows
    const clean = val.replace(/[^0-9]/g, "");
    setLength(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0) {
      onUpdate(rule.id, { sheetLength: num });
    }
  };

  const handleLengthBlur = () => {
    if (!length || parseInt(length, 10) <= 0) {
      const fallback = rule.sheetLength || 6000;
      setLength(String(fallback));
      onUpdate(rule.id, { sheetLength: fallback });
    }
  };

  const applyPredefinedSize = (w: number, l: number) => {
    setWidth(String(w));
    setLength(String(l));
    onUpdate(rule.id, { sheetWidth: w, sheetLength: l });
    toast.success(`Applied ${w}×${l} mm to row #${index + 1}`);
  };

  return (
    <tr className="hover:bg-muted/40 transition-colors border-b border-border">
      <td className="px-2 py-1.5 text-center font-mono text-[11px] text-muted-foreground font-bold bg-muted/30">
        {index + 1}
      </td>

      {/* Material Grade Cell */}
      <td className="p-1">
        <input
          type="text"
          value={material}
          onChange={(e) => handleMaterialChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={(e) => e.stopPropagation()}
          placeholder="CHQ, MS"
          className="w-full h-7 bg-background border border-input rounded px-1.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          title="Material Grade / Plate Abbreviation (e.g. CHQ, MS, IS2062)"
        />
      </td>

      {/* Thickness Cell (No Arrows) */}
      <td className="p-1">
        <input
          type="text"
          inputMode="decimal"
          value={thk}
          onChange={(e) => handleThkChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={(e) => e.stopPropagation()}
          placeholder="All"
          className="w-full h-7 bg-background border border-input rounded px-1 text-center font-mono text-xs font-bold text-sky-600 dark:text-sky-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="Plate Thickness in mm (e.g. 4, 8, 10 - or leave blank for all)"
        />
      </td>

      {/* Width Cell (No Arrows, Manual Typing) */}
      <td className="p-1">
        <input
          type="text"
          inputMode="numeric"
          value={width}
          onChange={(e) => handleWidthChange(e.target.value)}
          onBlur={handleWidthBlur}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={(e) => e.stopPropagation()}
          placeholder="1500"
          className="w-full h-7 bg-background border border-input rounded px-1 text-right font-mono text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="Plate Width in mm (e.g. 1500)"
        />
      </td>

      {/* Length Cell (No Arrows, Manual Typing) */}
      <td className="p-1">
        <input
          type="text"
          inputMode="numeric"
          value={length}
          onChange={(e) => handleLengthChange(e.target.value)}
          onBlur={handleLengthBlur}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={(e) => e.stopPropagation()}
          placeholder="6000"
          className="w-full h-7 bg-background border border-input rounded px-1 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="Plate Length in mm (e.g. 6000)"
        />
      </td>

      {/* Predefined Size Selector & Delete Actions */}
      <td className="p-1 text-center">
        <div className="flex items-center justify-center gap-1">
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                const [w, l] = val.split("x").map(Number);
                if (w && l) applyPredefinedSize(w, l);
              }
              e.target.value = "";
            }}
            defaultValue=""
            className="w-4 h-6 opacity-60 hover:opacity-100 bg-muted text-foreground text-[10px] rounded cursor-pointer border border-input focus:outline-none"
            title="Choose predefined standard size for this row"
          >
            <option value="" disabled>
              📐
            </option>
            <option value="2000x6000">2000 × 6000 mm</option>
            <option value="1500x6000">1500 × 6000 mm</option>
            <option value="1250x2500">1250 × 2500 mm</option>
            <option value="1500x3000">1500 × 3000 mm</option>
            <option value="2500x12000">2500 × 12000 mm</option>
          </select>

          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Delete this custom stock size"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function CustomStockSheetPanel({
  isExpanded,
  onToggle,
  className = "",
}: CustomStockSheetPanelProps) {
  const { config } = useAppState();
  const customStockSheets: CustomStockSheetRule[] = config.customStockSheets ?? [];

  const handleAddRule = (preset?: Partial<CustomStockSheetRule>) => {
    const newRule: CustomStockSheetRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      material: preset?.material ?? "CHQ",
      thickness: preset?.thickness !== undefined ? preset.thickness : 4,
      sheetWidth: preset?.sheetWidth ?? 2000,
      sheetLength: preset?.sheetLength ?? 6000,
      description: preset?.description ?? "Custom Workshop Stock Plate",
    };
    store.addCustomStockSheet(newRule);
    toast.success("Added Custom Stock Sheet Size", {
      description: `Configured ${newRule.material} (${newRule.sheetWidth}×{newRule.sheetLength} mm). Edit values directly by typing.`,
    });
  };

  const handleUpdate = (id: string, patch: Partial<CustomStockSheetRule>) => {
    store.updateCustomStockSheet(id, patch);
  };

  const handleDelete = (id: string) => {
    store.removeCustomStockSheet(id);
    toast.info("Removed custom stock sheet size");
  };

  if (!isExpanded) {
    return (
      <div
        onClick={onToggle}
        className="hidden lg:flex flex-col items-center justify-between border-l border-emerald-800 bg-emerald-700 hover:bg-emerald-600 transition-all cursor-pointer py-4 px-2 w-11 shrink-0 select-none text-white shadow-sm group"
        title="Click to expand Available Stock Sheet Sizes"
      >
        <div className="flex flex-col items-center gap-2">
          <ChevronLeft className="size-4 text-emerald-100 group-hover:-translate-x-0.5 transition-transform" />
          <Layers className="size-4 text-amber-300" />
        </div>
        <div className="[writing-mode:vertical-lr] text-xs font-bold tracking-wider uppercase text-white flex items-center gap-2">
          <span>📐 Available Stock Sizes</span>
          <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black [writing-mode:horizontal-tb]">
            {customStockSheets.length}
          </span>
        </div>
        <ChevronLeft className="size-4 text-emerald-100 group-hover:-translate-x-0.5 transition-transform" />
      </div>
    );
  }

  return (
    <div
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      className={cn(
        "w-full lg:w-[410px] xl:w-[440px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card text-card-foreground flex flex-col justify-between shadow-xl transition-all duration-200",
        className
      )}
    >
      {/* Top Banner Header */}
      <div className="bg-emerald-700 text-white px-3.5 py-2.5 border-b border-emerald-800 flex items-center justify-between gap-2 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-white/20 text-white shadow-inner font-bold">
            <Ruler className="size-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              <span>Available Stock Sheet Sizes</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-mono px-1.5 py-0.2 rounded font-black">
                {customStockSheets.length} {customStockSheets.length === 1 ? "Rule" : "Rules"}
              </span>
            </h4>
            <p className="text-[10.5px] text-emerald-100 mt-0.5 leading-none">
              Enter values manually by typing · No arrows needed
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="size-7 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-600 grid place-items-center transition-colors cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className="p-3 flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[520px] scrollbar-thin scrollbar-thumb-muted-foreground/30">
        {/* Material & Thickness Specific Available Sheet Sizes Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Material-Specific Stock Sheets</span>
            </span>
            <span className="text-[10.5px] text-muted-foreground font-mono">
              Type values in cells directly
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-muted/70 border-b border-border text-foreground font-mono text-[10.5px]">
                  <th className="px-2 py-1.5 text-center w-7">#</th>
                  <th className="p-1.5 font-bold">Material</th>
                  <th className="p-1.5 w-16 font-bold">Thk(mm)</th>
                  <th className="p-1.5 w-18 font-bold">Width(mm)</th>
                  <th className="p-1.5 w-18 font-bold">Length(mm)</th>
                  <th className="p-1.5 text-center w-12 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customStockSheets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-6 px-3 text-muted-foreground text-xs italic"
                    >
                      No custom stock sheets configured. Click "+ Add Stock Size" below to specify your plates.
                    </td>
                  </tr>
                ) : (
                  customStockSheets.map((rule, idx) => (
                    <StockSheetRowItem
                      key={rule.id}
                      rule={rule}
                      index={idx}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Controls & Quick Presets */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleAddRule({
                  material: "MS",
                  thickness: null,
                  sheetWidth: 2000,
                  sheetLength: 6000,
                  description: "Available MS Plate (2000×6000 mm)",
                })
              }
              className="flex-1 h-7.5 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Stock Size</span>
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-muted-foreground font-mono font-semibold">Presets:</span>
            <button
              type="button"
              onClick={() =>
                handleAddRule({
                  material: "CHQ",
                  thickness: 4,
                  sheetWidth: 1500,
                  sheetLength: 6000,
                  description: "Chequered plate for flooring: 1500×6000 mm",
                })
              }
              className="text-[10.5px] font-mono font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 rounded px-2 py-0.5 transition-colors cursor-pointer"
              title="Add CHQ 1500x6000 mm (Thk 4)"
            >
              + CHQ 1500×6000 (Thk 4)
            </button>
            <button
              type="button"
              onClick={() =>
                handleAddRule({
                  material: "MS",
                  thickness: null,
                  sheetWidth: 2000,
                  sheetLength: 6000,
                  description: "Standard MS stock plate: 2000×6000 mm",
                })
              }
              className="text-[10.5px] font-mono font-bold bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60 border border-sky-300 dark:border-sky-700 rounded px-2 py-0.5 transition-colors cursor-pointer"
              title="Add MS 2000x6000 mm"
            >
              + MS 2000×6000 (All)
            </button>
            <button
              type="button"
              onClick={() =>
                handleAddRule({
                  material: "IS2062",
                  thickness: null,
                  sheetWidth: 2000,
                  sheetLength: 6000,
                  description: "Wide plate: 2000×6000 mm",
                })
              }
              className="text-[10.5px] font-mono font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 rounded px-2 py-0.5 transition-colors cursor-pointer"
              title="Add 2000x6000 mm Wide Plate"
            >
              + 2000×6000 (Wide)
            </button>
          </div>
        </div>

        {/* Dynamic Informational Logic Box */}
        <div className="rounded-xl bg-muted/40 border border-border p-2.5 text-[11px] space-y-1.5 mt-auto text-foreground">
          <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
            <Info className="size-3.5 shrink-0" />
            <span>Active Sheet Selection Hierarchy</span>
          </div>

          <ul className="text-muted-foreground space-y-1 text-[10.5px] pl-1 leading-snug">
            {customStockSheets.map((rule) => (
              <li key={rule.id} className="flex items-start gap-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-700 dark:text-amber-300 font-semibold">{rule.material}</strong>{" "}
                  {rule.thickness ? `(thk ${rule.thickness} mm)` : "(all thicknesses)"} → uses{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                    {rule.sheetWidth} × {rule.sheetLength} mm
                  </strong>{" "}
                  stock sheet.
                </span>
              </li>
            ))}
            {customStockSheets.length > 0 && (
              <li className="flex items-start gap-1 text-muted-foreground pt-0.5 border-t border-border">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                <span>
                  Any unlisted material automatically uses primary stock size:{" "}
                  <strong className="text-foreground font-mono font-bold">
                    {customStockSheets[0].sheetWidth} × {customStockSheets[0].sheetLength} mm
                  </strong>
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
