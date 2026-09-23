import fs from 'fs';
import * as XLSX from 'xlsx';

// Test candidate table search and parseMatrixToParts implementation
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel file is empty or has no readable sheets.');
  }

  let bestCandidate = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!matrix || matrix.length === 0) continue;

    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r] || [];
      if (!row || row.length === 0) continue;

      let hasPart = false;
      let hasLen = false;
      let hasWid = false;
      let hasThk = false;
      let hasQty = false;
      let hasMat = false;
      let hasDesc = false;

      row.forEach((cell) => {
        const s = String(cell).trim().toLowerCase();
        if (/part\s*file|part\s*name|item\s*mark|part\s*mark|^drg\b|^pos\b|^item\b|^piece\b/i.test(s)) hasPart = true;
        if (/^length|^len\b|size\s*x/i.test(s)) hasLen = true;
        if (/^width|^wid\b|size\s*y/i.test(s)) hasWid = true;
        if (/^thk|thick/i.test(s)) hasThk = true;
        if (/^qty|quantity|q\.?ty|nos|pcs/i.test(s)) hasQty = true;
        if (/^material|^mat\b|^grade\b/i.test(s)) hasMat = true;
        if (/^desc|description|profile/i.test(s)) hasDesc = true;
      });

      let score = 0;
      if (hasPart) score += 12;
      if (hasLen && hasWid) score += 10;
      else if (hasLen || hasWid) score += 5;
      if (hasThk) score += 6;
      if (hasQty) score += 6;
      if (hasMat) score += 4;
      if (hasDesc) score += 8;

      const prevRowStr = (matrix[r - 1] || []).join(' ').toLowerCase();
      const prevPrevRowStr = (matrix[r - 2] || []).join(' ').toLowerCase();
      if (prevRowStr.includes('parts') || prevPrevRowStr.includes('parts')) {
        score += 15;
      }
      if (prevRowStr.includes('subnests') || prevPrevRowStr.includes('subnests')) {
        score -= 5;
      }

      if (score >= 12) {
        let dataRowCount = 0;
        for (let d = r + 1; d < matrix.length; d++) {
          const dRow = matrix[d] || [];
          if (dRow.some((c) => c !== '')) {
            dataRowCount++;
          } else {
            if (dataRowCount > 0) break;
          }
        }

        const candidate = {
          sheetName,
          headerRowIdx: r,
          score: score + Math.min(dataRowCount, 50),
          matrix: matrix.slice(r),
        };

        if (
          !bestCandidate ||
          candidate.score > bestCandidate.score ||
          (candidate.score === bestCandidate.score && candidate.matrix.length > bestCandidate.matrix.length)
        ) {
          bestCandidate = candidate;
        }
      }
    }
  }

  const mat = bestCandidate ? bestCandidate.matrix : XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
  return parseMatrix(mat);
}

function parseMatrix(matrix) {
  let bestHeaderIdx = 0;
  let maxScore = -1;

  for (let r = 0; r < Math.min(matrix.length, 60); r++) {
    const row = matrix[r] || [];
    let hasPart = false;
    let hasLen = false;
    let hasWid = false;
    let hasThk = false;
    let hasQty = false;
    let hasMat = false;
    let hasDesc = false;

    row.forEach((cell) => {
      const s = String(cell).trim().toLowerCase();
      if (/part\s*file|part\s*name|item\s*mark|part\s*mark|^drg\b|^pos\b|^item\b|^piece\b/i.test(s)) hasPart = true;
      if (/^length|^len\b|size\s*x/i.test(s)) hasLen = true;
      if (/^width|^wid\b|size\s*y/i.test(s)) hasWid = true;
      if (/^thk|thick/i.test(s)) hasThk = true;
      if (/^qty|quantity|q\.?ty|nos|pcs/i.test(s)) hasQty = true;
      if (/^material|^mat\b|^grade\b/i.test(s)) hasMat = true;
      if (/^desc|description|profile/i.test(s)) hasDesc = true;
    });

    let score = 0;
    if (hasPart) score += 12;
    if (hasLen && hasWid) score += 10;
    else if (hasLen || hasWid) score += 5;
    if (hasThk) score += 6;
    if (hasQty) score += 6;
    if (hasMat) score += 4;
    if (hasDesc) score += 8;

    const prevRowStr = (matrix[r - 1] || []).join(' ').toLowerCase();
    if (prevRowStr.includes('parts')) score += 15;
    if (prevRowStr.includes('subnests')) score -= 5;

    if (score > maxScore) {
      maxScore = score;
      bestHeaderIdx = r;
    }
  }

  const hasRecognizedHeaders = maxScore >= 10;
  const headerRow = hasRecognizedHeaders
    ? (matrix[bestHeaderIdx] || []).map((c) => String(c).trim())
    : [];

  const rawDataSlice = hasRecognizedHeaders ? matrix.slice(bestHeaderIdx + 1) : matrix;
  const dataRowsMatrix = [];
  let consecutiveEmpty = 0;

  for (const r of rawDataSlice) {
    if (!r || r.every((c) => c === '' || c === undefined || c === null)) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2 && dataRowsMatrix.length > 0) {
        break;
      }
      continue;
    }
    consecutiveEmpty = 0;
    dataRowsMatrix.push(r);
  }

  const findKeyIndex = (patterns) => {
    for (const pat of patterns) {
      const idx = headerRow.findIndex((k) => pat.test(k));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const itemIdx = findKeyIndex([
    /^part\s*file(?:\s*name)?$/i,
    /^part\s*name$/i,
    /^component(?:\s*name)?$/i,
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
    /^(?:thk|thick|thickness)(?:\.|\b)/i,
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
    /^size\s*x(?:\s*\(mm\))?$/i,
    /^dim\s*x$/i,
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
    /^(?:wid|width|breadth)(?:\s*\(mm\))?$/i,
    /^size\s*y(?:\s*\(mm\))?$/i,
    /^dim\s*y$/i,
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
    /^quantity$/i,
    /^q\.?ty\.?$/i,
    /^qty\.?$/i,
    /^nos$/i,
    /^pcs$/i,
    /quantity/i,
    /qty/i,
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

  const parseNum = (v) => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'number') return isNaN(v) || v <= 0 ? null : v;
    const str = String(v).trim();
    if (/[a-zA-Z]/.test(str)) return null;
    const numStr = str.replace(/[^0-9.]/g, '');
    const val = parseFloat(numStr);
    return isNaN(val) || val <= 0 ? null : val;
  };

  const parts = [];
  const rejectedParts = [];

  dataRowsMatrix.forEach((rowCells, idx) => {
    const rawValues = rowCells.map((v) => String(v).trim());
    if (rawValues.every((v) => !v)) return;

    let description = effDescIdx !== -1 && rowCells[effDescIdx] ? String(rowCells[effDescIdx]).trim() : '';
    if (!description && thkWidIdx !== -1 && rowCells[thkWidIdx]) {
      description = String(rowCells[thkWidIdx]).trim();
    }
    if (!description && rawValues.length > 0) {
      description = rawValues.find((v, c) => c !== effItemIdx && v.trim()) || rawValues[0] || '';
    }

    const fullRowText = rawValues.join(' ').toLowerCase();
    if (
      /grand\s*total|subtotal|^total\b|summary/i.test(description) ||
      fullRowText.includes('grand total') ||
      fullRowText.includes('subtotal')
    ) {
      return;
    }

    let rawItem = '';
    if (effItemIdx !== -1 && rowCells[effItemIdx] !== undefined) {
      const cellVal = String(rowCells[effItemIdx]).trim();
      if (cellVal) {
        const noExt = cellVal.replace(/\.(?:dft|dwg|dxf|step|stp|ipt|iam|sldprt|sldasm)$/i, '');
        const p = noExt.replace(/[()]/g, '').split(/[xX×,]/);
        const drgClean = (p[0] ?? '').trim();
        rawItem = drgClean || noExt;
      }
    }
    if (!rawItem) {
      rawItem = `P-${String(idx + 1).padStart(3, '0')}`;
    }
    const item = rawItem;

    let rawMat = '';
    if (effMatIdx !== -1 && rowCells[effMatIdx] !== undefined) {
      const mStr = String(rowCells[effMatIdx]).trim();
      if (mStr && !/^\d+(?:\.\d+)?$/.test(mStr)) {
        rawMat = mStr;
      }
    }
    let material = rawMat.toUpperCase() || 'IS:2062 E250A';

    let thickness = effThkIdx !== -1 ? parseNum(rowCells[effThkIdx]) : null;
    let length = effLenIdx !== -1 ? parseNum(rowCells[effLenIdx]) : null;
    let width = effWidIdx !== -1 ? parseNum(rowCells[effWidIdx]) : null;
    let qty = effQtyIdx !== -1 ? parseNum(rowCells[effQtyIdx]) : null;

    if (qty === null) qty = 1;

    let foundDimInDesc = false;
    // Check if dimension in desc
    const plMatch = description.match(/(?:PL|PLATE|ISMB|ISMC|ISA)?\s*(\d+(?:\.\d+)?)\s*[\*xX×]\s*(\d+(?:\.\d+)?)(?:\s*[\*xX×]\s*(\d+(?:\.\d+)?))?/i);
    if (plMatch) {
      foundDimInDesc = true;
      if (plMatch[3]) {
        length = parseFloat(plMatch[3]);
        width = parseFloat(plMatch[2]);
        thickness = parseFloat(plMatch[1]);
      } else if (plMatch[2]) {
        width = parseFloat(plMatch[2]);
        thickness = parseFloat(plMatch[1]);
      }
    }

    if (width !== null && length !== null && width > length) {
      const temp = width;
      width = length;
      length = temp;
    }

    const hasDimensions = foundDimInDesc || (length !== null && width !== null && length > 0 && width > 0);

    if (!hasDimensions || length === null || width === null || length <= 0 || width <= 0) {
      rejectedParts.push({ item, description, material, reason: 'Missing plate dimensions' });
    } else {
      parts.push({ item, description, material, thickness: thickness || 10, length, width, qty: Math.round(qty) });
    }
  });

  return { parts, rejectedParts, headerRow };
}

// RUN TESTS
const userFile = 'C:/Users/rites/Downloads/NESTING-FOR ACTUAL CUTTING-MEZANINNE-R1/P34-0001-MEZZ. NESTING-PLATE CUTTING-R1.xlsx';
const uBuf = fs.readFileSync(userFile);
const uRes = parseExcelBuffer(uBuf);
console.log('=== USER FILE RESULT ===');
console.log('Valid parts:', uRes.parts.length, 'Rejected:', uRes.rejectedParts.length);
console.log('Sample part 0:', uRes.parts[0]);
console.log('Sample part 57:', uRes.parts[uRes.parts.length - 1]);

console.log('\n=== DEMO FILES ===');
const demos = [
  'demos/edsad.xlsx',
  'demos/KUMAR_DRAWING_POS_Data.xlsx',
  'demos/POS_Data_From_All_Provided_Images (1).xlsx',
  'demos/WR1-16, TB1.xlsx',
  'demos/BOM_Extracted_Updated_v6.xlsx',
  'demos/B1-B19.xlsx'
];
demos.forEach(d => {
  const buf = fs.readFileSync(d);
  const res = parseExcelBuffer(buf);
  console.log(d, '-> Valid:', res.parts.length, 'Rejected:', res.rejectedParts.length);
});
