import { useSyncExternalStore } from "react";
import { MOCK_PARTS, type Part } from "./mock-data";
import type { OptimizationConfig, OptimizationResult } from "./nesting";

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

const initial: AppState = {
  file: null,
  parsed: false,
  parts: [],
  config: {
    sheetLength: 3000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 10,
    rotation: true,
    algorithm: "maxrects",
  },
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
    emit();
  },
  loadDemo() {
    state = {
      ...state,
      file: {
        name: "Ganga-Bridge-Fabrication-BOM.xlsx",
        size: 248_320,
        type: "xlsx",
        rows: MOCK_PARTS.length,
        materials: new Set(MOCK_PARTS.map((p) => p.material)).size,
      },
      parsed: true,
      parts: MOCK_PARTS,
    };
    emit();
  },
  setFile(file: UploadedFile) {
    state = { ...state, file, parsed: false, parts: [], result: null };
    emit();
  },
  parse() {
    state = {
      ...state,
      parsed: true,
      parts: MOCK_PARTS,
      file: state.file ?? {
        name: "Fabrication-BOM.xlsx",
        size: 248_320,
        type: "xlsx",
        rows: MOCK_PARTS.length,
        materials: 3,
      },
    };
    emit();
  },
  updatePart(id: string, patch: Partial<Part>) {
    state = {
      ...state,
      parts: state.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    };
    emit();
  },
  removePart(id: string) {
    state = { ...state, parts: state.parts.filter((p) => p.id !== id) };
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
