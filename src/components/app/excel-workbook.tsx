import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  FileSpreadsheet,
  ClipboardPaste,
  Copy,
  Plus,
  Trash2,
  Sparkles,
  Download,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { store } from "@/lib/store";
import { type Part } from "@/lib/mock-data";
import { extractDimensionsFromText, type ExtractedDimensions } from "@/lib/excel-parser";
import { cn } from "@/lib/utils";
import { CustomStockSheetPanel } from "@/components/app/custom-stock-sheet-panel";

export type ColumnFieldType =
  | "unmapped"
  | "profile"
  | "length"
  | "width"
  | "thickness"
  | "qty"
  | "item"
  | "material"
  | "description"
  | "ignore";

export interface WorkbookColumn {
  id: string;
  letter: string;
  field: ColumnFieldType;
  title: string;
  width: number;
  align: "left" | "center" | "right";
  placeholder: string;
}

export const FIELD_OPTIONS: Array<{
  value: ColumnFieldType;
  label: string;
  isRequired: boolean;
  badgeClass: string;
  hint: string;
}> = [
  {
    value: "unmapped",
    label: "-- Select Property * --",
    isRequired: false,
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400 font-bold",
    hint: "Choose property for this column",
  },
  {
    value: "profile",
    label: "📏 Section / Callout (PL10*110) *",
    isRequired: false,
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 font-bold",
    hint: "Plate Callout (e.g. PL10*110): Auto-detects Width & Thk (or Len if 3 values)",
  },
  {
    value: "length",
    label: "📐 Length (mm) *",
    isRequired: true,
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
    hint: "Required * — Plate Cut Length in mm",
  },
  {
    value: "width",
    label: "📐 Width (mm) *",
    isRequired: true,
    badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 font-bold",
    hint: "Required * — Plate Cut Width in mm",
  },
  {
    value: "thickness",
    label: "📏 Thickness (mm) *",
    isRequired: true,
    badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold",
    hint: "Required * — Plate Thickness in mm",
  },
  {
    value: "qty",
    label: "🔢 Quantity *",
    isRequired: true,
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40 font-bold",
    hint: "Required * — Number of pieces to cut",
  },
  {
    value: "item",
    label: "🏷️ Item Mark",
    isRequired: false,
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    hint: "Optional — Component / Pos No (auto-generated if empty)",
  },
  {
    value: "description",
    label: "📝 Description",
    isRequired: false,
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
    hint: "Optional — Profile / Part type details",
  },
  {
    value: "material",
    label: "🛡️ Material Grade",
    isRequired: false,
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    hint: "Optional — Steel specification (defaults to IS:2062 E250A)",
  },
  {
    value: "ignore",
    label: "✖️ Ignore Column",
    isRequired: false,
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
    hint: "Skip from nesting",
  },
];

export function detectFieldFromName(name: string): ColumnFieldType {
  const s = name.trim().toLowerCase();
  if (!s) return "unmapped";
  if (
    /^(?:pos|item|mark|part|tag|piece|member|drg|id|no)(?:\.|\b)/i.test(s) ||
    /item\s*mark|part\s*mark|drg\s*no|piece\s*no|pos\s*no/i.test(s)
  ) {
    return "item";
  }
  if (/^(?:profile|section|callout|size|pl\s*size|call\s*out)/i.test(s)) {
    return "profile";
  }
  if (/^(?:desc|description|particular|detail)/i.test(s)) {
    return "description";
  }
  if (/^(?:mat|material|grade|spec|quality|steel)/i.test(s)) {
    return "material";
  }
  if (/^(?:thk|thick|thickness|gauge|t\b|t\(mm\))/i.test(s) || /thk|thick/i.test(s)) {
    return "thickness";
  }
  if (/^(?:len|length|lg|span|cut\s*len|l\b|l\(mm\))/i.test(s) || /length|cut\s*len/i.test(s)) {
    return "length";
  }
  if (/^(?:wid|width|breadth|b\b|w\b|w\(mm\)|b\(mm\))/i.test(s) || /width|breadth/i.test(s)) {
    return "width";
  }
  if (/^(?:qty|quantity|nos|pcs|count|combined\s*qty)/i.test(s) || /qty|quantity|nos|pcs/i.test(s)) {
    return "qty";
  }
  return "unmapped";
}

/**
 * Intelligent dimension resolver for each workbook row.
 * Handles user rule:
 * - If 3 values (e.g. PL10*110*1200): len > width > thickness
 * - If 2 values (e.g. PL10*110): width > thk
 */
export function getRowDimensions(
  row: string[],
  columnIndices: {
    itemIdx: number;
    descIdx: number;
    matIdx: number;
    thkIdx: number;
    lenIdx: number;
    widIdx: number;
    qtyIdx: number;
    profileIdx: number;
  },
): {
  length: number | null;
  width: number | null;
  thickness: number | null;
  qty: number;
  calloutStr?: string;
  extracted?: ExtractedDimensions | null;
} {
  const { thkIdx, lenIdx, widIdx, qtyIdx, profileIdx } = columnIndices;

  // 1. Check dedicated columns
  const rawThk = thkIdx !== -1 && row[thkIdx] ? parseFloat(row[thkIdx]!) : null;
  const rawLen = lenIdx !== -1 && row[lenIdx] ? parseFloat(row[lenIdx]!) : null;
  const rawWid = widIdx !== -1 && row[widIdx] ? parseFloat(row[widIdx]!) : null;
  const rawQty = qtyIdx !== -1 && row[qtyIdx] ? parseInt(row[qtyIdx]!, 10) : 1;

  let thickness = rawThk && !isNaN(rawThk) && rawThk > 0 ? rawThk : null;
  let length = rawLen && !isNaN(rawLen) && rawLen > 0 ? rawLen : null;
  let width = rawWid && !isNaN(rawWid) && rawWid > 0 ? rawWid : null;
  const qty = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;

  // 2. Search for callouts (e.g. PL10*110) in profile column or any cell
  let extracted: ExtractedDimensions | null = null;
  let calloutStr = "";

  if (profileIdx !== -1 && row[profileIdx]) {
    extracted = extractDimensionsFromText(row[profileIdx]!);
    if (extracted) calloutStr = row[profileIdx]!;
  }

  if (!extracted) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell) {
        const ext = extractDimensionsFromText(cell);
        if (ext) {
          extracted = ext;
          calloutStr = cell;
          break;
        }
      }
    }
  }

  // 3. Apply user rules from callout
  if (extracted) {
    if (extracted.valuesCount === 3) {
      // 3 values rule: len > width > thickness
      if (length === null) length = extracted.length ?? null;
      if (width === null) width = extracted.width ?? null;
      if (thickness === null) thickness = extracted.thickness ?? null;
    } else if (extracted.valuesCount === 2) {
      // 2 values rule: width > thk
      if (width === null) width = extracted.width ?? null;
      if (thickness === null) thickness = extracted.thickness ?? null;
    }
  }

  // 4. Fallback search for length if 2 values were found and length is still missing
  if (extracted && extracted.valuesCount === 2 && length === null) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell && cell !== calloutStr) {
        const num = parseFloat(cell);
        if (!isNaN(num) && num > 0 && num !== width && num !== thickness && (qtyIdx === -1 || c !== qtyIdx)) {
          length = num;
          break;
        }
      }
    }
  }

  // 5. Ensure length >= width orientation
  if (length !== null && width !== null && width > length) {
    const temp = width;
    width = length;
    length = temp;
  }

  return {
    length,
    width,
    thickness,
    qty,
    calloutStr,
    extracted,
  };
}

function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/** Creates initial blank columns with no pre-filled names or mappings */
function createBlankColumns(count: number = 7): WorkbookColumn[] {
  return Array.from({ length: count }, (_, idx) => {
    const letter = getColumnLetter(idx);
    return {
      id: `col-init-${idx}-${Date.now()}`,
      letter,
      field: "unmapped",
      title: "",
      width: 140,
      align: "left",
      placeholder: `Col ${letter} Name...`,
    };
  });
}

const SAMPLE_COLUMNS_DEF: Array<{ field: ColumnFieldType; title: string }> = [
  { field: "item", title: "Item Mark" },
  { field: "description", title: "Description" },
  { field: "material", title: "Material Grade" },
  { field: "thickness", title: "Thk (mm)" },
  { field: "length", title: "Length (mm)" },
  { field: "width", title: "Width (mm)" },
  { field: "qty", title: "Qty (Pcs)" },
];

const INITIAL_ROW_COUNT = 12;

const SAMPLE_BOM_ROWS: string[][] = [
  ["P-101", "WEB STIFFENER PLATE", "IS:2062 E250A", "10", "1250", "450", "4"],
  ["P-102", "BOTTOM FLANGE PLATE", "IS:2062 E250A", "16", "2400", "750", "2"],
  ["P-103", "TOP FLANGE PLATE", "IS:2062 E250A", "16", "2400", "700", "2"],
  ["P-104", "DIAPHRAGM GUSSET", "IS:2062 E250A", "12", "900", "550", "6"],
  ["P-105", "HEAVY BASE PLATE", "IS:2062 E250A", "25", "1100", "950", "2"],
  ["P-106", "CHQ FLOOR TREAD", "IS:3502 (Chequered Plate)", "6", "1350", "320", "8"],
  ["P-107", "SPLICE CONNECTOR", "IS:2062 E250A", "10", "650", "350", "12"],
  ["P-108", "END BEARING STIFFENER", "IS:2062 E250A", "20", "1450", "400", "4"],
];

function createBlankRows(rowCount: number, colCount: number): string[][] {
  return Array.from({ length: rowCount }, () => Array(colCount).fill(""));
}

export function ExcelWorkbook({
  onApplied,
  importedParts,
  importedFileName,
}: {
  onApplied?: () => void;
  importedParts?: Part[];
  importedFileName?: string;
}) {
  // Columns State — starts completely BLANK at start (titles and fields empty)
  const [columns, setColumns] = useState<WorkbookColumn[]>(() => createBlankColumns(7));

  // Grid Matrix — starts completely BLANK at start
  const [grid, setGrid] = useState<string[][]>(() =>
    createBlankRows(INITIAL_ROW_COUNT, 7),
  );

  // Undo / Redo History
  const [history, setHistory] = useState<string[][][]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  // Selection state
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [selectionRange, setSelectionRange] = useState<{
    startR: number;
    startC: number;
    endR: number;
    endC: number;
  }>({ startR: 0, startC: 0, endR: 0, endC: 0 });

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Right-hand expandable stock sheet sizes panel state
  const [isStockPanelExpanded, setIsStockPanelExpanded] = useState<boolean>(true);

  // Drag-to-fill handle state
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const [fillDragPreview, setFillDragPreview] = useState<{
    startR: number;
    startC: number;
    endR: number;
    endC: number;
  } | null>(null);

  // Mouse selection dragging
  const [isSelectingRange, setIsSelectingRange] = useState(false);

  // AutoFill Mode & Options Tag state (Copy Cells vs Fill Series)
  const [autoFillOptionsOpen, setAutoFillOptionsOpen] = useState(false);
  const [lastAutoFill, setLastAutoFill] = useState<{
    srcRange: { minR: number; maxR: number; minC: number; maxC: number };
    tgtRange: { minR: number; maxR: number; minC: number; maxC: number };
    mode: "copy" | "series";
    savedSourceGrid: string[][];
  } | null>(null);

  // Container refs
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const fillSourceRangeRef = useRef<{
    startR: number;
    startC: number;
    endR: number;
    endC: number;
  } | null>(null);

  // Helper to commit to history
  const commitToHistory = useCallback(
    (newGrid: string[][]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIdx + 1);
        return [...sliced, newGrid];
      });
      setHistoryIdx((prev) => prev + 1);
      setGrid(newGrid);
    },
    [historyIdx],
  );

  // When external parts are imported (e.g. from uploaded Excel or OCR), populate workbook
  const lastImportedRef = useRef<Part[] | null>(null);

  useEffect(() => {
    if (importedParts && importedParts.length > 0 && importedParts !== lastImportedRef.current) {
      lastImportedRef.current = importedParts;
      const sampleCols: WorkbookColumn[] = SAMPLE_COLUMNS_DEF.map((def, idx) => ({
        id: `col-imported-${idx}`,
        letter: getColumnLetter(idx),
        field: def.field,
        title: def.title,
        width: def.field === "description" ? 200 : 140,
        align: def.field === "item" || def.field === "description" || def.field === "material" ? "left" : "right",
        placeholder: `Col ${getColumnLetter(idx)} Name...`,
      }));

      const newGrid: string[][] = importedParts.map((p) => [
        p.item,
        p.description || p.item,
        p.material,
        String(p.thickness),
        String(p.length),
        String(p.width),
        String(p.qty),
      ]);

      setColumns(sampleCols);
      commitToHistory(newGrid);
      setSelectedCell({ r: 0, c: 0 });
      setSelectionRange({ startR: 0, startC: 0, endR: Math.max(0, newGrid.length - 1), endC: 6 });
      toast.success(`Loaded ${importedParts.length} parts into Excel Workbook!`, {
        description: importedFileName
          ? `Extracted from "${importedFileName}". All columns mapped and ready for editing or optimization.`
          : "All columns mapped and ready for editing or optimization.",
      });
    }
  }, [importedParts, importedFileName, commitToHistory]);

  const handleUndo = useCallback(() => {
    if (historyIdx > 0) {
      const prevGrid = history[historyIdx - 1];
      if (prevGrid) {
        setHistoryIdx((prev) => prev - 1);
        setGrid(prevGrid);
        toast.info("Undo");
      }
    }
  }, [history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const nextGrid = history[historyIdx + 1];
      if (nextGrid) {
        setHistoryIdx((prev) => prev + 1);
        setGrid(nextGrid);
        toast.info("Redo");
      }
    }
  }, [history, historyIdx]);

  // Normalized selection bounds
  const selMinR = Math.min(selectionRange.startR, selectionRange.endR);
  const selMaxR = Math.max(selectionRange.startR, selectionRange.endR);
  const selMinC = Math.min(selectionRange.startC, selectionRange.endC);
  const selMaxC = Math.max(selectionRange.startC, selectionRange.endC);

  // Focus inline editor on edit start
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  // Active cell coordinate label (e.g. A1, D3)
  const activeCoordLabel = useMemo(() => {
    const colLetter = columns[selectedCell.c]?.letter || getColumnLetter(selectedCell.c);
    const rowNum = selectedCell.r + 1;
    return `${colLetter}${rowNum}`;
  }, [columns, selectedCell]);

  // Active cell value
  const activeCellValue = grid[selectedCell.r]?.[selectedCell.c] || "";

  // Dynamic Column Field Indices Map
  const columnIndices = useMemo(() => {
    const itemIdx = columns.findIndex((c) => c.field === "item");
    const descIdx = columns.findIndex((c) => c.field === "description");
    const matIdx = columns.findIndex((c) => c.field === "material");
    const thkIdx = columns.findIndex((c) => c.field === "thickness");
    const lenIdx = columns.findIndex((c) => c.field === "length");
    const widIdx = columns.findIndex((c) => c.field === "width");
    const qtyIdx = columns.findIndex((c) => c.field === "qty");
    const profileIdx = columns.findIndex((c) => c.field === "profile");

    return { itemIdx, descIdx, matIdx, thkIdx, lenIdx, widIdx, qtyIdx, profileIdx };
  }, [columns]);

  // Missing required fields check — recognizes dimensions auto-extracted from callouts (e.g. PL10*110)
  const requiredValidation = useMemo(() => {
    const { lenIdx, widIdx, thkIdx, qtyIdx, profileIdx } = columnIndices;
    const filledRows = grid.filter((r) => r.some((c) => c && c.trim() !== ""));

    let calloutSuppliesThkAndWid = false;
    let calloutSuppliesLen = false;

    if (filledRows.length > 0) {
      let rowsWith2or3 = 0;
      let rowsWith3 = 0;
      filledRows.forEach((row) => {
        let hasExt = false;
        if (profileIdx !== -1 && row[profileIdx]) {
          const ext = extractDimensionsFromText(row[profileIdx]!);
          if (ext) {
            hasExt = true;
            if (ext.valuesCount >= 2) rowsWith2or3++;
            if (ext.valuesCount === 3) rowsWith3++;
          }
        }
        if (!hasExt) {
          for (const cell of row) {
            if (cell) {
              const ext = extractDimensionsFromText(cell);
              if (ext) {
                if (ext.valuesCount >= 2) rowsWith2or3++;
                if (ext.valuesCount === 3) rowsWith3++;
                break;
              }
            }
          }
        }
      });

      if (rowsWith2or3 > 0 && rowsWith2or3 >= Math.ceil(filledRows.length * 0.5)) {
        calloutSuppliesThkAndWid = true;
      }
      if (rowsWith3 > 0 && rowsWith3 >= Math.ceil(filledRows.length * 0.5)) {
        calloutSuppliesLen = true;
      }
    }

    const hasLen = lenIdx !== -1 || calloutSuppliesLen;
    const hasWid = widIdx !== -1 || calloutSuppliesThkAndWid;
    const hasThk = thkIdx !== -1 || calloutSuppliesThkAndWid;
    const hasQty = qtyIdx !== -1 || filledRows.length > 0; // default qty 1 if rows exist

    const missing: string[] = [];
    if (!hasLen) missing.push("Length (mm) *");
    if (!hasWid) missing.push("Width (mm) *");
    if (!hasThk) missing.push("Thickness (mm) *");
    if (qtyIdx === -1 && filledRows.length === 0) missing.push("Quantity *");

    const allMapped = missing.length === 0;
    return {
      allMapped,
      missing,
      hasLen,
      hasWid,
      hasThk,
      hasQty,
      calloutSuppliesThkAndWid,
      calloutSuppliesLen,
    };
  }, [columnIndices, grid]);

  // Statistics calculation based on mapped columns and extracted callout dimensions
  const stats = useMemo(() => {
    let filledRows = 0;
    let totalPieces = 0;
    let estimatedWeight = 0;

    grid.forEach((row) => {
      const rowDims = getRowDimensions(row, columnIndices);
      if (rowDims.length && rowDims.width && rowDims.thickness && rowDims.qty > 0) {
        filledRows++;
        totalPieces += rowDims.qty;
        // steel density: 7.85e-6 kg/mm^3
        const rowKg =
          ((rowDims.length * rowDims.width * rowDims.thickness * 7.85) / 1_000_000) *
          rowDims.qty;
        estimatedWeight += rowKg;
      } else if (row.some((v) => v && v.trim() !== "")) {
        filledRows++;
      }
    });

    return {
      filledRows,
      totalPieces,
      estimatedWeight: Math.round(estimatedWeight),
    };
  }, [grid, columnIndices]);

  // Commit editing cell
  const commitEdit = useCallback(
    (nextCellAfterCommit?: { r: number; c: number }) => {
      if (!editingCell) return;
      const { r, c } = editingCell;
      const newGrid = grid.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? editValue : cell)) : row,
      );
      commitToHistory(newGrid);
      setEditingCell(null);
      if (nextCellAfterCommit) {
        setSelectedCell(nextCellAfterCommit);
        setSelectionRange({
          startR: nextCellAfterCommit.r,
          startC: nextCellAfterCommit.c,
          endR: nextCellAfterCommit.r,
          endC: nextCellAfterCommit.c,
        });
      }
    },
    [editingCell, editValue, grid, commitToHistory],
  );

  const startEditCell = useCallback(
    (r: number, c: number, initialChar?: string) => {
      setEditingCell({ r, c });
      setEditValue(initialChar !== undefined ? initialChar : grid[r]?.[c] || "");
    },
    [grid],
  );

  // -------------------------------------------------------------
  // COLUMN MANAGEMENT & FIELD MAPPING HANDLERS
  // -------------------------------------------------------------
  const handleUpdateColumnField = (colIndex: number, newField: ColumnFieldType) => {
    const fieldOpt = FIELD_OPTIONS.find((f) => f.value === newField);
    const cleanTitle = fieldOpt && newField !== "unmapped" ? fieldOpt.label.replace(/^[^\w\s]*\s*/, "") : "";
    setColumns((prev) => {
      const updated = [...prev];
      const targetCol = updated[colIndex];
      if (targetCol) {
        updated[colIndex] = {
          ...targetCol,
          field: newField,
          title: cleanTitle,
        };
      }
      return updated;
    });

    if (newField !== "unmapped") {
      const fieldLabel = fieldOpt?.label || newField;
      const colLetter = columns[colIndex]?.letter || getColumnLetter(colIndex);
      toast.success(`Column ${colLetter} mapped to ${fieldLabel}`, {
        description: "SteelNest AI will now extract this property from this column.",
      });
    }
  };

  const handleAddColumn = () => {
    const newIdx = columns.length;
    const newLetter = getColumnLetter(newIdx);
    const newCol: WorkbookColumn = {
      id: `col-custom-${Date.now()}`,
      letter: newLetter,
      field: "unmapped",
      title: "",
      width: 140,
      align: "left",
      placeholder: `Col ${newLetter} Name...`,
    };

    setColumns((prev) => [...prev, newCol]);
    setGrid((prev) => prev.map((row) => [...row, ""]));
    toast.info(`Added new Column ${newLetter}`);
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (columns.length <= 2) {
      toast.error("Workbook requires at least 2 columns.");
      return;
    }

    const removedCol = columns[colIndex];
    if (!removedCol) return;

    const newCols = columns
      .filter((_, idx) => idx !== colIndex)
      .map((col, idx) => ({
        ...col,
        letter: getColumnLetter(idx),
      }));

    const newGrid = grid.map((row) => row.filter((_, idx) => idx !== colIndex));

    setColumns(newCols);
    commitToHistory(newGrid);

    setSelectedCell((prev) => ({
      r: prev.r,
      c: Math.min(newCols.length - 1, prev.c),
    }));
    setSelectionRange((prev) => ({
      startR: prev.startR,
      startC: Math.min(newCols.length - 1, prev.startC),
      endR: prev.endR,
      endC: Math.min(newCols.length - 1, prev.endC),
    }));

    toast.info(`Deleted Column ${removedCol.letter} (${removedCol.title || "unnamed"})`);
  };

  // -------------------------------------------------------------
  // CLIPBOARD COPY / PASTE ENGINE
  // -------------------------------------------------------------
  const parseClipboardText = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((line) => line.trim().length > 0);

      if (lines.length === 0) return;

      const firstLine = lines[0] ?? "";
      const hasTabs = firstLine.includes("\t");
      const parsedMatrix: string[][] = lines.map((line) => {
        if (hasTabs) {
          return line.split("\t").map((cell) => cell.replace(/^"(.*)"$/, "$1").trim());
        }
        return line.split(",").map((cell) => cell.replace(/^"(.*)"$/, "$1").trim());
      });

      const startR = selectedCell.r;
      const startC = selectedCell.c;
      const maxColsNeeded = Math.max(columns.length, startC + Math.max(...parsedMatrix.map((r) => r.length)));

      let currentCols = [...columns];
      if (maxColsNeeded > currentCols.length) {
        for (let ci = currentCols.length; ci < maxColsNeeded; ci++) {
          const letter = getColumnLetter(ci);
          currentCols.push({
            id: `col-auto-${ci}-${Date.now()}`,
            letter,
            field: "unmapped",
            title: "",
            width: 140,
            align: "left",
            placeholder: `Col ${letter} Name...`,
          });
        }
      }

      // Check if row 0 contains headers (e.g. "Item", "Description", "Length")
      let skipFirstRow = false;
      const firstRow = parsedMatrix[0] ?? [];
      const headerKeywords = /item|part|mark|desc|profile|section|material|grade|thk|thick|len|length|wid|width|qty|quantity|nos|pcs/i;
      const headerMatchCount = firstRow.filter((val) => headerKeywords.test(val)).length;

      if (headerMatchCount >= 2 && startR === 0) {
        skipFirstRow = true;
        firstRow.forEach((hTitle, ci) => {
          const destColIdx = startC + ci;
          const targetCol = currentCols[destColIdx];
          if (targetCol && hTitle.trim()) {
            const detectedField = detectFieldFromName(hTitle);
            currentCols[destColIdx] = {
              ...targetCol,
              title: hTitle.trim(),
              field: detectedField !== "unmapped" ? detectedField : targetCol.field,
            };
          }
        });
        setColumns(currentCols);
        toast.success("Headers Recognized & Mapped!", {
          description: "Configured column names and extraction fields from pasted headers.",
        });
      }

      const rowsToInsert = skipFirstRow ? parsedMatrix.slice(1) : parsedMatrix;
      const neededRows = Math.max(grid.length, startR + rowsToInsert.length);
      const newGrid: string[][] = createBlankRows(neededRows, currentCols.length);

      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < currentCols.length; c++) {
          if (newGrid[r]) {
            newGrid[r]![c] = grid[r]?.[c] || "";
          }
        }
      }

      let insertedRows = 0;
      let insertedCols = 0;

      rowsToInsert.forEach((pRow, ri) => {
        const destR = startR + ri;
        if (destR >= newGrid.length) return;
        insertedRows++;
        pRow.forEach((val, ci) => {
          const destC = startC + ci;
          if (destC < currentCols.length && newGrid[destR]) {
            newGrid[destR]![destC] = val;
            insertedCols = Math.max(insertedCols, ci + 1);
          }
        });
      });

      commitToHistory(newGrid);

      const endR = Math.min(newGrid.length - 1, startR + rowsToInsert.length - 1);
      const endC = Math.min(currentCols.length - 1, startC + insertedCols - 1);
      setSelectionRange({ startR, startC, endR, endC });

      toast.success("Pasted from Clipboard!", {
        description: `Successfully inserted ${insertedRows} rows and ${insertedCols} columns into workbook.`,
      });
    },
    [grid, selectedCell, columns, commitToHistory],
  );

  const handlePasteEvent = useCallback(
    (e: React.ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          if (target !== cellEditInputRef.current) {
            return;
          }
        }
      }
      if (editingCell) return;
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      parseClipboardText(text);
    },
    [editingCell, parseClipboardText],
  );

  const handlePasteFromButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error("Clipboard is empty", {
          description: "Copy rows from Excel, Google Sheets, or CSV first, then paste here.",
        });
        return;
      }
      parseClipboardText(text);
    } catch {
      toast.error("Clipboard access denied", {
        description: "Please press Ctrl+V directly on the grid to paste.",
      });
    }
  };

  const handleCopySelected = useCallback(() => {
    const lines: string[] = [];
    for (let r = selMinR; r <= selMaxR; r++) {
      const rowVals: string[] = [];
      for (let c = selMinC; c <= selMaxC; c++) {
        rowVals.push(grid[r]?.[c] || "");
      }
      lines.push(rowVals.join("\t"));
    }
    const tsv = lines.join("\r\n");
    navigator.clipboard.writeText(tsv);
    toast.success("Copied to Clipboard", {
      description: `Copied ${selMaxR - selMinR + 1} rows to clipboard in standard Excel format.`,
    });
  }, [grid, selMinR, selMaxR, selMinC, selMaxC]);

  // -------------------------------------------------------------
  // SIGNATURE FEATURE: DRAG-TO-FILL AUTOFILL HANDLE
  // -------------------------------------------------------------
  const executeAutoFill = useCallback(
    (
      srcRange: { minR: number; maxR: number; minC: number; maxC: number },
      tgtRange: { minR: number; maxR: number; minC: number; maxC: number },
      fillMode: "copy" | "series" = "copy",
      baseGrid: string[][] = grid,
    ) => {
      const newGrid = baseGrid.map((r) => [...r]);

      for (let c = tgtRange.minC; c <= tgtRange.maxC; c++) {
        const srcVals: string[] = [];
        for (let r = srcRange.minR; r <= srcRange.maxR; r++) {
          srcVals.push(baseGrid[r]?.[c] || "");
        }

        const srcLen = srcVals.length;
        if (srcLen === 0) continue;

        const singleVal = srcVals[0] ?? "";
        const numSuffixMatch = singleVal.match(/^(.*?)(\d+)$/);

        const allNumeric = srcVals.every((v) => v !== "" && !isNaN(Number(v)));
        let numericStep = 0;
        if (allNumeric && srcLen >= 2) {
          const first = Number(srcVals[0]);
          const last = Number(srcVals[srcLen - 1]);
          numericStep = (last - first) / (srcLen - 1);
        }

        // Fill downward
        if (tgtRange.maxR > srcRange.maxR) {
          let stepCounter = 1;
          for (let r = srcRange.maxR + 1; r <= tgtRange.maxR; r++) {
            if (!newGrid[r]) continue;
            if (fillMode === "series" && numSuffixMatch && srcLen === 1 && numSuffixMatch[1] !== undefined && numSuffixMatch[2] !== undefined) {
              const prefix = numSuffixMatch[1];
              const digits = numSuffixMatch[2];
              const nextNum = parseInt(digits, 10) + stepCounter;
              newGrid[r]![c] = `${prefix}${String(nextNum).padStart(digits.length, "0")}`;
            } else if (fillMode === "series" && allNumeric && srcLen >= 2) {
              const base = Number(srcVals[srcLen - 1]);
              newGrid[r]![c] = String(Math.round((base + numericStep * stepCounter) * 100) / 100);
            } else {
              // Default "copy": duplicate exact values without incrementing!
              const patternIdx = (stepCounter - 1) % srcLen;
              newGrid[r]![c] = srcVals[patternIdx] ?? "";
            }
            stepCounter++;
          }
        }

        // Fill upward
        if (tgtRange.minR < srcRange.minR) {
          let stepCounter = 1;
          for (let r = srcRange.minR - 1; r >= tgtRange.minR; r--) {
            if (!newGrid[r]) continue;
            if (fillMode === "series" && numSuffixMatch && srcLen === 1 && numSuffixMatch[1] !== undefined && numSuffixMatch[2] !== undefined) {
              const prefix = numSuffixMatch[1];
              const digits = numSuffixMatch[2];
              const prevNum = Math.max(1, parseInt(digits, 10) - stepCounter);
              newGrid[r]![c] = `${prefix}${String(prevNum).padStart(digits.length, "0")}`;
            } else if (fillMode === "series" && allNumeric && srcLen >= 2) {
              const base = Number(srcVals[0]);
              newGrid[r]![c] = String(Math.round((base - numericStep * stepCounter) * 100) / 100);
            } else {
              // Default "copy": duplicate exact values without incrementing!
              const patternIdx = (srcLen - (stepCounter % srcLen)) % srcLen;
              newGrid[r]![c] = srcVals[patternIdx] ?? "";
            }
            stepCounter++;
          }
        }
      }

      commitToHistory(newGrid);
      setSelectionRange({
        startR: tgtRange.minR,
        startC: tgtRange.minC,
        endR: tgtRange.maxR,
        endC: tgtRange.maxC,
      });

      setLastAutoFill({
        srcRange,
        tgtRange,
        mode: fillMode,
        savedSourceGrid: baseGrid,
      });

      const filledCellsCount =
        (tgtRange.maxR - tgtRange.minR + 1) * (tgtRange.maxC - tgtRange.minC + 1) -
        (srcRange.maxR - srcRange.minR + 1) * (srcRange.maxC - srcRange.minC + 1);

      if (fillMode === "series") {
        toast.success("Excel Auto-Fill: Series Filled (+1)", {
          description: `Incremented ${filledCellsCount} cells in sequence.`,
        });
      } else {
        toast.success("Excel Auto-Fill: Copied Values", {
          description: `Copied exact values to ${filledCellsCount} cells without incrementing.`,
        });
      }
    },
    [grid, commitToHistory],
  );

  // Global mouse handlers for fill handle drag and selection drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingFill && !isSelectingRange) return;

      const cellElement = (e.target as HTMLElement)?.closest("[data-grid-cell]");
      if (!cellElement) return;

      const hoverR = parseInt(cellElement.getAttribute("data-r") || "-1", 10);
      const hoverC = parseInt(cellElement.getAttribute("data-c") || "-1", 10);
      if (hoverR < 0 || hoverC < 0) return;

      if (isDraggingFill && fillSourceRangeRef.current) {
        const src = fillSourceRangeRef.current;
        const srcMinR = Math.min(src.startR, src.endR);
        const srcMaxR = Math.max(src.startR, src.endR);
        const srcMinC = Math.min(src.startC, src.endC);
        const srcMaxC = Math.max(src.startC, src.endC);

        if (hoverR > srcMaxR) {
          setFillDragPreview({
            startR: srcMinR,
            startC: srcMinC,
            endR: hoverR,
            endC: srcMaxC,
          });
        } else if (hoverR < srcMinR) {
          setFillDragPreview({
            startR: hoverR,
            startC: srcMinC,
            endR: srcMaxR,
            endC: srcMaxC,
          });
        } else {
          setFillDragPreview(null);
        }
      } else if (isSelectingRange) {
        setSelectionRange((prev) => ({
          ...prev,
          endR: hoverR,
          endC: hoverC,
        }));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDraggingFill && fillDragPreview && fillSourceRangeRef.current) {
        const src = fillSourceRangeRef.current;
        const srcRange = {
          minR: Math.min(src.startR, src.endR),
          maxR: Math.max(src.startR, src.endR),
          minC: Math.min(src.startC, src.endC),
          maxC: Math.max(src.startC, src.endC),
        };
        const tgtRange = {
          minR: Math.min(fillDragPreview.startR, fillDragPreview.endR),
          maxR: Math.max(fillDragPreview.startR, fillDragPreview.endR),
          minC: Math.min(fillDragPreview.startC, fillDragPreview.endC),
          maxC: Math.max(fillDragPreview.startC, fillDragPreview.endC),
        };

        const mode: "copy" | "series" = e.ctrlKey ? "series" : "copy";
        executeAutoFill(srcRange, tgtRange, mode, grid);
      }

      setIsDraggingFill(false);
      setFillDragPreview(null);
      fillSourceRangeRef.current = null;
      setIsSelectingRange(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingFill, isSelectingRange, fillDragPreview, executeAutoFill]);

  const handleFillHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFill(true);
    fillSourceRangeRef.current = {
      startR: selMinR,
      startC: selMinC,
      endR: selMaxR,
      endC: selMaxC,
    };
  };

  // Keyboard navigation & hotkeys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If typing inside ANY input, textarea, or select outside of the spreadsheet's active cell editor, DO NOT INTERCEPT!
    const target = e.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
        if (target !== cellEditInputRef.current) {
          return;
        }
      }
    }

    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        const nextR = Math.min(grid.length - 1, editingCell.r + 1);
        commitEdit({ r: nextR, c: editingCell.c });
      } else if (e.key === "Tab") {
        e.preventDefault();
        const nextC = Math.min(columns.length - 1, editingCell.c + 1);
        commitEdit({ r: editingCell.r, c: nextC });
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextR = Math.min(grid.length - 1, selectedCell.r + 1);
      setSelectedCell({ r: nextR, c: selectedCell.c });
      setSelectionRange({ startR: nextR, startC: selectedCell.c, endR: nextR, endC: selectedCell.c });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextR = Math.max(0, selectedCell.r - 1);
      setSelectedCell({ r: nextR, c: selectedCell.c });
      setSelectionRange({ startR: nextR, startC: selectedCell.c, endR: nextR, endC: selectedCell.c });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextC = Math.min(columns.length - 1, selectedCell.c + 1);
      setSelectedCell({ r: selectedCell.r, c: nextC });
      setSelectionRange({ startR: selectedCell.r, startC: nextC, endR: selectedCell.r, endC: nextC });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const nextC = Math.max(0, selectedCell.c - 1);
      setSelectedCell({ r: selectedCell.r, c: nextC });
      setSelectionRange({ startR: selectedCell.r, startC: nextC, endR: selectedCell.r, endC: nextC });
    } else if (e.key === "Enter") {
      e.preventDefault();
      startEditCell(selectedCell.r, selectedCell.c);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const nextC = selectedCell.c < columns.length - 1 ? selectedCell.c + 1 : 0;
      const nextR =
        selectedCell.c < columns.length - 1
          ? selectedCell.r
          : Math.min(grid.length - 1, selectedCell.r + 1);
      setSelectedCell({ r: nextR, c: nextC });
      setSelectionRange({ startR: nextR, startC: nextC, endR: nextR, endC: nextC });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const newGrid = grid.map((r, ri) =>
        ri >= selMinR && ri <= selMaxR
          ? r.map((c, ci) => (ci >= selMinC && ci <= selMaxC ? "" : c))
          : r,
      );
      commitToHistory(newGrid);
    } else if (e.ctrlKey || e.metaKey) {
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleCopySelected();
      } else if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        handleRedo();
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      startEditCell(selectedCell.r, selectedCell.c, e.key);
    }
  };

  const handleAddRows = (count: number) => {
    const blank = createBlankRows(count, columns.length);
    commitToHistory([...grid, ...blank]);
    toast.info(`Added +${count} blank rows`);
  };

  // Clear sheet — resets both grid rows and column titles/mappings
  const handleClearSheet = () => {
    setColumns(createBlankColumns(7));
    setGrid(createBlankRows(INITIAL_ROW_COUNT, 7));
    setSelectedCell({ r: 0, c: 0 });
    setSelectionRange({ startR: 0, startC: 0, endR: 0, endC: 0 });
    toast.info("Cleared workbook and reset all column names");
  };

  // Load complete sample BOM — populates standard column names, property mappings, and sample plate parts
  const handleLoadSampleBom = () => {
    const sampleCols: WorkbookColumn[] = SAMPLE_COLUMNS_DEF.map((def, idx) => ({
      id: `col-sample-${idx}`,
      letter: getColumnLetter(idx),
      field: def.field,
      title: def.title,
      width: def.field === "description" ? 200 : 140,
      align: def.field === "item" || def.field === "description" || def.field === "material" ? "left" : "right",
      placeholder: `Col ${getColumnLetter(idx)} Name...`,
    }));

    setColumns(sampleCols);

    const newGrid = createBlankRows(Math.max(INITIAL_ROW_COUNT, SAMPLE_BOM_ROWS.length), sampleCols.length);
    SAMPLE_BOM_ROWS.forEach((row, r) => {
      row.forEach((val, c) => {
        if (newGrid[r]) {
          newGrid[r]![c] = val;
        }
      });
    });

    commitToHistory(newGrid);
    setSelectedCell({ r: 0, c: 0 });
    setSelectionRange({ startR: 0, startC: 0, endR: SAMPLE_BOM_ROWS.length - 1, endC: 6 });
    toast.success("Loaded Sample Structural Steel BOM", {
      description: "Sample columns & plate line items loaded. All required columns (*) mapped.",
    });
  };

  // Export current grid to XLSX file
  const handleExportXlsx = () => {
    const headers = columns.map((c) => c.title || `Column ${c.letter}`);
    const dataRows = grid.filter((r) => r.some((v) => v.trim() !== ""));
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fabrication BOM");
    XLSX.writeFile(workbook, "Fabrication_BOM_SteelNest.xlsx");
    toast.success("Downloaded Excel BOM (.xlsx)");
  };

  // -------------------------------------------------------------
  // APPLY / IMPORT WORKBOOK INTO NESTING OPTIMIZER
  // VALIDATES ALL * REQUIRED COLUMNS BEFORE PROCEEDING
  // -------------------------------------------------------------
  const handleApplyToOptimizer = () => {
    // 1. Validate * Required Columns Mapping
    if (!requiredValidation.allMapped) {
      toast.error("Required Column Mappings Missing (*)", {
        description: `Please map all required columns marked with *: ${requiredValidation.missing.join(", ")} before proceeding.`,
      });
      return;
    }

    const filledRows = grid.filter((r) => r.some((cell) => cell.trim() !== ""));

    if (filledRows.length === 0) {
      toast.error("Workbook has no data rows", {
        description: "Please paste or enter at least one plate component before optimizing.",
      });
      return;
    }

    const { itemIdx, descIdx, matIdx } = columnIndices;

    const parts: Part[] = [];
    const invalidRows: number[] = [];

    filledRows.forEach((row, idx) => {
      const rowDims = getRowDimensions(row, columnIndices);
      const item = (itemIdx !== -1 && row[itemIdx]?.trim()) || `P-${String(idx + 1).padStart(3, "0")}`;
      const description =
        (descIdx !== -1 && row[descIdx]?.trim()) ||
        rowDims.calloutStr ||
        "FABRICATION PLATE";
      const material = (matIdx !== -1 && row[matIdx]?.trim()) || "IS:2062 E250A";

      if (
        !rowDims.length ||
        !rowDims.width ||
        !rowDims.thickness ||
        !rowDims.qty ||
        rowDims.length <= 0 ||
        rowDims.width <= 0 ||
        rowDims.thickness <= 0 ||
        rowDims.qty <= 0
      ) {
        invalidRows.push(idx + 1);
        return;
      }

      parts.push({
        id: `wb-part-${idx + 1}-${Date.now()}`,
        item,
        description,
        material,
        thickness: rowDims.thickness,
        length: rowDims.length,
        width: rowDims.width,
        qty: Math.max(1, rowDims.qty),
      });
    });

    if (parts.length === 0) {
      toast.error("No valid plates detected in filled rows", {
        description: `Ensure the mapped required columns (* Length, * Width, * Thickness, * Quantity) contain positive numbers.`,
      });
      return;
    }

    const fileInfo = {
      name: `Excel Workbook Entry (${parts.length} Items)`,
      size: parts.length * 128,
      type: "EXCEL_WORKBOOK",
      rows: parts.length,
      materials: new Set(parts.map((p) => p.material)).size,
    };

    store.setParsedParts(fileInfo, parts, []);

    toast.success(`Loaded ${parts.length} parts into Nesting Engine!`, {
      description: `All * required columns verified. Cut layout optimizer is executing now.`,
    });

    if (onApplied) onApplied();
  };

  const { lenIdx, widIdx, thkIdx, qtyIdx } = columnIndices;

  return (
    <div
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handlePasteEvent}
      tabIndex={0}
      className="relative rounded-2xl border-2 border-emerald-600/30 bg-card shadow-soft overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all mb-6"
    >
      {/* EXCEL RIBBON TOOLBAR */}
      <div className="bg-emerald-700 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-white/20 text-white shadow-inner font-bold text-base">
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
                <span>Excel Live BOM Workbook</span>
                <span className="text-[10px] uppercase font-mono bg-white/20 px-2 py-0.5 rounded-md font-semibold">
                  {importedFileName ? `Imported: ${importedFileName}` : "Interactive Grid · Map * Required"}
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-emerald-100 mt-0.5">
              Paste or type your data, name columns, and map properties marked with <strong className="text-amber-200">*</strong> before proceeding.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handlePasteFromButton}
            className="h-8 px-3 rounded-lg text-xs font-bold bg-white text-emerald-950 hover:bg-emerald-50 border border-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Paste tab-delimited or table data from your clipboard (Ctrl+V)"
          >
            <ClipboardPaste className="size-3.5 text-emerald-700" />
            <span>Paste from Excel</span>
          </button>

          <button
            type="button"
            onClick={handleCopySelected}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-500/60 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Copy selected cells to clipboard (Ctrl+C)"
          >
            <Copy className="size-3.5 text-emerald-200" />
            <span>Copy (Ctrl+C)</span>
          </button>

          <div className="h-4 w-px bg-white/30 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={handleAddColumn}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-500/60 shadow-xs flex items-center gap-1 transition-all cursor-pointer"
            title="Add a new column to the spreadsheet"
          >
            <Plus className="size-3.5" />
            <span>+ Column</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddRows(5)}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-500/60 shadow-xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>+5 Rows</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSampleBom}
            className="h-8 px-3 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Populate table with standard structural steel fabrication plates"
          >
            <Sparkles className="size-3.5 text-amber-900" />
            <span>Sample BOM</span>
          </button>

          <button
            type="button"
            onClick={handleExportXlsx}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-500/60 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download table as an Excel (.xlsx) file"
          >
            <Download className="size-3.5 text-emerald-200" />
            <span>Export .XLSX</span>
          </button>

          <button
            type="button"
            onClick={handleClearSheet}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-500/60 shadow-xs flex items-center transition-all cursor-pointer"
            title="Clear all rows and reset column names"
          >
            <Trash2 className="size-3.5 text-rose-200" />
          </button>

          <button
            type="button"
            onClick={() => setIsStockPanelExpanded((prev) => !prev)}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border",
              isStockPanelExpanded
                ? "bg-amber-400 text-slate-950 border-amber-300 font-black ring-2 ring-white/60"
                : "bg-white text-emerald-950 hover:bg-emerald-50 border-white font-bold"
            )}
            title="Toggle Right-Hand Available Stock Sheet Sizes (e.g. CHQ 1500×6000 thk 4)"
          >
            <Layers className={cn("size-3.5", isStockPanelExpanded ? "text-slate-950" : "text-amber-600")} />
            <span>Stock Sizes</span>
            {isStockPanelExpanded ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>

          <div className="h-4 w-px bg-white/30 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={handleApplyToOptimizer}
            className={cn(
              "h-8 px-4 rounded-lg text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer",
              requiredValidation.allMapped
                ? "bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-white/60 animate-pulse"
                : "bg-slate-950 hover:bg-slate-900 text-slate-100 border border-slate-700"
            )}
            title={
              requiredValidation.allMapped
                ? "All required fields mapped! Click to run nesting optimization"
                : `Map required columns marked with * (${requiredValidation.missing.join(", ")}) before proceeding`
            }
          >
            <CheckCircle className="size-3.5" />
            <span>{requiredValidation.allMapped ? "Proceed to Nesting" : "Map Required (*) to Proceed"}</span>
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>

      {/* * REQUIRED MAPPING CHECKLIST BANNER */}
      <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold flex items-center gap-1 text-foreground">
            <span className="text-rose-600 font-extrabold text-sm">*</span>
            <span>Required Columns before Proceeding:</span>
          </span>

          {/* Length * Pill */}
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-colors",
              requiredValidation.hasLen
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse",
            )}
          >
            {requiredValidation.hasLen ? "✓" : "*"} Length (mm){" "}
            {lenIdx !== -1
              ? `(Col ${columns[lenIdx]?.letter})`
              : requiredValidation.calloutSuppliesLen
              ? "(Auto: 3 values)"
              : "Missing *"}
          </span>

          {/* Width * Pill */}
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-colors",
              requiredValidation.hasWid
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse",
            )}
          >
            {requiredValidation.hasWid ? "✓" : "*"} Width (mm){" "}
            {widIdx !== -1
              ? `(Col ${columns[widIdx]?.letter})`
              : requiredValidation.calloutSuppliesThkAndWid
              ? "(Auto: width > thk)"
              : "Missing *"}
          </span>

          {/* Thickness * Pill */}
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-colors",
              requiredValidation.hasThk
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse",
            )}
          >
            {requiredValidation.hasThk ? "✓" : "*"} Thickness (mm){" "}
            {thkIdx !== -1
              ? `(Col ${columns[thkIdx]?.letter})`
              : requiredValidation.calloutSuppliesThkAndWid
              ? "(Auto: width > thk)"
              : "Missing *"}
          </span>

          {/* Quantity * Pill */}
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-colors",
              requiredValidation.hasQty
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse",
            )}
          >
            {requiredValidation.hasQty ? "✓" : "*"} Quantity{" "}
            {qtyIdx !== -1
              ? `(Col ${columns[qtyIdx]?.letter})`
              : stats.filledRows > 0
              ? "(Default: 1 pc)"
              : "Missing *"}
          </span>

          {/* Callout Indicator Badge */}
          {requiredValidation.calloutSuppliesThkAndWid && (
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-[10px] flex items-center gap-1">
              <span>📏 Auto-Callout active:</span>
              <strong className="font-mono">width &gt; thk</strong>
            </span>
          )}
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono shrink-0 hidden md:flex">
          <div>
            <span>Filled: </span>
            <strong className="text-foreground">{stats.filledRows} rows</strong>
          </div>
          <div>
            <span>Total Pcs: </span>
            <strong className="text-primary">{stats.totalPieces.toLocaleString()}</strong>
          </div>
          <div>
            <span>Est Net Wt: </span>
            <strong className="text-emerald-600 dark:text-emerald-400">
              {stats.estimatedWeight.toLocaleString()} kg
            </strong>
          </div>
        </div>
      </div>

      {/* WORKBOOK CONTENT: LEFT SCROLLABLE MAIN EXCEL GRID + RIGHT EXPANDABLE STOCK SIZES SHEET */}
      <div className="flex flex-col lg:flex-row items-stretch border-b">
        {/* LEFT: Scrollable Main Excel Workbook Grid */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* FORMULA & COORDINATE STATUS BAR */}
          <div className="bg-muted/60 border-b px-3 py-1.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="font-mono font-bold bg-background border rounded px-2.5 py-1 text-[11px] text-primary shadow-2xs w-16 text-center select-none">
                {activeCoordLabel}
              </div>
              <span className="text-muted-foreground font-serif italic text-sm font-semibold select-none">
                fx
              </span>
              <Input
                value={editingCell ? editValue : activeCellValue}
                onChange={(e) => {
                  if (editingCell) {
                    setEditValue(e.target.value);
                  } else {
                    startEditCell(selectedCell.r, selectedCell.c, e.target.value);
                  }
                }}
                placeholder="Cell value or double click any cell to edit"
                className="h-7 text-xs font-mono flex-1 bg-background"
              />
            </div>
          </div>

          {/* SPREADSHEET GRID TABLE WITH EDITABLE BLANK COLUMN HEADERS & MULTI-COLUMN HORIZONTAL SCROLL */}
          <div className="overflow-x-auto overflow-y-auto max-h-[480px] select-none relative scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
            <table className="min-w-max w-full text-xs border-collapse font-sans table-fixed">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 shadow-xs">
                {/* Top Row: Column Letters A, B, C... & Delete Column Button */}
                <tr className="border-b border-slate-300 dark:border-slate-800 text-muted-foreground text-[10px] font-mono">
                  <th className="w-12 min-w-[48px] sticky top-0 left-0 z-40 bg-slate-300 dark:bg-slate-950 border-r border-slate-300 dark:border-slate-800 text-center py-1">
                    #
                  </th>
                  {columns.map((col, colIdx) => (
                    <th
                      key={`letter-${col.id}`}
                      style={{ width: col.width || 150, minWidth: col.width || 150 }}
                      className="border-r border-slate-300 dark:border-slate-800 px-2 py-1 font-bold text-center tracking-wider text-slate-700 dark:text-slate-300 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{col.letter}</span>
                        {columns.length > 2 && (
                          <button
                            onClick={() => handleDeleteColumn(colIdx)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-500 rounded transition-opacity"
                            title={`Delete Column ${col.letter}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Quick + Add Column cell at end of header */}
                  <th className="w-10 min-w-[42px] bg-slate-200/80 dark:bg-slate-950 border-r border-slate-300 dark:border-slate-800 text-center py-1">
                    <button
                      type="button"
                      onClick={handleAddColumn}
                      className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-800 dark:text-emerald-300 font-bold transition-colors cursor-pointer"
                      title="Add new column (+)"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </th>
                </tr>

                {/* Sub Row: PROPERTY DROPDOWN MAPPER ONLY */}
                <tr className="border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-foreground">
                  <th className="w-12 min-w-[48px] sticky left-0 z-30 bg-slate-200 dark:bg-slate-950 border-r border-slate-300 dark:border-slate-800 text-center py-2.5">
                    <span className="text-[10px] text-muted-foreground font-mono font-bold">PROP</span>
                  </th>
                  {columns.map((col, colIdx) => {
                    const currentOpt = FIELD_OPTIONS.find((f) => f.value === col.field);
                    const isUnmapped = col.field === "unmapped";

                    return (
                      <th
                        key={`header-${col.id}`}
                        style={{ width: col.width || 150, minWidth: col.width || 150 }}
                        className="border-r border-slate-300 dark:border-slate-800 p-1.5 text-left align-middle"
                      >
                        {/* Property Dropdown Selector Only (No manual name input) */}
                        <div className="relative">
                          <select
                            value={col.field}
                            onChange={(e) =>
                              handleUpdateColumnField(colIdx, e.target.value as ColumnFieldType)
                            }
                            className={cn(
                              "w-full h-8 text-xs font-bold rounded-lg px-2 appearance-none cursor-pointer border pr-6 transition-all shadow-2xs",
                              isUnmapped
                                ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400 font-bold animate-pulse hover:bg-amber-500/15"
                                : currentOpt?.badgeClass || "bg-background text-foreground border-input",
                            )}
                            title={`Select what property Column ${col.letter} represents`}
                          >
                            {FIELD_OPTIONS.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                className={cn(
                                  "bg-popover text-popover-foreground py-1",
                                  opt.isRequired && "font-bold text-emerald-600",
                                )}
                              >
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="size-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-10 min-w-[42px] bg-slate-50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-800 text-center py-1">
                    <span className="text-[10px] text-muted-foreground font-mono">+</span>
                  </th>
                </tr>
              </thead>

          {/* Table Body: Spreadsheet Rows */}
          <tbody>
            {grid.map((row, r) => {
              const isRowSelected = r >= selMinR && r <= selMaxR;

              return (
                <tr
                  key={`row-${r}`}
                  className={cn(
                    "border-b border-slate-200 dark:border-slate-800/70 transition-colors",
                    isRowSelected ? "bg-emerald-500/5" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40",
                  )}
                >
                  {/* Left Row Number (Sticky Left) */}
                  <td
                    onClick={() => {
                      setSelectedCell({ r, c: 0 });
                      setSelectionRange({ startR: r, startC: 0, endR: r, endC: columns.length - 1 });
                    }}
                    className={cn(
                      "w-12 min-w-[48px] sticky left-0 z-20 border-r border-slate-300 dark:border-slate-800 font-mono text-[11px] text-center font-bold py-1.5 cursor-pointer select-none transition-colors",
                      isRowSelected
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 dark:bg-slate-900 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800",
                    )}
                  >
                    {r + 1}
                  </td>

                  {/* Columns */}
                  {columns.map((col, c) => {
                    const cellVal = row[c] || "";
                    const isSelected = r === selectedCell.r && c === selectedCell.c;
                    const isInSelectionRange =
                      r >= selMinR && r <= selMaxR && c >= selMinC && c <= selMaxC;
                    const isEditing = editingCell?.r === r && editingCell?.c === c;

                    const isBottomRightOfSelection = r === selMaxR && c === selMaxC;

                    const isInFillPreview =
                      fillDragPreview &&
                      r >= Math.min(fillDragPreview.startR, fillDragPreview.endR) &&
                      r <= Math.max(fillDragPreview.startR, fillDragPreview.endR) &&
                      c >= Math.min(fillDragPreview.startC, fillDragPreview.endC) &&
                      c <= Math.max(fillDragPreview.startC, fillDragPreview.endC);

                    return (
                      <td
                        key={`cell-${r}-${c}`}
                        data-grid-cell="true"
                        data-r={r}
                        data-c={c}
                        style={{ width: col.width || 150, minWidth: col.width || 150 }}
                        onClick={() => {
                          if (!isEditing) {
                            setSelectedCell({ r, c });
                            setSelectionRange({ startR: r, startC: c, endR: r, endC: c });
                            setLastAutoFill(null);
                            setAutoFillOptionsOpen(false);
                          }
                        }}
                        onDoubleClick={() => startEditCell(r, c)}
                        className={cn(
                          "relative border-r border-slate-200 dark:border-slate-800/80 px-2 py-1 text-xs transition-colors font-mono cursor-cell select-none",
                          col.align === "right" ? "text-right" : "text-left",
                          isInSelectionRange && "bg-emerald-500/10 dark:bg-emerald-500/15",
                          isSelected && "ring-2 ring-emerald-600 z-10 bg-emerald-500/15 font-semibold",
                          isInFillPreview &&
                            "border-2 border-dashed border-emerald-600 bg-emerald-500/20",
                        )}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            className="w-full h-full p-0 font-mono text-xs bg-transparent border-none outline-none text-foreground font-semibold"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="truncate flex-1 font-mono">
                              {cellVal || "\u00A0"}
                            </span>
                            {/* Visual pill showing model understood dimensions */}
                            {(() => {
                              if (!cellVal || cellVal.length < 3) return null;
                              const ext = extractDimensionsFromText(cellVal);
                              if (!ext) return null;
                              if (ext.valuesCount === 2) {
                                return (
                                  <span
                                    className="text-[9px] font-sans font-bold bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 px-1 py-0.5 rounded shrink-0 tracking-tight select-none"
                                    title={`Understood Callout: Width = ${ext.width}mm > Thickness = ${ext.thickness}mm`}
                                  >
                                    W:{ext.width} T:{ext.thickness}
                                  </span>
                                );
                              }
                              if (ext.valuesCount === 3) {
                                return (
                                  <span
                                    className="text-[9px] font-sans font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 px-1 py-0.5 rounded shrink-0 tracking-tight select-none"
                                    title={`Understood Callout: Length = ${ext.length}mm > Width = ${ext.width}mm > Thickness = ${ext.thickness}mm`}
                                  >
                                    L:{ext.length} W:{ext.width} T:{ext.thickness}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}

                        {/* EXCEL DRAG-TO-FILL AUTOFILL HANDLE */}
                        {isBottomRightOfSelection && !isEditing && (
                          <>
                            <div
                              onMouseDown={handleFillHandleMouseDown}
                              className="absolute -bottom-1 -right-1 z-30 size-2.5 bg-emerald-600 border border-white dark:border-slate-900 shadow-sm cursor-crosshair rounded-[1px] hover:scale-150 transition-transform"
                              title="Drag to fill values (copies exact value by default; hold Ctrl or use + menu for series)"
                            />

                            {/* AUTOFILL OPTIONS SMART TAG (+) */}
                            {lastAutoFill && (
                              <div className="absolute -bottom-7 right-0 z-40">
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAutoFillOptionsOpen((prev) => !prev);
                                    }}
                                    className="flex items-center gap-1 rounded bg-card border border-border px-1.5 py-0.5 text-[10px] font-bold text-foreground shadow-md hover:bg-muted cursor-pointer transition-all"
                                    title="AutoFill Options (Copy Cells vs Fill Series)"
                                  >
                                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">+</span>
                                    <span>{lastAutoFill.mode === "copy" ? "Copy Cells" : "Fill Series"}</span>
                                    <ChevronDown className="size-2.5 opacity-60" />
                                  </button>

                                  {autoFillOptionsOpen && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          executeAutoFill(
                                            lastAutoFill.srcRange,
                                            lastAutoFill.tgtRange,
                                            "copy",
                                            lastAutoFill.savedSourceGrid,
                                          );
                                          setAutoFillOptionsOpen(false);
                                        }}
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs cursor-pointer transition-colors",
                                          lastAutoFill.mode === "copy"
                                            ? "bg-primary/10 text-primary font-bold"
                                            : "hover:bg-muted text-foreground",
                                        )}
                                      >
                                        <span>📋</span>
                                        <div>
                                          <div className="font-semibold leading-none">Copy Cells</div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5">Keep same exact value</div>
                                        </div>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          executeAutoFill(
                                            lastAutoFill.srcRange,
                                            lastAutoFill.tgtRange,
                                            "series",
                                            lastAutoFill.savedSourceGrid,
                                          );
                                          setAutoFillOptionsOpen(false);
                                        }}
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs cursor-pointer transition-colors mt-0.5",
                                          lastAutoFill.mode === "series"
                                            ? "bg-primary/10 text-primary font-bold"
                                            : "hover:bg-muted text-foreground",
                                        )}
                                      >
                                        <span>🔢</span>
                                        <div>
                                          <div className="font-semibold leading-none">Fill Series</div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5">Increment numbers (+1)</div>
                                        </div>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="w-10 min-w-[42px] border-r border-slate-200 dark:border-slate-800/70 bg-muted/5" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Right-Hand Expandable Stock Sheet Sizes Panel */}
    <CustomStockSheetPanel
      isExpanded={isStockPanelExpanded}
      onToggle={() => setIsStockPanelExpanded((prev) => !prev)}
    />
  </div>

      {/* FOOTER INSTRUCTIONS & PROCEED BAR */}
      <div className="bg-muted/40 border-t px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {!requiredValidation.allMapped ? (
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                Please map all required columns marked with <strong className="font-extrabold">*</strong> ({requiredValidation.missing.join(", ")}) before proceeding.
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="size-4 shrink-0" />
              <span>All required columns mapped! Ready to nest {stats.filledRows} line items.</span>
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleApplyToOptimizer}
          className={cn(
            "font-bold h-8 text-xs gap-1.5 shadow-soft transition-all",
            requiredValidation.allMapped
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-slate-700 text-slate-200 hover:bg-slate-800",
          )}
        >
          <CheckCircle className="size-3.5" />
          {requiredValidation.allMapped
            ? `Proceed to Nesting (${stats.filledRows} Items)`
            : "Map Required (*) before Proceeding"}
        </Button>
      </div>
    </div>
  );
}
