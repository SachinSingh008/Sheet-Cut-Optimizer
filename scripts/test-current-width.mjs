import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

const conf = {
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

const res = optimize(PARTS_6MM, conf);
console.log(`Optimization: ${res.sheetCount} sheets, ${res.utilization.toFixed(2)}% yield`);
res.sheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  const maxY = Math.max(...s.placed.map(p => p.y + p.h));
  console.log(`Sheet ${s.id}: ${s.placed.length} parts, maxX: ${maxX} mm, maxY: ${maxY} mm (Sheet Width: ${s.sheetWidth} mm)`);
});
