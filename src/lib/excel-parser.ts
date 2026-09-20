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

export interface ExtractedDimensions {
  length?: number | undefined;
  width?: number | undefined;
  thickness?: number | undefined;
  valuesCount: number;
}

/**
 * Intelligent dimension extractor following standard fabrication plate rules:
 * - If 3 values: len > width > thickness (largest = length, middle = width, smallest = thickness)
 * - If 2 values: width > thk (larger = width, smaller = thickness)
 */
export function extractDimensionsFromText(text: string): ExtractedDimensions | null {
  if (!text) return null;
  const str = String(text).trim();
  if (!str) return null;

  // 1. Check for 3-part dimensions (e.g. "PL10*110*1200", "PL 10 x 110 x 1200", "10*110*1200", "1200*110*10", "PL10*110-1200")
  const threePartRegex =
    /(?:(?:PL|PLT|PLATE|FLAT|FL|FB|MS|CHQ|STRIP)[\s\-\.]*)?(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)?\s*[\*xX×\-\/,\s]\s*(?:(?:x|X|×|\*)\s*)?(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)?\s*[\*xX×\-\/,\s]\s*(?:(?:x|X|×|\*)\s*)?(\d+(?:\.\d+)?)(?:\s*(?:LG\.?|LONG|MM))?/i;

  const m3 = str.match(threePartRegex);
  if (m3 && m3[1] && m3[2] && m3[3]) {
    const n1 = parseFloat(m3[1]);
    const n2 = parseFloat(m3[2]);
    const n3 = parseFloat(m3[3]);
    if (!isNaN(n1) && !isNaN(n2) && !isNaN(n3) && n1 > 0 && n2 > 0 && n3 > 0) {
      // User rule: if 3 values contain then len > width > thickness
      const sorted = [n1, n2, n3].sort((a, b) => b - a);
      return {
        length: sorted[0],
        width: sorted[1],
        thickness: sorted[2],
        valuesCount: 3,
      };
    }
  }

  // 2. Check for 2-part dimensions (e.g. "PL10*110", "PL10*150", "PL10*257", "PL10*46", "PL10*71", "PL10*86", "10*110")
  // Optionally followed by explicit length like "x 1200 LG" or ", 1200 LG"
  const twoPartWithLg =
    /(?:(?:PL|PLT|PLATE|FLAT|FL|FB|MS|CHQ|STRIP)[\s\-\.]*)?(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)?\s*[\*xX×]\s*(\d+(?:\.\d+)?)(?:[\s,xX×\*]+(\d+(?:\.\d+)?)\s*(?:LG\.?|LONG|MM))?/i;

  const m2 = str.match(twoPartWithLg);
  if (m2 && m2[1] && m2[2]) {
    const n1 = parseFloat(m2[1]);
    const n2 = parseFloat(m2[2]);
    const n3 = m2[3] ? parseFloat(m2[3]) : null;

    if (!isNaN(n1) && !isNaN(n2) && n1 > 0 && n2 > 0) {
      if (n3 !== null && !isNaN(n3) && n3 > 0) {
        // 3 values found (2 in callout + 1 length)
        const sorted = [n1, n2, n3].sort((a, b) => b - a);
        return {
          length: sorted[0],
          width: sorted[1],
          thickness: sorted[2],
          valuesCount: 3,
        };
      }

      // User rule: if 2 values then width > thk
      const sorted = [n1, n2].sort((a, b) => b - a);
      return {
        width: sorted[0],
        thickness: sorted[1],
        valuesCount: 2,
      };
    }
  }

  // 3. Fallback for "10 THK x 110" or "PL 10 THK 110"
  const thkXWid = str.match(/(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)[,\s\*\-xX×]+(\d+(?:\.\d+)?)/i);
  if (thkXWid && thkXWid[1] && thkXWid[2]) {
    const n1 = parseFloat(thkXWid[1]);
    const n2 = parseFloat(thkXWid[2]);
    if (!isNaN(n1) && !isNaN(n2) && n1 > 0 && n2 > 0) {
      const sorted = [n1, n2].sort((a, b) => b - a);
      return {
        width: sorted[0],
        thickness: sorted[1],
        valuesCount: 2,
      };
    }
  }

  return null;
}

/**
 * Supports all industrial structural steel profile and cut sheet formats:
 * - Direct plates (PL*, PLT*, PLATE*, FL*, FLAT*, FB*, MS*, pure numbers like 10*100)
 * - Chequered plates (CHQ.PL 6 THK, 100 x 226, IS:3502)
 * - Industrial descriptive callouts (PL.16THK. x 100 x 400 LG., PL 10 THK, 120 x 180 (CHF))
 * - Indian/European standard beams (IPE200, ISMB150, ISMB 150x75, 1290 (CHF), NPB350X170X57.09, UB254X146X31, UC152X152X23)
 * - Structural channels (ISMC125, ISMC150, ISMC200, ISMC 150x75, 1290 LG.)
 * - Structural angles (ISA90X90X8, ISA75X75X6, ISA50X50X6, L65*65*6, ISA 75x75x8)
 * Automatically scans across sheets and detects header rows even under title banners.
 */
export async function parseExcelFile(file: File): Promise<{
  parts: Part[];
  rejectedParts: RejectedPart[];
  materialsCount: number;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel file is empty or has no readable sheets.");
  }

  // 1. Find the best sheet containing BOM data and headers
  const headerKeywords =
    /profile|desc|description|item|mark|part|name|length|len|width|wid|qty|quantity|thk|thick|thickness|material|mat|grade|nos|pcs|size|drg|particular|section|dim|pos|piece|tag/i;

  let bestMatrix: any[][] = [];
  let maxHeaderMatches = -1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const m: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!m || m.length === 0) continue;

    for (let r = 0; r < Math.min(m.length, 15); r++) {
      let matches = 0;
      (m[r] || []).forEach((cell) => {
        if (cell && headerKeywords.test(String(cell).trim())) {
          matches++;
        }
      });
      if (matches > maxHeaderMatches) {
        maxHeaderMatches = matches;
        bestMatrix = m;
      }
    }
  }

  if (bestMatrix.length === 0) {
    throw new Error("No data found in any sheet of the uploaded file.");
  }

  return parseMatrixToParts(bestMatrix);
}

/**
 * Parses a 2D matrix (from an Excel sheet or pasted spreadsheet grid) into Part[] and RejectedPart[]
 */
export function parseMatrixToParts(matrix: any[][]): {
  parts: Part[];
  rejectedParts: RejectedPart[];
  materialsCount: number;
} {
  if (!matrix || matrix.length === 0) {
    return { parts: [], rejectedParts: [], materialsCount: 0 };
  }

  const headerKeywords =
    /profile|desc|description|item|mark|part|name|length|len|width|wid|qty|quantity|thk|thick|thickness|material|mat|grade|nos|pcs|size|drg|particular|section|dim|pos|piece|tag/i;

  let bestHeaderIdx = 0;
  let maxHeaderMatches = -1;

  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    let matches = 0;
    (matrix[r] || []).forEach((cell) => {
      if (cell && headerKeywords.test(String(cell).trim())) {
        matches++;
      }
    });
    if (matches > maxHeaderMatches) {
      maxHeaderMatches = matches;
      bestHeaderIdx = r;
    }
  }

  const hasRecognizedHeaders = maxHeaderMatches >= 2;
  const headerRow: string[] = hasRecognizedHeaders
    ? (matrix[bestHeaderIdx] || []).map((c) => String(c).trim())
    : [];
  const dataRowsMatrix = hasRecognizedHeaders
    ? matrix.slice(bestHeaderIdx + 1)
    : matrix;

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

  const itemIdx = findKeyIndex([
    /^pos(?:\.|\b)/i,
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
    /^tag$/i,
    /^piece\s*no\.?$/i,
    /^piece$/i,
    /^member$/i,
    /^item$/i,
    /^part$/i,
    /^name$/i,
    /item\s*name/i,
    /part\s*name/i,
    /plate\s*name/i,
    /mark\s*name/i,
    /^sr\.?\s*no\.?$/i,
    /^s\.no\.?$/i,
    /^sr$/i,
    /^no$/i,
    /^id$/i,
  ]);

  const descIdx = findKeyIndex([
    /profile\s*size/i,
    /^profile$/i,
    /profile/i,
    /^dimension(?:s)?(?:\.|\b)/i,
    /dim/i,
    /^desc/i,
    /description/i,
    /particular/i,
    /detail/i,
    /section/i,
    /size/i,
    /specification/i,
  ]);

  const matIdx = findKeyIndex([
    /^material$/i,
    /^mat$/i,
    /material/i,
    /grade/i,
    /spec/i,
    /quality/i,
    /steel/i,
    /type/i,
  ]);

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

  const thkWidIdx = findKeyIndex([
    /(?:thk|thick|thickness)[\s\-*xX×]*(?:wid|width|breadth)/i,
    /(?:wid|width|breadth)[\s\-*xX×]*(?:thk|thick|thickness)/i,
    /^t[\s*xX×]w$/i,
    /^w[\s*xX×]t$/i,
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
    /^q\.?ty$/i,
    /q\.?ty/i,
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

  const effItemIdx = itemIdx !== -1 ? itemIdx : (!hasRecognizedHeaders ? 0 : -1);
  const effDescIdx = descIdx !== -1 ? descIdx : (!hasRecognizedHeaders ? 1 : -1);
  const effMatIdx = matIdx !== -1 ? matIdx : (!hasRecognizedHeaders ? 2 : -1);
  const effThkIdx = thkIdx !== -1 ? thkIdx : (!hasRecognizedHeaders ? 3 : -1);
  const effLenIdx = lenIdx !== -1 ? lenIdx : (!hasRecognizedHeaders ? 4 : -1);
  const effWidIdx = widIdx !== -1 ? widIdx : (!hasRecognizedHeaders ? 5 : -1);
  const effQtyIdx = qtyIdx !== -1 ? qtyIdx : (!hasRecognizedHeaders ? 6 : -1);

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

    // 1. Description & Profile Name
    let description = effDescIdx !== -1 && rowCells[effDescIdx] ? String(rowCells[effDescIdx]).trim() : "";
    if (!description && thkWidIdx !== -1 && rowCells[thkWidIdx]) {
      description = String(rowCells[thkWidIdx]).trim();
    }
    if (!description && rawValues.length > 0) {
      description = rawValues.find((v, c) => c !== effItemIdx && v.trim()) || rawValues[0] || "";
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

    // 2. Item Mark
    let rawItem = "";
    if (effItemIdx !== -1 && rowCells[effItemIdx] !== undefined) {
      const cellVal = String(rowCells[effItemIdx]).trim();
      if (cellVal) {
        // Clean drawing mark references like "(B13 x 2)" or "(B4 x 3, B5 x 1)" or "(WR1 x 1)"
        const parts = cellVal.replace(/[()]/g, "").split(/[xX×,]/);
        const drgClean = (parts[0] ?? "").trim();
        rawItem = drgClean || cellVal;
      }
    }

    // Auto-generate clean distinct item mark P-001, P-002, etc. if no explicit column existed
    if (!rawItem) {
      rawItem = `P-${String(idx + 1).padStart(3, "0")}`;
    }

    const item = rawItem;

    // 3. Material Grade
    let rawMat = "";
    if (effMatIdx !== -1 && rowCells[effMatIdx] !== undefined) {
      const mStr = String(rowCells[effMatIdx]).trim();
      // Ensure material column value is not a pure number (e.g. from shifted quantity/weight columns)
      if (mStr && !/^\d+(?:\.\d+)?$/.test(mStr)) {
        rawMat = mStr;
      }
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

    // 4. Raw Cell Numbers Parsing from dedicated columns
    let thickness = effThkIdx !== -1 ? parseNum(rowCells[effThkIdx]) : null;
    let length = effLenIdx !== -1 ? parseNum(rowCells[effLenIdx]) : null;
    let width = effWidIdx !== -1 ? parseNum(rowCells[effWidIdx]) : null;
    let qty = effQtyIdx !== -1 ? parseNum(rowCells[effQtyIdx]) : null;

    // Combined thickness * width column parsing (e.g. "10*100")
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

    // 5. INTELLIGENT DESCRIPTION & PROFILE EXTRACTION
    let foundDimInDesc = false;

    // Check for explicit THK in description (e.g. "PL 6 THK", "PL.16THK.", "CHQ.PL 6 THK", "10 THK")
    const thkMatch =
      description.match(/(?:PL|CHQ|PLATE)?[\.\s]*(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i) ||
      description.match(/\b(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i);
    if (thkMatch && thkMatch[1]) {
      const descThk = parseFloat(thkMatch[1]);
      if (!isNaN(descThk) && descThk > 0) {
        thickness = descThk;
      }
    }

    // Check for explicit LG / Length in description (e.g. "1290 LG", "400 LG.", "180 LG")
    const lgMatch = description.match(/\b(\d+(?:\.\d+)?)\s*(?:LG\.?|LONG|MM)\b/i);
    if (lgMatch && lgMatch[1]) {
      const descLen = parseFloat(lgMatch[1]);
      if (!isNaN(descLen) && descLen > 0) {
        length = descLen;
      }
    }

    // Pattern A: Structural Beams (IPE200, ISMB150, ISMB 150x75, 1290 (CHF), NPB350X170X57.09, UB254X146X31, UC152X152X23)
    const beamMatch = description.match(
      /^(?:NPB|ISMB|ISWB|ISNB|UB|UC|IPE|HEB|HEA|BEAM)[\s\-]*(\d+(?:\.\d+)?)(?:\s*[xX×\*]\s*(\d+(?:\.\d+)?))?(?:[\s,xX×\-]+(\d+(?:\.\d+)?))?/i,
    );
    if (beamMatch && beamMatch[1]) {
      const depth = parseFloat(beamMatch[1]);
      const flange = beamMatch[2] ? parseFloat(beamMatch[2]) : null;
      width = flange || depth;
      if (thickness === null) thickness = 10;
      if ((length === null || length <= 0) && beamMatch[3]) {
        const candidateLen = parseFloat(beamMatch[3]);
        if (candidateLen >= 80) {
          length = candidateLen;
        }
      }
      foundDimInDesc = true;
    }

    // Pattern B: Structural Channels (ISMC 150x75, 1290 LG. or ISMC125, ISMC150, ISMC200)
    if (!foundDimInDesc) {
      const ismcMatch = description.match(
        /^(?:ISMC|CHANNEL|MC)[\s\-]*(\d+(?:\.\d+)?)(?:\s*[xX×\*]\s*(\d+(?:\.\d+)?))?(?:[\s,xX×\-]+(\d+(?:\.\d+)?))?/i,
      );
      if (ismcMatch && ismcMatch[1]) {
        const depth = parseFloat(ismcMatch[1]);
        const flange = ismcMatch[2] ? parseFloat(ismcMatch[2]) : null;
        width = flange || depth;
        if (thickness === null) thickness = 8;
        if ((length === null || length <= 0) && ismcMatch[3]) {
          const candidateLen = parseFloat(ismcMatch[3]);
          if (candidateLen >= 80) {
            length = candidateLen;
          }
        }
        foundDimInDesc = true;
      }
    }

    // Pattern C: Structural Angles (ISA90X90X8, ISA75X75X6, ISA50X50X6, L65*65*6, ISA 75x75x8)
    if (!foundDimInDesc) {
      const isaMatch = description.match(
        /^(?:ISA|ANGLE|L)[\s\-]*(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)/i,
      );
      if (isaMatch && isaMatch[1] && isaMatch[2] && isaMatch[3]) {
        const leg1 = parseFloat(isaMatch[1]);
        const leg2 = parseFloat(isaMatch[2]);
        const t = parseFloat(isaMatch[3]);
        width = Math.max(leg1, leg2);
        thickness = t;
        foundDimInDesc = true;
      }
    }

    // Pattern D: Explicit THK plate descriptions (e.g. "PL 6 THK, 100 x 226", "PL.16THK. x 100 x 400 LG.")
    if (!foundDimInDesc && thickness !== null && thickness > 0) {
      const wlMatch = description.match(/\b(\d+(?:\.\d+)?)\s*[\*xX×]\s*(\d+(?:\.\d+)?)\b/);
      if (wlMatch && wlMatch[1] && wlMatch[2]) {
        const d1 = parseFloat(wlMatch[1]);
        const d2 = parseFloat(wlMatch[2]);
        if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
          width = Math.min(d1, d2);
          if (length === null || length <= 0) {
            length = Math.max(d1, d2);
          }
          foundDimInDesc = true;
        }
      }
    }

    // Pattern E: Standard Plates / Flats (PL10*110, PL10*150, PL10*257, PL10*46, etc.)
    // User Rule:
    // - If 3 values: len > width > thickness
    // - If 2 values: width > thk
    if (!foundDimInDesc) {
      let extracted = extractDimensionsFromText(description) || extractDimensionsFromText(item);
      if (!extracted) {
        for (const cVal of rawValues) {
          if (cVal) {
            extracted = extractDimensionsFromText(cVal);
            if (extracted) break;
          }
        }
      }

      if (extracted) {
        if (extracted.valuesCount === 3) {
          length = extracted.length!;
          width = extracted.width!;
          thickness = extracted.thickness!;
          foundDimInDesc = true;
        } else if (extracted.valuesCount === 2) {
          width = extracted.width!;
          thickness = extracted.thickness!;

          // If length was not already given by dedicated column, look for length in other row cells
          if (length === null || length <= 0) {
            for (let c = 0; c < rowCells.length; c++) {
              if (c !== effItemIdx && c !== effDescIdx && c !== effThkIdx && c !== effWidIdx && c !== effQtyIdx) {
                const n = parseNum(rowCells[c]);
                if (n && n > 0 && n !== width && n !== thickness && (qty === null || n !== qty)) {
                  length = n;
                  break;
                }
              }
            }
          }

          if (length !== null && length > 0) {
            foundDimInDesc = true;
          }
        }
      }
    }

    // Ensure standard width <= length rectangle orientation
    if (width !== null && length !== null && width > length) {
      const temp = width;
      width = length;
      length = temp;
    }

    // 6. VALIDATION RULES
    let rejectionReason: string | null = null;

    if (!foundDimInDesc || length === null || width === null || length <= 0 || width <= 0) {
      rejectionReason = "Missing plate dimensions (L x W) in description or columns";
    } else if (length > 25000) {
      rejectionReason = `Length (${length.toLocaleString()} mm) exceeds maximum processing limit (25,000 mm)`;
    } else if (width > 5000) {
      rejectionReason = `Width (${width.toLocaleString()} mm) exceeds maximum plate width limit (5,000 mm)`;
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
