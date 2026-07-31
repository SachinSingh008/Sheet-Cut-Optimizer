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
};

const defaultConfig: OptimizationConfig = {
  sheetLength: 3000,
  sheetWidth: 1500,
  kerf: 3,
  trim: 10,
  rotation: true,
  algorithm: "maxrects",
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
};

let state: AppState = initial;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const store = {
  get: () => state,
  set(patch: Partial<AppState>) {
    state = { ...state, ...patch };
    if (patch.parts || patch.config) {
      state.result = state.parts.length ? optimize(state.parts, state.config) : null;
    }
    emit();
  },

  /** Set parsed Excel BOM parts and rejected items, and automatically optimize layout */
  setParsedParts(fileInfo: UploadedFile, parts: Part[], rejectedParts: RejectedPart[] = []) {
    const result = parts.length ? optimize(parts, state.config) : null;
    state = {
      ...state,
      file: fileInfo,
      parsed: true,
      parts,
      rejectedParts,
      result,
    };
    emit();
  },

  /** Move a rejected part into valid parts after user edits missing dimensions */
  restoreRejectedPart(rejectedId: string, validPart: Part) {
    const rejectedParts = state.rejectedParts.filter((r) => r.id !== rejectedId);
    const parts = [...state.parts, validPart];
    state = {
      ...state,
      parts,
      rejectedParts,
      result: parts.length ? optimize(parts, state.config) : null,
    };
    emit();
  },

  /** Auto-split an oversized long part (e.g. 20,000mm) into standard sheet segment lengths (e.g. 3x6000mm + 1x2000mm) */
  splitOversizedPart(rejectedId: string, maxSegmentLength: number = 6000) {
    const itemToSplit = state.rejectedParts.find((r) => r.id === rejectedId);
    if (!itemToSplit) return;

    // Parse numeric total length from rawLen or description
    const lenMatch = (itemToSplit.rawLen || itemToSplit.description).match(/(\d+(?:\.\d+)?)/);
    const totalLen = lenMatch ? parseFloat(lenMatch[1]) : 0;

    const widMatch = (itemToSplit.rawWid || itemToSplit.description).match(/(\d+(?:\.\d+)?)/);
    const width = widMatch ? parseFloat(widMatch[1]) : 300;

    const thkMatch = (itemToSplit.rawThk || itemToSplit.description).match(/(\d+(?:\.\d+)?)/);
    const thickness = thkMatch ? parseFloat(thkMatch[1]) : 10;

    const qtyMatch = (itemToSplit.rawQty || "1").match(/(\d+)/);
    const baseQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

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
      result: parts.length ? optimize(parts, state.config) : null,
    };
    emit();
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
    state = {
      ...state,
      config: newConfig,
      result: state.parts.length ? optimize(state.parts, newConfig) : null,
    };
    emit();
  },

  updatePlateType(id: string, patch: Partial<PlateTypeConfig>) {
    const currentTypes = state.config.plateTypes ?? DEFAULT_PLATE_TYPES;
    const updated = currentTypes.map((pt) => (pt.id === id ? { ...pt, ...patch } : pt));
    const newConfig = { ...state.config, plateTypes: updated };
    state = {
      ...state,
      config: newConfig,
      result: state.parts.length ? optimize(state.parts, newConfig) : null,
    };
    emit();
  },

  removePlateType(id: string) {
    const currentTypes = state.config.plateTypes ?? DEFAULT_PLATE_TYPES;
    const updated = currentTypes.filter((pt) => pt.id !== id);
    const newConfig = { ...state.config, plateTypes: updated };
    state = {
      ...state,
      config: newConfig,
      result: state.parts.length ? optimize(state.parts, newConfig) : null,
    };
    emit();
  },

  setFile(file: UploadedFile) {
    state = { ...state, file, parsed: false };
    emit();
  },

  updatePart(id: string, patch: Partial<Part>) {
    const parts = state.parts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    state = {
      ...state,
      parts,
      result: parts.length ? optimize(parts, state.config) : null,
    };
    emit();
  },

  removePart(id: string) {
    const parts = state.parts.filter((p) => p.id !== id);
    state = {
      ...state,
      parts,
      result: parts.length ? optimize(parts, state.config) : null,
    };
    emit();
  },

  reset() {
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
