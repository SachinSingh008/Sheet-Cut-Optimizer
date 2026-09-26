import { optimize, packGuillotineColumnSheet, evaluateLayoutScore, DEFAULT_SCORING_WEIGHTS } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

const config = { sheetLength: 6000, sheetWidth: 1250, kerf: 3, trim: 0, rotation: true };

const queue = [];
for (const p of PARTS_6MM) {
  for (let q = 0; q < p.qty; q++) {
    queue.push({ part: p, w: p.length, h: p.width, rotated: false });
  }
}

const colSheets = packGuillotineColumnSheet(queue, 6000, 1250, config, "IS2062", 6, "COL");
console.log("ColSheets length:", colSheets.length);
colSheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`  ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX}`);
});

const weights = DEFAULT_SCORING_WEIGHTS.balanced;
const colScore = evaluateLayoutScore(colSheets, weights, config);
console.log("ColSheets score:", colScore.score);

const optRes = optimize(PARTS_6MM, config);
console.log("\nOptRes sheets length:", optRes.sheets.length);
optRes.sheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`  ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX}`);
});
const optScore = evaluateLayoutScore(optRes.sheets, weights, config);
console.log("OptRes score:", optScore.score);
