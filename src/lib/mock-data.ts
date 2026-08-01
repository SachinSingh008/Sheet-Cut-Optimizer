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

const rows: Array<Omit<Part, "id">> = [
  { item: "BP-101", description: "Base plate — column C1", material: "IS2062 E250A", thickness: 12, length: 400, width: 400, qty: 24 },
  { item: "BP-102", description: "Base plate — column C2", material: "IS2062 E250A", thickness: 12, length: 500, width: 350, qty: 16 },
  { item: "GP-204", description: "Gusset plate — bracing node", material: "IS2062 E250A", thickness: 10, length: 320, width: 260, qty: 48 },
  { item: "GP-205", description: "Gusset plate — beam haunch", material: "IS2062 E250A", thickness: 10, length: 450, width: 300, qty: 36 },
  { item: "SP-310", description: "Splice plate — flange", material: "IS2062 E350BR", thickness: 16, length: 620, width: 220, qty: 20 },
  { item: "SP-311", description: "Splice plate — web", material: "IS2062 E350BR", thickness: 10, length: 380, width: 240, qty: 28 },
  { item: "ST-402", description: "Stiffener — girder web", material: "IS2062 E250A", thickness: 8, length: 200, width: 557, qty: 12 },
  { item: "ST-403", description: "Stiffener — bearing", material: "IS2062 E250A", thickness: 8, length: 240, width: 480, qty: 32 },
  { item: "ST-404", description: "Stiffener — intermediate", material: "IS2062 E250A", thickness: 8, length: 180, width: 420, qty: 44 },
  { item: "CL-501", description: "Cleat angle backing plate", material: "IS2062 E250A", thickness: 6, length: 150, width: 150, qty: 96 },
  { item: "CL-502", description: "Shear cleat plate", material: "IS2062 E250A", thickness: 6, length: 260, width: 180, qty: 64 },
  { item: "CV-610", description: "Cover plate — top flange", material: "IS2062 E350BR", thickness: 16, length: 1800, width: 300, qty: 8 },
  { item: "CV-611", description: "Cover plate — bottom flange", material: "IS2062 E350BR", thickness: 16, length: 1800, width: 300, qty: 8 },
  { item: "END-702", description: "End plate — moment connection", material: "IS2062 E350BR", thickness: 20, length: 700, width: 260, qty: 18 },
  { item: "END-703", description: "End plate — pinned connection", material: "IS2062 E250A", thickness: 12, length: 460, width: 200, qty: 26 },
  { item: "SD-810", description: "Sole plate — crane bracket", material: "SAILMA 350HI", thickness: 20, length: 520, width: 380, qty: 10 },
  { item: "SD-811", description: "Bracket web plate", material: "SAILMA 350HI", thickness: 16, length: 640, width: 340, qty: 12 },
  { item: "WP-905", description: "Walkway support plate", material: "IS2062 E250A", thickness: 6, length: 340, width: 120, qty: 72 },
  { item: "WP-906", description: "Handrail base plate", material: "IS2062 E250A", thickness: 6, length: 120, width: 120, qty: 120 },
  { item: "TP-931", description: "Tie plate — purlin", material: "IS2062 E250A", thickness: 8, length: 300, width: 90, qty: 88 },
  { item: "PL-950", description: "Packing plate — 3mm shim", material: "IS2062 E250A", thickness: 10, length: 200, width: 200, qty: 40 },
  { item: "PL-951", description: "Anchor template plate", material: "IS2062 E250A", thickness: 12, length: 600, width: 600, qty: 6 },
  { item: "BR-970", description: "Bracing end plate", material: "IS2062 E350BR", thickness: 10, length: 380, width: 380, qty: 22 },
  { item: "BR-971", description: "Bracing gusset — roof", material: "IS2062 E350BR", thickness: 10, length: 700, width: 420, qty: 14 },
  { item: "ER-990", description: "Erection lug plate", material: "SAILMA 350HI", thickness: 20, length: 260, width: 160, qty: 30 },
  { item: "ER-991", description: "Lifting lug — heavy", material: "SAILMA 350HI", thickness: 25, length: 300, width: 200, qty: 12 },
  { item: "MS-995", description: "Misc. filler plate", material: "IS2062 E250A", thickness: 6, length: 500, width: 90, qty: 54 },
  { item: "MS-996", description: "Cap plate — hollow section", material: "IS2062 E250A", thickness: 8, length: 220, width: 220, qty: 46 },
];

export const MOCK_PARTS: Part[] = rows.map((r, i) => ({
  ...r,
  id: `P${String(i + 1).padStart(3, "0")}`,
  invalid:
    r.item === "MS-995" ? "Width below 100 mm minimum for auto-nesting" : null,
}));

export type ThicknessGroup = {
  thickness: number;
  parts: Part[];
  pieces: number;
  weight: number;
};

export function groupByThickness(parts: Part[]): ThicknessGroup[] {
  const map = new Map<number, Part[]>();
  for (const p of parts) {
    const t = Number(p.thickness) || 0;
    map.set(t, [...(map.get(t) ?? []), p]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([thickness, items]) => ({
      thickness,
      parts: items,
      pieces: items.reduce((s, p) => s + (Number(p.qty) || 0), 0),
      weight: items.reduce((s, p) => s + partWeight(p), 0),
    }));
}

export const MATERIAL_RATE: Record<string, number> = {
  "IS2062 E250A": 62,
  "IS2062 E350BR": 71,
  "SAILMA 350HI": 78,
};

export const SHEET_SIZES = [
  { label: "2500 × 1250 mm", length: 2500, width: 1250 },
  { label: "3000 × 1500 mm", length: 3000, width: 1500 },
  { label: "6000 × 1500 mm", length: 6000, width: 1500 },
];

export const ALGORITHMS = [
  { value: "auto", label: "Adaptive Engine (Auto-detects BOM characteristics)" },
  { value: "skyline", label: "Skyline (Bottom-Left Contour)" },
  { value: "maxrects", label: "MaxRects (Best Area Fit)" },
  { value: "guillotine", label: "Guillotine (Straight Shear Cuts)" },
  { value: "hybrid", label: "Hybrid (Skyline + MaxRects Back-Fill)" },
];
