import { type Part } from "./mock-data";
import {
  optimize,
  DEFAULT_SCORING_WEIGHTS,
  type OptimizationConfig,
  type OptimizationResult,
  type CandidateMetrics,
  type OptimizationPreset,
} from "./nesting";

/**
 * Task 11 Implementation: Benchmarking Framework for SteelNest AI
 * 
 * Measures:
 * 1. Material Utilization (%)
 * 2. Sheet Count
 * 3. Waste (%) & Waste Area (mm²)
 * 4. Remnant Quality Score & Largest Remnant Dimensions
 * 5. Cut Length (mm)
 * 6. Execution Time (ms)
 * 
 * Compares algorithms, generates benchmark reports, and stores benchmark results.
 */

export type AlgorithmBenchmarkMetrics = {
  /** Material Utilization percentage (0 - 100%) */
  materialUtilization: number;
  /** Total stock sheets required */
  sheetCount: number;
  /** Waste percentage (100 - utilization %) */
  wastePercent: number;
  /** Total waste area in mm² */
  wasteArea: number;
  /** Remnant Quality score (0 - 100 based on large reusable offcut ratio vs tiny scrap) */
  remnantQualityScore: number;
  /** Largest single contiguous rectangular offcut area in mm² */
  largestRemnantArea: number;
  /** Dimensions of largest offcut in mm */
  largestRemnantDims: { w: number; h: number };
  /** Unusable micro scrap area (< 300x300mm) in mm² */
  fragmentedWasteArea: number;
  /** Total torch cut travel length in mm */
  cutLength: number;
  /** Algorithm execution time in milliseconds */
  executionTimeMs: number;
  /** Cut continuity score (0 - 100%) */
  cutContinuityScore: number;
  /** Bounding box packing density percentage (0 - 100%) */
  packingDensity: number;
};

export type AlgorithmBenchmarkResult = {
  algorithmId: string;
  algorithmName: string;
  preset: OptimizationPreset;
  executionTimeMs: number;
  metrics: AlgorithmBenchmarkMetrics;
  result: OptimizationResult;
};

export type CategoryWinners = {
  bestUtilization: string;
  bestSheetCount: string;
  lowestWaste: string;
  bestRemnantQuality: string;
  shortestCutLength: string;
  fastestSpeed: string;
  overallWinner: string;
};

export type BenchmarkComparisonRow = {
  algorithmId: string;
  algorithmName: string;
  preset: string;
  materialUtilization: number;
  sheetCount: number;
  wastePercent: number;
  remnantQualityScore: number;
  largestRemnantArea: number;
  cutLength: number;
  executionTimeMs: number;
  overallScore: number;
  isWinner: {
    utilization: boolean;
    sheetCount: boolean;
    waste: boolean;
    remnantQuality: boolean;
    cutLength: boolean;
    speed: boolean;
    overall: boolean;
  };
};

export type BenchmarkSuiteResult = {
  id: string;
  timestamp: number;
  bomName: string;
  totalParts: number;
  totalPieces: number;
  baseConfig: OptimizationConfig;
  algorithmResults: AlgorithmBenchmarkResult[];
  comparisonMatrix: BenchmarkComparisonRow[];
  winners: CategoryWinners;
  summaryReportMarkdown: string;
};

export const STANDARD_BENCHMARK_ALGORITHMS: Array<{ id: string; name: string; preset?: OptimizationPreset }> = [
  { id: "skyline", name: "Skyline Bottom-Left Engine", preset: "balanced" },
  { id: "maxrects", name: "MaxRects Area-Fit Engine", preset: "max-yield" },
  { id: "guillotine", name: "Guillotine Shear-Cut Engine", preset: "guillotine-shear" },
  { id: "hybrid", name: "Hybrid Adaptive Engine", preset: "balanced" },
  { id: "auto", name: "Adaptive Auto-Selection Engine", preset: "balanced" },
];

/** Storage key for persisting benchmark history in LocalStorage */
const STORAGE_KEY = "steelnest_benchmark_history_v1";

/**
 * Calculates Remnant Quality Score (0 - 100).
 * High score is given when offcuts are consolidated into large reusable rectangular sheets,
 * rather than fragmented into tiny unusable scrap slivers.
 */
export function calculateRemnantQualityScore(
  metrics: CandidateMetrics,
  sheetLength: number = 6000,
  sheetWidth: number = 1250
): number {
  const totalSheetArea = sheetLength * sheetWidth;
  if (totalSheetArea <= 0) return 0;

  const largestRemnantRatio = Math.min(1.0, metrics.largestRemnantArea / (totalSheetArea * 0.5));
  const fragmentedWasteRatio = metrics.fragmentedWasteArea > 0
    ? Math.min(1.0, metrics.fragmentedWasteArea / (totalSheetArea * 0.2))
    : 0;

  const score = (largestRemnantRatio * 80) + ((1 - fragmentedWasteRatio) * 20);
  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

/**
 * Runs a single algorithm benchmark test, measuring execution time and capturing all metrics.
 */
export function benchmarkSingleAlgorithm(
  parts: Part[],
  algorithmId: string,
  algorithmName: string,
  baseConfig: OptimizationConfig,
  preset: OptimizationPreset = "balanced",
  warmup: boolean = false
): AlgorithmBenchmarkResult {
  const config: OptimizationConfig = {
    ...baseConfig,
    algorithm: algorithmId,
    preset,
    scoringWeights: DEFAULT_SCORING_WEIGHTS[preset],
  };

  if (warmup) {
    optimize(parts, config);
  }

  const startTime = performance.now();
  const result = optimize(parts, config);
  const endTime = performance.now();
  const executionTimeMs = Number((endTime - startTime).toFixed(2));

  const metrics: CandidateMetrics = result.metrics || {
    utilization: result.utilization,
    sheetCount: result.sheetCount,
    totalCutLength: 0,
    largestRemnantArea: 0,
    largestRemnantDims: { w: 0, h: 0 },
    fragmentedWasteArea: 0,
    reusableRemnantArea: 0,
    reusableRemnantCount: 0,
    remnantQualityScore: 0,
    cutContinuityScore: 0,
    packingDensity: 0,
    rotationCount: 0,
    stripAlignmentScore: 0,
  };

  const wastePercent = Number((100 - result.utilization).toFixed(2));
  const totalSheetArea = (result.sheets || []).reduce((a, s) => a + s.sheetLength * s.sheetWidth, 0);
  const totalUsedArea = (result.sheets || []).reduce((a, s) => a + s.usedArea, 0);
  const wasteArea = Math.max(0, totalSheetArea - totalUsedArea);
  const remnantQualityScore = calculateRemnantQualityScore(metrics, baseConfig.sheetLength, baseConfig.sheetWidth);

  const benchmarkMetrics: AlgorithmBenchmarkMetrics = {
    materialUtilization: Number(result.utilization.toFixed(2)),
    sheetCount: result.sheetCount,
    wastePercent,
    wasteArea: Math.round(wasteArea),
    remnantQualityScore,
    largestRemnantArea: metrics.largestRemnantArea,
    largestRemnantDims: metrics.largestRemnantDims,
    fragmentedWasteArea: metrics.fragmentedWasteArea,
    cutLength: metrics.totalCutLength,
    executionTimeMs,
    cutContinuityScore: metrics.cutContinuityScore,
    packingDensity: metrics.packingDensity,
  };

  return {
    algorithmId,
    algorithmName,
    preset,
    executionTimeMs,
    metrics: benchmarkMetrics,
    result,
  };
}

/**
 * Runs a complete benchmark suite comparing multiple algorithms against a given BOM part list.
 */
export function runBenchmarkSuite(
  parts: Part[],
  baseConfig: OptimizationConfig,
  algorithmsToBenchmark = STANDARD_BENCHMARK_ALGORITHMS,
  bomName: string = "BOM Dataset"
): BenchmarkSuiteResult {
  const totalParts = parts.length;
  const totalPieces = parts.reduce((sum, p) => sum + (p.qty || 1), 0);

  const algorithmResults: AlgorithmBenchmarkResult[] = [];

  for (const algo of algorithmsToBenchmark) {
    const res = benchmarkSingleAlgorithm(
      parts,
      algo.id,
      algo.name,
      baseConfig,
      algo.preset || "balanced",
      true
    );
    algorithmResults.push(res);
  }

  // Determine Category Winners
  let bestUtilAlgo = algorithmResults[0]!;
  let bestSheetsAlgo = algorithmResults[0]!;
  let lowestWasteAlgo = algorithmResults[0]!;
  let bestRemnantAlgo = algorithmResults[0]!;
  let shortestCutAlgo = algorithmResults[0]!;
  let fastestAlgo = algorithmResults[0]!;
  let overallBestAlgo = algorithmResults[0]!;
  let maxOverallScore = -Infinity;

  algorithmResults.forEach((res) => {
    if (res.metrics.materialUtilization > bestUtilAlgo.metrics.materialUtilization) {
      bestUtilAlgo = res;
    }
    if (res.metrics.sheetCount < bestSheetsAlgo.metrics.sheetCount) {
      bestSheetsAlgo = res;
    }
    if (res.metrics.wastePercent < lowestWasteAlgo.metrics.wastePercent) {
      lowestWasteAlgo = res;
    }
    if (res.metrics.remnantQualityScore > bestRemnantAlgo.metrics.remnantQualityScore) {
      bestRemnantAlgo = res;
    }
    if (res.metrics.cutLength < shortestCutAlgo.metrics.cutLength && res.metrics.cutLength > 0) {
      shortestCutAlgo = res;
    }
    if (res.executionTimeMs < fastestAlgo.executionTimeMs) {
      fastestAlgo = res;
    }

    // Scalar overall score formula balancing speed, yield, sheet count, cut length and remnant quality
    const compositeScore =
      res.metrics.materialUtilization * 4.0 -
      res.metrics.sheetCount * 50.0 +
      res.metrics.remnantQualityScore * 1.5 -
      (res.metrics.cutLength / 1000) * 0.1 -
      Math.log(Math.max(1, res.executionTimeMs)) * 2.0;

    if (compositeScore > maxOverallScore) {
      maxOverallScore = compositeScore;
      overallBestAlgo = res;
    }
  });

  const winners: CategoryWinners = {
    bestUtilization: bestUtilAlgo.algorithmName,
    bestSheetCount: bestSheetsAlgo.algorithmName,
    lowestWaste: lowestWasteAlgo.algorithmName,
    bestRemnantQuality: bestRemnantAlgo.algorithmName,
    shortestCutLength: shortestCutAlgo.algorithmName,
    fastestSpeed: fastestAlgo.algorithmName,
    overallWinner: overallBestAlgo.algorithmName,
  };

  const comparisonMatrix: BenchmarkComparisonRow[] = algorithmResults.map((res) => {
    const compositeScore = Number(
      (
        res.metrics.materialUtilization * 4.0 -
        res.metrics.sheetCount * 50.0 +
        res.metrics.remnantQualityScore * 1.5 -
        (res.metrics.cutLength / 1000) * 0.1 -
        Math.log(Math.max(1, res.executionTimeMs)) * 2.0
      ).toFixed(2)
    );

    return {
      algorithmId: res.algorithmId,
      algorithmName: res.algorithmName,
      preset: res.preset,
      materialUtilization: res.metrics.materialUtilization,
      sheetCount: res.metrics.sheetCount,
      wastePercent: res.metrics.wastePercent,
      remnantQualityScore: res.metrics.remnantQualityScore,
      largestRemnantArea: res.metrics.largestRemnantArea,
      cutLength: res.metrics.cutLength,
      executionTimeMs: res.executionTimeMs,
      overallScore: compositeScore,
      isWinner: {
        utilization: res.algorithmId === bestUtilAlgo.algorithmId,
        sheetCount: res.algorithmId === bestSheetsAlgo.algorithmId,
        waste: res.algorithmId === lowestWasteAlgo.algorithmId,
        remnantQuality: res.algorithmId === bestRemnantAlgo.algorithmId,
        cutLength: res.algorithmId === shortestCutAlgo.algorithmId,
        speed: res.algorithmId === fastestAlgo.algorithmId,
        overall: res.algorithmId === overallBestAlgo.algorithmId,
      },
    };
  });

  const suiteId = `bm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = Date.now();

  const suiteResult: BenchmarkSuiteResult = {
    id: suiteId,
    timestamp,
    bomName,
    totalParts,
    totalPieces,
    baseConfig,
    algorithmResults,
    comparisonMatrix,
    winners,
    summaryReportMarkdown: "",
  };

  suiteResult.summaryReportMarkdown = generateBenchmarkReportMarkdown(suiteResult);
  return suiteResult;
}

/**
 * Generates a full markdown benchmark report from a suite result.
 */
export function generateBenchmarkReportMarkdown(suite: BenchmarkSuiteResult): string {
  const dateStr = new Date(suite.timestamp).toLocaleString();

  let md = `# 📊 SteelNest AI — Nesting Engine Algorithm Benchmark Report\n\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**BOM Name:** ${suite.bomName}  \n`;
  md += `**Parts Count:** ${suite.totalParts} lines (${suite.totalPieces} total pieces)  \n`;
  md += `**Stock Plate Dimensions:** ${suite.baseConfig.sheetLength} × ${suite.baseConfig.sheetWidth} mm  \n\n`;

  md += `## 🏆 Executive Benchmark Summary\n\n`;
  md += `- **Overall Winner:** 🥇 **${suite.winners.overallWinner}**\n`;
  md += `- **Highest Material Utilization:** 🎯 ${suite.winners.bestUtilization}\n`;
  md += `- **Fewest Stock Sheets Used:** 📦 ${suite.winners.bestSheetCount}\n`;
  md += `- **Lowest Waste:** ♻️ ${suite.winners.lowestWaste}\n`;
  md += `- **Best Remnant Quality:** 🧩 ${suite.winners.bestRemnantQuality}\n`;
  md += `- **Shortest Cut Length:** ✂️ ${suite.winners.shortestCutLength}\n`;
  md += `- **Fastest Execution Speed:** ⚡ ${suite.winners.fastestSpeed}\n\n`;

  md += `## 📈 Algorithm Performance Comparison Matrix\n\n`;
  md += `| Algorithm | Utilization (%) | Sheet Count | Waste (%) | Remnant Quality (0-100) | Cut Length (mm) | Execution Time (ms) |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  suite.comparisonMatrix.forEach((row) => {
    const utilBadge = row.isWinner.utilization ? " 🥇" : "";
    const sheetBadge = row.isWinner.sheetCount ? " ⭐" : "";
    const remnantBadge = row.isWinner.remnantQuality ? " 🧩" : "";
    const speedBadge = row.isWinner.speed ? " ⚡" : "";

    md += `| **${row.algorithmName}** | ${row.materialUtilization}%${utilBadge} | ${row.sheetCount}${sheetBadge} | ${row.wastePercent}% | ${row.remnantQualityScore}${remnantBadge} | ${row.cutLength.toLocaleString()} mm | ${row.executionTimeMs} ms${speedBadge} |\n`;
  });

  md += `\n## 🔍 Detailed Metric Breakdown\n\n`;
  suite.algorithmResults.forEach((res) => {
    md += `### ${res.algorithmName} (${res.preset} preset)\n`;
    md += `- **Execution Time:** \`${res.executionTimeMs} ms\`\n`;
    md += `- **Material Utilization:** \`${res.metrics.materialUtilization}%\`\n`;
    md += `- **Sheets Required:** \`${res.metrics.sheetCount} plates\`\n`;
    md += `- **Total Scrap Area:** \`${(res.metrics.wasteArea / 1e6).toFixed(3)} m²\` (${res.metrics.wastePercent}% waste)\n`;
    md += `- **Largest Offcut Block:** \`${res.metrics.largestRemnantDims.w} × ${res.metrics.largestRemnantDims.h} mm\` (\`${(res.metrics.largestRemnantArea / 1e6).toFixed(3)} m²\` area)\n`;
    md += `- **Fragmented Scrap (< 300x300mm):** \`${(res.metrics.fragmentedWasteArea / 1e6).toFixed(3)} m²\`\n`;
    md += `- **Torch Cut Travel Length:** \`${res.metrics.cutLength.toLocaleString()} mm\`\n`;
    md += `- **Cut Continuity Score:** \`${res.metrics.cutContinuityScore}%\`\n`;
    md += `- **Bounding Box Density:** \`${res.metrics.packingDensity}%\`\n\n`;
  });

  return md;
}

/**
 * Storage manager for persisting and retrieving benchmark results.
 */
export const BenchmarkStorage = {
  /** Saves a benchmark suite result to LocalStorage */
  saveBenchmarkResult(suite: BenchmarkSuiteResult): void {
    try {
      const history = BenchmarkStorage.getStoredBenchmarks();
      const updated = [suite, ...history.filter((item) => item.id !== suite.id)].slice(0, 50); // keep up to 50 runs
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Unable to save benchmark to localStorage:", e);
    }
  },

  /** Retrieves all stored benchmark suite results */
  getStoredBenchmarks(): BenchmarkSuiteResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as BenchmarkSuiteResult[];
    } catch (e) {
      console.warn("Unable to read benchmarks from localStorage:", e);
      return [];
    }
  },

  /** Retrieves a specific benchmark run by ID */
  getBenchmarkById(id: string): BenchmarkSuiteResult | undefined {
    const list = BenchmarkStorage.getStoredBenchmarks();
    return list.find((item) => item.id === id);
  },

  /** Deletes a single benchmark result by ID */
  deleteBenchmarkResult(id: string): void {
    try {
      const history = BenchmarkStorage.getStoredBenchmarks();
      const updated = history.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Unable to delete benchmark from localStorage:", e);
    }
  },

  /** Clears all stored benchmark runs */
  clearAllBenchmarks(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Unable to clear benchmarks from localStorage:", e);
    }
  },

  /** Exports all benchmark history as a formatted JSON string */
  exportBenchmarkHistoryJSON(): string {
    const history = BenchmarkStorage.getStoredBenchmarks();
    return JSON.stringify(history, null, 2);
  },
};
