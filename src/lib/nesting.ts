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

export interface SheetUtilizedDimensions {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  usedLength: number;
  usedWidth: number;
  /** Formatted as e.g. "100 × 205 mm" (showing how much part is used with kerf) */
  requiredCutSizeStr: string;
  /** Formatted as "L: 205mm × W: 100mm" */
  requiredCutDetailStr: string;
  /** Primary remnant offcut rectangle */
  primaryRemnant: {
    w: number;
    h: number;
    formatted: string;
  };
  /** Secondary remnant offcut rectangle */
  secondaryRemnant?: {
    w: number;
    h: number;
    formatted: string;
  } | undefined;
}

/**
 * Calculates the exact required stock plate size used by nested parts
 * taking blade kerf into account (e.g. 2 plates of 100x100 with 5mm kerf -> 100 x 205 mm)
 * and calculates the remaining usable remnant offcuts.
 */
export function computeSheetUtilizedDimensions(
  sheet: NestedSheet,
  kerf: number = 5,
): SheetUtilizedDimensions {
  if (!sheet.placed || sheet.placed.length === 0) {
    const sMin = Math.min(sheet.sheetLength, sheet.sheetWidth);
    const sMax = Math.max(sheet.sheetLength, sheet.sheetWidth);
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      usedLength: 0,
      usedWidth: 0,
      requiredCutSizeStr: "0 × 0 mm",
      requiredCutDetailStr: "0 × 0 mm",
      primaryRemnant: {
        w: sheet.sheetLength,
        h: sheet.sheetWidth,
        formatted: `${sMin} × ${sMax} mm`,
      },
    };
  }

  const maxX = Math.max(...sheet.placed.map((p) => p.x + p.w));
  const maxY = Math.max(...sheet.placed.map((p) => p.y + p.h));
  const minX = Math.min(...sheet.placed.map((p) => p.x));
  const minY = Math.min(...sheet.placed.map((p) => p.y));

  const usedLen = Math.round(maxX);
  const usedWid = Math.round(maxY);

  // User rule: e.g. 2 plates of 100x100 with 5mm kerf gives 100 x 205
  const d1 = Math.min(usedWid, usedLen);
  const d2 = Math.max(usedWid, usedLen);
  const requiredCutSizeStr = `${d1} × ${d2} mm`;
  const requiredCutDetailStr = `${usedLen} × ${usedWid} mm`;

  // Remnant sizes:
  // Remnant 1 (Length-wise): from maxX to sheetLength, height = sheetWidth
  const rem1W = Math.max(0, sheet.sheetLength - usedLen);
  const rem1H = sheet.sheetWidth;

  // Remnant 2 (Width-wise over cut zone): width = usedLen, height = sheetWidth - usedWid
  const rem2W = usedLen;
  const rem2H = Math.max(0, sheet.sheetWidth - usedWid);

  const r1Min = Math.min(rem1W, rem1H);
  const r1Max = Math.max(rem1W, rem1H);

  return {
    minX,
    minY,
    maxX: usedLen,
    maxY: usedWid,
    usedLength: usedLen,
    usedWidth: usedWid,
    requiredCutSizeStr,
    requiredCutDetailStr,
    primaryRemnant: {
      w: rem1W,
      h: rem1H,
      formatted: `${r1Min} × ${r1Max} mm`,
    },
    secondaryRemnant:
      rem2W > 25 && rem2H > 25
        ? {
            w: rem2W,
            h: rem2H,
            formatted: `${Math.min(rem2W, rem2H)} × ${Math.max(rem2W, rem2H)} mm`,
          }
        : undefined,
  };
}

export interface ThicknessLengthItem {
  thickness: number;
  material: string;
  isChq: boolean;
  qty: number;
  lengthNeeded: number; // e.g. 6300 or 200
  sheetWidth: number;   // e.g. 1500
  sheetIds: string[];   // e.g. ["S01"] or ["S02"]
  totalLengthMm: number; // qty * lengthNeeded
  weightKg: number;
}

export interface ThicknessGroupSummary {
  thickness: number;
  material: string;
  isChq: boolean;
  items: ThicknessLengthItem[];
  totalSheets: number;
  totalLengthNeededMm: number; // combined length for that thickness (e.g. 6300 + 200 = 6500)
  totalWeightKg: number;
}

export interface ExecutiveProcurementSummary {
  groups: ThicknessGroupSummary[];
  grandTotalSheets: number;
  grandTotalLengthMm: number;
  grandTotalWeightKg: number;
}

/**
 * Calculates executive summary of total combined lengths needed per thickness plate.
 * For example: if Sheet 1 of thk 8 needs 6300mm and Sheet 2 of thk 8 needs 200mm,
 * this outputs:
 *   - thk 8, qty 1, len 6300 mm
 *   - thk 8, qty 1, len 200 mm
 *   - Total combined length for thk 8: 6,500 mm (2 sheets)
 */
export function computeThicknessLengthSummary(
  sheets: NestedSheet[],
  kerf: number = 5,
): ExecutiveProcurementSummary {
  if (!sheets || sheets.length === 0) {
    return {
      groups: [],
      grandTotalSheets: 0,
      grandTotalLengthMm: 0,
      grandTotalWeightKg: 0,
    };
  }

  // Group sheets by thickness and material (distinguishing CHQ vs Normal)
  const groupMap = new Map<string, { thickness: number; material: string; isChq: boolean; sheets: NestedSheet[] }>();

  for (const s of sheets) {
    const isChq = /CHQ|CHEQ|CHEQUERED|CHECKERED|PATTERN|IS3502|IS 3502|\bCP\b/i.test(
      `${s.material} ${s.id}`
    );
    const key = `${s.thickness}|${isChq ? "CHQ" : "MS"}|${s.material}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.sheets.push(s);
    } else {
      groupMap.set(key, {
        thickness: s.thickness,
        material: s.material,
        isChq,
        sheets: [s],
      });
    }
  }

  const groups: ThicknessGroupSummary[] = [];
  let grandTotalSheets = 0;
  let grandTotalLengthMm = 0;
  let grandTotalWeightKg = 0;

  for (const [, grp] of groupMap) {
    // Within each thickness group, calculate length needed for each sheet and aggregate by lengthNeeded
    const lengthMap = new Map<number, { qty: number; sheetWidth: number; sheetIds: string[]; totalWeight: number }>();

    for (const s of grp.sheets) {
      const u = computeSheetUtilizedDimensions(s, kerf);
      // If parts are placed, usedLength is the cut length needed; if near full sheet, use full stock length
      const lengthNeeded = s.placed.length === 0 ? 0 : (u.usedLength >= s.sheetLength - 5 ? s.sheetLength : Math.max(u.usedLength, 1));
      const width = s.sheetWidth;

      // Density: 7.85e-6 kg/mm^3
      const weight = lengthNeeded * width * s.thickness * 7.85e-6;

      const existing = lengthMap.get(lengthNeeded);
      if (existing) {
        existing.qty += 1;
        existing.sheetIds.push(s.id);
        existing.totalWeight += weight;
      } else {
        lengthMap.set(lengthNeeded, {
          qty: 1,
          sheetWidth: width,
          sheetIds: [s.id],
          totalWeight: weight,
        });
      }
    }

    // Sort items by lengthNeeded descending (e.g. 6300mm full sheets first, then 200mm partial sheets)
    const sortedLengths = [...lengthMap.entries()].sort((a, b) => b[0] - a[0]);

    const items: ThicknessLengthItem[] = sortedLengths.map(([lenNeeded, data]) => ({
      thickness: grp.thickness,
      material: grp.material,
      isChq: grp.isChq,
      qty: data.qty,
      lengthNeeded: lenNeeded,
      sheetWidth: data.sheetWidth,
      sheetIds: data.sheetIds,
      totalLengthMm: lenNeeded * data.qty,
      weightKg: Math.round(data.totalWeight * 10) / 10,
    }));

    const totalSheets = items.reduce((sum, item) => sum + item.qty, 0);
    const totalLengthNeededMm = items.reduce((sum, item) => sum + item.totalLengthMm, 0);
    const totalWeightKg = Math.round(items.reduce((sum, item) => sum + item.weightKg, 0) * 10) / 10;

    groups.push({
      thickness: grp.thickness,
      material: grp.material,
      isChq: grp.isChq,
      items,
      totalSheets,
      totalLengthNeededMm,
      totalWeightKg,
    });

    grandTotalSheets += totalSheets;
    grandTotalLengthMm += totalLengthNeededMm;
    grandTotalWeightKg += totalWeightKg;
  }

  // Sort groups by thickness ascending
  groups.sort((a, b) => a.thickness - b.thickness || a.material.localeCompare(b.material));

  return {
    groups,
    grandTotalSheets,
    grandTotalLengthMm,
    grandTotalWeightKg: Math.round(grandTotalWeightKg * 10) / 10,
  };
}

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
    abbreviations: ["CHQ", "CHEQ", "CP", "CHEQUERED", "CHECKERED", "PATTERN", "IS3502", "IS 3502"],
    minThickness: 2,
    maxThickness: 12,
    sheetLength: 6000,
    sheetWidth: 1250,
    description: "Anti-skid floor & stair tread plates (6000 × 1250 mm)",
  },
  {
    id: "ms-thin",
    name: "Mild Steel Plate (IS 2062 Thin)",
    abbreviations: ["PL", "MS", "IS2062", "IS:2062", "E250", "E250A", "E250BR", "E250C"],
    minThickness: 2,
    maxThickness: 10,
    sheetLength: 6000,
    sheetWidth: 2000,
    description: "Standard workshop plates (2000 × 6000 mm)",
  },
  {
    id: "ms-heavy",
    name: "Mild Steel Heavy Plate (IS 2062 Structural)",
    abbreviations: ["PL", "MS", "IS2062", "IS:2062", "E250", "E250A", "E250BR", "E250C"],
    minThickness: 11,
    maxThickness: 50,
    sheetLength: 6000,
    sheetWidth: 2000,
    description: "Heavy structural bridge plates (2000 × 6000 mm)",
  },
  {
    id: "high-tensile",
    name: "High Tensile Alloy Plate (SAILMA 350HI / E350BR)",
    abbreviations: ["SAILMA", "E350BR", "E350", "HS"],
    minThickness: 8,
    maxThickness: 100,
    sheetLength: 6000,
    sheetWidth: 2000,
    description: "High strength bridge girder plates (2000 × 6000 mm)",
  },
];

export type OptimizationPreset = "fast" | "balanced" | "max-yield" | "guillotine-shear";

export type ScoringWeights = {
  materialUtilization: number;   // Weight for global % yield
  sheetCountPenalty: number;      // Penalty per stock plate used
  cutLengthPenalty: number;       // Penalty per 1000mm torch cut distance
  reusableRemnantBonus: number;   // Bonus for single large contiguous offcut
  fragmentedWastePenalty: number; // Penalty for tiny scrap slivers (< 300x300mm)
  cutContinuityBonus: number;     // Bonus for aligned continuous shear cuts
  packingDensityBonus: number;    // Bonus for tight bounding-box density
  rotationPenalty: number;        // Penalty for rotating parts when non-essential
  stripAlignmentBonus: number;    // Bonus for same-width / same-height part strips
  remnantQualityBonus?: number;   // Optional bonus for high remnant quality score (0-100)
};

export const DEFAULT_SCORING_WEIGHTS: Record<OptimizationPreset, ScoringWeights> = {
  fast: {
    materialUtilization: 1.0,
    sheetCountPenalty: 100000.0, // Strict priority #1: Fewer sheets dominates!
    cutLengthPenalty: 0.1,
    reusableRemnantBonus: 10.0,
    fragmentedWastePenalty: 5.0,
    cutContinuityBonus: 5.0,
    packingDensityBonus: 5.0,
    rotationPenalty: 1.0,
    stripAlignmentBonus: 5.0,
  },
  balanced: {
    materialUtilization: 2.0,
    sheetCountPenalty: 100000.0, // Strict priority #1: Fewer sheets dominates!
    cutLengthPenalty: 0.2,
    reusableRemnantBonus: 25.0,
    fragmentedWastePenalty: 15.0,
    cutContinuityBonus: 35.0, // High bonus for continuous straight shear lines
    packingDensityBonus: 10.0,
    rotationPenalty: 0.5,     // Low rotation penalty: allow rotation freely for optimal fit
    stripAlignmentBonus: 40.0, // High bonus for same-width / same-height part strips
  },
  "max-yield": {
    materialUtilization: 5.0,
    sheetCountPenalty: 100000.0, // Strict priority #1: Fewer sheets dominates!
    cutLengthPenalty: 0.1,
    reusableRemnantBonus: 50.0,
    fragmentedWastePenalty: 30.0,
    cutContinuityBonus: 40.0,
    packingDensityBonus: 20.0,
    rotationPenalty: 0.5,
    stripAlignmentBonus: 45.0,
  },
  "guillotine-shear": {
    materialUtilization: 2.0,
    sheetCountPenalty: 100000.0, // Strict priority #1: Fewer sheets dominates!
    cutLengthPenalty: 0.5,
    reusableRemnantBonus: 30.0,
    fragmentedWastePenalty: 20.0,
    cutContinuityBonus: 60.0, // Maximum bonus for continuous straight shear lines
    packingDensityBonus: 10.0,
    rotationPenalty: 0.5,
    stripAlignmentBonus: 60.0, // Maximum bonus for matching strip heights
  },
};

export type CandidateMetrics = {
  utilization: number;            // Overall material yield % (0 - 100)
  sheetCount: number;             // Total stock plates used
  totalCutLength: number;         // Total cut line length in mm
  largestRemnantArea: number;     // Largest single rectangular offcut in mm^2
  largestRemnantDims: { w: number; h: number }; // Dimensions of largest offcut
  fragmentedWasteArea: number;    // Unusable micro scrap area in mm^2 (< 300x300mm)
  reusableRemnantArea: number;    // Total area of reusable offcuts (>= 300x300mm) in mm^2
  reusableRemnantCount: number;   // Count of reusable offcuts
  remnantQualityScore: number;    // Composite remnant quality score (0 - 100)
  cutContinuityScore: number;     // % of shared collinear cut edges (0 - 100)
  packingDensity: number;         // % density within occupied bounding box
  rotationCount: number;          // Number of rotated parts
  stripAlignmentScore: number;    // Score for part strip height/width alignment (0 - 100)
};

export type CandidateLayout = {
  id: string;
  sheets: NestedSheet[];
  metrics: CandidateMetrics;
  score: number;
  algorithm: string;
  preset: OptimizationPreset;
  timestamp: number;
};

export type SimulatedAnnealingConfig = {
  initialTemp?: number;
  minTemp?: number;
  coolingRate?: number;
  maxIterations?: number;
  maxStagnantIterations?: number;
  reheatFactor?: number;
  adaptiveCooling?: boolean;
};

export type MutationType = "pair-swap" | "block-move" | "subsequence-reverse" | "rotation-toggle";

export type SAFitnessHistoryEntry = {
  iteration: number;
  temperature: number;
  energy: number;
  bestEnergy: number;
  accepted: boolean;
  mutation: MutationType;
};

export type SAResult = {
  bestSheets: NestedSheet[];
  bestEnergy: number;
  iterations: number;
  restarts: number;
  history: SAFitnessHistoryEntry[];
};

export type CustomStockSheetRule = {
  id: string;
  material: string; // e.g. "CHQ", "MS", "IS2062", or "*"
  thickness?: number | null; // e.g. 4 (if null or 0, applies to all thicknesses of that material)
  sheetWidth: number; // e.g. 1500
  sheetLength: number; // e.g. 6000
  description?: string;
};

export type OptimizationConfig = {
  sheetLength: number;
  sheetWidth: number;
  kerf: number;
  trim: number;
  rotation: boolean;
  algorithm: string;
  preset?: OptimizationPreset;
  scoringWeights?: ScoringWeights;
  groupByMaterial?: boolean;
  plateTypes?: PlateTypeConfig[];
  customStockSheets?: CustomStockSheetRule[] | undefined;
  saConfig?: SimulatedAnnealingConfig;
  generations?: number;
  populationSize?: number;
  convergenceThreshold?: number;
};

export type BOMCharacteristic =
  | "mostly-long"
  | "mostly-squares"
  | "mixed-parts"
  | "large-plates"
  | "tiny-parts";

export type BOMAnalysis = {
  characteristic: BOMCharacteristic;
  characteristicLabel: string;
  totalPartsCount: number;
  totalPiecesCount: number;
  avgAspectRatio: number;
  longPartsRatio: number;      // fraction of total pieces with aspect ratio >= 2.5
  squarePartsRatio: number;    // fraction of total pieces with aspect ratio <= 1.25
  largePartsRatio: number;     // fraction of total pieces with area >= 12% sheet area (or area >= 0.5m^2)
  tinyPartsRatio: number;      // fraction of total pieces with area <= 2% sheet area (or area <= 0.05m^2)
  avgPartArea: number;         // m^2
  aspectRatioVariance: number;
  areaVarianceRatio: number;
};

export type DecisionLogic = {
  selectedAlgorithm: "skyline" | "maxrects" | "guillotine" | "hybrid";
  algorithmLabel: string;
  primaryReason: string;
  explanation: string;
  heuristicStrategy: string;
  recommendedPreset: OptimizationPreset;
};

export type OptimizationResult = {
  sheets: NestedSheet[];
  utilization: number;
  scrap: number;
  sheetCount: number;
  cost: number;
  savings: number;
  weight: number;
  config: OptimizationConfig;
  candidate?: CandidateLayout;
  candidateLayouts?: CandidateLayout[];
  metrics?: CandidateMetrics;
  bomAnalysis?: BOMAnalysis;
  decisionLogic?: DecisionLogic;
  generationsRun?: number;
  converged?: boolean;
};

export function findMatchingPlateType(
  materialOrPart: string | Part,
  thickness?: number,
  plateTypes: PlateTypeConfig[] = DEFAULT_PLATE_TYPES,
  description?: string,
  item?: string
): PlateTypeConfig | null {
  let matStr = "";
  let thkNum = 0;
  let descStr = "";
  let itemStr = "";

  if (typeof materialOrPart === "object" && materialOrPart !== null) {
    matStr = materialOrPart.material || "";
    thkNum = materialOrPart.thickness || 0;
    descStr = materialOrPart.description || "";
    itemStr = materialOrPart.item || "";
    if (typeof thickness === "object" && Array.isArray(thickness)) {
      plateTypes = thickness as unknown as PlateTypeConfig[];
    }
  } else {
    matStr = materialOrPart || "";
    thkNum = thickness || 0;
    descStr = description || "";
    itemStr = item || "";
  }

  const activeTypes = plateTypes && plateTypes.length > 0 ? plateTypes : DEFAULT_PLATE_TYPES;
  const fullTextUpper = `${matStr} ${descStr} ${itemStr}`.toUpperCase();

  // 1. Explicit check for Chequered Plate keywords
  if (/CHQ|CHEQ|CHEQUERED|CHECKERED|PATTERN|IS3502|IS 3502|\bCP\b/.test(fullTextUpper)) {
    const chqPt = activeTypes.find((pt) => pt.id === "chq");
    if (chqPt && thkNum >= chqPt.minThickness && thkNum <= chqPt.maxThickness) {
      return chqPt;
    }
  }

  // 2. Primary check: search fullTextUpper for plate type abbreviation + thickness range
  for (let i = 0; i < activeTypes.length; i++) {
    const pt = activeTypes[i]!;
    for (let j = 0; j < pt.abbreviations.length; j++) {
      const abbr = pt.abbreviations[j]!.trim().toUpperCase();
      if (abbr && fullTextUpper.includes(abbr)) {
        if (thkNum >= pt.minThickness && thkNum <= pt.maxThickness) {
          return pt;
        }
      }
    }
  }

  // 3. Fallback check: match by thickness range (excluding CHQ unless explicitly matched above)
  for (let i = 0; i < activeTypes.length; i++) {
    const pt = activeTypes[i]!;
    if (pt.id !== "chq" && thkNum >= pt.minThickness && thkNum <= pt.maxThickness) {
      return pt;
    }
  }

  return null;
}

/**
 * Resolves stock sheet dimensions (Length x Width) for a part based on user-specified stock sizes.
 * If user configured available stock sheet sizes, those user sizes are strictly used for the layout.
 */
export function resolveSheetDimensionsForPart(
  part: Part,
  config: OptimizationConfig
): {
  sheetLength: number;
  sheetWidth: number;
  plateTypeId: string;
  plateTypeName: string;
  isCustom: boolean;
} {
  const customRules = config.customStockSheets ?? [];
  const partMatUpper = (part.material || "").toUpperCase();
  const partDescUpper = (part.description || "").toUpperCase();
  const partItemUpper = (part.item || "").toUpperCase();
  const partFullText = `${partMatUpper} ${partDescUpper} ${partItemUpper}`;
  const partClean = partFullText.replace(/[^A-Z0-9]/g, "");
  const partThk = Number(part.thickness) || 0;
  const isChqPart = /CHQ|CHEQ|CHEQUERED|CHECKERED|PATTERN|IS3502|IS 3502|\bCP\b/.test(partFullText);

  // Helper to match user's custom rule material to part
  const matchMaterial = (ruleMat: string): boolean => {
    const rm = (ruleMat || "").trim().toUpperCase();
    if (!rm || rm === "*" || rm === "ALL") return true;

    const isChqRule = /CHQ|CHEQ|CHEQUERED|CHECKERED|PATTERN|IS3502|\bCP\b/.test(rm);
    if (isChqRule) return isChqPart;
    if (isChqPart) return false;

    const rmClean = rm.replace(/[^A-Z0-9]/g, "");
    if (rmClean && partClean.includes(rmClean)) return true;

    // Common abbreviations in steel fabrication: IS2062, MS, E250, Mild Steel, PL
    if (rm === "MS" || rm === "MILD STEEL") {
      return (
        partClean.includes("MS") ||
        partClean.includes("IS2062") ||
        partClean.includes("E250") ||
        partClean.includes("PL") ||
        !isChqPart
      );
    }
    if (rmClean.includes("2062") && (partClean.includes("2062") || partClean.includes("E250") || partClean.includes("MS"))) {
      return true;
    }
    return false;
  };

  // 1. If user defined Available Stock Sheets in the panel:
  if (customRules.length > 0) {
    // 1a. Priority 1: Match on material AND exact thickness
    for (const rule of customRules) {
      if (rule.thickness != null && Number(rule.thickness) > 0) {
        if (Math.abs(Number(rule.thickness) - partThk) < 0.05 && matchMaterial(rule.material)) {
          const w = Number(rule.sheetWidth) || 2000;
          const l = Number(rule.sheetLength) || 6000;
          return {
            sheetLength: l,
            sheetWidth: w,
            plateTypeId: isChqPart ? "chq-custom" : "stock-custom",
            plateTypeName: `Stock ${rule.material || ""} (${w}×${l} mm)`,
            isCustom: true,
          };
        }
      }
    }

    // 1b. Priority 2: Match on material for All thicknesses (thickness is null or 0)
    for (const rule of customRules) {
      if (!rule.thickness || Number(rule.thickness) <= 0) {
        if (matchMaterial(rule.material)) {
          const w = Number(rule.sheetWidth) || 2000;
          const l = Number(rule.sheetLength) || 6000;
          return {
            sheetLength: l,
            sheetWidth: w,
            plateTypeId: isChqPart ? "chq-custom" : "stock-custom",
            plateTypeName: `Stock ${rule.material || ""} (${w}×${l} mm)`,
            isCustom: true,
          };
        }
      }
    }

    // 1c. Priority 3: User defined stock sizes in the table, so optimize strictly as per user's stock size!
    // Never fall back to 6300x1500 default when user provided stock sizes
    const fallbackRule = customRules[0]!;
    const w = Number(fallbackRule.sheetWidth) || 1500;
    const l = Number(fallbackRule.sheetLength) || 6000;
    return {
      sheetLength: l,
      sheetWidth: w,
      plateTypeId: "stock-user",
      plateTypeName: `Stock Plate (${w}×${l} mm)`,
      isCustom: true,
    };
  }

  // 2. If no custom stock sheets exist at all, use config.sheetWidth & config.sheetLength
  const fallbackL = config.sheetLength || 6000;
  const fallbackW = config.sheetWidth || 1500;
  return {
    sheetLength: fallbackL,
    sheetWidth: fallbackW,
    plateTypeId: "standard-stock",
    plateTypeName: `Stock Plate (${fallbackW}×${fallbackL} mm)`,
    isCustom: false,
  };
}

/**
 * Task 6 Implementation: Adaptive Optimization Engine - BOM Characteristic Analyzer
 * Automatically analyzes BOM shape, aspect ratio, relative part area, and size variance.
 */
export function analyzeBOMCharacteristics(
  parts: Part[],
  sheetLength: number = 6000,
  sheetWidth: number = 1500
): BOMAnalysis {
  const validParts = parts.filter((p) => !p.invalid);
  if (validParts.length === 0) {
    return {
      characteristic: "mixed-parts",
      characteristicLabel: "Mixed Parts",
      totalPartsCount: 0,
      totalPiecesCount: 0,
      avgAspectRatio: 1.0,
      longPartsRatio: 0,
      squarePartsRatio: 0,
      largePartsRatio: 0,
      tinyPartsRatio: 0,
      avgPartArea: 0,
      aspectRatioVariance: 0,
      areaVarianceRatio: 0,
    };
  }

  const sheetArea = sheetLength * sheetWidth;
  let totalPieces = 0;
  let totalARSum = 0;
  let totalAreaSum = 0;

  let longPieces = 0;
  let squarePieces = 0;
  let largePieces = 0;
  let tinyPieces = 0;

  const arList: number[] = [];
  const areaList: number[] = [];

  for (let i = 0; i < validParts.length; i++) {
    const p = validParts[i]!;
    const qty = p.qty || 1;
    const l = Math.max(p.length, p.width);
    const w = Math.min(p.length, p.width) || 1;
    const ar = l / w;
    const area = p.length * p.width;
    const relArea = area / sheetArea;

    for (let q = 0; q < qty; q++) {
      totalPieces++;
      totalARSum += ar;
      totalAreaSum += area;
      arList.push(ar);
      areaList.push(area);

      if (ar >= 2.5) longPieces++;
      if (ar <= 1.25) squarePieces++;
      if (relArea >= 0.12 || area >= 500_000) largePieces++;
      if (relArea <= 0.02 || area <= 40_000) tinyPieces++;
    }
  }

  const avgAspectRatio = totalPieces > 0 ? totalARSum / totalPieces : 1.0;
  const avgPartArea = totalPieces > 0 ? (totalAreaSum / totalPieces) / 1_000_000 : 0;

  const longPartsRatio = totalPieces > 0 ? longPieces / totalPieces : 0;
  const squarePartsRatio = totalPieces > 0 ? squarePieces / totalPieces : 0;
  const largePartsRatio = totalPieces > 0 ? largePieces / totalPieces : 0;
  const tinyPartsRatio = totalPieces > 0 ? tinyPieces / totalPieces : 0;

  let arVarSum = 0;
  for (let i = 0; i < arList.length; i++) {
    arVarSum += (arList[i]! - avgAspectRatio) ** 2;
  }
  const aspectRatioVariance = arList.length > 0 ? arVarSum / arList.length : 0;

  const areaMean = avgPartArea * 1_000_000;
  let areaVarSum = 0;
  for (let i = 0; i < areaList.length; i++) {
    areaVarSum += (areaList[i]! - areaMean) ** 2;
  }
  const areaVariance = areaList.length > 0 ? areaVarSum / areaList.length : 0;
  const areaVarianceRatio = areaMean > 0 ? Math.sqrt(areaVariance) / areaMean : 0;

  let characteristic: BOMCharacteristic = "mixed-parts";
  let characteristicLabel = "Mixed Parts";

  if (longPartsRatio >= 0.45 || avgAspectRatio >= 2.8) {
    characteristic = "mostly-long";
    characteristicLabel = "Mostly Long Parts";
  } else if (squarePartsRatio >= 0.45) {
    characteristic = "mostly-squares";
    characteristicLabel = "Mostly Squares";
  } else if (tinyPartsRatio >= 0.45) {
    characteristic = "tiny-parts";
    characteristicLabel = "Tiny Parts";
  } else if (largePartsRatio >= 0.35) {
    characteristic = "large-plates";
    characteristicLabel = "Large Plates";
  } else {
    characteristic = "mixed-parts";
    characteristicLabel = "Mixed Parts";
  }

  return {
    characteristic,
    characteristicLabel,
    totalPartsCount: validParts.length,
    totalPiecesCount: totalPieces,
    avgAspectRatio: Number(avgAspectRatio.toFixed(2)),
    longPartsRatio: Number(longPartsRatio.toFixed(2)),
    squarePartsRatio: Number(squarePartsRatio.toFixed(2)),
    largePartsRatio: Number(largePartsRatio.toFixed(2)),
    tinyPartsRatio: Number(tinyPartsRatio.toFixed(2)),
    avgPartArea: Number(avgPartArea.toFixed(3)),
    aspectRatioVariance: Number(aspectRatioVariance.toFixed(2)),
    areaVarianceRatio: Number(areaVarianceRatio.toFixed(2)),
  };
}

/**
 * Task 6 Implementation: Adaptive Optimization Engine - Algorithm & Heuristic Selection Logic
 * Maps BOM characteristics to the optimal algorithm (Skyline, MaxRects, Guillotine, or Hybrid).
 */
export function selectAdaptiveAlgorithm(
  bomAnalysis: BOMAnalysis,
  userSelectedAlgorithm: string = "auto"
): DecisionLogic {
  let selectedAlgorithm: "skyline" | "maxrects" | "guillotine" | "hybrid";
  let algorithmLabel: string;
  let primaryReason: string;
  let explanation: string;
  let heuristicStrategy: string;
  let recommendedPreset: OptimizationPreset = "balanced";

  switch (bomAnalysis.characteristic) {
    case "mostly-long":
      selectedAlgorithm = "skyline";
      algorithmLabel = "Skyline Bottom-Left Engine";
      primaryReason = `BOM contains ${Math.round(bomAnalysis.longPartsRatio * 100)}% high-aspect-ratio long parts (avg aspect ratio: ${bomAnalysis.avgAspectRatio.toFixed(2)}:1).`;
      explanation = `Skyline Bottom-Left heuristic was automatically chosen because long profiles (bars, channels, web plates) nest most efficiently along sheet edge contours without trapping high-volume dead spaces.`;
      heuristicStrategy = "Dynamic Skyline Top-Contour Profile & Same-Width Strip Alignment";
      recommendedPreset = "balanced";
      break;

    case "mostly-squares":
      selectedAlgorithm = "guillotine";
      algorithmLabel = "Guillotine Shear-Cut Engine";
      primaryReason = `BOM is dominated by near-square geometries (${Math.round(bomAnalysis.squarePartsRatio * 100)}% square parts with aspect ratio ≤ 1.25).`;
      explanation = `Guillotine edge-splitting algorithm was automatically selected to enforce continuous straight cut lines across sheets, simplifying shop-floor shear cuts and reducing torch travel distance.`;
      heuristicStrategy = "Edge-to-Edge Straight Guillotine Cuts & Continuous Shear Alignment";
      recommendedPreset = "guillotine-shear";
      break;

    case "tiny-parts":
      selectedAlgorithm = "maxrects";
      algorithmLabel = "MaxRects Area-Fit Engine";
      primaryReason = `BOM consists mostly of small micro-plates and brackets (${Math.round(bomAnalysis.tinyPartsRatio * 100)}% tiny parts with area ≤ 2% sheet area).`;
      explanation = `MaxRects (Maximal Rectangles) algorithm was automatically selected because it maintains all overlapping free rectangular spaces, maximizing packing density for small components into tight offcut spaces.`;
      heuristicStrategy = "Best Short-Side Fit (BSSF) & Best Area Fit (BAF) Waste Pocket Filling";
      recommendedPreset = "max-yield";
      break;

    case "large-plates":
      selectedAlgorithm = "hybrid";
      algorithmLabel = "Hybrid Skyline + MaxRects Engine";
      primaryReason = `BOM features substantial heavy structural plates (${Math.round(bomAnalysis.largePartsRatio * 100)}% large plates occupying ≥ 12% sheet area).`;
      explanation = `Hybrid engine was automatically selected to place large primary foundation plates using Skyline bottom-left positioning, then back-fill remaining stock scrap with smaller secondary components using MaxRects.`;
      heuristicStrategy = "Large Foundation Placement + MaxRects Back-Filling & Multi-Pass Re-compaction";
      recommendedPreset = "max-yield";
      break;

    case "mixed-parts":
    default:
      selectedAlgorithm = "hybrid";
      algorithmLabel = "Hybrid Adaptive Multi-Pass Engine";
      primaryReason = `BOM exhibits high aspect-ratio and area variance across mixed shape profiles.`;
      explanation = `Hybrid adaptive multi-pass engine was automatically selected to run combinatorial multi-sorters across Skyline, MaxRects, and Guillotine policies, selecting the optimal candidate with maximum yield.`;
      heuristicStrategy = "Multi-Sorter Deep Combinatorial Search & Annealing Swap Perturbation";
      recommendedPreset = "balanced";
      break;
  }

  if (userSelectedAlgorithm !== "auto" && userSelectedAlgorithm !== selectedAlgorithm) {
    const manualMap: Record<string, string> = {
      skyline: "Skyline Bottom-Left Engine",
      maxrects: "MaxRects Area-Fit Engine",
      guillotine: "Guillotine Shear-Cut Engine",
      hybrid: "Hybrid Adaptive Multi-Pass Engine",
    };
    const manualName = manualMap[userSelectedAlgorithm] || userSelectedAlgorithm;
    primaryReason += ` (Manual Override Active: Running ${manualName}). Auto-recommendation was ${algorithmLabel}.`;
  }

  return {
    selectedAlgorithm,
    algorithmLabel,
    primaryReason,
    explanation,
    heuristicStrategy,
    recommendedPreset,
  };
}

export type FreeRectangle = {
  x: number;
  y: number;
  w: number;
  h: number;
  active?: boolean;
};

export type PackingItem = { part: Part; w: number; h: number; rotated: boolean };

/** GRASP Ordering Policies */
export type GRASPPolicy =
  | "same-type-clustered"
  | "area-descending"
  | "area-ascending"
  | "longest-side"
  | "shortest-side"
  | "perimeter"
  | "aspect-ratio"
  | "height-strip"
  | "width-strip"
  | "randomized-greedy"
  | "weighted-random";

export const ALL_GRASP_POLICIES: GRASPPolicy[] = [
  "same-type-clustered",
  "area-descending",
  "area-ascending",
  "longest-side",
  "shortest-side",
  "perimeter",
  "aspect-ratio",
  "height-strip",
  "width-strip",
  "randomized-greedy",
  "weighted-random",
];

export type GRASPConfig = {
  candidateCount?: number;   // Number of candidate sequences (100 to 500, default 200)
  rclAlpha?: number;         // Restricted Candidate List parameter alpha in [0, 1] (default 0.25)
  seed?: number;             // Seed for reproducible random generation
  policies?: GRASPPolicy[];  // Active policies to generate candidate populations from
  allowDuplicates?: boolean; // Whether duplicate sequence fingerprints are permitted (default false)
};

export type GRASPCandidate = {
  id: string;
  policy: GRASPPolicy;
  items: PackingItem[];
  fingerprint: string;
  seed?: number;
};

export type CandidatePopulation = {
  candidates: GRASPCandidate[];
  totalGenerated: number;
  uniqueCount: number;
  diversityScore: number;    // % of candidates that are distinct (0 - 100)
  config: Required<GRASPConfig>;
};

export type SkylineNode = {
  x: number;
  y: number;
  width: number;
};

export type WastePocket = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Fast, seedable 32-bit PRNG (Mulberry32)
 * Guarantees 100% reproducible candidate populations given a random seed.
 */
export function createPRNG(seed?: number): () => number {
  if (seed === undefined || seed === null) {
    return Math.random;
  }
  let s = seed >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Computes a fast 32-bit FNV-1a hash fingerprint for zero-allocation sequence matching */
export function getSequenceFingerprint(items: PackingItem[]): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const id = item.part.id;
    for (let c = 0; c < id.length; c++) {
      hash ^= id.charCodeAt(c);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= item.w;
    hash = Math.imul(hash, 0x01000193);
    hash ^= item.h;
    hash = Math.imul(hash, 0x01000193);
    if (item.rotated) {
      hash ^= 1;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16);
}

/** Evaluates numerical priority metric of a part item for a specific ordering policy */
export function evaluateItemPolicyMetric(item: PackingItem, policy: GRASPPolicy): number {
  switch (policy) {
    case "area-descending":
      return item.w * item.h;
    case "area-ascending":
      return -(item.w * item.h);
    case "longest-side":
      return Math.max(item.w, item.h);
    case "shortest-side":
      return Math.min(item.w, item.h);
    case "perimeter":
      return 2 * (item.w + item.h);
    case "aspect-ratio":
      return Math.max(item.w, item.h) / Math.min(item.w, item.h);
    case "height-strip":
      return item.h * 10000 + item.w;
    case "width-strip":
      return item.w * 10000 + item.h;
    case "randomized-greedy":
      return item.w * item.h;
    case "weighted-random":
      return item.w * item.h;
    default:
      return item.w * item.h;
  }
}

/** Sorts candidate items deterministically according to policy */
function sortItemsByPolicy(items: PackingItem[], policy: GRASPPolicy): PackingItem[] {
  const list = items.slice();
  switch (policy) {
    case "same-type-clustered":
      return list.sort(
        (a, b) =>
          a.part.item.localeCompare(b.part.item) ||
          b.w * b.h - a.w * a.h ||
          Math.max(b.w, b.h) - Math.max(a.w, a.h)
      );
    case "area-descending":
      return list.sort((a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h));
    case "area-ascending":
      return list.sort((a, b) => a.w * a.h - b.w * b.h || Math.min(a.w, a.h) - Math.min(b.w, b.h));
    case "longest-side":
      return list.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
    case "shortest-side":
      return list.sort((a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.w * b.h - a.w * a.h);
    case "perimeter":
      return list.sort((a, b) => 2 * (b.w + b.h) - 2 * (a.w + a.h) || b.w * b.h - a.w * a.h);
    case "aspect-ratio":
      return list.sort(
        (a, b) =>
          Math.max(b.w, b.h) / Math.min(b.w, b.h) - Math.max(a.w, a.h) / Math.min(a.w, a.h) ||
          b.w * b.h - a.w * a.h
      );
    case "height-strip":
      return list.sort((a, b) => b.h - a.h || b.w - a.w);
    case "width-strip":
      return list.sort((a, b) => b.w - a.w || b.h - a.h);
    default:
      return list;
  }
}

/** Zero-allocation index-swap sequence sampler for GRASP */
function buildRCLSequenceFast(
  items: PackingItem[],
  alpha: number,
  policy: GRASPPolicy,
  prng: () => number
): PackingItem[] {
  const n = items.length;
  if (n === 0) return [];

  const pool = items.slice();
  const result = new Array<PackingItem>(n);

  for (let k = 0; k < n; k++) {
    const remaining = n - k;
    if (remaining === 1) {
      result[k] = pool[0]!;
      break;
    }

    let minScore = Infinity;
    let maxScore = -Infinity;
    const scores = new Float64Array(remaining);

    for (let i = 0; i < remaining; i++) {
      const sc = evaluateItemPolicyMetric(pool[i]!, policy);
      scores[i] = sc;
      if (sc < minScore) minScore = sc;
      if (sc > maxScore) maxScore = sc;
    }

    const threshold = maxScore - alpha * (maxScore - minScore);
    let rclCount = 0;
    for (let i = 0; i < remaining; i++) {
      if (scores[i]! >= threshold) rclCount++;
    }

    const chosenIndexInRcl = Math.floor(prng() * rclCount);
    let candidateIndex = 0;
    let currentRclIndex = 0;

    for (let i = 0; i < remaining; i++) {
      if (scores[i]! >= threshold) {
        if (currentRclIndex === chosenIndexInRcl) {
          candidateIndex = i;
          break;
        }
        currentRclIndex++;
      }
    }

    result[k] = pool[candidateIndex]!;
    pool[candidateIndex] = pool[remaining - 1]!;
  }

  return result;
}

/** Zero-allocation roulette-wheel weighted random sequence generator */
function buildWeightedRandomSequenceFast(
  items: PackingItem[],
  prng: () => number
): PackingItem[] {
  const n = items.length;
  if (n === 0) return [];

  const pool = items.slice();
  const result = new Array<PackingItem>(n);

  for (let k = 0; k < n; k++) {
    const remaining = n - k;
    if (remaining === 1) {
      result[k] = pool[0]!;
      break;
    }

    let totalWeight = 0;
    const weights = new Float64Array(remaining);

    for (let i = 0; i < remaining; i++) {
      const w = Math.max(pool[i]!.w * pool[i]!.h, 1);
      weights[i] = w;
      totalWeight += w;
    }

    const randVal = prng() * totalWeight;
    let cumulative = 0;
    let selectedIdx = 0;

    for (let i = 0; i < remaining; i++) {
      cumulative += weights[i]!;
      if (randVal <= cumulative) {
        selectedIdx = i;
        break;
      }
    }

    result[k] = pool[selectedIdx]!;
    pool[selectedIdx] = pool[remaining - 1]!;
  }

  return result;
}

/**
 * Production-grade GRASP Candidate Generator.
 * Generates 100-500 candidate part sequences across ordering policies.
 */
export function generateGRASPCandidates(
  items: PackingItem[],
  config: GRASPConfig = {}
): CandidatePopulation {
  const targetCount = Math.min(Math.max(config.candidateCount ?? 200, 100), 500);
  const alpha = Math.min(Math.max(config.rclAlpha ?? 0.25, 0.0), 1.0);
  const activePolicies = config.policies && config.policies.length > 0 ? config.policies : ALL_GRASP_POLICIES;
  const allowDuplicates = config.allowDuplicates ?? false;
  const seed = config.seed;

  const prng = createPRNG(seed);
  const candidates: GRASPCandidate[] = [];
  const fingerprints = new Set<string>();

  let totalAttempts = 0;
  const maxAttempts = targetCount * 10;

  if (items.length === 0) {
    return {
      candidates: [],
      totalGenerated: 0,
      uniqueCount: 0,
      diversityScore: 100,
      config: {
        candidateCount: targetCount,
        rclAlpha: alpha,
        seed: seed ?? 0,
        policies: activePolicies,
        allowDuplicates,
      },
    };
  }

  const staticPolicies: GRASPPolicy[] = [
    "area-descending",
    "area-ascending",
    "longest-side",
    "shortest-side",
    "perimeter",
    "aspect-ratio",
    "height-strip",
    "width-strip",
  ];

  for (let p = 0; p < staticPolicies.length; p++) {
    const policy = staticPolicies[p]!;
    if (!activePolicies.includes(policy)) continue;
    if (candidates.length >= targetCount) break;

    const seq = sortItemsByPolicy(items, policy);
    const fp = getSequenceFingerprint(seq);

    if (allowDuplicates || !fingerprints.has(fp)) {
      fingerprints.add(fp);
      candidates.push({
        id: `cand-${candidates.length + 1}`,
        policy,
        items: seq,
        fingerprint: fp,
        ...(seed !== undefined ? { seed } : {}),
      });
    }
    totalAttempts++;
  }

  let policyIdx = 0;
  while (candidates.length < targetCount && totalAttempts < maxAttempts) {
    totalAttempts++;
    const currentPolicy = activePolicies[policyIdx % activePolicies.length]!;
    policyIdx++;

    let seq: PackingItem[];
    if (currentPolicy === "weighted-random") {
      seq = buildWeightedRandomSequenceFast(items, prng);
    } else if (currentPolicy === "randomized-greedy") {
      seq = buildRCLSequenceFast(items, alpha, "area-descending", prng);
    } else {
      const dynamicAlpha = Math.min(1.0, alpha + (prng() * 0.2 - 0.1));
      seq = buildRCLSequenceFast(items, Math.max(0.01, dynamicAlpha), currentPolicy, prng);
    }

    if (prng() > 0.6 && seq.length > 2) {
      const idxA = Math.floor(prng() * seq.length);
      const idxB = Math.floor(prng() * seq.length);
      if (idxA !== idxB && seq[idxA] && seq[idxB]) {
        const copy = seq.slice();
        const temp = copy[idxA]!;
        copy[idxA] = copy[idxB]!;
        copy[idxB] = temp;
        seq = copy;
      }
    }

    const fp = getSequenceFingerprint(seq);
    if (allowDuplicates || !fingerprints.has(fp)) {
      fingerprints.add(fp);
      candidates.push({
        id: `cand-${candidates.length + 1}`,
        policy: currentPolicy,
        items: seq,
        fingerprint: fp,
        ...(seed !== undefined ? { seed } : {}),
      });
    }
  }

  const uniqueCount = fingerprints.size;
  const diversityScore = candidates.length > 0 ? Number(((uniqueCount / candidates.length) * 100).toFixed(2)) : 100;

  return {
    candidates,
    totalGenerated: candidates.length,
    uniqueCount,
    diversityScore,
    config: {
      candidateCount: targetCount,
      rclAlpha: alpha,
      seed: seed ?? 0,
      policies: activePolicies,
      allowDuplicates,
    },
  };
}

/** In-Place Zero-Allocation Containment Filter for Free Rectangles */
function pruneFreeRectanglesInPlace(rects: FreeRectangle[]): FreeRectangle[] {
  const count = rects.length;
  if (count <= 1) return rects;

  for (let i = 0; i < count; i++) {
    const r1 = rects[i]!;
    if (r1.w < 2 || r1.h < 2) {
      r1.active = false;
      continue;
    }
    r1.active = true;
  }

  for (let i = 0; i < count; i++) {
    const r1 = rects[i]!;
    if (!r1.active) continue;

    const r1x2 = r1.x + r1.w;
    const r1y2 = r1.y + r1.h;

    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const r2 = rects[j]!;
      if (!r2.active) continue;

      if (
        r1.x >= r2.x &&
        r1.y >= r2.y &&
        r1x2 <= r2.x + r2.w &&
        r1y2 <= r2.y + r2.h
      ) {
        r1.active = false;
        break;
      }
    }
  }

  const result: FreeRectangle[] = [];
  for (let i = 0; i < count; i++) {
    if (rects[i]!.active) {
      result.push(rects[i]!);
    }
  }

  result.sort((a, b) => a.x - b.x || a.y - b.y || b.w * b.h - a.w * a.h);
  return result;
}

/** Fast split of free rectangle set after placing a part */
function splitFreeRectangleSet(
  freeRects: FreeRectangle[],
  px: number,
  py: number,
  pw: number,
  ph: number,
  kerf: number
): FreeRectangle[] {
  const px2 = px + pw + kerf;
  const py2 = py + ph + kerf;
  const nextFree: FreeRectangle[] = [];

  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i]!;
    const rx1 = r.x;
    const ry1 = r.y;
    const rx2 = r.x + r.w;
    const ry2 = r.y + r.h;

    if (px >= rx2 || px2 <= rx1 || py >= ry2 || py2 <= ry1) {
      nextFree.push(r);
      continue;
    }

    if (py > ry1 && py < ry2) {
      nextFree.push({ x: rx1, y: ry1, w: r.w, h: py - ry1 });
    }
    if (py2 > ry1 && py2 < ry2) {
      nextFree.push({ x: rx1, y: py2, w: r.w, h: ry2 - py2 });
    }
    if (px > rx1 && px < rx2) {
      nextFree.push({ x: rx1, y: ry1, w: px - rx1, h: r.h });
    }
    if (px2 > rx1 && px2 < rx2) {
      nextFree.push({ x: px2, y: ry1, w: rx2 - px2, h: r.h });
    }
  }

  return pruneFreeRectanglesInPlace(nextFree);
}

/**
 * Ultra-Fast High-Yield MaxRects Bin Packing Engine.
 * Evaluates candidates using global Best-Fit-Decreasing (BFD) and dynamic multi-rule scoring.
 */
export function packSingleSheetMaxRectsBFD(
  items: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  sheetId: string,
  heuristicRule: "bssf" | "blsf" | "baf" | "guillotine-aligned" | "same-width-strip"
): { placed: PlacedPart[]; unplaced: PackingItem[]; usedArea: number; freeRects: FreeRectangle[] } {
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
  const remainingCandidates = items.slice();
  let usedArea = 0;
  let index = 0;

  while (remainingCandidates.length > 0 && freeRects.length > 0) {
    let bestItemIdx = -1;
    let bestRectIdx = -1;
    let bestScore = Infinity;
    let chosenW = 0;
    let chosenH = 0;
    let chosenRotated = false;

    for (let itemIdx = 0; itemIdx < remainingCandidates.length; itemIdx++) {
      const item = remainingCandidates[itemIdx]!;

      let canRotate = config.rotation && item.w !== item.h;
      let orientations = [{ w: item.w, h: item.h, rotated: item.rotated }];
      if (canRotate) {
        orientations.push({ w: item.h, h: item.w, rotated: !item.rotated });
      }

      for (let rectIdx = 0; rectIdx < freeRects.length; rectIdx++) {
        const rect = freeRects[rectIdx]!;

        for (let o = 0; o < orientations.length; o++) {
          const orient = orientations[o]!;
          if (orient.w <= rect.w && orient.h <= rect.h) {
            const leftoverX = rect.w - orient.w;
            const leftoverY = rect.h - orient.h;

            // Compute edge-contact score against sheet borders and placed parts
            let contactLength = 0;
            if (rect.x === trim) contactLength += orient.h;
            if (rect.y === trim) contactLength += orient.w;
            if (rect.x + orient.w >= curSheetLength - trim) contactLength += orient.h;
            if (rect.y + orient.h >= curSheetWidth - trim) contactLength += orient.w;

            const pStart = Math.max(0, placed.length - 25);
            for (let p = pStart; p < placed.length; p++) {
              const ex = placed[p]!;
              if (
                rect.x > ex.x + ex.w + 2 ||
                rect.x + orient.w < ex.x - 2 ||
                rect.y > ex.y + ex.h + 2 ||
                rect.y + orient.h < ex.y - 2
              ) {
                continue;
              }
              if (Math.abs(ex.x + ex.w - rect.x) < 2 || Math.abs(rect.x + orient.w - ex.x) < 2) {
                const overlapY = Math.max(0, Math.min(rect.y + orient.h, ex.y + ex.h) - Math.max(rect.y, ex.y));
                if (overlapY > 2) contactLength += overlapY;
              }
              if (Math.abs(ex.y + ex.h - rect.y) < 2 || Math.abs(rect.y + orient.h - ex.y) < 2) {
                const overlapX = Math.max(0, Math.min(rect.x + orient.w, ex.x + ex.w) - Math.max(rect.x, ex.x));
                if (overlapX > 2) contactLength += overlapX;
              }
            }

            const contactBonus = contactLength * 5;

            let score = 0;
            if (heuristicRule === "bssf") {
              const shortSide = Math.min(leftoverX, leftoverY);
              const longSide = Math.max(leftoverX, leftoverY);
              score = shortSide * 1000 + longSide - contactBonus;
            } else if (heuristicRule === "blsf") {
              const longSide = Math.max(leftoverX, leftoverY);
              const shortSide = Math.min(leftoverX, leftoverY);
              score = longSide * 1000 + shortSide - contactBonus;
            } else if (heuristicRule === "baf") {
              score = rect.w * rect.h - orient.w * orient.h - contactBonus;
            } else if (heuristicRule === "guillotine-aligned") {
              const alignX = leftoverX === 0 ? -5000 : leftoverX;
              const alignY = leftoverY === 0 ? -5000 : leftoverY;
              score = alignX + alignY - contactBonus;
            } else if (heuristicRule === "same-width-strip") {
              let stripBonus = 0;
              const pStart = Math.max(0, placed.length - 25);
            for (let p = pStart; p < placed.length; p++) {
                const existing = placed[p]!;
                if (Math.abs(existing.y - rect.y) < 2 && Math.abs(existing.h - orient.h) < 2) {
                  stripBonus += 15000;
                }
                if (Math.abs(existing.x - rect.x) < 2 && Math.abs(existing.w - orient.w) < 2) {
                  stripBonus += 15000;
                }
              }
              const shortSide = Math.min(leftoverX, leftoverY);
              score = shortSide * 100 - stripBonus - contactBonus;
            }

            // Width-First Placement Directive:
            // 1. Heavy penalty on rect.x (advancing in length) keeps parts in the current leftmost width column
            // 2. Penalty on orient.w minimizes how far the part extends into the length
            // 3. Gentle penalty on rect.y packs parts sequentially along the 1500mm width
            // 4. Bonus for utilizing the 1500mm width (higher orient.h up to curSheetWidth)
            const xAdvancePenalty = rect.x * 30000 + orient.w * 8000;
            const ySequencePenalty = rect.y * 50;
            const widthFillBonus = (orient.h / curSheetWidth) * 3000;
            score += xAdvancePenalty + ySequencePenalty - widthFillBonus;

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

    if (bestItemIdx === -1 || bestRectIdx === -1) {
      break;
    }

    const targetItem = remainingCandidates[bestItemIdx]!;
    const targetRect = freeRects[bestRectIdx]!;

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

    freeRects = splitFreeRectangleSet(freeRects, targetRect.x, targetRect.y, chosenW, chosenH, kerf);
  }

  // Waste Pocket Micro-Backfill Pass: Intelligently pack small remaining items into tiny free rects
  if (remainingCandidates.length > 0 && freeRects.length > 0) {
    const unplacedSorted = remainingCandidates.slice().sort((a, b) => a.w * a.h - b.w * b.h);

    for (let uIdx = 0; uIdx < unplacedSorted.length; uIdx++) {
      const item = unplacedSorted[uIdx]!;
      let bestFitRectIdx = -1;
      let bestFitScore = Infinity;
      let fitW = 0;
      let fitH = 0;
      let fitRotated = false;

      let orientations = [{ w: item.w, h: item.h, rotated: item.rotated }];
      if (config.rotation && item.w !== item.h) {
        orientations.push({ w: item.h, h: item.w, rotated: !item.rotated });
      }

      for (let r = 0; r < freeRects.length; r++) {
        const rect = freeRects[r]!;
        for (let o = 0; o < orientations.length; o++) {
          const orient = orientations[o]!;
          if (orient.w <= rect.w && orient.h <= rect.h) {
            const leftoverArea = rect.w * rect.h - orient.w * orient.h;
            let contactLength = 0;
            if (rect.x === trim) contactLength += orient.h;
            if (rect.y === trim) contactLength += orient.w;
            if (rect.x + orient.w >= curSheetLength - trim) contactLength += orient.h;
            if (rect.y + orient.h >= curSheetWidth - trim) contactLength += orient.w;

            for (let p = 0; p < placed.length; p++) {
              const ex = placed[p]!;
              if (Math.abs(ex.x + ex.w - rect.x) < 2 || Math.abs(rect.x + orient.w - ex.x) < 2) {
                const overlapY = Math.max(0, Math.min(rect.y + orient.h, ex.y + ex.h) - Math.max(rect.y, ex.y));
                if (overlapY > 2) contactLength += overlapY;
              }
              if (Math.abs(ex.y + ex.h - rect.y) < 2 || Math.abs(rect.y + orient.h - ex.y) < 2) {
                const overlapX = Math.max(0, Math.min(rect.x + orient.w, ex.x + ex.w) - Math.max(rect.x, ex.x));
                if (overlapX > 2) contactLength += overlapX;
              }
            }

            const score = leftoverArea - contactLength * 10 + rect.x * 20000 + rect.y * 50;
            if (score < bestFitScore) {
              bestFitScore = score;
              bestFitRectIdx = r;
              fitW = orient.w;
              fitH = orient.h;
              fitRotated = orient.rotated;
            }
          }
        }
      }

      if (bestFitRectIdx !== -1) {
        const targetRect = freeRects[bestFitRectIdx]!;
        placed.push({
          key: `${sheetId}-${index}`,
          part: item.part,
          x: targetRect.x,
          y: targetRect.y,
          w: fitW,
          h: fitH,
          rotated: fitRotated,
          index: index++,
        });
        usedArea += fitW * fitH;

        const origIdx = remainingCandidates.findIndex(
          (rc) => rc === item || (rc.part.id === item.part.id && rc.w === item.w && rc.h === item.h)
        );
        if (origIdx !== -1) {
          remainingCandidates.splice(origIdx, 1);
        }

        freeRects = splitFreeRectangleSet(freeRects, targetRect.x, targetRect.y, fitW, fitH, kerf);
      }
    }
  }

  return { placed, unplaced: remainingCandidates, usedArea, freeRects };
}

/** Multi-Trial High-Yield Solver targeting 90–95% material utilization */
function solveBucketMinSheets(
  queueItems: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number
): NestedSheet[] {
  const sorters: Array<{ name: string; fn: (a: PackingItem, b: PackingItem) => number }> = [
    { name: "SameWidthStrips", fn: (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.w * b.h - a.w * a.h },
    { name: "SameHeightStrips", fn: (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w - a.w },
    { name: "AreaDesc", fn: (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h) },
    { name: "MaxDimDesc", fn: (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h },
    { name: "LongSideDesc", fn: (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h) },
    { name: "PerimeterDesc", fn: (a, b) => b.w + b.h - (a.w + a.h) },
  ];

  const heuristics: Array<"bssf" | "blsf" | "baf" | "guillotine-aligned" | "same-width-strip"> = [
    "bssf",
    "blsf",
    "baf",
    "same-width-strip",
    "guillotine-aligned",
  ];

  let bestSheets: NestedSheet[] | null = null;
  let bestSheetCount = Infinity;
  let bestTotalUtilization = -1;

  for (let s = 0; s < sorters.length; s++) {
    const sorter = sorters[s]!;
    const sortedQueue = queueItems.slice().sort(sorter.fn);

    for (let h = 0; h < heuristics.length; h++) {
      const heuristic = heuristics[h]!;
      let remainingQueue = sortedQueue.slice();
      let currentTrialSheets: NestedSheet[] = [];

      while (remainingQueue.length > 0) {
        const sheetId = `TEMP-${currentTrialSheets.length + 1}`;
        const { placed, unplaced, usedArea } = packSingleSheetMaxRectsBFD(
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

      currentTrialSheets = postOptimizationRecompact(currentTrialSheets, config);

      const totalTrialArea = currentTrialSheets.reduce((a, st) => a + st.sheetLength * st.sheetWidth, 0) || 1;
      const totalTrialUsed = currentTrialSheets.reduce((a, st) => a + st.usedArea, 0);
      const trialUtil = (totalTrialUsed / totalTrialArea) * 100;

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

/** Calculate remaining free non-overlapping rectangles on a sheet after existing parts are placed */
function calculateFreeRectanglesForSheet(sheet: NestedSheet, config: OptimizationConfig): FreeRectangle[] {
  const trim = config.trim;
  const kerf = config.kerf;

  let freeRects: FreeRectangle[] = [
    {
      x: trim,
      y: trim,
      w: sheet.sheetLength - trim * 2,
      h: sheet.sheetWidth - trim * 2,
    },
  ];

  for (let i = 0; i < sheet.placed.length; i++) {
    const placed = sheet.placed[i]!;
    freeRects = splitFreeRectangleSet(freeRects, placed.x, placed.y, placed.w, placed.h, kerf);
  }

  return freeRects;
}

/** 
 * Fast Inter-Sheet Re-compactor & Partial Waste Back-Filling.
 * Transfers parts from low-utilization last sheets to scrap spaces of earlier sheets.
 */
export function postOptimizationRecompact(sheets: NestedSheet[], config: OptimizationConfig): NestedSheet[] {
  if (sheets.length <= 1) return sheets;

  let currentSheets = sheets.map((s) => ({
    ...s,
    placed: s.placed.map((p) => ({ ...p })),
  }));

  let eliminatedAny = false;

  // 1. Full Elimination Pass (Try to eliminate entire trailing sheet)
  do {
    eliminatedAny = false;
    if (currentSheets.length <= 1) break;

    const lastSheetIdx = currentSheets.length - 1;
    const lastSheet = currentSheets[lastSheetIdx];
    if (!lastSheet) break;
    const candidateParts = lastSheet.placed.slice().sort((a, b) => b.w * b.h - a.w * a.h);

    const tempSheets = currentSheets.slice(0, lastSheetIdx).map((s) => ({
      ...s,
      placed: s.placed.map((p) => ({ ...p })),
    }));

    // Feasibility check: if candidate area exceeds available free area in prior sheets, elimination is impossible
    const totalCandidateArea = candidateParts.reduce((a, p) => a + p.w * p.h, 0);
    const availableFreeArea = tempSheets.reduce(
      (a, s) => a + (s.sheetLength * s.sheetWidth - s.usedArea),
      0
    );
    if (totalCandidateArea > availableFreeArea) break;

    let allPlacedSuccessfully = true;

    for (let i = 0; i < candidateParts.length; i++) {
      const partToPlace = candidateParts[i]!;
      let partFit = false;

      for (let t = 0; t < tempSheets.length; t++) {
        const targetSheet = tempSheets[t]!;
        const freeRects = calculateFreeRectanglesForSheet(targetSheet, config);

        let orientations = [{ w: partToPlace.w, h: partToPlace.h, rotated: partToPlace.rotated }];
        if (config.rotation && partToPlace.w !== partToPlace.h) {
          orientations.push({ w: partToPlace.h, h: partToPlace.w, rotated: !partToPlace.rotated });
        }

        for (let r = 0; r < freeRects.length; r++) {
          const freeRect = freeRects[r]!;
          for (let o = 0; o < orientations.length; o++) {
            const orient = orientations[o]!;
            if (orient.w <= freeRect.w && orient.h <= freeRect.h) {
              targetSheet.placed.push({
                key: `${targetSheet.id}-${targetSheet.placed.length}`,
                part: partToPlace.part,
                x: freeRect.x,
                y: freeRect.y,
                w: orient.w,
                h: orient.h,
                rotated: orient.rotated,
                index: targetSheet.placed.length,
              });
              targetSheet.usedArea += orient.w * orient.h;
              targetSheet.utilization =
                (targetSheet.usedArea / (targetSheet.sheetLength * targetSheet.sheetWidth)) * 100;
              partFit = true;
              break;
            }
          }
          if (partFit) break;
        }
        if (partFit) break;
      }

      if (!partFit) {
        allPlacedSuccessfully = false;
        break;
      }
    }

    if (allPlacedSuccessfully) {
      currentSheets = tempSheets;
      eliminatedAny = true;
    }
  } while (eliminatedAny);

  // 2. Partial Back-Filling Pass (Transfer individual parts from trailing sheets into earlier free pockets)
  if (currentSheets.length > 1) {
    for (let sIdx = currentSheets.length - 1; sIdx >= 1; sIdx--) {
      const trailingSheet = currentSheets[sIdx]!;
      if (!trailingSheet || trailingSheet.placed.length === 0) continue;

      const targetFreeRectsMap = new Map<number, FreeRectangle[]>();
      for (let tIdx = 0; tIdx < sIdx; tIdx++) {
        targetFreeRectsMap.set(tIdx, calculateFreeRectanglesForSheet(currentSheets[tIdx]!, config));
      }

      const trailingParts = trailingSheet.placed.slice().sort((a, b) => a.w * a.h - b.w * b.h);

      for (let pIdx = trailingParts.length - 1; pIdx >= 0; pIdx--) {
        const partToMove = trailingParts[pIdx]!;
        let moved = false;

        for (let tIdx = 0; tIdx < sIdx; tIdx++) {
          const targetSheet = currentSheets[tIdx]!;
          const freeRects = targetFreeRectsMap.get(tIdx);
          if (!freeRects || freeRects.length === 0) continue;

          let orientations = [{ w: partToMove.w, h: partToMove.h, rotated: partToMove.rotated }];
          if (config.rotation && partToMove.w !== partToMove.h) {
            orientations.push({ w: partToMove.h, h: partToMove.w, rotated: !partToMove.rotated });
          }

          for (let r = 0; r < freeRects.length; r++) {
            const freeRect = freeRects[r]!;
            for (let o = 0; o < orientations.length; o++) {
              const orient = orientations[o]!;
              if (orient.w <= freeRect.w && orient.h <= freeRect.h) {
                targetSheet.placed.push({
                  key: `${targetSheet.id}-${targetSheet.placed.length}`,
                  part: partToMove.part,
                  x: freeRect.x,
                  y: freeRect.y,
                  w: orient.w,
                  h: orient.h,
                  rotated: orient.rotated,
                  index: targetSheet.placed.length,
                });
                targetSheet.usedArea += orient.w * orient.h;
                targetSheet.utilization =
                  (targetSheet.usedArea / (targetSheet.sheetLength * targetSheet.sheetWidth)) * 100;

                const remIdx = trailingSheet.placed.findIndex((p) => p.key === partToMove.key);
                if (remIdx !== -1) {
                  trailingSheet.placed.splice(remIdx, 1);
                }
                trailingSheet.usedArea -= partToMove.w * partToMove.h;
                trailingSheet.utilization =
                  (trailingSheet.usedArea / (trailingSheet.sheetLength * trailingSheet.sheetWidth)) * 100;

                const updatedFree = splitFreeRectangleSet(
                  freeRects,
                  freeRect.x,
                  freeRect.y,
                  orient.w,
                  orient.h,
                  config.kerf
                );
                targetFreeRectsMap.set(tIdx, updatedFree);

                moved = true;
                break;
              }
            }
            if (moved) break;
          }
          if (moved) break;
        }
      }
    }

    currentSheets = currentSheets.filter((s) => s.placed.length > 0);
  }

  return currentSheets;
}

/**
 * Computes a weighted scalar fitness score for layout selection and optimization rank.
 */
export function evaluateLayoutScore(
  sheets: NestedSheet[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS.balanced,
  config: OptimizationConfig
): { score: number; metrics: CandidateMetrics } {
  const metrics = evaluateLayoutMetrics(sheets, config);

  const reusableRemnantM2 = metrics.reusableRemnantArea / 1e6;
  const fragmentedM2 = metrics.fragmentedWasteArea / 1e6;
  const cutMeters = metrics.totalCutLength / 1000;
  const remnantQualityBonus = weights.remnantQualityBonus ?? 30.0;

  // Extra penalty for low-utilization trailing sheets (< 50% yield)
  let trailingSheetPenalty = 0;
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]!;
    if (s.utilization < 50) {
      trailingSheetPenalty += (50 - s.utilization) * 3.0;
    }
  }

  const score =
    metrics.utilization * weights.materialUtilization -
    metrics.sheetCount * weights.sheetCountPenalty -
    trailingSheetPenalty -
    cutMeters * weights.cutLengthPenalty +
    reusableRemnantM2 * weights.reusableRemnantBonus -
    fragmentedM2 * weights.fragmentedWastePenalty +
    (metrics.remnantQualityScore / 100) * remnantQualityBonus +
    metrics.cutContinuityScore * weights.cutContinuityBonus +
    metrics.packingDensity * weights.packingDensityBonus -
    metrics.rotationCount * weights.rotationPenalty +
    metrics.stripAlignmentScore * weights.stripAlignmentBonus;

  return {
    score: Number(score.toFixed(2)),
    metrics,
  };
}

/** Order Crossover (OX) for sequence permutation candidate genomes */
export function orderCrossover(
  seqA: PackingItem[],
  seqB: PackingItem[],
  prng: () => number = Math.random
): PackingItem[] {
  const len = seqA.length;
  if (len <= 2) return [...seqA];

  const cut1 = Math.floor(prng() * (len - 1));
  const cut2 = Math.floor(prng() * (len - cut1)) + cut1 + 1;

  const child: Array<PackingItem | null> = new Array(len).fill(null);
  const included = new Set<PackingItem>();

  for (let i = cut1; i < cut2; i++) {
    const item = seqA[i]!;
    child[i] = item;
    included.add(item);
  }

  let bIdx = 0;
  for (let i = 0; i < len; i++) {
    if (child[i] === null) {
      while (bIdx < len && included.has(seqB[bIdx]!)) {
        bIdx++;
      }
      if (bIdx < len) {
        const item = seqB[bIdx]!;
        child[i] = item;
        included.add(item);
        bIdx++;
      }
    }
  }

  return child.map((item, idx) => item || seqA[idx]!);
}

/** Mutates candidate sequence chromosome via pairwise swap, 2-opt reverse, or block move */
export function mutateSequence(
  seq: PackingItem[],
  prng: () => number = Math.random
): PackingItem[] {
  if (seq.length <= 1) return seq;
  const result = [...seq];
  const choice = prng();

  if (choice < 0.35) {
    const i = Math.floor(prng() * result.length);
    const j = Math.floor(prng() * result.length);
    if (i !== j) {
      const tmp = result[i]!;
      result[i] = result[j]!;
      result[j] = tmp;
    }
  } else if (choice < 0.70) {
    const i = Math.floor(prng() * (result.length - 1));
    const j = Math.floor(prng() * (result.length - i)) + i + 1;
    const sub = result.slice(i, j).reverse();
    result.splice(i, sub.length, ...sub);
  } else {
    const blockSize = Math.min(Math.floor(prng() * 3) + 1, result.length);
    const src = Math.floor(prng() * (result.length - blockSize + 1));
    const block = result.splice(src, blockSize);
    const dest = Math.floor(prng() * (result.length + 1));
    result.splice(dest, 0, ...block);
  }

  return result;
}

export type CandidateGenome = {
  sequence: PackingItem[];
  heuristic: "same-width-strip" | "bssf" | "baf" | "guillotine-aligned" | "largest-first-strict";
};

export type PopulationIndividual = {
  genome: CandidateGenome;
  sheets: NestedSheet[];
  metrics: CandidateMetrics;
  score: number;
};

/** Evaluates a single candidate layout genome */
function evaluateGenome(
  genome: CandidateGenome,
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number
): PopulationIndividual {
  let remainingQueue = [...genome.sequence];
  let currentSheets: NestedSheet[] = [];

  while (remainingQueue.length > 0) {
    const sheetId = `TEMP-${currentSheets.length + 1}`;
    // Map genome heuristic to the supported packSingleSheetMaxRectsBFD heuristics
    const heuristicForPack: "bssf" | "blsf" | "baf" | "guillotine-aligned" | "same-width-strip" =
      genome.heuristic === "largest-first-strict" ? "bssf" : genome.heuristic;
    const { placed, unplaced, usedArea } = packSingleSheetMaxRectsBFD(
      remainingQueue,
      curSheetLength,
      curSheetWidth,
      config,
      sheetId,
      heuristicForPack
    );

    if (placed.length === 0) break;

    currentSheets.push({
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

  const preset = config.preset ?? "balanced";
  const weights = config.scoringWeights ?? DEFAULT_SCORING_WEIGHTS[preset];
  const { score, metrics } = evaluateLayoutScore(currentSheets, weights, config);

  return {
    genome,
    sheets: currentSheets,
    metrics,
    score,
  };
}

/**
 * Industrial Guillotine Vertical Column Strip Packer.
 * Aligns parts of matching width or identical item marks into continuous vertical columns along Y.
 * Enables ONE long vertical guillotine cut to separate the entire column strip, followed by small horizontal cross cuts.
 * Dynamically tests 0° and 90° rotation for every individual part to match the column width.
 */
/**
 * Fast Dynamic Programming 1D Knapsack for exact span fill in guillotine strips.
 * Given candidate items with lengths s_i = dim_i + kerf and capacity C = targetSpan + kerf,
 * finds the subset that maximizes total length <= targetSpan.
 */
function dpKnapsack1D<T extends PackingItem>(
  candidates: Array<{ item: T; w: number; h: number; rotated: boolean; spanLen: number }>,
  targetSpan: number,
  kerf: number
): Array<{ item: T; w: number; h: number; rotated: boolean; spanLen: number }> {
  if (!candidates || candidates.length === 0) return [];
  const C = targetSpan + kerf;
  if (C <= 0) return [];

  // Filter candidates to avoid redundant DP iterations while preserving part diversity
  const typeMap = new Map<string, number>();
  const filtered: typeof candidates = [];
  for (const c of candidates) {
    const key = `${c.item.part.id}_${c.w}x${c.h}`;
    const count = typeMap.get(key) || 0;
    const maxNeeded = Math.ceil(targetSpan / Math.max(1, c.spanLen)) + 2;
    if (count < maxNeeded) {
      typeMap.set(key, count + 1);
      filtered.push(c);
    }
  }

  const N = filtered.length;
  const prevItem = new Int32Array(C + 1).fill(-1);
  const prevCap = new Int32Array(C + 1).fill(-1);
  const dp = new Uint8Array(C + 1);
  dp[0] = 1;

  let maxReached = 0;

  for (let i = 0; i < N; i++) {
    const item = filtered[i]!;
    const weight = item.spanLen + kerf;
    if (weight > C) continue;

    for (let cap = C; cap >= weight; cap--) {
      if (dp[cap - weight] === 1 && dp[cap] === 0) {
        dp[cap] = 1;
        prevItem[cap] = i;
        prevCap[cap] = cap - weight;
        if (cap > maxReached) maxReached = cap;
      }
    }
    if (maxReached >= C - kerf) break;
  }

  let bestCap = maxReached;
  while (bestCap > 0 && dp[bestCap] === 0) bestCap--;

  if (bestCap <= 0) {
    const single = candidates.find((c) => c.spanLen <= targetSpan);
    return single ? [single] : [];
  }

  const chosen: typeof candidates = [];
  let curr = bestCap;
  while (curr > 0 && prevItem[curr] !== -1) {
    const itemIdx = prevItem[curr]!;
    chosen.push(filtered[itemIdx]!);
    curr = prevCap[curr]!;
  }

  // Sort chosen items for clean collinear visual appearance
  chosen.sort((a, b) => a.item.part.item.localeCompare(b.item.part.item) || b.spanLen - a.spanLen);
  return chosen;
}

function knapsackHeightDesc<T extends PackingItem>(
  candidates: Array<{ item: T; w: number; h: number; rotated: boolean; spanLen: number }>,
  targetSpan: number,
  kerf: number
): Array<{ item: T; w: number; h: number; rotated: boolean; spanLen: number }> {
  if (!candidates || candidates.length === 0) return [];
  const sorted = [...candidates].sort(
    (a, b) => b.spanLen - a.spanLen || a.item.part.item.localeCompare(b.item.part.item)
  );
  const chosen: typeof candidates = [];
  let currentSpan = 0;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const nextSpan = currentSpan + (chosen.length > 0 ? kerf : 0) + c.spanLen;
    if (nextSpan <= targetSpan) {
      chosen.push(c);
      currentSpan = nextSpan;
      if (currentSpan >= targetSpan - 3) break;
    }
  }
  return chosen;
}

/**
 * Industrial Guillotine Vertical Column Strip Packer with DP Knapsack.
 * Aligns parts of identical width into continuous, unbroken vertical columns along Y.
 * Enables ONE long vertical guillotine shear pass from top to bottom edge, followed by horizontal cross cuts.
 * Guarantees zero lateral voids, straight shear cut lines, and maximum height fill.
 */
export function packGuillotineColumnSheet(
  items: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number,
  sheetIdPrefix: string = "COL"
): NestedSheet[] {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = curSheetLength - trim * 2;
  const usableW = curSheetWidth - trim * 2;

  let remainingQueue = items.map((it, idx) => ({ ...it, qId: idx }));
  const sheets: NestedSheet[] = [];

  while (remainingQueue.length > 0) {
    const sheetId = `${sheetIdPrefix}-${sheets.length + 1}`;
    const placed: PlacedPart[] = [];
    let currentX = trim;
    let usedArea = 0;
    let index = 0;

    while (currentX < curSheetLength - trim && remainingQueue.length > 0) {
      const remainingSpaceW = curSheetLength - trim - currentX;
      if (remainingSpaceW <= 0) break;

      // Group available items by candidate width
      const widthMap = new Map<
        number,
        Array<{ item: PackingItem & { qId: number }; w: number; h: number; rotated: boolean; spanLen: number }>
      >();
      for (let i = 0; i < remainingQueue.length; i++) {
        const item = remainingQueue[i]!;
        const canRotate = config.rotation && item.w !== item.h;

        if (item.w <= remainingSpaceW && item.h <= usableW) {
          if (!widthMap.has(item.w)) widthMap.set(item.w, []);
          widthMap.get(item.w)!.push({ item, h: item.h, w: item.w, rotated: item.rotated, spanLen: item.h });
        }
        if (canRotate && item.h <= remainingSpaceW && item.w <= usableW) {
          if (!widthMap.has(item.h)) widthMap.set(item.h, []);
          widthMap.get(item.h)!.push({ item, h: item.w, w: item.h, rotated: !item.rotated, spanLen: item.w });
        }
      }

      if (widthMap.size === 0) break;

      let bestWidth = 0;
      let bestCombination: Array<{ item: PackingItem & { qId: number }; w: number; h: number; rotated: boolean; spanLen: number }> = [];
      let bestFillH = 0;

      for (const [w, candidates] of widthMap) {
        // Compare DP knapsack vs height-descending knapsack to find optimal fill
        const comboDP = dpKnapsack1D(candidates, usableW, kerf);
        const comboDesc = knapsackHeightDesc(candidates, usableW, kerf);
        const fillDP = comboDP.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDP.length - 1) * kerf;
        const fillDesc = comboDesc.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDesc.length - 1) * kerf;

        const combo = fillDP >= fillDesc ? comboDP : comboDesc;
        const comboH = Math.max(fillDP, fillDesc);

        if (comboH > bestFillH || (comboH === bestFillH && w > bestWidth)) {
          bestFillH = comboH;
          bestWidth = w;
          bestCombination = combo;
        }
      }

      if (bestWidth <= 0 || bestCombination.length === 0) break;

      let currentY = trim;
      for (const chosen of bestCombination) {
        placed.push({
          key: `${sheetId}-${index}`,
          part: chosen.item.part,
          x: currentX,
          y: currentY,
          w: chosen.w,
          h: chosen.h,
          rotated: chosen.rotated,
          index: index++,
        });

        usedArea += chosen.w * chosen.h;
        currentY += chosen.h + kerf;

        const remIdx = remainingQueue.findIndex((r) => r.qId === chosen.item.qId);
        if (remIdx !== -1) {
          remainingQueue.splice(remIdx, 1);
        }
      }

      currentX += bestWidth + kerf;
    }

    if (placed.length === 0) break;

    sheets.push({
      id: sheetId,
      material,
      thickness,
      sheetLength: curSheetLength,
      sheetWidth: curSheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
    });
  }

  return sheets;
}

/**
 * Industrial Guillotine Horizontal Shelf Strip Packer with DP Knapsack.
 * Aligns parts into uniform horizontal strips (shelves) to eliminate lateral fragmentation.
 * Enables ONE long horizontal guillotine shear cut across the sheet, followed by small vertical cuts.
 */
export function packGuillotineShelfSheet(
  items: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number,
  sheetIdPrefix: string = "SHELF"
): NestedSheet[] {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = curSheetLength - trim * 2;
  const usableW = curSheetWidth - trim * 2;

  let remainingQueue = items.map((it, idx) => ({ ...it, qId: idx }));
  const sheets: NestedSheet[] = [];

  while (remainingQueue.length > 0) {
    const sheetId = `${sheetIdPrefix}-${sheets.length + 1}`;
    const placed: PlacedPart[] = [];
    let currentY = trim;
    let usedArea = 0;
    let index = 0;

    while (currentY < curSheetWidth - trim && remainingQueue.length > 0) {
      const remainingSpaceH = curSheetWidth - trim - currentY;
      if (remainingSpaceH <= 0) break;

      // Group available items by candidate shelf height
      const heightMap = new Map<
        number,
        Array<{ item: PackingItem & { qId: number }; w: number; h: number; rotated: boolean; spanLen: number }>
      >();
      for (let i = 0; i < remainingQueue.length; i++) {
        const item = remainingQueue[i]!;
        const canRotate = config.rotation && item.w !== item.h;

        if (item.h <= remainingSpaceH && item.w <= usableL) {
          if (!heightMap.has(item.h)) heightMap.set(item.h, []);
          heightMap.get(item.h)!.push({ item, w: item.w, h: item.h, rotated: item.rotated, spanLen: item.w });
        }
        if (canRotate && item.w <= remainingSpaceH && item.h <= usableL) {
          if (!heightMap.has(item.w)) heightMap.set(item.w, []);
          heightMap.get(item.w)!.push({ item, w: item.h, h: item.w, rotated: !item.rotated, spanLen: item.h });
        }
      }

      if (heightMap.size === 0) break;

      let bestHeight = 0;
      let bestCombination: Array<{ item: PackingItem & { qId: number }; w: number; h: number; rotated: boolean; spanLen: number }> = [];
      let bestFillL = 0;

      for (const [h, candidates] of heightMap) {
        const comboDP = dpKnapsack1D(candidates, usableL, kerf);
        const comboDesc = knapsackHeightDesc(candidates, usableL, kerf);
        const fillDP = comboDP.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDP.length - 1) * kerf;
        const fillDesc = comboDesc.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDesc.length - 1) * kerf;

        const combo = fillDP >= fillDesc ? comboDP : comboDesc;
        const comboL = Math.max(fillDP, fillDesc);

        if (comboL > bestFillL || (comboL === bestFillL && h > bestHeight)) {
          bestFillL = comboL;
          bestHeight = h;
          bestCombination = combo;
        }
      }

      if (bestHeight <= 0 || bestCombination.length === 0) break;

      let currentX = trim;
      for (const chosen of bestCombination) {
        placed.push({
          key: `${sheetId}-${index}`,
          part: chosen.item.part,
          x: currentX,
          y: currentY,
          w: chosen.w,
          h: chosen.h,
          rotated: chosen.rotated,
          index: index++,
        });

        usedArea += chosen.w * chosen.h;
        currentX += chosen.w + kerf;

        const remIdx = remainingQueue.findIndex((r) => r.qId === chosen.item.qId);
        if (remIdx !== -1) {
          remainingQueue.splice(remIdx, 1);
        }
      }

      currentY += bestHeight + kerf;
    }

    if (placed.length === 0) break;

    sheets.push({
      id: sheetId,
      material,
      thickness,
      sheetLength: curSheetLength,
      sheetWidth: curSheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
    });
  }

  return sheets;
}

/**
 * Industrial Skyline Bottom-Left Profile Sheet Packer.
 * Maintains top contour skylines across the sheet to place parts at the lowest, leftmost valid position.
 * Backfills skyline waste gaps and eliminates staircase dead space.
 */
export function packSkylineSheet(
  items: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number,
  sheetIdPrefix: string = "SKYLINE"
): NestedSheet[] {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = curSheetLength - trim * 2;
  const usableW = curSheetWidth - trim * 2;

  let remainingQueue = items.slice();
  const sheets: NestedSheet[] = [];

  while (remainingQueue.length > 0) {
    const sheetId = `${sheetIdPrefix}-${sheets.length + 1}`;
    const placed: PlacedPart[] = [];
    let usedArea = 0;
    let index = 0;

    let skyline: SkylineNode[] = [{ x: trim, y: trim, width: usableL }];

    let placedAnyInPass = true;
    while (placedAnyInPass && remainingQueue.length > 0) {
      placedAnyInPass = false;

      let bestItemIdx = -1;
      let bestSkylineIdx = -1;
      let bestW = 0;
      let bestH = 0;
      let bestRotated = false;
      let bestX = 0;
      let bestY = Infinity;
      let bestScore = Infinity;

      for (let i = 0; i < remainingQueue.length; i++) {
        const item = remainingQueue[i]!;
        let canRotate = config.rotation && item.w !== item.h;

        let orientations = [{ w: item.w, h: item.h, rotated: item.rotated }];
        if (canRotate) {
          orientations.push({ w: item.h, h: item.w, rotated: !item.rotated });
        }

        for (const orient of orientations) {
          for (let sIdx = 0; sIdx < skyline.length; sIdx++) {
            let coveredW = 0;
            let maxY = 0;
            let fits = false;

            for (let k = sIdx; k < skyline.length; k++) {
              const node = skyline[k]!;
              if (node.y > maxY) maxY = node.y;
              coveredW += node.width;

              if (coveredW >= orient.w) {
                fits = true;
                break;
              }
            }

            if (fits && maxY + orient.h <= curSheetWidth - trim) {
              const startX = skyline[sIdx]!.x;

              let contactLen = 0;
              if (startX === trim) contactLen += orient.h;
              if (maxY === trim) contactLen += orient.w;
              if (startX + orient.w >= curSheetLength - trim) contactLen += orient.h;
              if (maxY + orient.h >= curSheetWidth - trim) contactLen += orient.w;

              // Width-first skyline: place at lowest startX and stack upward along Y (1500mm width)
              const score = startX * 30000 + maxY * 50 - contactLen * 50;

              if (score < bestScore) {
                bestScore = score;
                bestItemIdx = i;
                bestSkylineIdx = sIdx;
                bestW = orient.w;
                bestH = orient.h;
                bestRotated = orient.rotated;
                bestX = startX;
                bestY = maxY;
              }
            }
          }
        }
      }

      if (bestItemIdx !== -1 && bestSkylineIdx !== -1) {
        const chosen = remainingQueue[bestItemIdx]!;
        placed.push({
          key: `${sheetId}-${index}`,
          part: chosen.part,
          x: bestX,
          y: bestY,
          w: bestW,
          h: bestH,
          rotated: bestRotated,
          index: index++,
        });

        usedArea += bestW * bestH;
        remainingQueue.splice(bestItemIdx, 1);
        placedAnyInPass = true;

        const newSkyline: SkylineNode[] = [];
        let i = 0;
        while (i < skyline.length) {
          const node = skyline[i]!;

          if (node.x + node.width <= bestX) {
            newSkyline.push(node);
            i++;
          } else if (node.x >= bestX + bestW + kerf) {
            newSkyline.push(node);
            i++;
          } else {
            if (node.x < bestX) {
              newSkyline.push({ x: node.x, y: node.y, width: bestX - node.x });
            }

            const rightX = Math.min(node.x + node.width, curSheetLength - trim);
            if (rightX > bestX + bestW + kerf) {
              const remW = rightX - (bestX + bestW + kerf);
              if (remW > 0) {
                newSkyline.push({ x: bestX + bestW + kerf, y: node.y, width: remW });
              }
            }
            i++;
          }
        }

        newSkyline.push({
          x: bestX,
          y: bestY + bestH + kerf,
          width: bestW + kerf,
        });

        newSkyline.sort((a, b) => a.x - b.x);

        const mergedSkyline: SkylineNode[] = [];
        for (const n of newSkyline) {
          if (n.width <= 0) continue;
          if (mergedSkyline.length === 0) {
            mergedSkyline.push({ ...n });
          } else {
            const prev = mergedSkyline[mergedSkyline.length - 1]!;
            if (Math.abs(prev.x + prev.width - n.x) < 2 && Math.abs(prev.y - n.y) < 2) {
              prev.width += n.width;
            } else {
              mergedSkyline.push({ ...n });
            }
          }
        }

        skyline = mergedSkyline;
      } else {
        let minSegIdx = -1;
        let minSegY = Infinity;

        for (let s = 0; s < skyline.length; s++) {
          if (skyline[s]!.y < minSegY) {
            minSegY = skyline[s]!.y;
            minSegIdx = s;
          }
        }

        if (minSegIdx !== -1) {
          const seg = skyline[minSegIdx]!;
          const leftY = minSegIdx > 0 ? skyline[minSegIdx - 1]!.y : Infinity;
          const rightY = minSegIdx < skyline.length - 1 ? skyline[minSegIdx + 1]!.y : Infinity;
          const targetY = Math.min(leftY, rightY);

          if (targetY > seg.y && targetY <= curSheetWidth - trim) {
            seg.y = targetY;
            placedAnyInPass = true;

            const mergedSkyline: SkylineNode[] = [];
            for (const n of skyline) {
              if (mergedSkyline.length === 0) {
                mergedSkyline.push({ ...n });
              } else {
                const prev = mergedSkyline[mergedSkyline.length - 1]!;
                if (Math.abs(prev.x + prev.width - n.x) < 2 && Math.abs(prev.y - n.y) < 2) {
                  prev.width += n.width;
                } else {
                  mergedSkyline.push({ ...n });
                }
              }
            }
            skyline = mergedSkyline;
          }
        }
      }
    }

    if (placed.length === 0) break;

    sheets.push({
      id: sheetId,
      material,
      thickness,
      sheetLength: curSheetLength,
      sheetWidth: curSheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
    });
  }

  return sheets;
}

/** Population-Based Optimizer algorithm maintaining 100 candidate layouts */
export function solveBucketPopulation(
  queueItems: PackingItem[],
  curSheetLength: number,
  curSheetWidth: number,
  config: OptimizationConfig,
  material: string,
  thickness: number,
  onProgress?: (progress: number, message?: string) => void
): {
  bestSheets: NestedSheet[];
  populationCandidates: CandidateLayout[];
  generationsRun: number;
  converged: boolean;
} {
  const preset = config.preset ?? "balanced";
  const count = queueItems.length;

  // Dynamically scale population and generations based on bucket item count
  // to deliver blazing performance (<5s) while preserving elite layout quality.
  let defaultPopSize = 30;
  let defaultMaxGens = 10;
  let defaultStagnantLimit = 4;

  if (count > 250) {
    defaultPopSize = preset === "max-yield" ? 12 : 8;
    defaultMaxGens = preset === "max-yield" ? 4 : 2;
    defaultStagnantLimit = 2;
  } else if (count > 100) {
    defaultPopSize = preset === "max-yield" ? 18 : 10;
    defaultMaxGens = preset === "max-yield" ? 6 : 3;
    defaultStagnantLimit = 2;
  } else if (count > 40) {
    defaultPopSize = preset === "max-yield" ? 28 : 16;
    defaultMaxGens = preset === "max-yield" ? 8 : 4;
    defaultStagnantLimit = 3;
  } else {
    defaultPopSize = preset === "max-yield" ? 40 : 25;
    defaultMaxGens = preset === "max-yield" ? 15 : 8;
    defaultStagnantLimit = 3;
  }

  if (preset === "fast") {
    defaultPopSize = Math.min(defaultPopSize, 8);
    defaultMaxGens = Math.min(defaultMaxGens, 2);
    defaultStagnantLimit = 2;
  }

  const popSize = config.populationSize ?? defaultPopSize;
  const maxGens = config.generations ?? defaultMaxGens;
  const stagnantLimit = defaultStagnantLimit;

  const convergenceThreshold = config.convergenceThreshold ?? 0.001;
  const eliteCount = Math.max(2, Math.floor(popSize * 0.15)); // Keep Elite top 15%
  const heuristics: Array<"same-width-strip" | "bssf" | "baf" | "guillotine-aligned" | "largest-first-strict"> = [
    "same-width-strip",
    "bssf",
    "baf",
    "guillotine-aligned",
    "largest-first-strict",
  ];

  const staticPolicies: GRASPPolicy[] = [
    "area-descending",
    "area-ascending",
    "longest-side",
    "shortest-side",
    "perimeter",
    "aspect-ratio",
    "height-strip",
    "width-strip",
  ];

  const sorters: Array<(a: PackingItem, b: PackingItem) => number> = [
    (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.w * b.h - a.w * a.h,
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w - a.w,
    (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h),
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h),
    (a, b) => b.w + b.h - (a.w + a.h),
    (a, b) => b.w / b.h - a.w / a.h,
  ];

  // 1. Initial Population Generation (Size = 100)
  let population: PopulationIndividual[] = [];

  for (const sorter of sorters) {
    for (const h of heuristics) {
      if (population.length >= popSize) break;
      const seq = [...queueItems].sort(sorter);
      population.push(
        evaluateGenome(
          { sequence: seq, heuristic: h },
          curSheetLength,
          curSheetWidth,
          config,
          material,
          thickness
        )
      );
    }
  }

  const baseQueue = [...queueItems].sort((a, b) => b.w * b.h - a.w * a.h);
  while (population.length < popSize) {
    const pert = mutateSequence(baseQueue);
    const h = heuristics[Math.floor(Math.random() * heuristics.length)]!;
    population.push(
      evaluateGenome(
        { sequence: pert, heuristic: h },
        curSheetLength,
        curSheetWidth,
        config,
        material,
        thickness
      )
    );
  }

  // Evaluate & Sort
  population.sort((a, b) => b.score - a.score);

  let bestScore = population[0]?.score ?? -Infinity;
  let stagnantGens = 0;
  let generationsRun = 0;
  let converged = false;

  function tournamentSelect(pop: PopulationIndividual[], k = 3): PopulationIndividual {
    let best = pop[Math.floor(Math.random() * pop.length)]!;
    for (let i = 1; i < k; i++) {
      const cand = pop[Math.floor(Math.random() * pop.length)]!;
      if (cand.score > best.score) {
        best = cand;
      }
    }
    return best;
  }

  // 2. Generation Evolution Loop
  for (let gen = 0; gen < maxGens; gen++) {
    generationsRun = gen + 1;
    const progressPct = Math.round(((gen + 1) / maxGens) * 100);
    onProgress?.(progressPct, `Population Generation ${gen + 1}/${maxGens} (Best Score: ${population[0]?.score.toFixed(1)})...`);

    // Convergence Detection
    const currentBestScore = population[0]!.score;
    if (currentBestScore - bestScore > convergenceThreshold) {
      bestScore = currentBestScore;
      stagnantGens = 0;
    } else {
      stagnantGens++;
    }

    if (stagnantGens >= stagnantLimit) {
      converged = true;
      break;
    }

    // Keep Elite
    const nextGen: PopulationIndividual[] = population
      .slice(0, eliteCount)
      .map((ind) => ({ ...ind }));

    // Generate New Population (up to popSize = 100)
    while (nextGen.length < popSize) {
      const p1 = tournamentSelect(population);
      const p2 = tournamentSelect(population);

      // Crossover
      let childSeq = orderCrossover(p1.genome.sequence, p2.genome.sequence);
      let childHeuristic = Math.random() < 0.5 ? p1.genome.heuristic : p2.genome.heuristic;

      // Mutation
      if (Math.random() < 0.40) {
        childSeq = mutateSequence(childSeq);
        if (Math.random() < 0.25) {
          childHeuristic = heuristics[Math.floor(Math.random() * heuristics.length)]!;
        }
      }

      const childInd = evaluateGenome(
        { sequence: childSeq, heuristic: childHeuristic },
        curSheetLength,
        curSheetWidth,
        config,
        material,
        thickness
      );

      nextGen.push(childInd);
    }

    // Sort New Population
    nextGen.sort((a, b) => b.score - a.score);
    population = nextGen;
  }

  const bestIndividual = population[0]!;

  const populationCandidates: CandidateLayout[] = population.map((ind, idx) => ({
    id: `pop-cand-${idx + 1}`,
    sheets: ind.sheets,
    metrics: ind.metrics,
    score: ind.score,
    algorithm: config.algorithm || "population-ga",
    preset,
    timestamp: Date.now(),
  }));

  let bestSheets = postOptimizationRecompact(bestIndividual.sheets, config);
  const weights = config.scoringWeights ?? DEFAULT_SCORING_WEIGHTS[preset];

  // Helper to evaluate and update global best candidate
  function tryCandidateSheets(candidateSheetsRaw: NestedSheet[]) {
    const candidateSheets = postOptimizationRecompact(candidateSheetsRaw, config);
    if (candidateSheets.length === 0) return;

    const candUtil =
      (candidateSheets.reduce((a, s) => a + s.usedArea, 0) /
        (candidateSheets.reduce((a, s) => a + s.sheetLength * s.sheetWidth, 0) || 1)) *
      100;
    const bestUtil =
      (bestSheets.reduce((a, s) => a + s.usedArea, 0) /
        (bestSheets.reduce((a, s) => a + s.sheetLength * s.sheetWidth, 0) || 1)) *
      100;

    const candScore = evaluateLayoutScore(candidateSheets, weights, config).score;
    const bestScoreVal = evaluateLayoutScore(bestSheets, weights, config).score;

    // Evaluate last sheet maxX to maximize single contiguous reusable remnant
    const lastCand = candidateSheets[candidateSheets.length - 1];
    const lastBest = bestSheets[bestSheets.length - 1];
    const lastCandMaxX = lastCand && lastCand.placed.length > 0
      ? Math.max(...lastCand.placed.map((p) => p.x + p.w))
      : 0;
    const lastBestMaxX = lastBest && lastBest.placed.length > 0
      ? Math.max(...lastBest.placed.map((p) => p.x + p.w))
      : 0;

    if (
      candidateSheets.length < bestSheets.length ||
      (candidateSheets.length === bestSheets.length && candScore > bestScoreVal) ||
      (candidateSheets.length === bestSheets.length && Math.abs(candScore - bestScoreVal) <= 1.0 && lastCandMaxX < lastBestMaxX - 5)
    ) {
      bestSheets = candidateSheets;
    }
  }

  // 3. Direct Fast DP Guillotine Strip Evaluation:
  // Immediately test DP Guillotine Column and Shelf Strip Packers on full queue
  const colDirect = packGuillotineColumnSheet(
    queueItems,
    curSheetLength,
    curSheetWidth,
    config,
    material,
    thickness,
    "COL-DP"
  );
  tryCandidateSheets(colDirect);

  const shelfDirect = packGuillotineShelfSheet(
    queueItems,
    curSheetLength,
    curSheetWidth,
    config,
    material,
    thickness,
    "SHELF-DP"
  );
  tryCandidateSheets(shelfDirect);

  // 4. Multi-Algorithm Best-Fitting Evaluation Tournament:
  // Evaluates Guillotine Columns, Guillotine Shelves, MaxRects BFD, and Skyline BL across multiple ordering policies
  const tournamentPolicies: GRASPPolicy[] = [
    "same-type-clustered",
    "width-strip",
    "height-strip",
    "longest-side",
    "area-descending",
  ];

  // Candidate A: Guillotine Column Strip Packer (One long vertical cut + small horizontal cross-cuts)
  for (const pol of tournamentPolicies) {
    const sortedQueue = sortItemsByPolicy(queueItems, pol);
    const colRaw = packGuillotineColumnSheet(
      sortedQueue,
      curSheetLength,
      curSheetWidth,
      config,
      material,
      thickness,
      "COL"
    );
    tryCandidateSheets(colRaw);
  }

  // Candidate B: Guillotine Shelf Strip Packer (One long horizontal cut + small vertical cross-cuts)
  for (const pol of tournamentPolicies) {
    const sortedQueue = sortItemsByPolicy(queueItems, pol);
    const shelfRaw = packGuillotineShelfSheet(
      sortedQueue,
      curSheetLength,
      curSheetWidth,
      config,
      material,
      thickness,
      "SHELF"
    );
    tryCandidateSheets(shelfRaw);
  }

  // Candidate C: MaxRects BFD with Same-Width-Strip (for continuous collinear boundaries)
  for (const pol of tournamentPolicies.slice(0, 3)) {
    const sortedQueue = sortItemsByPolicy(queueItems, pol);
    let rem = sortedQueue.slice();
    const bfdStripSheets: NestedSheet[] = [];
    while (rem.length > 0) {
      const sid = `BFD-STRIP-${bfdStripSheets.length + 1}`;
      const { placed, unplaced, usedArea } = packSingleSheetMaxRectsBFD(
        rem,
        curSheetLength,
        curSheetWidth,
        config,
        sid,
        "same-width-strip"
      );
      if (!placed.length) break;
      bfdStripSheets.push({
        id: sid,
        material,
        thickness,
        sheetLength: curSheetLength,
        sheetWidth: curSheetWidth,
        placed,
        usedArea,
        utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
      });
      rem = unplaced;
    }
    tryCandidateSheets(bfdStripSheets);
  }

  // Candidate D: MaxRects BFD with Guillotine-Aligned
  for (const pol of tournamentPolicies.slice(0, 3)) {
    const sortedQueue = sortItemsByPolicy(queueItems, pol);
    let rem = sortedQueue.slice();
    const bfdGuillSheets: NestedSheet[] = [];
    while (rem.length > 0) {
      const sid = `BFD-GUILL-${bfdGuillSheets.length + 1}`;
      const { placed, unplaced, usedArea } = packSingleSheetMaxRectsBFD(
        rem,
        curSheetLength,
        curSheetWidth,
        config,
        sid,
        "guillotine-aligned"
      );
      if (!placed.length) break;
      bfdGuillSheets.push({
        id: sid,
        material,
        thickness,
        sheetLength: curSheetLength,
        sheetWidth: curSheetWidth,
        placed,
        usedArea,
        utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
      });
      rem = unplaced;
    }
    tryCandidateSheets(bfdGuillSheets);
  }

  // Candidate E: Skyline Bottom-Left Engine with gap backfilling
  for (const pol of tournamentPolicies.slice(0, 3)) {
    const sortedQueue = sortItemsByPolicy(queueItems, pol);
    const skylineRaw = packSkylineSheet(
      sortedQueue,
      curSheetLength,
      curSheetWidth,
      config,
      material,
      thickness,
      "SKYLINE"
    );
    tryCandidateSheets(skylineRaw);
  }

  // Candidate F: MaxRects BFD Standard Engine
  if (queueItems.length <= 80) {
    const bfdSheetsRaw = solveBucketMinSheets(
      queueItems,
      curSheetLength,
      curSheetWidth,
      config,
      material,
      thickness
    );
    tryCandidateSheets(bfdSheetsRaw);
  }

  return {
    bestSheets,
    populationCandidates,
    generationsRun,
    converged,
  };
}

/** Minimum-Sheet Multi-Trial Optimization Engine with Integrated Population-Based Optimizer */
export function optimize(
  parts: Part[],
  config: OptimizationConfig,
  onProgress?: (progress: number, message?: string) => void
): OptimizationResult {
  onProgress?.(5, "Analyzing BOM characteristics and strategy...");
  const valid = parts.filter((p) => !p.invalid);
  const buckets = new Map<string, Part[]>();

  const activePlateTypes = config.plateTypes ?? DEFAULT_PLATE_TYPES;
  const groupByMaterial = config.groupByMaterial ?? false;

  for (let i = 0; i < valid.length; i++) {
    const p = valid[i]!;
    const dimInfo = resolveSheetDimensionsForPart(p, config);
    const plateTypeId = dimInfo.plateTypeId;
    const key = groupByMaterial
      ? `${plateTypeId}|${dimInfo.sheetLength}x${dimInfo.sheetWidth}|${p.material}|${p.thickness}`
      : `${plateTypeId}|${dimInfo.sheetLength}x${dimInfo.sheetWidth}|${p.thickness}`;
    const list = buckets.get(key);
    if (list) {
      list.push(p);
    } else {
      buckets.set(key, [p]);
    }
  }

  const sheets: NestedSheet[] = [];
  const allPopulationCandidates: CandidateLayout[] = [];
  let totalGenerationsRun = 0;
  let isConverged = false;
  const totalBuckets = buckets.size || 1;
  let bucketIndex = 0;

  for (const [key, group] of buckets) {
    bucketIndex++;
    const startProgress = 10 + ((bucketIndex - 1) / totalBuckets) * 75;
    const endProgress = 10 + (bucketIndex / totalBuckets) * 75;

    const firstPart = group[0]!;
    const dimInfo = resolveSheetDimensionsForPart(firstPart, config);
    const thickness = firstPart.thickness;

    const isChq = /CHQ|CHEQ|CHEQUERED|CHECKERED|PATTERN|IS3502|IS 3502|\bCP\b/i.test(
      `${firstPart.material} ${firstPart.description} ${firstPart.item}`
    );

    const material = isChq
      ? `IS:3502 Chequered Plate (${thickness}mm)`
      : firstPart.material || `Mild Steel Plate (${thickness}mm)`;

    onProgress?.(startProgress, `Evolving population for bucket ${bucketIndex}/${totalBuckets}: ${material}...`);

    const curSheetLength = dimInfo.sheetLength;
    const curSheetWidth = dimInfo.sheetWidth;

    const usableL = curSheetLength - config.trim * 2;
    const usableW = curSheetWidth - config.trim * 2;

    const queue: PackingItem[] = [];
    for (let i = 0; i < group.length; i++) {
      const p = group[i]!;
      for (let q = 0; q < p.qty; q++) {
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

    const popRes = solveBucketPopulation(
      queue,
      curSheetLength,
      curSheetWidth,
      config,
      material,
      thickness,
      (p, msg) => {
        const subProgress = startProgress + (p / 100) * (endProgress - startProgress);
        onProgress?.(subProgress, msg);
      }
    );

    let groupSheets = popRes.bestSheets;
    groupSheets = postOptimizationRecompact(groupSheets, config);

    sheets.push(...groupSheets);
    allPopulationCandidates.push(...popRes.populationCandidates);
    totalGenerationsRun = Math.max(totalGenerationsRun, popRes.generationsRun);
    if (popRes.converged) isConverged = true;
  }

  onProgress?.(88, "Sorting generated sheets & re-indexing layout IDs...");

  sheets.sort(
    (a, b) =>
      a.thickness - b.thickness ||
      a.material.localeCompare(b.material) ||
      b.utilization - a.utilization
  );

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

  const preset = config.preset ?? "balanced";
  const weights = config.scoringWeights ?? DEFAULT_SCORING_WEIGHTS[preset];
  const { score, metrics } = evaluateLayoutScore(sheets, weights, config);
  const bomAnalysis = analyzeBOMCharacteristics(parts, config.sheetLength, config.sheetWidth);
  const decisionLogic = selectAdaptiveAlgorithm(bomAnalysis, config.algorithm);

  const candidate: CandidateLayout = {
    id: `cand-${Date.now()}`,
    sheets,
    metrics,
    score,
    algorithm: config.algorithm || "population-ga",
    preset,
    timestamp: Date.now(),
  };

  return {
    sheets,
    utilization,
    scrap: 100 - utilization,
    sheetCount: sheets.length,
    cost,
    savings: Math.max(savings, 0),
    weight,
    config,
    candidate,
    candidateLayouts: allPopulationCandidates,
    metrics,
    bomAnalysis,
    decisionLogic,
    generationsRun: totalGenerationsRun,
    converged: isConverged,
  };
}

// ── Remnant Analysis Helpers ──────────────────────────────────────────────────

/** Minimum dimension for a reusable offcut (300 × 300 mm) */
const MIN_REUSABLE_DIM = 300;

type RemnantBlock = { x: number; y: number; w: number; h: number; area: number };

/** Extracts all rectangular free-space remnant blocks from nested sheets */
function getAllRemnants(
  sheets: NestedSheet[],
  _config: OptimizationConfig
): RemnantBlock[] {
  const remnants: RemnantBlock[] = [];
  for (const sheet of sheets) {
    if (!sheet.placed.length) continue;
    // Compute axis-aligned free strips from bounding envelope
    const maxX = Math.max(...sheet.placed.map((p) => p.x + p.w));
    const maxY = Math.max(...sheet.placed.map((p) => p.y + p.h));
    // Right-side remnant
    const rw = sheet.sheetLength - maxX;
    if (rw > 0 && sheet.sheetWidth > 0) {
      remnants.push({ x: maxX, y: 0, w: rw, h: sheet.sheetWidth, area: rw * sheet.sheetWidth });
    }
    // Top-side remnant
    const rh = sheet.sheetWidth - maxY;
    if (rh > 0 && maxX > 0) {
      remnants.push({ x: 0, y: maxY, w: maxX, h: rh, area: maxX * rh });
    }
  }
  return remnants;
}

type RemnantSummary = {
  largestArea: number;
  largestDims: { w: number; h: number };
  reusableArea: number;
  reusableCount: number;
  fragmentedArea: number;
  score: number;
};

/** Calculates quality score and area statistics from classified remnant blocks */
function calculateRemnantQualityScore(remnants: RemnantBlock[]): RemnantSummary {
  let largestArea = 0;
  let largestDims = { w: 0, h: 0 };
  let reusableArea = 0;
  let reusableCount = 0;
  let fragmentedArea = 0;

  for (const r of remnants) {
    if (r.area > largestArea) {
      largestArea = r.area;
      largestDims = { w: r.w, h: r.h };
    }
    if (r.w >= MIN_REUSABLE_DIM && r.h >= MIN_REUSABLE_DIM) {
      reusableArea += r.area;
      reusableCount++;
    } else {
      fragmentedArea += r.area;
    }
  }

  // Score: 0–100 based on reusable area ratio vs fragmented
  const totalRemnant = reusableArea + fragmentedArea || 1;
  const score = Math.min(100, Math.round((reusableArea / totalRemnant) * 100));

  return { largestArea, largestDims, reusableArea, reusableCount, fragmentedArea, score };
}

/**
 * Evaluates comprehensive multi-criteria metrics for a generated candidate layout.
 */
export function evaluateLayoutMetrics(
  sheets: NestedSheet[],
  config: OptimizationConfig
): CandidateMetrics {
  if (!sheets || sheets.length === 0) {
    return {
      utilization: 0,
      sheetCount: 0,
      totalCutLength: 0,
      largestRemnantArea: 0,
      largestRemnantDims: { w: 0, h: 0 },
      reusableRemnantArea: 0,
      reusableRemnantCount: 0,
      fragmentedWasteArea: 0,
      remnantQualityScore: 100,
      cutContinuityScore: 0,
      packingDensity: 0,
      rotationCount: 0,
      stripAlignmentScore: 0,
    } satisfies CandidateMetrics;
  }

  const sheetCount = sheets.length;
  const totalSheetArea = sheets.reduce((sum, s) => sum + s.sheetLength * s.sheetWidth, 0) || 1;
  const totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
  const utilization = (totalUsedArea / totalSheetArea) * 100;

  let totalCutLength = 0;
  let rotationCount = 0;
  let totalPerimeter = 0;
  let sharedEdgeLength = 0;
  let alignedStripCount = 0;
  let totalPlacedParts = 0;
  let totalBoundingBoxDensity = 0;

  sheets.forEach((sheet) => {
    const placed = sheet.placed;
    totalPlacedParts += placed.length;

    // 1. Cut length & Rotation count
    placed.forEach((p) => {
      totalCutLength += 2 * (p.w + p.h);
      totalPerimeter += 2 * (p.w + p.h);
      if (p.rotated) rotationCount++;
    });

    // 2. Cut Continuity (Shared Collinear Edges) & Strip Alignment
    for (let i = 0; i < placed.length; i++) {
      const p1 = placed[i]!;
      for (let j = i + 1; j < placed.length; j++) {
        const p2 = placed[j]!;

        // Vertical column alignment (same x & matching width = continuous vertical cut)
        if (Math.abs(p1.x - p2.x) <= config.kerf + 1 && Math.abs(p1.w - p2.w) <= 1) {
          alignedStripCount++;
          sharedEdgeLength += Math.min(p1.h, p2.h);
        }
        // Horizontal shelf alignment (same y & matching height = continuous horizontal cut)
        if (Math.abs(p1.y - p2.y) <= config.kerf + 1 && Math.abs(p1.h - p2.h) <= 1) {
          alignedStripCount++;
          sharedEdgeLength += Math.min(p1.w, p2.w);
        }

        // Adjacent shared cross-cut in Y (touching across kerf)
        if (
          Math.abs((p1.y + p1.h + config.kerf) - p2.y) <= 2 ||
          Math.abs((p2.y + p2.h + config.kerf) - p1.y) <= 2
        ) {
          const overlapX = Math.max(0, Math.min(p1.x + p1.w, p2.x + p2.w) - Math.max(p1.x, p2.x));
          if (overlapX > 2) {
            sharedEdgeLength += overlapX;
          }
        }
        // Adjacent shared cross-cut in X (touching across kerf)
        if (
          Math.abs((p1.x + p1.w + config.kerf) - p2.x) <= 2 ||
          Math.abs((p2.x + p2.w + config.kerf) - p1.x) <= 2
        ) {
          const overlapY = Math.max(0, Math.min(p1.y + p1.h, p2.y + p2.h) - Math.max(p1.y, p2.y));
          if (overlapY > 2) {
            sharedEdgeLength += overlapY;
          }
        }
      }
    }

    // 3. Bounding Box Packing Density
    if (placed.length > 0) {
      const maxX = Math.max(...placed.map((p) => p.x + p.w));
      const maxY = Math.max(...placed.map((p) => p.y + p.h));
      const boundingBoxArea = maxX * maxY || 1;
      const sheetDensity = (sheet.usedArea / boundingBoxArea) * 100;
      totalBoundingBoxDensity += sheetDensity;
    }
  });

  // 4. Classified Remnants Analysis & Quality Scoring
  const classifiedRemnants = getAllRemnants(sheets, config);
  const remnantSummary = calculateRemnantQualityScore(classifiedRemnants);

  const cutContinuityScore = totalPerimeter > 0 ? Math.min(100, (sharedEdgeLength / totalPerimeter) * 200) : 0;
  const packingDensity = sheetCount > 0 ? totalBoundingBoxDensity / sheetCount : 0;
  const totalPairs = (totalPlacedParts * (totalPlacedParts - 1)) / 2;
  const stripAlignmentScore = totalPairs > 0 ? Math.min(100, (alignedStripCount / totalPairs) * 100) : 100;

  return {
    utilization: Number(utilization.toFixed(2)),
    sheetCount,
    totalCutLength: Math.round(totalCutLength),
    largestRemnantArea: remnantSummary.largestArea,
    largestRemnantDims: remnantSummary.largestDims,
    reusableRemnantArea: remnantSummary.reusableArea,
    reusableRemnantCount: remnantSummary.reusableCount,
    fragmentedWasteArea: remnantSummary.fragmentedArea,
    remnantQualityScore: remnantSummary.score,
    cutContinuityScore: Number(cutContinuityScore.toFixed(2)),
    packingDensity: Number(packingDensity.toFixed(2)),
    rotationCount,
    stripAlignmentScore: Number(stripAlignmentScore.toFixed(2)),
  };
}



export function netWeight(parts: Part[]) {
  return parts.reduce((s, p) => s + partWeight(p), 0);
}
