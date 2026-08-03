import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

const sizes = [
  { l: 6000, w: 1250 },
  { l: 6300, w: 1500 },
  { l: 2500, w: 1250 },
  { l: 2440, w: 1220 },
  { l: 3000, w: 1500 },
];

console.log("=== Testing Stock Sheet Dimensions ===");
for (const s of sizes) {
  const config = {
    sheetLength: s.l,
    sheetWidth: s.w,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
    groupByMaterial: false,
  };
  const res = optimize(PARTS_6MM, config);
  console.log(`Size ${s.l}x${s.w}: ${res.sheetCount} sheets, ${res.utilization.toFixed(2)}% util`);
  for (const sheet of res.sheets) {
    console.log(`   ${sheet.id}: ${sheet.placed.length} parts, ${sheet.utilization.toFixed(1)}% util`);
  }
}
