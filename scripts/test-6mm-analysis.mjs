import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

const totalPieces = PARTS_6MM.reduce((sum, p) => sum + p.qty, 0);
const netPartArea = PARTS_6MM.reduce((sum, p) => sum + p.length * p.width * p.qty, 0);

console.log("==================================================");
console.log("6 MM BENCHMARK PART METRICS");
console.log("==================================================");
console.log(`Total Part Items: ${PARTS_6MM.length}`);
console.log(`Total Pieces to Place: ${totalPieces}`);
console.log(`Total Net Part Area: ${(netPartArea / 1e6).toFixed(4)} m² (${netPartArea.toLocaleString()} mm²)`);
console.log("Parts Breakdown:");
PARTS_6MM.forEach(p => {
  const itemArea = p.length * p.width * p.qty;
  console.log(`  ${p.item.padEnd(8)}: ${p.length} × ${p.width} mm, Qty: ${p.qty} (${(itemArea/1e6).toFixed(4)} m², ${((itemArea/netPartArea)*100).toFixed(1)}% of total area)`);
});
console.log("==================================================\n");

// Check stock sizes
const stockConfigurations = [
  { label: "Standard SAIL/Tata HR Sheet (2500 × 1250 mm)", length: 2500, width: 1250 },
  { label: "Standard 8x4 Sheet (2440 × 1220 mm)", length: 2440, width: 1220 },
  { label: "Standard Medium Plate (3000 × 1500 mm)", length: 3000, width: 1500 },
  { label: "Standard Large Mill Plate (6000 × 1250 mm)", length: 6000, width: 1250 },
  { label: "Standard Heavy Workshop Plate (6000 × 1500 mm)", length: 6000, width: 1500 },
];

console.log("==================================================");
console.log("THEORETICAL LOWER BOUND BY STOCK SIZE");
console.log("==================================================");
stockConfigurations.forEach(stock => {
  const sheetArea = stock.length * stock.width;
  const theoreticalMinSheets = netPartArea / sheetArea;
  const ceilSheets = Math.ceil(theoreticalMinSheets);
  const maxPossibleUtilAtCeil = (netPartArea / (ceilSheets * sheetArea)) * 100;
  console.log(`Stock: ${stock.label}`);
  console.log(`  Sheet Area: ${(sheetArea / 1e6).toFixed(4)} m²`);
  console.log(`  Theoretical Exact Sheets Needed (with 0% waste & 0 kerf): ${theoreticalMinSheets.toFixed(3)} sheets`);
  console.log(`  Absolute Mathematical Minimum Integer Sheets: ${ceilSheets} sheets`);
  console.log(`  Max Possible Utilization at ${ceilSheets} sheets: ${maxPossibleUtilAtCeil.toFixed(2)}%`);
  console.log(`  Is 2 sheets physically possible? ${theoreticalMinSheets <= 2.0 ? "YES (" + (netPartArea / (2 * sheetArea) * 100).toFixed(1) + "% util required)" : "NO (Would require " + (netPartArea / (2 * sheetArea) * 100).toFixed(1) + "% util > 100%!)"}`);
  console.log("--------------------------------------------------");
});
