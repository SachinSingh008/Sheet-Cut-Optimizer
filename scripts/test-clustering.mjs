import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

const config = {
  sheetLength: 6000,
  sheetWidth: 1250,
  kerf: 3,
  trim: 0,
  rotation: true,
  algorithm: "auto",
  preset: "balanced",
  groupByMaterial: false,
  plateTypes: [],
};

const res = optimize(PARTS_6MM, config);

for (const s of res.sheets) {
  const partsByItem = new Map();
  for (const p of s.placed) {
    const item = p.part.item;
    if (!partsByItem.has(item)) partsByItem.set(item, []);
    partsByItem.get(item).push(p);
  }
  console.log(`\nSheet ${s.id} (${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%):`);
  for (const [item, list] of partsByItem) {
    const minX = Math.min(...list.map(p => p.x));
    const maxX = Math.max(...list.map(p => p.x + p.w));
    const minY = Math.min(...list.map(p => p.y));
    const maxY = Math.max(...list.map(p => p.y + p.h));
    const uniqueXs = new Set(list.map(p => p.x)).size;
    console.log(`  - ${item} (Qty ${list.length}): X in [${minX}..${maxX}], Y in [${minY}..${maxY}], placed across ${uniqueXs} distinct X columns`);
  }
}
