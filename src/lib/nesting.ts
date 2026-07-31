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

export type OptimizationConfig = {
  sheetLength: number;
  sheetWidth: number;
  kerf: number;
  trim: number;
  rotation: boolean;
  algorithm: string;
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
};

/** Shelf (bottom-left) nesting — deterministic and good enough for visualization. */
export function optimize(parts: Part[], config: OptimizationConfig): OptimizationResult {
  const valid = parts.filter((p) => !p.invalid);
  const buckets = new Map<string, Part[]>();
  for (const p of valid) {
    const key = `${p.material}|${p.thickness}`;
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
  }

  const sheets: NestedSheet[] = [];
  const usableL = config.sheetLength - config.trim * 2;
  const usableW = config.sheetWidth - config.trim * 2;

  for (const [key, group] of buckets) {
    const material = key.split("|")[0] ?? "Unknown";
    const thickness = Number(key.split("|")[1] ?? 0);

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
        sheetLength: config.sheetLength,
        sheetWidth: config.sheetWidth,
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
      if (cursorX + it.w > config.sheetLength - config.trim) {
        shelfY += shelfH + config.kerf;
        shelfH = 0;
        cursorX = config.trim;
      }
      if (shelfY + it.h > config.sheetWidth - config.trim) {
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
    (a, s) => a + (s.sheetLength * s.sheetWidth * s.thickness * 7.85e-6),
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
