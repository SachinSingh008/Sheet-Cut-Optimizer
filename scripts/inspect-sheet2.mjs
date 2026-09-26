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
console.log("Sheet 1 placed count:", res.sheets[0].placed.length);
console.log("Sheet 2 placed count:", res.sheets[1].placed.length);

const s1 = res.sheets[0];
const maxX1 = Math.max(...s1.placed.map(p => p.x + p.w));
const maxY1 = Math.max(...s1.placed.map(p => p.y + p.h));
console.log(`Sheet 1 maxX: ${maxX1}, maxY: ${maxY1}`);

// Check parts on Sheet 2
console.log("\nSheet 2 parts:");
for (const p of res.sheets[1].placed) {
  console.log(`  ${p.part.item}: x=${p.x}, y=${p.y}, w=${p.w}, h=${p.h}`);
}
