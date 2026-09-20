export type Part = {
  id: string;
  item: string;
  description: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  qty: number;
  invalid?: string | null;
};

const STEEL_DENSITY = 7.85e-6; // kg per mm^3

export function partWeight(p: Part): number {
  const l = Number(p?.length) || 0;
  const w = Number(p?.width) || 0;
  const t = Number(p?.thickness) || 0;
  const q = Number(p?.qty) || 0;
  const val = l * w * t * STEEL_DENSITY * q;
  return isNaN(val) || !isFinite(val) ? 0 : val;
}

export function partArea(p: Part): number {
  const l = Number(p?.length) || 0;
  const w = Number(p?.width) || 0;
  const val = (l * w) / 1_000_000; // m2
  return isNaN(val) || !isFinite(val) ? 0 : val;
}

import {
  findMatchingPlateType,
  DEFAULT_PLATE_TYPES,
  type PlateTypeConfig,
  resolveSheetDimensionsForPart,
  type CustomStockSheetRule,
} from "./nesting";

export const MOCK_PARTS: Part[] = [];

export type ThicknessGroup = {
  key: string;
  thickness: number;
  plateTypeId: string;
  plateTypeName: string;
  sheetLength: number;
  sheetWidth: number;
  parts: Part[];
  pieces: number;
  weight: number;
};

export function groupByThickness(
  parts: Part[],
  plateTypes: PlateTypeConfig[] = DEFAULT_PLATE_TYPES,
  customStockSheets?: CustomStockSheetRule[]
): ThicknessGroup[] {
  const dummyConfig = {
    sheetLength: 6300,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    plateTypes,
    customStockSheets: customStockSheets ?? [],
  };
  const map = new Map<string, Part[]>();

  for (const p of parts) {
    const dim = resolveSheetDimensionsForPart(p, dummyConfig);
    const t = Number(p.thickness) || 0;
    const key = `${dim.plateTypeId}|${dim.sheetLength}x${dim.sheetWidth}|${t}`;

    const existing = map.get(key);
    if (existing) {
      existing.push(p);
    } else {
      map.set(key, [p]);
    }
  }

  return [...map.entries()]
    .map(([key, items]) => {
      const first = items[0]!;
      const dim = resolveSheetDimensionsForPart(first, dummyConfig);
      const ptId = dim.plateTypeId;
      const ptName = dim.plateTypeName;
      const sheetLength = dim.sheetLength;
      const sheetWidth = dim.sheetWidth;
      const thickness = Number(first.thickness) || 0;

      return {
        key,
        thickness,
        plateTypeId: ptId,
        plateTypeName: ptName,
        sheetLength,
        sheetWidth,
        parts: items,
        pieces: items.reduce((s, p) => s + (Number(p.qty) || 0), 0),
        weight: items.reduce((s, p) => s + partWeight(p), 0),
      };
    })
    .sort((a, b) => a.thickness - b.thickness || a.plateTypeName.localeCompare(b.plateTypeName));
}

export const MATERIAL_RATE: Record<string, number> = {
  "IS2062 E250A": 62,
  "IS2062 E350BR": 71,
  "SAILMA 350HI": 78,
};

export const SHEET_SIZES = [
  { label: "6300 × 1500 mm (Regular Standard)", length: 6300, width: 1500 },
  { label: "6000 × 1250 mm (CHQ Standard)", length: 6000, width: 1250 },
  { label: "3000 × 1500 mm", length: 3000, width: 1500 },
  { label: "2500 × 1250 mm", length: 2500, width: 1250 },
];

export const ALGORITHMS = [
  { value: "auto", label: "Adaptive Engine (Auto-detects BOM characteristics)" },
  { value: "skyline", label: "Skyline (Bottom-Left Contour)" },
  { value: "maxrects", label: "MaxRects (Best Area Fit)" },
  { value: "guillotine", label: "Guillotine (Straight Shear Cuts)" },
  { value: "hybrid", label: "Hybrid (Skyline + MaxRects Back-Fill)" },
];
