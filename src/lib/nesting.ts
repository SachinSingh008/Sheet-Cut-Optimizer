import { MATERIAL_RATE, partWeight, type Part } from "./mock-data";

export type PlacedPart = {
  key: string;
  part: Part;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  index: number;
};

export type NestedSheet = {
  id: string;
  material: string;
  thickness: number;
  sheetLength: number;
  sheetWidth: number;
  placed: PlacedPart[];
  usedArea: number;
  utilization: number;
};

export type PlateTypeConfig = {
  id: string;
  name: string;
  abbreviations: string[]; // e.g. ["CHQ", "CHEQ", "CP"]
  minThickness: number;
  maxThickness: number;
  sheetLength: number;
  sheetWidth: number;
  description?: string;
};

/** Official SAIL / Tata Steel / Jindal Mill Standard Plate Dimensions */
export const DEFAULT_PLATE_TYPES: PlateTypeConfig[] = [
  {
    id: "chq",
    name: "Chequered Plate (IS 3502 / IS 2062)",
    abbreviations: ["CHQ", "CHEQ", "CP", "CHEQUERED"],
    minThickness: 2,
    maxThickness: 12,
    sheetLength: 2500,
    sheetWidth: 1250,
    description: "Anti-skid floor & stair tread plates (SAIL std: 2500 × 1250 mm)",
  },
  {
    id: "ms-thin",
    name: "Mild Steel Plate (IS 2062 E250A Thin)",
    abbreviations: ["PL", "MS", "IS2062"],
    minThickness: 3,
    maxThickness: 10,
    sheetLength: 3000,
    sheetWidth: 1500,
    description: "Standard thin HR mill plates (SAIL std: 3000 × 1500 mm)",
  },
  {
    id: "ms-heavy",
    name: "Mild Steel Heavy Plate (IS 2062 Structural)",
    abbreviations: ["PL", "MS", "IS2062"],
    minThickness: 11,
    maxThickness: 50,
    sheetLength: 6300,
    sheetWidth: 2000,
    description: "Heavy structural bridge plates (SAIL/Jindal std: 6300 × 2000 mm)",
  },
  {
    id: "high-tensile",
    name: "High Tensile Alloy Plate (SAILMA 350HI / E350BR)",
    abbreviations: ["SAILMA", "E350BR", "HS"],
    minThickness: 8,
    maxThickness: 100,
    sheetLength: 12000,
    sheetWidth: 2500,
    description: "High strength bridge girder plates (SAIL std: 12000 × 2500 mm)",
  },
];

export type OptimizationConfig = {
  sheetLength: number;
  sheetWidth: number;
  kerf: number;
  trim: number;
  rotation: boolean;
  algorithm: string;
  plateTypes?: PlateTypeConfig[];
};

export function findMatchingPlateType(
  material: string,
  thickness: number,
  plateTypes: PlateTypeConfig[] = DEFAULT_PLATE_TYPES,
): PlateTypeConfig | null {
  const matUpper = material.toUpperCase();
  for (const pt of plateTypes) {
    const matchesAbbr = pt.abbreviations.some((abbr) => matUpper.includes(abbr.trim().toUpperCase()));
    if (matchesAbbr && thickness >= pt.minThickness && thickness <= pt.maxThickness) {
      return pt;
    }
  }
  return null;
}

/** Shelf (bottom-left) nesting — deterministic and good enough for visualization. */
export function optimize(parts: Part[], config: OptimizationConfig): OptimizationResult {
  const valid = parts.filter((p) => !p.invalid);
  const buckets = new Map<string, Part[]>();
  for (const p of valid) {
    const key = `${p.material}|${p.thickness}`;
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
  }

  const activePlateTypes = config.plateTypes ?? DEFAULT_PLATE_TYPES;
  const sheets: NestedSheet[] = [];

  for (const [key, group] of buckets) {
    const material = key.split("|")[0] ?? "Unknown";
    const thickness = Number(key.split("|")[1] ?? 0);

    // Look up plate type dimensions or use config defaults
    const matchedPlate = findMatchingPlateType(material, thickness, activePlateTypes);
    const curSheetLength = matchedPlate ? matchedPlate.sheetLength : config.sheetLength;
    const curSheetWidth = matchedPlate ? matchedPlate.sheetWidth : config.sheetWidth;

    const usableL = curSheetLength - config.trim * 2;
    const usableW = curSheetWidth - config.trim * 2;

    const queue: Array<{ part: Part; w: number; h: number; rotated: boolean }> = [];
    for (const p of group) {
      for (let i = 0; i < p.qty; i++) {
        let w = p.length;
        let h = p.width;
        let rotated = false;
        if (config.rotation && h > w) {
          [w, h] = [h, w];
          rotated = true;
        }
        if (w > usableL || h > usableW) {
          if (config.rotation && h <= usableL && w <= usableW) {
            [w, h] = [h, w];
            rotated = !rotated;
          } else {
            continue;
          }
        }
        queue.push({ part: p, w, h, rotated });
      }
    }
    queue.sort((a, b) => b.h - a.h || b.w - a.w);

    let shelfY = config.trim;
    let shelfH = 0;
    let cursorX = config.trim;
    let index = 0;

    const newSheet = (): NestedSheet => {
      const created: NestedSheet = {
        id: `S${String(sheets.length + 1).padStart(2, "0")}`,
        material,
        thickness,
        sheetLength: curSheetLength,
        sheetWidth: curSheetWidth,
        placed: [],
        usedArea: 0,
        utilization: 0,
      };
      sheets.push(created);
      shelfY = config.trim;
      shelfH = 0;
      cursorX = config.trim;
      index = 0;
      return created;
    };

    let sheet: NestedSheet | null = null;

    for (const it of queue) {
      let s: NestedSheet = sheet ?? (sheet = newSheet());
      if (cursorX + it.w > curSheetLength - config.trim) {
        shelfY += shelfH + config.kerf;
        shelfH = 0;
        cursorX = config.trim;
      }
      if (shelfY + it.h > curSheetWidth - config.trim) {
        sheet = newSheet();
        s = sheet;
      }
      s.placed.push({
        key: `${s.id}-${index}`,
        part: it.part,
        x: cursorX,
        y: shelfY,
        w: it.w,
        h: it.h,
        rotated: it.rotated,
        index: index++,
      });
      s.usedArea += it.w * it.h;
      cursorX += it.w + config.kerf;
      shelfH = Math.max(shelfH, it.h);
    }
    sheet = null;
  }

  for (const s of sheets) {
    s.utilization = (s.usedArea / (s.sheetLength * s.sheetWidth)) * 100;
  }

  const totalArea = sheets.reduce((a, s) => a + s.sheetLength * s.sheetWidth, 0) || 1;
  const usedArea = sheets.reduce((a, s) => a + s.usedArea, 0);
  const utilization = (usedArea / totalArea) * 100;
  const weight = sheets.reduce(
    (a, s) => a + s.sheetLength * s.sheetWidth * s.thickness * 7.85e-6,
    0,
  );
  const cost = sheets.reduce((a, s) => {
    const rate = MATERIAL_RATE[s.material] ?? 65;
    return a + s.sheetLength * s.sheetWidth * s.thickness * 7.85e-6 * rate;
  }, 0);
  const baselineUtil = Math.max(utilization - 14.5, 40);
  const savings = cost * (1 - baselineUtil / utilization);

  return {
    sheets,
    utilization,
    scrap: 100 - utilization,
    sheetCount: sheets.length,
    cost,
    savings: Math.max(savings, 0),
    weight,
    config,
  };
}

export function netWeight(parts: Part[]) {
  return parts.reduce((s, p) => s + partWeight(p), 0);
}
