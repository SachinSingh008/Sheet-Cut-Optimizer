import * as XLSX from "xlsx";
import type { Part } from "./mock-data";

export type RejectedPart = {
  id: string;
  item: string;
  description: string;
  material: string;
  reason: string;
  rawThk?: string;
  rawLen?: string;
  rawWid?: string;
  rawQty?: string;
};

/**
 * Parses an Excel (.xlsx, .xls) or CSV file into Part[] and RejectedPart[]
 * Support all industrial structural steel profile formats (PL*, PLT*, ISA*, ISMC*, NPB*, etc.)
 * and detects header rows automatically even when title banners exist.
 */
export async function parseExcelFile(file: File): Promise<{
  parts: Part[];
  rejectedParts: RejectedPart[];
  materialsCount: number;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file is empty or has no readable sheets.");
  }

  const sheet = workbook.Sheets[sheetName]!;

  // 1. Convert sheet to matrix (array of arrays) for header row auto-detection
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!matrix || matrix.length === 0) {
    throw new Error("No data found in the selected sheet.");
  }

  // 2. Find header row by scoring rows against common BOM column keywords
  const headerKeywords =
    /profile|desc|description|item|mark|part|name|length|len|width|wid|qty|quantity|thk|thick|thickness|material|mat|grade|nos|pcs|size|drg|particular|section/i;

  let headerIdx = 0;
  let maxMatches = 0;

  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    let matches = 0;
    row.forEach((cell) => {
      if (cell && headerKeywords.test(String(cell).trim())) {
        matches++;
      }
    });
    if (matches > maxMatches) {
      maxMatches = matches;
      headerIdx = r;
    }
  }

  const headerRow: string[] = (matrix[headerIdx] || []).map((c) => String(c).trim());
  const dataRowsMatrix = matrix.slice(headerIdx + 1);

  if (dataRowsMatrix.length === 0) {
    throw new Error("No data rows found below sheet headers.");
  }

  // Helper to find column key index matching patterns
  const findKeyIndex = (patterns: RegExp[]): number => {
    for (const pat of patterns) {
      const idx = headerRow.findIndex((k) => pat.test(k));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const thkWidIdx = findKeyIndex([
    /(?:thk|thick|thickness)[\s\-*xX×]*(?:wid|width|breadth)/i,
    /(?:wid|width|breadth)[\s\-*xX×]*(?:thk|thick|thickness)/i,
    /^t[\s*xX×]w$/i,
    /^w[\s*xX×]t$/i,
  ]);

  const itemIdx = findKeyIndex([
    /^item\s*mark$/i,
    /^part\s*mark$/i,
    /^drg\s*\/?\s*qty$/i,
    /^drg(?:\s*no\.?)?$/i,
    /^drawing(?:\s*no\.?)?$/i,
    /^part\s*no\.?$/i,
    /^item\s*no\.?$/i,
    /^plate\s*no\.?$/i,
    /^mark\s*no\.?$/i,
    /^mark$/i,
    /^item$/i,
    /^part$/i,
    /^name$/i,
    /item\s*name/i,
    /part\s*name/i,
    /plate\s*name/i,
    /mark\s*name/i,
    /^tag$/i,
    /^pos$/i,
    /^piece$/i,
    /^member$/i,
    /^sr\.?\s*no\.?$/i,
    /^s\.no\.?$/i,
    /^sr$/i,
    /^no$/i,
    /^id$/i,
  ]);

  const descIdx = findKeyIndex([
    /profile/i,
    /desc/i,
    /description/i,
    /particular/i,
    /detail/i,
    /section/i,
    /size/i,
    /specification/i,
    /dim/i,
    /^name$/i,
    /name/i,
  ]);

  const matIdx = findKeyIndex([/mat/i, /grade/i, /spec/i, /quality/i, /steel/i, /type/i]);

  const rawThkIdx = findKeyIndex([
    /^(?:thk|thick|thickness)$/i,
    /thk\(mm\)/i,
    /thick\(mm\)/i,
    /^t$/i,
    /t\(mm\)/i,
    /gauge/i,
    /thk/i,
    /thick/i,
  ]);
  const thkIdx = rawThkIdx !== -1 && rawThkIdx !== thkWidIdx ? rawThkIdx : -1;

  const lenIdx = findKeyIndex([
    /^(?:cut\s*)?len(?:gth)?(?:\s*\(mm\))?$/i,
    /cut\s*len/i,
    /^len$/i,
    /^length$/i,
    /length/i,
    /len/i,
    /^lg$/i,
    /span/i,
    /^l$/i,
    /l\(mm\)/i,
  ]);

  const rawWidIdx = findKeyIndex([
    /^(?:wid|width|breadth)$/i,
    /width\(mm\)/i,
    /wid\(mm\)/i,
    /^w$/i,
    /w\(mm\)/i,
    /^b$/i,
    /b\(mm\)/i,
    /wid/i,
    /width/i,
  ]);
  const widIdx = rawWidIdx !== -1 && rawWidIdx !== thkWidIdx ? rawWidIdx : -1;

  const qtyIdx = findKeyIndex([
    /combined\s*qty/i,
    /combined\s*quantity/i,
    /total\s*qty/i,
    /total\s*quantity/i,
    /net\s*qty/i,
    /final\s*qty/i,
    /^qty$/i,
    /^quantity$/i,
    /^nos$/i,
    /^pcs$/i,
    /qty/i,
    /quantity/i,
    /nos/i,
    /pcs/i,
    /count/i,
    /num/i,
  ]);

  const parseNum = (v: any): number | null => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "number") return isNaN(v) || v <= 0 ? null : v;
    const str = String(v).trim();
    // Ignore text containing letters or drawing references e.g. "(B13 x 2)" or "DRG"
    if (/[a-zA-Z]/.test(str)) return null;
    const numStr = str.replace(/[^0-9.]/g, "");
    const val = parseFloat(numStr);
    return isNaN(val) || val <= 0 ? null : val;
  };

  const parts: Part[] = [];
  const rejectedParts: RejectedPart[] = [];

  dataRowsMatrix.forEach((rowCells, idx) => {
    const rawValues = rowCells.map((v) => String(v).trim());
    if (rawValues.every((v) => !v)) return; // Skip empty rows

    // 1. Description & Item
    let description = descIdx !== -1 && rowCells[descIdx] ? String(rowCells[descIdx]).trim() : "";
    if (!description && thkWidIdx !== -1 && rowCells[thkWidIdx]) {
      description = String(rowCells[thkWidIdx]).trim();
    }
    if (!description && rawValues.length > 0) {
      description = rawValues.find((v, c) => c !== itemIdx && v.trim()) || rawValues[0] || "";
    }

    // Skip Summary / Grand Total rows
    const fullRowText = rawValues.join(" ").toLowerCase();
    if (
      /grand\s*total|subtotal|^total\b|summary/i.test(description) ||
      fullRowText.includes("grand total") ||
      fullRowText.includes("subtotal")
    ) {
      return;
    }

    let rawItem = "";
    if (itemIdx !== -1 && rowCells[itemIdx] !== undefined) {
      const cellVal = String(rowCells[itemIdx]).trim();
      if (cellVal) {
        // Clean drawing mark references like "(B13 x 2)" or "(B4 x 3, B5 x 1)"
        const drgClean = cellVal.replace(/[()]/g, "").split(/[xX×,]/)[0].trim();
        rawItem = drgClean || cellVal;
      }
    }

    // If no explicit item mark was found in the sheet columns (e.g. edsad.xlsx with only Qty, profile, length):
    // Generate clean distinct item marks P-001, P-002, etc. so parts are distinguished and tracked in the model!
    if (!rawItem) {
      rawItem = `P-${String(idx + 1).padStart(3, "0")}`;
    }

    const item = rawItem;

    // 2. Material Grade
    let rawMat = matIdx !== -1 && rowCells[matIdx] !== undefined ? String(rowCells[matIdx]).trim() : "";
    if (!rawMat && rawValues.length > 3) {
      rawMat = rawValues[3] || "";
    }

    let material = rawMat.toUpperCase();
    const isChqInDesc =
      /CHQ|CHEQ|CHEQUERED|CHECKERED|PATTERN|IS3502|IS 3502/i.test(description) ||
      /CHQ|CHEQ|CHEQUERED|CHECKERED/i.test(item);

    if (
      !material ||
      material === "---" ||
      material === "NULL" ||
      material === "UNDEFINED" ||
      (isChqInDesc && !/CHQ|CHEQ|CHEQUERED|3502/i.test(material))
    ) {
      if (isChqInDesc) {
        material = "IS:3502 (Chequered Plate)";
      } else {
        material = "IS:2062 E250A";
      }
    }

    // 3. Raw Cell numbers parsing from columns
    let thickness = thkIdx !== -1 ? parseNum(rowCells[thkIdx]) : null;
    let length = lenIdx !== -1 ? parseNum(rowCells[lenIdx]) : null;
    let width = widIdx !== -1 ? parseNum(rowCells[widIdx]) : null;
    let qty = qtyIdx !== -1 ? parseNum(rowCells[qtyIdx]) : null;

    // Combined thickness * width column parsing
    if (thkWidIdx !== -1 && rowCells[thkWidIdx] !== undefined) {
      const cellStr = String(rowCells[thkWidIdx]).trim();
      const twMatch = cellStr.match(/(\d+(?:\.\d+)?)\s*[\*xX×]\s*(\d+(?:\.\d+)?)/);
      if (twMatch && twMatch[1] && twMatch[2]) {
        const d1 = parseFloat(twMatch[1]);
        const d2 = parseFloat(twMatch[2]);
        if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
          thickness = Math.min(d1, d2);
          width = Math.max(d1, d2);
        }
      }
    }

    // Fallback search for quantity across row cells if primary qtyIdx returned null
    if (qty === null) {
      for (let c = 0; c < rowCells.length; c++) {
        const headerName = headerRow[c] || "";
        if (/qty|quantity|nos|pcs|combined/i.test(headerName)) {
          const val = parseNum(rowCells[c]);
          if (val !== null) {
            qty = val;
            break;
          }
        }
      }
    }
    if (qty === null) qty = 1;

    // 4. INTELLIGENT DESCRIPTION REGEX EXTRACTION (FOR STEEL PROFILES & PLATES)
    let foundDimInDesc = false;

    // Extract Thickness from description if THK keyword is present
    const thkMatch =
      description.match(/(?:PL|CHQ|PLATE)?[\.\s]*(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i) ||
      description.match(/\b(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i);
    if (thkMatch && thkMatch[1]) {
      const descThk = parseFloat(thkMatch[1]);
      if (!isNaN(descThk) && descThk > 0) {
        thickness = descThk;
      }
    }

    // Extract trailing Length (e.g., "1290 LG" or "3220 LG" or "1000 MM")
    const lgMatch = description.match(/\b(\d+(?:\.\d+)?)\s*(?:LG|LONG|MM)\b/i);
    if (lgMatch && lgMatch[1]) {
      const descLen = parseFloat(lgMatch[1]);
      if (!isNaN(descLen) && descLen > 0) {
        length = descLen;
      }
    }

    // Pattern A: Profile with Thickness * Width
    // Supports prefixed: PL10*100, PL 10*100, PLT10*100, PLATE 10*100, FL 10*100, FLAT 100x10, FB 10*100, MS 10*100
    // AND pure numeric: 10*100, 10 * 100, 10x100, 10 x 100, 10X100, 10.0*100, 10*100mm, etc.
    const plMatch = description.match(
      /(?:(?:PL|PLT|PLATE|FLAT|FL|FB|MS)[\s\-]*)?(\d+(?:\.\d+)?)\s*[\*xX×]\s*(\d+(?:\.\d+)?)(?:\s*[\*xX×]\s*(\d+(?:\.\d+)?))?/i,
    );
    if (plMatch && plMatch[1] && plMatch[2]) {
      const d1 = parseFloat(plMatch[1]);
      const d2 = parseFloat(plMatch[2]);
      if (plMatch[3]) {
        // 3 dimensions in profile: T * W * L (e.g. PL10*100*130 or 10*100*130)
        const d3 = parseFloat(plMatch[3]);
        const dims = [d1, d2, d3].sort((a, b) => a - b);
        thickness = dims[0];
        width = dims[1];
        length = dims[2];
        foundDimInDesc = true;
      } else {
        // 2 dimensions in profile: Thickness * Width (e.g. PL10*100, 10*100, 14*50)
        const tCandidate = Math.min(d1, d2);
        const wCandidate = Math.max(d1, d2);
        thickness = tCandidate;
        width = wCandidate;

        if (length !== null && length > 0) {
          // Length is provided in length column (e.g. edsad.xlsx where length is in column 2)
          // Ensure width <= length orientation for standard nesting rectangle representation
          if (width > length) {
            const temp = width;
            width = length;
            length = temp;
          }
        }
        foundDimInDesc = true;
      }
    }

    // Pattern B: ISA angle section e.g. ISA50X50X6 or ISA 50X50X6
    if (!foundDimInDesc) {
      const isaMatch = description.match(
        /(?:ISA|ANGLE|L)[\s\-]*(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)/i,
      );
      if (isaMatch && isaMatch[1] && isaMatch[3]) {
        width = parseFloat(isaMatch[1]);
        thickness = parseFloat(isaMatch[3]);
        foundDimInDesc = true;
      }
    }

    // Pattern C: Channel section e.g. ISMC125 or ISMC150 or ISMC 150x75
    if (!foundDimInDesc) {
      const ismcMatch = description.match(/(?:ISMC|CHANNEL|MC)[\s\-]*(\d+(?:\.\d+)?)(?:\s*[xX×\*]\s*(\d+(?:\.\d+)?))?/i);
      if (ismcMatch && ismcMatch[1]) {
        width = parseFloat(ismcMatch[1]);
        if (thickness === null) thickness = 10;
        foundDimInDesc = true;
      }
    }

    // Pattern D: Beam section e.g. NPB350X170X57.09 or ISMB200
    if (!foundDimInDesc) {
      const beamMatch = description.match(
        /(?:NPB|ISMB|ISWB|ISNB|UB|UC|BEAM)[\s\-]*(\d+(?:\.\d+)?)(?:\s*[xX×\*]\s*(\d+(?:\.\d+)?))?/i,
      );
      if (beamMatch && beamMatch[1]) {
        const depth = parseFloat(beamMatch[1]);
        const flange = beamMatch[2] ? parseFloat(beamMatch[2]) : depth;
        width = flange;
        if (thickness === null) thickness = 10;
        foundDimInDesc = true;
      }
    }

    // Pattern E: Explicit W x L or THK in description (e.g. "200 x 300")
    if (!foundDimInDesc) {
      const dimMatch = description.match(/\b(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)\b/);
      if (dimMatch && dimMatch[1] && dimMatch[2]) {
        const d1 = parseFloat(dimMatch[1]);
        const d2 = parseFloat(dimMatch[2]);
        if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
          length = Math.max(d1, d2);
          width = Math.min(d1, d2);
          foundDimInDesc = true;
        }
      }
    }

    if (length && width && length > 0 && width > 0) {
      foundDimInDesc = true;
    }

    // 5. STRICT VALIDATION RULES FOR FABRICATION PLATES
    let rejectionReason: string | null = null;

    // Check if the component is a structural long profile (Angle, Channel, Beam, Tube) rather than a 2D flat plate
    const isStructuralProfile =
      /^(?:ISA|ANGLE|ISMC|CHANNEL|MC|NPB|ISMB|ISWB|ISNB|ISLB|UB|UC|BEAM|RHS|SHS|PIPE|TUBE)\b/i.test(description) ||
      /^(?:ISA|ISMC|NPB|ISMB|ISWB|UB|UC|RHS|SHS|PIPE)/i.test(description) ||
      /^(?:ISA|ISMC|NPB|ISMB|ISWB|UB|UC|RHS|SHS|PIPE)/i.test(item);

    if (isStructuralProfile) {
      rejectionReason = `Structural section profile (${description || item}) — 2D sheet nesting is for flat plates only`;
    } else if (!foundDimInDesc || length === null || width === null || length <= 0 || width <= 0) {
      rejectionReason = "Missing or unparseable plate dimensions (L x W) in description or columns";
    } else if (length > 12000) {
      rejectionReason = `Length (${length.toLocaleString()} mm) exceeds max stock plate limit (12,000 mm)`;
    } else if (width > 3000) {
      rejectionReason = `Width (${width.toLocaleString()} mm) exceeds max stock plate limit (3,000 mm)`;
    } else if (qty === null || qty <= 0) {
      rejectionReason = "Invalid or zero quantity";
    }

    // Reject or Accept
    if (rejectionReason) {
      rejectedParts.push({
        id: `rej-${idx + 1}-${Date.now()}`,
        item,
        description: description || "Unspecified Component",
        material,
        reason: rejectionReason,
        rawThk: thickness ? `${thickness} mm` : "-",
        rawLen: length ? `${length} mm` : "-",
        rawWid: width ? `${width} mm` : "-",
        rawQty: qty ? `${qty}` : "-",
      });
    } else {
      parts.push({
        id: `part-${idx + 1}-${Date.now()}`,
        item,
        description: description || "Plate Component",
        material,
        thickness: thickness || 10,
        length: length!,
        width: width!,
        qty: qty ? Math.round(qty) : 1,
      });
    }
  });

  const materialsCount = new Set(parts.map((p) => p.material)).size;

  return { parts, rejectedParts, materialsCount };
}

