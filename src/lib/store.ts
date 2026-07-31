import { useSyncExternalStore } from "react";
import { MOCK_PARTS, type Part } from "./mock-data";
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
  plateTypes: DEFAULT_PLATE_TYPES,
};

const initialParts = MOCK_PARTS;
const initialResult = optimize(initialParts, defaultConfig);

const initial: AppState = {
  file: {
    name: "Ganga-Bridge-Fabrication-BOM.xlsx",
    size: 248_320,
    type: "xlsx",
    rows: initialParts.length,
    materials: 3,
  },
  parsed: true,
  parts: initialParts,
  config: defaultConfig,
  result: initialResult,
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
  loadDemo() {
    const parts = MOCK_PARTS;
    state = {
      ...state,
      file: {
        name: "Ganga-Bridge-Fabrication-BOM.xlsx",
        size: 248_320,
        type: "xlsx",
        rows: parts.length,
        materials: new Set(parts.map((p) => p.material)).size,
      },
      parsed: true,
      parts,
      result: optimize(parts, state.config),
    };
    emit();
  },
  setFile(file: UploadedFile) {
    state = { ...state, file, parsed: false, parts: [], result: null };
    emit();
  },
  parse() {
    const parts = MOCK_PARTS;
    state = {
      ...state,
      parsed: true,
      parts,
      file: state.file ?? {
        name: "Fabrication-BOM.xlsx",
        size: 248_320,
        type: "xlsx",
        rows: parts.length,
        materials: 3,
      },
      result: optimize(parts, state.config),
    };
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
