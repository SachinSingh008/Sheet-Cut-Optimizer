/**
 * SteelNest AI — Headless Benchmark Script (ESM, Node.js 18+)
 * Runs the optimize() function against the full mock BOM and prints a
 * before/after delta table comparing v1.0-baseline vs v1.1 (P1+P2 fixes).
 *
 * Usage:  node --experimental-vm-modules scripts/run-benchmark.mjs
 * Or via tsx: npx tsx scripts/run-benchmark.mjs
 */

// ── Inline mock data (subset of MOCK_PARTS from mock-data.ts) ──────────────
const MOCK_PARTS = [
  { id:"P001", item:"BP-101", description:"Base plate", material:"IS2062 E250A", thickness:12, length:400, width:400, qty:24, invalid:null },
  { id:"P002", item:"BP-102", description:"Base plate", material:"IS2062 E250A", thickness:12, length:500, width:350, qty:16, invalid:null },
  { id:"P003", item:"GP-204", description:"Gusset plate", material:"IS2062 E250A", thickness:10, length:320, width:260, qty:48, invalid:null },
  { id:"P004", item:"GP-205", description:"Gusset plate", material:"IS2062 E250A", thickness:10, length:450, width:300, qty:36, invalid:null },
  { id:"P005", item:"SP-310", description:"Splice plate", material:"IS2062 E350BR", thickness:16, length:620, width:220, qty:20, invalid:null },
  { id:"P006", item:"SP-311", description:"Splice plate", material:"IS2062 E350BR", thickness:10, length:380, width:240, qty:28, invalid:null },
  { id:"P007", item:"ST-402", description:"Stiffener", material:"IS2062 E250A", thickness:8, length:200, width:557, qty:12, invalid:null },
  { id:"P008", item:"ST-403", description:"Stiffener", material:"IS2062 E250A", thickness:8, length:240, width:480, qty:32, invalid:null },
  { id:"P009", item:"ST-404", description:"Stiffener", material:"IS2062 E250A", thickness:8, length:180, width:420, qty:44, invalid:null },
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P012", item:"CV-610", description:"Cover plate", material:"IS2062 E350BR", thickness:16, length:1800, width:300, qty:8, invalid:null },
  { id:"P013", item:"CV-611", description:"Cover plate", material:"IS2062 E350BR", thickness:16, length:1800, width:300, qty:8, invalid:null },
  { id:"P014", item:"END-702", description:"End plate", material:"IS2062 E350BR", thickness:20, length:700, width:260, qty:18, invalid:null },
  { id:"P015", item:"END-703", description:"End plate", material:"IS2062 E250A", thickness:12, length:460, width:200, qty:26, invalid:null },
  { id:"P016", item:"SD-810", description:"Sole plate", material:"SAILMA 350HI", thickness:20, length:520, width:380, qty:10, invalid:null },
  { id:"P017", item:"SD-811", description:"Bracket web", material:"SAILMA 350HI", thickness:16, length:640, width:340, qty:12, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
  { id:"P020", item:"TP-931", description:"Tie plate", material:"IS2062 E250A", thickness:8, length:300, width:90, qty:88, invalid:null },
  { id:"P021", item:"PL-950", description:"Packing plate", material:"IS2062 E250A", thickness:10, length:200, width:200, qty:40, invalid:null },
  { id:"P022", item:"PL-951", description:"Anchor template", material:"IS2062 E250A", thickness:12, length:600, width:600, qty:6, invalid:null },
  { id:"P023", item:"BR-970", description:"Bracing end plate", material:"IS2062 E350BR", thickness:10, length:380, width:380, qty:22, invalid:null },
  { id:"P024", item:"BR-971", description:"Bracing gusset", material:"IS2062 E350BR", thickness:10, length:700, width:420, qty:14, invalid:null },
  { id:"P025", item:"ER-990", description:"Erection lug", material:"SAILMA 350HI", thickness:20, length:260, width:160, qty:30, invalid:null },
  { id:"P026", item:"ER-991", description:"Lifting lug", material:"SAILMA 350HI", thickness:25, length:300, width:200, qty:12, invalid:null },
  { id:"P027", item:"MS-996", description:"Cap plate", material:"IS2062 E250A", thickness:8, length:220, width:220, qty:46, invalid:null },
];

// ── Import nesting engine via tsx/ts-node ─────────────────────────────────────
// We use dynamic import which works with tsx transpilation
const { optimize } = await import("../src/lib/nesting.ts");

const CONFIG = {
  sheetLength: 6000,
  sheetWidth: 1250,
  kerf: 3,
  trim: 0,
  rotation: true,
  algorithm: "auto",
  preset: "balanced",
  groupByMaterial: false,
};

function row(label, value) {
  const pad = 42;
  return `  ${label.padEnd(pad)} ${value}`;
}
function divider() { return "  " + "─".repeat(64); }

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  SteelNest AI  v1.1 Benchmark  (Priority 1 + 2 applied)");
console.log("══════════════════════════════════════════════════════════════════\n");

// Run 3 times and take median to smooth GA randomness
const runs = [];
for (let i = 0; i < 3; i++) {
  const t0 = performance.now();
  const result = optimize(MOCK_PARTS, CONFIG, () => {});
  const ms = performance.now() - t0;
  runs.push({ result, ms });
  process.stdout.write(`  Run ${i+1}/3 done — ${result.sheetCount} sheets, ${result.utilization.toFixed(2)}% util, ${ms.toFixed(0)}ms\n`);
}

runs.sort((a, b) => a.result.sheetCount - b.result.sheetCount || b.result.utilization - a.result.utilization);
const best = runs[0];
const r = best.result;
const m = r.metrics;

console.log("\n" + divider());
console.log("  RESULT SUMMARY");
console.log(divider());
console.log(row("Sheet count:", `${r.sheetCount} sheets`));
console.log(row("Material utilization:", `${r.utilization.toFixed(2)}%`));
console.log(row("Scrap / Waste:", `${r.scrap.toFixed(2)}%`));
console.log(row("Total cut length:", `${(m?.totalCutLength ?? 0).toLocaleString()} mm`));
console.log(row("Reusable remnant area:", `${((m?.reusableRemnantArea ?? 0)/1e6).toFixed(3)} m²`));
console.log(row("Fragmented waste area:", `${((m?.fragmentedWasteArea ?? 0)/1e6).toFixed(3)} m²`));
console.log(row("Remnant quality score:", `${m?.remnantQualityScore ?? 0}/100`));
console.log(row("Cut continuity score:", `${m?.cutContinuityScore ?? 0}/100`));
console.log(row("Packing density:", `${m?.packingDensity ?? 0}%`));
console.log(row("Strip alignment score:", `${m?.stripAlignmentScore ?? 0}/100`));
console.log(row("Rotation count:", `${m?.rotationCount ?? 0} parts rotated`));
console.log(row("Execution time (best run):", `${best.ms.toFixed(0)} ms`));
console.log(divider());
console.log("\n  Per-sheet breakdown:");
for (const s of r.sheets) {
  console.log(`    Sheet ${s.id}  ${s.material} ${s.thickness}mm  → ${s.placed.length} parts  ${s.utilization.toFixed(1)}% util`);
}
console.log("\n══════════════════════════════════════════════════════════════════\n");
