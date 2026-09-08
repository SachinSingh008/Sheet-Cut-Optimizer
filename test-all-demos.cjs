const fs = require('fs');
const XLSX = require('./node_modules/xlsx');

const files = [
  'edsad.xlsx',
  'KUMAR_DRAWING_POS_Data.xlsx',
  'POS_Data_From_All_Provided_Images (1).xlsx',
  'WR1-16, TB1.xlsx',
  'BOM_Extracted_Updated_v6.xlsx',
  'B1-B19.xlsx'
];

function parseComprehensiveWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const headerKeywords =
    /profile|desc|description|item|mark|part|name|length|len|width|wid|qty|quantity|thk|thick|thickness|material|mat|grade|nos|pcs|size|drg|particular|section|dim|pos/i;

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

  const headerRow = (matrix[headerIdx] || []).map((c) => String(c).trim());
  const dataRowsMatrix = matrix.slice(headerIdx + 1);

  const findKeyIndex = (patterns) => {
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
    /^item$/i,
    /^part$/i,
    /^piece$/i,
    /^member$/i,
    /^sr\.?\s*no\.?$/i,
    /^s\.no\.?$/i,
  ]);

  const descIdx = findKeyIndex([
    /profile\s*size/i,
    /^profile$/i,
    /profile/i,
    /^dimension/i,
    /dim/i,
    /^desc/i,
    /description/i,
    /particular/i,
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
    /steel/i
  ]);

  const rawThkIdx = findKeyIndex([
    /^(?:thk|thick|thickness)$/i,
    /thk\(mm\)/i,
    /thick\(mm\)/i,
    /^t$/i,
    /t\(mm\)/i,
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
  ]);

  const parseNum = (v) => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "number") return isNaN(v) || v <= 0 ? null : v;
    const str = String(v).trim();
    if (/[a-zA-Z]/.test(str)) return null;
    const numStr = str.replace(/[^0-9.]/g, "");
    const val = parseFloat(numStr);
    return isNaN(val) || val <= 0 ? null : val;
  };

  const parts = [];
  const rejectedParts = [];

  dataRowsMatrix.forEach((rowCells, idx) => {
    const rawValues = rowCells.map((v) => String(v).trim());
    if (rawValues.every((v) => !v)) return;

    let description = descIdx !== -1 && rowCells[descIdx] ? String(rowCells[descIdx]).trim() : "";
    if (!description && thkWidIdx !== -1 && rowCells[thkWidIdx]) {
      description = String(rowCells[thkWidIdx]).trim();
    }
    if (!description && rawValues.length > 0) {
      description = rawValues.find((v, c) => c !== itemIdx && v.trim()) || rawValues[0] || "";
    }

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
        const drgClean = cellVal.replace(/[()]/g, "").split(/[xX×,]/)[0].trim();
        rawItem = drgClean || cellVal;
      }
    }

    if (!rawItem) {
      rawItem = `P-${String(idx + 1).padStart(3, "0")}`;
    }

    const item = rawItem;

    // Material Grade extraction
    let rawMat = "";
    if (matIdx !== -1 && rowCells[matIdx] !== undefined) {
      const mStr = String(rowCells[matIdx]).trim();
      // Only treat as material if not a pure number (which is likely a shifted qty/weight column)
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

    let thickness = thkIdx !== -1 ? parseNum(rowCells[thkIdx]) : null;
    let length = lenIdx !== -1 ? parseNum(rowCells[lenIdx]) : null;
    let width = widIdx !== -1 ? parseNum(rowCells[widIdx]) : null;
    let qty = qtyIdx !== -1 ? parseNum(rowCells[qtyIdx]) : null;

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

    let foundDimInDesc = false;

    // Check for explicit THK in description (e.g. "PL 6 THK", "PL.16THK.", "CHQ.PL 6 THK")
    const thkMatch =
      description.match(/(?:PL|CHQ|PLATE)?[\.\s]*(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i) ||
      description.match(/\b(\d+(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i);
    if (thkMatch && thkMatch[1]) {
      const descThk = parseFloat(thkMatch[1]);
      if (!isNaN(descThk) && descThk > 0) {
        thickness = descThk;
      }
    }

    // Check for explicit LG / Length in description (e.g. "1290 LG", "400 LG.")
    const lgMatch = description.match(/\b(\d+(?:\.\d+)?)\s*(?:LG\.?|LONG|MM)\b/i);
    if (lgMatch && lgMatch[1]) {
      const descLen = parseFloat(lgMatch[1]);
      if (!isNaN(descLen) && descLen > 0) {
        length = descLen;
      }
    }

    // Case 1: If THK was explicitly found in description (e.g. "PL 6 THK, 100 x 226", "PL.16THK. x 100 x 400 LG.")
    // Then any "W x L" in description is Width x Length!
    if (thickness !== null && thickness > 0) {
      const wlMatch = description.match(/\b(\d+(?:\.\d+)?)\s*[\*xX×]\s*(\d+(?:\.\d+)?)\b/);
      if (wlMatch && wlMatch[1] && wlMatch[2]) {
        const d1 = parseFloat(wlMatch[1]);
        const d2 = parseFloat(wlMatch[2]);
        if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
          width = Math.min(d1, d2);
          // If length wasn't set by length column or lgMatch, take larger
          if (length === null || length <= 0) {
            length = Math.max(d1, d2);
          }
          foundDimInDesc = true;
        }
      }
    }

    // Case 2: Angle profile: ISA90X90X8, ISA75X75X6, ISA50X50X6, L65*65*6, ISA 75x75x8
    if (!foundDimInDesc) {
      const isaMatch = description.match(
        /(?:ISA|ANGLE|^L\b|^L(?=\d))[\s\-]*(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)/i,
      );
      if (isaMatch && isaMatch[1] && isaMatch[3]) {
        const leg1 = parseFloat(isaMatch[1]);
        const leg2 = parseFloat(isaMatch[2]);
        const t = parseFloat(isaMatch[3]);
        width = Math.max(leg1, leg2);
        thickness = t;
        foundDimInDesc = true;
      }
    }

    // Case 3: Standard Plate / Flat: PL10*100, PLT10*188, PL 12*150, FL 10*100, 10*100
    if (!foundDimInDesc) {
      const plMatch = description.match(
        /(?:(?:PL|PLT|PLATE|FLAT|FL|FB|MS)[\s\-]*)?(\d+(?:\.\d+)?)\s*[\*xX×]\s*(\d+(?:\.\d+)?)(?:\s*[\*xX×]\s*(\d+(?:\.\d+)?))?/i,
      );
      if (plMatch && plMatch[1] && plMatch[2]) {
        const d1 = parseFloat(plMatch[1]);
        const d2 = parseFloat(plMatch[2]);
        if (plMatch[3]) {
          const d3 = parseFloat(plMatch[3]);
          // 3 dimensions: T * W * L (e.g. 10*100*130)
          // If a dedicated length column exists with a larger valid number, respect it
          if (length !== null && length > 0) {
            thickness = Math.min(d1, d2);
            width = Math.max(d1, d2);
          } else {
            const dims = [d1, d2, d3].sort((a, b) => a - b);
            thickness = dims[0];
            width = dims[1];
            length = dims[2];
          }
          foundDimInDesc = true;
        } else {
          // 2 dimensions: e.g. PL10*100 or 10*100
          // If length is already provided in length column (e.g. 130 or 1509):
          // d1 and d2 are Thickness and Width!
          if (length !== null && length > 0) {
            thickness = Math.min(d1, d2);
            width = Math.max(d1, d2);
            foundDimInDesc = true;
          } else {
            // No length column: assume d1 x d2 is Width x Length (with default plate thk) or Thk x Width
            // If one is very large (e.g. > 200), it's likely Width x Length
            if (Math.max(d1, d2) >= 100 && Math.min(d1, d2) >= 30) {
              width = Math.min(d1, d2);
              length = Math.max(d1, d2);
              if (thickness === null) thickness = 10;
              foundDimInDesc = true;
            } else {
              thickness = Math.min(d1, d2);
              width = Math.max(d1, d2);
              foundDimInDesc = true;
            }
          }
        }
      }
    }

    // Case 4: Channel section: ISMC 150x75, 1290 LG. or ISMC125, ISMC150, ISMC200
    if (!foundDimInDesc) {
      const ismcMatch = description.match(/(?:ISMC|CHANNEL|MC)[\s\-]*(\d+(?:\.\d+)?)(?:\s*[xX×\*]\s*(\d+(?:\.\d+)?))?/i);
      if (ismcMatch && ismcMatch[1]) {
        const depth = parseFloat(ismcMatch[1]);
        const flange = ismcMatch[2] ? parseFloat(ismcMatch[2]) : null;
        width = flange || depth;
        if (thickness === null) thickness = 8;
        foundDimInDesc = true;
      }
    }

    // Case 5: Beam section: IPE200, ISMB150, ISMB 150x75, NPB350X170X57.09, UB254X146X31, UC152X152X23
    if (!foundDimInDesc) {
      const beamMatch = description.match(
        /(?:NPB|ISMB|ISWB|ISNB|UB|UC|IPE|HEB|HEA|BEAM)[\s\-]*(\d+(?:\.\d+)?)(?:\s*[xX×\*]\s*(\d+(?:\.\d+)?))?/i,
      );
      if (beamMatch && beamMatch[1]) {
        const depth = parseFloat(beamMatch[1]);
        const flange = beamMatch[2] ? parseFloat(beamMatch[2]) : null;
        width = flange || depth;
        if (thickness === null) thickness = 10;
        foundDimInDesc = true;
      }
    }

    // Case 6: Fallback for any "W x L" in description
    if (!foundDimInDesc) {
      const dimMatch = description.match(/\b(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)\b/);
      if (dimMatch && dimMatch[1] && dimMatch[2]) {
        const d1 = parseFloat(dimMatch[1]);
        const d2 = parseFloat(dimMatch[2]);
        if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
          width = Math.min(d1, d2);
          if (length === null || length <= 0) {
            length = Math.max(d1, d2);
          }
          if (thickness === null) thickness = 10;
          foundDimInDesc = true;
        }
      }
    }

    // Validation
    let rejectionReason = null;

    if (!foundDimInDesc || length === null || width === null || length <= 0 || width <= 0) {
      rejectionReason = "Missing plate dimensions (L x W) in description or columns";
    } else if (length > 25000) {
      rejectionReason = `Length (${length.toLocaleString()} mm) exceeds maximum processing limit (25,000 mm)`;
    } else if (width > 5000) {
      rejectionReason = `Width (${width.toLocaleString()} mm) exceeds maximum plate width limit (5,000 mm)`;
    } else if (qty === null || qty <= 0) {
      rejectionReason = "Invalid or zero quantity";
    }

    if (rejectionReason) {
      rejectedParts.push({
        item,
        description,
        material,
        reason: rejectionReason,
        thickness,
        length,
        width,
        qty
      });
    } else {
      parts.push({
        item,
        description,
        material,
        thickness: thickness || 10,
        length,
        width,
        qty: Math.round(qty)
      });
    }
  });

  return { parts, rejectedParts, headerRow };
}

for (const file of files) {
  console.log(`\n=================== ${file} ===================`);
  const buf = fs.readFileSync('demos/' + file);
  const res = parseComprehensiveWorkbook(buf);
  console.log(`Header Row: [${res.headerRow.join(', ')}]`);
  console.log(`Valid Parts: ${res.parts.length}, Rejected Parts: ${res.rejectedParts.length}`);
  if (res.parts.length > 0) {
    console.log(`Sample Valid Part 0:`, res.parts[0]);
    if (res.parts.length > 1) {
      console.log(`Sample Valid Part 1:`, res.parts[1]);
    }
    const samplePl = res.parts.find(p => p.description.includes('PL') || p.description.includes('THK'));
    if (samplePl) console.log(`Sample Plate Part:`, samplePl);
  }
  if (res.rejectedParts.length > 0) {
    console.log(`Sample Rejected Part:`, res.rejectedParts[0]);
    const reasons = {};
    for (const r of res.rejectedParts) {
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    }
    console.log(`Rejection counts:`, reasons);
  }
}
