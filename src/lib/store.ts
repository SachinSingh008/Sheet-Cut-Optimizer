import { useSyncExternalStore } from "react";
import { type Part } from "./mock-data";
import { type RejectedPart } from "./excel-parser";
import {
  optimize,
  DEFAULT_PLATE_TYPES,
  type OptimizationConfig,
  type OptimizationResult,
  type PlateTypeConfig,
} from "./nesting";

export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  rows: number;
  materials: number;
};

export type AppState = {
  file: UploadedFile | null;
  parsed: boolean;
  parts: Part[];
  rejectedParts: RejectedPart[];
  config: OptimizationConfig;
  result: OptimizationResult | null;
  isOptimizing: boolean;
  progress: number;
  progressMessage: string;
};

const defaultConfig: OptimizationConfig = {
  sheetLength: 6000,
  sheetWidth: 1250,
  kerf: 3,
  trim: 0,
  rotation: true,
  algorithm: "auto",
  groupByMaterial: false,
  plateTypes: DEFAULT_PLATE_TYPES,
};

const initial: AppState = {
  file: null,
  parsed: false,
  parts: [],
  rejectedParts: [],
  config: defaultConfig,
  result: null,
  isOptimizing: false,
  progress: 0,
  progressMessage: "",
};

let state: AppState = initial;
const listeners = new Set<() => void>();

let activeWorker: Worker | null = null;
let activeTaskId = 0;

function emit() {
  for (const l of listeners) l();
}

/**
  * Executes nesting optimization in a Web Worker background thread.
  * Handles progress reporting, task cancellation, and memory cleanup.
  */
function runBackgroundOptimization(parts: Part[], config: OptimizationConfig) {
  // Memory cleanup: terminate any running worker before spawning a new one
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  activeTaskId++;
  const currentTaskId = activeTaskId;

  if (!parts.length) {
    state = {
      ...state,
      result: null,
      isOptimizing: false,
      progress: 0,
      progressMessage: "",
    };
    emit();
    return;
  }

  state = {
    ...state,
    isOptimizing: true,
    progress: 0,
    progressMessage: "Starting background worker...",
  };
  emit();

  if (typeof window !== "undefined" && typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("./nesting.worker.ts", import.meta.url), {
        type: "module",
      });
      activeWorker = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (currentTaskId !== activeTaskId) return;
        const data = e.data;
        if (data.type === "PROGRESS") {
          state = {
            ...state,
            progress: data.progress,
            progressMessage: data.message,
          };
          emit();
        } else if (data.type === "SUCCESS") {
          if (activeWorker === worker) {
            worker.terminate();
            activeWorker = null;
          }
          state = {
            ...state,
            result: data.result,
            isOptimizing: false,
            progress: 100,
            progressMessage: "Optimization complete",
          };
          emit();
        } else if (data.type === "ERROR") {
          if (activeWorker === worker) {
            worker.terminate();
            activeWorker = null;
          }
          state = {
            ...state,
            isOptimizing: false,
            progress: 0,
            progressMessage: data.error || "Optimization error",
          };
          emit();
        }
      };

      worker.onerror = (err) => {
        if (currentTaskId !== activeTaskId) return;
        if (activeWorker === worker) {
          worker.terminate();
          activeWorker = null;
        }
        state = {
          ...state,
          isOptimizing: false,
          progress: 0,
          progressMessage: err.message || "Worker execution error",
        };
        emit();
      };

      worker.postMessage({
        type: "START",
        id: currentTaskId,
        parts,
        config,
      });
      return;
    } catch (err) {
      console.warn("Failed to create Web Worker, falling back to sync optimization:", err);
    }
  }

  // Synchronous fallback for SSR or environments without Web Worker support
  try {
    const result = optimize(parts, config);
    state = {
      ...state,
      result,
      isOptimizing: false,
      progress: 100,
      progressMessage: "Optimization complete",
    };
  } catch (err: any) {
    state = {
      ...state,
      isOptimizing: false,
      progress: 0,
      progressMessage: err?.message || "Optimization error",
    };
  }
  emit();
}

export const store = {
  get: () => state,
  set(patch: Partial<AppState>) {
    state = { ...state, ...patch };
    if (patch.parts || patch.config) {
      runBackgroundOptimization(state.parts, state.config);
    } else {
      emit();
    }
  },

  /** Manually trigger background optimization on current parts and configuration */
  runOptimization() {
    if (state.parts.length) {
      runBackgroundOptimization(state.parts, state.config);
    }
  },

  /** Immediately cancel any active Web Worker optimization task and clean up memory */
  cancelOptimization() {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    activeTaskId++;
    state = {
      ...state,
      isOptimizing: false,
      progress: 0,
      progressMessage: "Optimization cancelled",
    };
    emit();
  },

  /** Set parsed Excel BOM parts and rejected items, and automatically optimize layout */
  setParsedParts(fileInfo: UploadedFile, parts: Part[], rejectedParts: RejectedPart[] = []) {
    state = {
      ...state,
      file: fileInfo,
      parsed: true,
      parts,
      rejectedParts,
    };
    runBackgroundOptimization(parts, state.config);
  },

  /** Move a rejected part into valid parts after user edits missing dimensions */
  restoreRejectedPart(rejectedId: string, validPart: Part) {
    const rejectedParts = state.rejectedParts.filter((r) => r.id !== rejectedId);
    const parts = [...state.parts, validPart];
    state = {
      ...state,
      parts,
      rejectedParts,
    };
    runBackgroundOptimization(parts, state.config);
  },

  /** Auto-split an oversized long part into standard sheet segment lengths */
  splitOversizedPart(rejectedId: string, maxSegmentLength: number = 6000) {
    const itemToSplit = state.rejectedParts.find((r) => r.id === rejectedId);
    if (!itemToSplit) return;

    const lenMatch = ((itemToSplit.rawLen ?? '') || itemToSplit.description).match(/(\d+(?:\.\d+)?)/);
    const totalLen = lenMatch ? parseFloat(lenMatch[1]!) : 0;

    const widMatch = ((itemToSplit.rawWid ?? '') || itemToSplit.description).match(/(\d+(?:\.\d+)?)/);
    const width = widMatch ? parseFloat(widMatch[1]!) : 300;

    const thkMatch = ((itemToSplit.rawThk ?? '') || itemToSplit.description).match(/(\d+(?:\.\d+)?)/);
    const thickness = thkMatch ? parseFloat(thkMatch[1]!) : 10;

    const qtyMatch = (itemToSplit.rawQty ?? "1").match(/(\d+)/);
    const baseQty = qtyMatch ? parseInt(qtyMatch[1]!, 10) : 1;

    if (totalLen <= 0) return;

    const numFullSegments = Math.floor(totalLen / maxSegmentLength);
    const remainderLen = totalLen % maxSegmentLength;

    const newSplitParts: Part[] = [];

    if (numFullSegments > 0) {
      newSplitParts.push({
        id: `split-${Date.now()}-1`,
        item: `${itemToSplit.item} (Split ${maxSegmentLength}mm)`,
        description: `${itemToSplit.description} — Segment 1 of 2 (${maxSegmentLength}mm section)`,
        material: itemToSplit.material,
        thickness,
        length: maxSegmentLength,
        width,
        qty: numFullSegments * baseQty,
      });
    }

    if (remainderLen > 0) {
      newSplitParts.push({
        id: `split-${Date.now()}-2`,
        item: `${itemToSplit.item} (Split ${remainderLen}mm)`,
        description: `${itemToSplit.description} — Segment 2 of 2 (${remainderLen}mm section)`,
        material: itemToSplit.material,
        thickness,
        length: remainderLen,
        width,
        qty: baseQty,
      });
    }

    const rejectedParts = state.rejectedParts.filter((r) => r.id !== rejectedId);
    const parts = [...state.parts, ...newSplitParts];

    state = {
      ...state,
      parts,
      rejectedParts,
    };
    runBackgroundOptimization(parts, state.config);
  },

  /** Delete a rejected part entry completely */
  removeRejectedPart(rejectedId: string) {
    const rejectedParts = state.rejectedParts.filter((r) => r.id !== rejectedId);
    state = { ...state, rejectedParts };
    emit();
  },

  addPlateType(pt: PlateTypeConfig) {
    const currentTypes = state.config.plateTypes ?? DEFAULT_PLATE_TYPES;
    const updated = [...currentTypes, pt];
    const newConfig = { ...state.config, plateTypes: updated };
    state = { ...state, config: newConfig };
    runBackgroundOptimization(state.parts, newConfig);
  },

  updatePlateType(id: string, patch: Partial<PlateTypeConfig>) {
    const currentTypes = state.config.plateTypes ?? DEFAULT_PLATE_TYPES;
    const updated = currentTypes.map((pt) => (pt.id === id ? { ...pt, ...patch } : pt));
    const newConfig = { ...state.config, plateTypes: updated };
    state = { ...state, config: newConfig };
    runBackgroundOptimization(state.parts, newConfig);
  },

  removePlateType(id: string) {
    const currentTypes = state.config.plateTypes ?? DEFAULT_PLATE_TYPES;
    const updated = currentTypes.filter((pt) => pt.id !== id);
    const newConfig = { ...state.config, plateTypes: updated };
    state = { ...state, config: newConfig };
    runBackgroundOptimization(state.parts, newConfig);
  },

  setFile(file: UploadedFile) {
    state = { ...state, file, parsed: false };
    emit();
  },

  updatePart(id: string, patch: Partial<Part>) {
    const parts = state.parts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    state = { ...state, parts };
    runBackgroundOptimization(parts, state.config);
  },

  removePart(id: string) {
    const parts = state.parts.filter((p) => p.id !== id);
    state = { ...state, parts };
    runBackgroundOptimization(parts, state.config);
  },

  reset() {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    activeTaskId++;
    state = initial;
    emit();
  },

  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(
    store.subscribe,
    store.get,
    () => initial,
  );
}
