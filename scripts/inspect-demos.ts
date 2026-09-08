import fs from 'fs';
import * as XLSX from 'xlsx';
import { parseExcelFile } from '../src/lib/excel-parser';

const files = [
  'demos/B1-B19.xlsx',
  'demos/BOM_Extracted_Updated_v6.xlsx',
  'demos/KUMAR_DRAWING_POS_Data.xlsx',
  'demos/POS_Data_From_All_Provided_Images (1).xlsx',
  'demos/WR1-16, TB1.xlsx',
  'demos/edsad.xlsx',
];

async function inspect() {
  for (const filePath of files) {
    console.log(`\n======================================================`);
    console.log(`FILE: ${filePath}`);
    console.log(`======================================================`);
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    console.log(`Sheet Names: ${wb.SheetNames.join(', ')}`);

    for (const sName of wb.SheetNames) {
      const sheet = wb.Sheets[sName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      console.log(`\n--- Sheet: "${sName}" (${matrix.length} total rows) ---`);
      console.log(`First 6 rows:`);
      for (let r = 0; r < Math.min(matrix.length, 6); r++) {
        console.log(` Row ${r}:`, JSON.stringify(matrix[r]));
      }
    }

    const file = new File([buf], filePath.split('/').pop()!, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    try {
      const res = await parseExcelFile(file);
      console.log(`\nPARSER RESULT for ${filePath}:`);
      console.log(`Valid parts extracted: ${res.parts.length}`);
      console.log(`Rejected parts: ${res.rejectedParts.length}`);
      if (res.parts.length > 0) {
        console.log(`Sample valid part (first 2):`, res.parts.slice(0, 2));
      }
      if (res.rejectedParts.length > 0) {
        console.log(`Sample rejected part (first 3):`, res.rejectedParts.slice(0, 3));
      }
    } catch (err: any) {
      console.error(`ERROR parsing ${filePath}:`, err.message);
    }
  }
}

inspect().catch(console.error);
