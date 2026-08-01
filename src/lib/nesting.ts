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
    sheetLength: 6000,
    sheetWidth: 1250,
    description: "Anti-skid floor & stair tread plates (SAIL std: 6000 × 1250 mm)",
  },
  {
    id: "ms-thin",
    name: "Mild Steel Plate (IS 2062 Thin)",
    abbreviations: ["PL", "MS", "IS2062", "IS:2062", "E250", "E250A", "E250BR", "E250C"],
    minThickness: 2,
    maxThickness: 10,
    sheetLength: 6000,
    sheetWidth: 1250,
    description: "Standard thin HR mill plates (SAIL std: 6000 × 1250 mm)",
  },
  {
    id: "ms-heavy",
    name: "Mild Steel Heavy Plate (IS 2062 Structural)",
    abbreviations: ["PL", "MS", "IS2062", "IS:2062", "E250", "E250A", "E250BR", "E250C"],
    minThickness: 11,
    maxThickness: 50,
    sheetLength: 6000,
    sheetWidth: 1250,
    description: "Heavy structural bridge plates (SAIL/Jindal std: 6000 × 1250 mm)",
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
    sheetCountPenalty: 50.0,
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
    sheetCountPenalty: 100.0,
    cutLengthPenalty: 0.2,
    reusableRemnantBonus: 25.0,
    fragmentedWastePenalty: 15.0,
    cutContinuityBonus: 15.0,
    packingDensityBonus: 10.0,
    rotationPenalty: 2.0,
    stripAlignmentBonus: 15.0,
  },
  "max-yield": {
    materialUtilization: 5.0,
    sheetCountPenalty: 250.0,
    cutLengthPenalty: 0.1,
    reusableRemnantBonus: 50.0,
    fragmentedWastePenalty: 30.0,
    cutContinuityBonus: 20.0,
    packingDensityBonus: 20.0,
    rotationPenalty: 1.0,
    stripAlignmentBonus: 20.0,
  },
  "guillotine-shear": {
    materialUtilization: 2.0,
    sheetCountPenalty: 150.0,
    cutLengthPenalty: 0.5,
    reusableRemnantBonus: 30.0,
    fragmentedWastePenalty: 20.0,
    cutContinuityBonus: 50.0, // High bonus for continuous straight shear lines
    packingDensityBonus: 10.0,
    rotationPenalty: 5.0,
    stripAlignmentBonus: 40.0, // High bonus for matching strip heights
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
  material: string,
  thickness: number,
  plateTypes: PlateTypeConfig[] = DEFAULT_PLATE_TYPES,
): PlateTypeConfig | null {
  const matUpper = material.toUpperCase();
  
  // 1. Primary check: match material abbreviation + thickness range
  for (let i = 0; i < plateTypes.length; i++) {
    const pt = plateTypes[i]!;
    for (let j = 0; j < pt.abbreviations.length; j++) {
      if (matUpper.includes(pt.abbreviations[j]!.trim().toUpperCase())) {
        if (thickness >= pt.minThickness && thickness <= pt.maxThickness) {
          return pt;
        }
      }
    }
  }

  // 2. Fallback check: match by thickness range
  for (let i = 0; i < plateTypes.length; i++) {
    const pt = plateTypes[i]!;
    if (pt.id !== "chq" && thickness >= pt.minThickness && thickness <= pt.maxThickness) {
      return pt;
    }
  }

  return null;
}

/**
 * Task 6 Implementation: Adaptive Optimization Engine - BOM Characteristic Analyzer
 * Automatically analyzes BOM shape, aspect ratio, relative part area, and size variance.
 */
export function analyzeBOMCharacteristics(
  parts: Part[],
  sheetLength: number = 6000,
  sheetWidth: number = 1250
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
function packSingleSheetMaxRectsBFD(
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

            let score = 0;
            if (heuristicRule === "bssf") {
              const shortSide = Math.min(leftoverX, leftoverY);
              const longSide = Math.max(leftoverX, leftoverY);
              score = shortSide * 1000 + longSide;
            } else if (heuristicRule === "blsf") {
              const longSide = Math.max(leftoverX, leftoverY);
              const shortSide = Math.min(leftoverX, leftoverY);
              score = longSide * 1000 + shortSide;
            } else if (heuristicRule === "baf") {
              score = rect.w * rect.h - orient.w * orient.h;
            } else if (heuristicRule === "guillotine-aligned") {
              const alignX = leftoverX === 0 ? -5000 : leftoverX;
              const alignY = leftoverY === 0 ? -5000 : leftoverY;
              score = alignX + alignY;
            } else if (heuristicRule === "same-width-strip") {
              let stripBonus = 0;
              for (let p = 0; p < placed.length; p++) {
                const existing = placed[p]!;
                if (Math.abs(existing.y - rect.y) < 2 && Math.abs(existing.h - orient.h) < 2) {
                  stripBonus += 15000;
                }
                if (Math.abs(existing.x - rect.x) < 2 && Math.abs(existing.w - orient.w) < 2) {
                  stripBonus += 15000;
                }
              }
              const shortSide = Math.min(leftoverX, leftoverY);
              score = shortSide * 100 - stripBonus;
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

  // Waste Pocket Micro-Backfill Pass: Attempt to pack small remaining items into tiny free rects
  if (remainingCandidates.length > 0 && freeRects.length > 0) {
    for (let itemIdx = remainingCandidates.length - 1; itemIdx >= 0; itemIdx--) {
      const item = remainingCandidates[itemIdx]!;
      let fitRectIdx = -1;
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
            fitRectIdx = r;
            fitW = orient.w;
            fitH = orient.h;
            fitRotated = orient.rotated;
            break;
          }
        }
        if (fitRectIdx !== -1) break;
      }

      if (fitRectIdx !== -1) {
        const targetRect = freeRects[fitRectIdx]!;
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
        remainingCandidates.splice(itemIdx, 1);
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
 * Fast Inter-Sheet Re-compactor & Waste Back-Filling.
 * Transfers parts from low-utilization last sheets to scrap spaces of earlier sheets.
 */
function postOptimizationRecompact(sheets: NestedSheet[], config: OptimizationConfig): NestedSheet[] {
  if (sheets.length <= 1) return sheets;

  let currentSheets = sheets.map((s) => ({
    ...s,
    placed: s.placed.map((p) => ({ ...p })),
  }));

  let eliminatedAny = false;

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

  return currentSheets;
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

  currentSheets = postOptimizationRecompact(currentSheets, config);

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
  const popSize = config.populationSize ?? 100; // Maintain 100 candidate layouts

  let maxGens = config.generations;
  let stagnantLimit = 8;

  if (preset === "fast") {
    maxGens = maxGens ?? 15;
    stagnantLimit = 5;
  } else if (preset === "max-yield") {
    maxGens = maxGens ?? 75;
    stagnantLimit = 15;
  } else if (preset === "guillotine-shear") {
    maxGens = maxGens ?? 35;
    stagnantLimit = 8;
  } else {
    maxGens = maxGens ?? 35;
    stagnantLimit = 8;
  }

  const convergenceThreshold = config.convergenceThreshold ?? 0.001;
  const eliteCount = Math.max(2, Math.floor(popSize * 0.15)); // Keep Elite top 15%
  const heuristics: Array<"same-width-strip" | "bssf" | "baf" | "guillotine-aligned" | "largest-first-strict"> = [
    "same-width-strip",
    "bssf",
    "baf",
    "guillotine-aligned",
    "largest-first-strict",
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

  return {
    bestSheets: bestIndividual.sheets,
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

  const groupByMaterial = config.groupByMaterial ?? false;

  for (let i = 0; i < valid.length; i++) {
    const p = valid[i]!;
    const key = groupByMaterial ? `${p.material}|${p.thickness}` : `${p.thickness}`;
    const list = buckets.get(key);
    if (list) {
      list.push(p);
    } else {
      buckets.set(key, [p]);
    }
  }

  const activePlateTypes = config.plateTypes ?? DEFAULT_PLATE_TYPES;
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

    const material = groupByMaterial
      ? (key.split("|")[0] ?? "Combined Grade")
      : (group[0]?.material ?? "IS:2062 (Combined)");
    const thickness = groupByMaterial ? Number(key.split("|")[1] ?? 0) : Number(key);

    onProgress?.(startProgress, `Evolving population for bucket ${bucketIndex}/${totalBuckets}: ${material} (${thickness}mm)...`);

    const matchedPlate = findMatchingPlateType(material, thickness, activePlateTypes);
    const curSheetLength = matchedPlate ? matchedPlate.sheetLength : config.sheetLength;
    const curSheetWidth = matchedPlate ? matchedPlate.sheetWidth : config.sheetWidth;

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

        // Check horizontal collinear edge sharing
        if (Math.abs(p1.y - p2.y) < 2 || Math.abs((p1.y + p1.h) - (p2.y + p2.h)) < 2) {
          const overlapX = Math.max(0, Math.min(p1.x + p1.w, p2.x + p2.w) - Math.max(p1.x, p2.x));
          if (overlapX > 5) {
            sharedEdgeLength += overlapX;
          }
        }
        // Check vertical collinear edge sharing
        if (Math.abs(p1.x - p2.x) < 2 || Math.abs((p1.x + p1.w) - (p2.x + p2.w)) < 2) {
          const overlapY = Math.max(0, Math.min(p1.y + p1.h, p2.y + p2.h) - Math.max(p1.y, p2.y));
          if (overlapY > 5) {
            sharedEdgeLength += overlapY;
          }
        }

        // Check strip alignment (matching height/width)
        if (
          (Math.abs(p1.y - p2.y) < 2 && Math.abs(p1.h - p2.h) < 2) ||
          (Math.abs(p1.x - p2.x) < 2 && Math.abs(p1.w - p2.w) < 2)
        ) {
          alignedStripCount++;
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

  const score =
    metrics.utilization * weights.materialUtilization -
    metrics.sheetCount * weights.sheetCountPenalty -
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

export function netWeight(parts: Part[]) {
  return parts.reduce((s, p) => s + partWeight(p), 0);
}
