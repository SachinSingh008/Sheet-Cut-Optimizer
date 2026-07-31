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
  abbreviations: string[];
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
    name: "Mild Steel Plate (IS 2062 Thin)",
    abbreviations: ["PL", "MS", "IS2062", "IS:2062", "E250", "E250A", "E250BR", "E250C"],
    minThickness: 2,
    maxThickness: 10,
    sheetLength: 3000,
    sheetWidth: 1500,
    description: "Standard thin HR mill plates (SAIL std: 3000 × 1500 mm)",
  },
  {
    id: "ms-heavy",
    name: "Mild Steel Heavy Plate (IS 2062 Structural)",
    abbreviations: ["PL", "MS", "IS2062", "IS:2062", "E250", "E250A", "E250BR", "E250C"],
    minThickness: 11,
    maxThickness: 50,
    sheetLength: 6300,
    sheetWidth: 2000,
    description: "Heavy structural bridge plates (SAIL/Jindal std: 6300 × 2000 mm)",
  },
  {
    id: "high-tensile",
    name: "High Tensile Alloy Plate (SAILMA 350HI / E350BR)",
    abbreviations: ["SAILMA", "E350BR", "E350", "HS"],
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
  groupByMaterial?: boolean;
  plateTypes?: PlateTypeConfig[];
};

export function findMatchingPlateType(
  material: string,
  thickness: number,
  plateTypes: PlateTypeConfig[] = DEFAULT_PLATE_TYPES,
): PlateTypeConfig | null {
  const matUpper = material.toUpperCase();
  
  // 1. Primary check: match material abbreviation + thickness range
  for (const pt of plateTypes) {
    const matchesAbbr = pt.abbreviations.some((abbr) => matUpper.includes(abbr.trim().toUpperCase()));
    if (matchesAbbr && thickness >= pt.minThickness && thickness <= pt.maxThickness) {
      return pt;
    }
  }

  // 2. Fallback check: match by thickness range to ensure consistent stock sizes for same thickness
  for (const pt of plateTypes) {
    if (pt.id !== "chq" && thickness >= pt.minThickness && thickness <= pt.maxThickness) {
      return pt;
    }
  }

  return null;
}

type FreeRectangle = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type PackingItem = { part: Part; w: number; h: number; rotated: boolean };

/** Filter and merge overlapping or contained free rectangles */
function filterAndMergeFreeRectangles(rects: FreeRectangle[]): FreeRectangle[] {
  let result = rects.filter((r) => r.w > 2 && r.h > 2);

  // Remove rectangles completely contained within another free rectangle
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < result.length; j++) {
      if (i === j) continue;
      const r1 = result[i];
      const r2 = result[j];
      if (
        r1.x >= r2.x &&
        r1.y >= r2.y &&
        r1.x + r1.w <= r2.x + r2.w &&
        r1.y + r1.h <= r2.y + r2.h
      ) {
        result.splice(i, 1);
        if (i > 0) i--;
        break;
      }
    }
  }

  // Sort by bottom-left proximity to prioritize corner/edge packing
  result.sort((a, b) => a.x - b.x || a.y - b.y || b.w * b.h - a.w * a.h);
  return result;
}

/** Pack a single sheet using a specific heuristic strategy */
function packSingleSheetHeuristic(
  items: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  sheetId: string,
  heuristic: "bssf" | "baf" | "guillotine-aligned"
): { placed: PlacedPart[]; unplaced: PackingItem[]; usedArea: number } {
  const trim = config.trim;
  const kerf = config.kerf;

  let freeRects: FreeRectangle[] = [
    {
      x: trim,
      y: trim,
      w: curSheetLength - trim * 2,
      h: curSheetWidth - trim * 2,
    },
  ];

  const placed: PlacedPart[] = [];
  let remainingCandidates = [...items];
  let usedArea = 0;
  let index = 0;

  // GREEDY MULTI-PASS MAX PACKING
  while (remainingCandidates.length > 0) {
    let bestItemIdx = -1;
    let bestRectIdx = -1;
    let bestScore = Infinity;
    let chosenW = 0;
    let chosenH = 0;
    let chosenRotated = false;

    for (let itemIdx = 0; itemIdx < remainingCandidates.length; itemIdx++) {
      const item = remainingCandidates[itemIdx];
      const orientations = [{ w: item.w, h: item.h, rotated: item.rotated }];
      if (config.rotation && item.w !== item.h) {
        orientations.push({ w: item.h, h: item.w, rotated: !item.rotated });
      }

      for (let rectIdx = 0; rectIdx < freeRects.length; rectIdx++) {
        const rect = freeRects[rectIdx];
        for (const orient of orientations) {
          if (orient.w <= rect.w && orient.h <= rect.h) {
            const leftoverX = rect.w - orient.w;
            const leftoverY = rect.h - orient.h;

            let score = 0;
            if (heuristic === "bssf") {
              const shortSide = Math.min(leftoverX, leftoverY);
              const longSide = Math.max(leftoverX, leftoverY);
              score = shortSide * 1000 + longSide;
            } else if (heuristic === "baf") {
              score = rect.w * rect.h - orient.w * orient.h;
            } else if (heuristic === "guillotine-aligned") {
              const alignX = leftoverX === 0 ? -5000 : leftoverX;
              const alignY = leftoverY === 0 ? -5000 : leftoverY;
              score = alignX + alignY;
            }

            if (score < bestScore) {
              bestScore = score;
              bestItemIdx = itemIdx;
              bestRectIdx = rectIdx;
              chosenW = orient.w;
              chosenH = orient.h;
              chosenRotated = orient.rotated;
            }
          }
        }
      }
    }

    if (bestItemIdx === -1) break;

    const targetItem = remainingCandidates[bestItemIdx];
    const targetRect = freeRects[bestRectIdx];

    placed.push({
      key: `${sheetId}-${index}`,
      part: targetItem.part,
      x: targetRect.x,
      y: targetRect.y,
      w: chosenW,
      h: chosenH,
      rotated: chosenRotated,
      index: index++,
    });
    usedArea += chosenW * chosenH;

    remainingCandidates.splice(bestItemIdx, 1);

    const rightW = targetRect.w - chosenW - kerf;
    const topH = targetRect.h - chosenH - kerf;

    freeRects.splice(bestRectIdx, 1);

    if (rightW > 0 && topH > 0) {
      if (chosenW * topH >= rightW * chosenH) {
        freeRects.push({ x: targetRect.x, y: targetRect.y + chosenH + kerf, w: targetRect.w, h: topH });
        if (rightW > 0) {
          freeRects.push({ x: targetRect.x + chosenW + kerf, y: targetRect.y, w: rightW, h: chosenH });
        }
      } else {
        freeRects.push({ x: targetRect.x + chosenW + kerf, y: targetRect.y, w: rightW, h: targetRect.h });
        if (topH > 0) {
          freeRects.push({ x: targetRect.x, y: targetRect.y + chosenH + kerf, w: chosenW, h: topH });
        }
      }
    } else if (rightW > 0) {
      freeRects.push({ x: targetRect.x + chosenW + kerf, y: targetRect.y, w: rightW, h: targetRect.h });
    } else if (topH > 0) {
      freeRects.push({ x: targetRect.x, y: targetRect.y + chosenH + kerf, w: targetRect.w, h: topH });
    }

    freeRects = filterAndMergeFreeRectangles(freeRects);
  }

  return { placed, unplaced: remainingCandidates, usedArea };
}

/** Multi-Trial Combinatorial Solver: Finds the exact packing that uses the MINIMUM sheet count */
function solveBucketMinSheets(
  queueItems: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number
): NestedSheet[] {
  const sorters: Array<{ name: string; fn: (a: PackingItem, b: PackingItem) => number }> = [
    { name: "Area", fn: (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h) },
    { name: "MaxDim", fn: (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h },
    { name: "Perimeter", fn: (a, b) => b.w + b.h - (a.w + a.h) },
    { name: "Ratio", fn: (a, b) => b.w / b.h - a.w / a.h },
  ];

  const heuristics = ["bssf", "baf", "guillotine-aligned"] as const;

  let bestSheets: NestedSheet[] | null = null;
  let bestSheetCount = Infinity;
  let bestTotalUtilization = -1;

  for (const sorter of sorters) {
    for (const heuristic of heuristics) {
      const sortedQueue = [...queueItems].sort(sorter.fn);
      let remainingQueue = [...sortedQueue];
      const currentTrialSheets: NestedSheet[] = [];

      while (remainingQueue.length > 0) {
        const sheetId = `TEMP-${currentTrialSheets.length + 1}`;
        const { placed, unplaced, usedArea } = packSingleSheetHeuristic(
          remainingQueue,
          curSheetLength,
          curSheetWidth,
          config,
          sheetId,
          heuristic
        );

        if (placed.length === 0) {
          break;
        }

        currentTrialSheets.push({
          id: sheetId,
          material,
          thickness,
          sheetLength: curSheetLength,
          sheetWidth: curSheetWidth,
          placed,
          usedArea,
          utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
        });

        remainingQueue = unplaced;
      }

      const totalTrialArea = currentTrialSheets.reduce((a, s) => a + s.sheetLength * s.sheetWidth, 0) || 1;
      const totalTrialUsed = currentTrialSheets.reduce((a, s) => a + s.usedArea, 0);
      const trialUtil = (totalTrialUsed / totalTrialArea) * 100;

      // Select trial that uses the ABSOLUTE MINIMUM NUMBER OF SHEETS
      if (
        currentTrialSheets.length < bestSheetCount ||
        (currentTrialSheets.length === bestSheetCount && trialUtil > bestTotalUtilization)
      ) {
        bestSheetCount = currentTrialSheets.length;
        bestTotalUtilization = trialUtil;
        bestSheets = currentTrialSheets;
      }
    }
  }

  return bestSheets ?? [];
}

/** Minimum-Sheet Multi-Trial Optimization Engine */
export function optimize(parts: Part[], config: OptimizationConfig): OptimizationResult {
  const valid = parts.filter((p) => !p.invalid);
  const buckets = new Map<string, Part[]>();

  const groupByMaterial = config.groupByMaterial ?? false;

  for (const p of valid) {
    const key = groupByMaterial ? `${p.material}|${p.thickness}` : `${p.thickness}`;
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
  }

  const activePlateTypes = config.plateTypes ?? DEFAULT_PLATE_TYPES;
  const sheets: NestedSheet[] = [];

  for (const [key, group] of buckets) {
    const material = groupByMaterial
      ? (key.split("|")[0] ?? "Combined Grade")
      : (group[0]?.material ?? "IS:2062 (Combined)");
    const thickness = groupByMaterial ? Number(key.split("|")[1] ?? 0) : Number(key);

    const matchedPlate = findMatchingPlateType(material, thickness, activePlateTypes);
    const curSheetLength = matchedPlate ? matchedPlate.sheetLength : config.sheetLength;
    const curSheetWidth = matchedPlate ? matchedPlate.sheetWidth : config.sheetWidth;

    const usableL = curSheetLength - config.trim * 2;
    const usableW = curSheetWidth - config.trim * 2;

    const queue: PackingItem[] = [];
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

    // Solve for minimum sheets using multi-trial combinatorial heuristics
    const groupSheets = solveBucketMinSheets(
      queue,
      curSheetLength,
      curSheetWidth,
      config,
      material,
      thickness
    );

    sheets.push(...groupSheets);
  }

  // Sort sheets:
  // 1. Thickness ascending (e.g. 6mm -> 8mm -> 10mm -> 16mm -> 20mm)
  // 2. Material alphabetically
  // 3. Utilization DESCENDING (Most congested / highest yield sheet FIRST, max scrap sheet LAST)
  sheets.sort(
    (a, b) =>
      a.thickness - b.thickness ||
      a.material.localeCompare(b.material) ||
      b.utilization - a.utilization
  );

  // Re-index sheet IDs sequentially S01, S02, S03... so all sheets of the same thickness are grouped together
  sheets.forEach((s, idx) => {
    const newId = `S${String(idx + 1).padStart(2, "0")}`;
    s.id = newId;
    s.placed.forEach((p, pIdx) => {
      p.key = `${newId}-${pIdx}`;
    });
  });

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
