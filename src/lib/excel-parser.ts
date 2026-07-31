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
 * Only accepts items with valid, physically realizable plate dimensions (L x W).
 * Items lacking dimension details (e.g. C.T. MOTOR STOOL, BEND PLATE) are moved to rejectedParts.
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
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("No data rows found in the selected sheet.");
  }

  const keys = Object.keys(rawRows[0]!);

  const findKey = (patterns: RegExp[]): string | undefined => {
    for (const pat of patterns) {
      const match = keys.find((k) => pat.test(k.trim()));
      if (match) return match;
    }
    return undefined;
  };

  const itemKey = findKey([/item/i, /mark/i, /part/i, /tag/i, /sr/i, /s\.no/i, /pos/i, /^no$/i]);
  const descKey = findKey([/desc/i, /name/i, /profile/i, /particular/i, /detail/i, /section/i]);
  const matKey = findKey([/mat/i, /grade/i, /spec/i, /quality/i, /steel/i, /type/i]);
  const thkKey = findKey([/thk/i, /thick/i, /height/i, /gauge/i, /^t$/i, /t\(mm\)/i]);
  const lenKey = findKey([/len/i, /length/i, /^l$/i, /l\(mm\)/i, /cut len/i]);
  const widKey = findKey([/wid/i, /width/i, /^w$/i, /w\(mm\)/i, /breadth/i, /^b$/i, /b\(mm\)/i]);
  const qtyKey = findKey([/qty/i, /quantity/i, /nos/i, /pcs/i, /count/i, /num/i]);

  const parts: Part[] = [];
  const rejectedParts: RejectedPart[] = [];

  rawRows.forEach((row, idx) => {
    const rawValues = Object.values(row).map((v) => String(v).trim());

    // 1. Description & Item
    let description = descKey && row[descKey] ? String(row[descKey]).trim() : "";
    if (!description && rawValues.length > 2) {
      description = rawValues[2] || rawValues[1] || "";
    }

    let rawItem = itemKey && row[itemKey] !== undefined ? String(row[itemKey]).trim() : "";
    if (!rawItem && rawValues.length > 1) {
      rawItem = rawValues[1] || rawValues[0] || `P-${String(idx + 1).padStart(3, "0")}`;
    }
    const item = rawItem ? `ITEM ${rawItem}`.replace(/^ITEM ITEM/, "ITEM") : `P-${String(idx + 1).padStart(3, "0")}`;

    // 2. Material Grade
    let rawMat = matKey && row[matKey] !== undefined ? String(row[matKey]).trim() : "";
    if (!rawMat && rawValues.length > 3) {
      rawMat = rawValues[3] || "";
    }

    let material = rawMat.toUpperCase();
    if (!material || material === "---" || material === "NULL" || material === "UNDEFINED") {
      if (/CHQ|CHEQ|CHEQUERED/i.test(description)) {
        material = "IS:3502 (Chequered Plate)";
      } else {
        material = "IS:2062 E250A";
      }
    }

    // 3. Cell numbers parsing
    const parseNum = (v: any): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const numStr = String(v).replace(/[^0-9.]/g, "");
      const val = parseFloat(numStr);
      return isNaN(val) || val <= 0 ? null : val;
    };

    let thickness = thkKey ? parseNum(row[thkKey]) : null;
    let length = lenKey ? parseNum(row[lenKey]) : null;
    let width = widKey ? parseNum(row[widKey]) : null;
    let qty = qtyKey ? parseNum(row[qtyKey]) : null;

    // Only use positional fallback for qty if qtyKey missing
    if (qty === null && rawValues.length >= 8) qty = parseNum(rawValues[7]);

    // 4. INTELLIGENT DESCRIPTION REGEX EXTRACTION (PRIMARY SOURCE FOR DIMENSIONS)
    let foundDimInDesc = false;

    // Extract Thickness from description
    const thkMatch = description.match(/(?:PL|CHQ|PLATE)?[\.\s]*(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i) ||
                     description.match(/\b(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i);
    if (thkMatch && thkMatch[1]) {
      const descThk = parseFloat(thkMatch[1]);
      if (!isNaN(descThk) && descThk > 0) {
        thickness = descThk;
      }
    }

    // Extract Dimensions (Width x Length) from description
    const dimMatch = description.match(/\b(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\b/);
    if (dimMatch && dimMatch[1] && dimMatch[2]) {
      const d1 = parseFloat(dimMatch[1]);
      const d2 = parseFloat(dimMatch[2]);
      if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
        length = Math.max(d1, d2);
        width = Math.min(d1, d2);
        foundDimInDesc = true;
      }
    }

    // Profile length matching (e.g. "ISMB 150x75, 1290 (CHF)" or "ISMC 150x75, 3220 LG")
    const profileMatch = description.match(/IS(?:MC|MB|NB|WB)\s*(\d+)x(\d+)\s*,\s*(\d+)/i);
    if (profileMatch && profileMatch[1] && profileMatch[3]) {
      const pWidth = parseFloat(profileMatch[1]);
      const pLen = parseFloat(profileMatch[3]);
      if (!isNaN(pWidth) && !isNaN(pLen)) {
        width = pWidth;
        length = pLen;
        if (thickness === null) thickness = 10;
        foundDimInDesc = true;
      }
    }

    // 5. STRICT VALIDATION RULES FOR FABRICATION PLATES
    let rejectionReason: string | null = null;

    if (!foundDimInDesc && (!length || !width)) {
      rejectionReason = "Missing or unparseable plate dimensions (L x W) in description or columns";
    } else if (length === null || width === null || length <= 0 || width <= 0) {
      rejectionReason = "Missing or invalid plate dimensions (L x W)";
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
