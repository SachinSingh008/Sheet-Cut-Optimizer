import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';

async function main() {
  const filePath = 'C:/Users/rites/Downloads/NESTING-FOR ACTUAL CUTTING-MEZANINNE-R1/P34-0001-MEZZ. NESTING-PLATE CUTTING-R1.xlsx';
  const buf = fs.readFileSync(filePath);
  const file = new File([buf], 'P34-0001-MEZZ. NESTING-PLATE CUTTING-R1.xlsx');
  const res = await parseExcelFile(file);
  console.log('USER FILE -> Valid:', res.parts.length, 'Rejected:', res.rejectedParts.length);
  if (res.parts.length > 0) {
    console.log('Sample part 0:', res.parts[0]);
    console.log('Sample part last:', res.parts[res.parts.length - 1]);
  }

  const demos = [
    'demos/edsad.xlsx',
    'demos/KUMAR_DRAWING_POS_Data.xlsx',
    'demos/POS_Data_From_All_Provided_Images (1).xlsx',
    'demos/WR1-16, TB1.xlsx',
    'demos/BOM_Extracted_Updated_v6.xlsx',
    'demos/B1-B19.xlsx'
  ];

  for (const d of demos) {
    const dBuf = fs.readFileSync(d);
    const dFile = new File([dBuf], d.split('/').pop()!);
    const dRes = await parseExcelFile(dFile);
    console.log(d, '-> Valid:', dRes.parts.length, 'Rejected:', dRes.rejectedParts.length);
  }
}

main().catch(console.error);
