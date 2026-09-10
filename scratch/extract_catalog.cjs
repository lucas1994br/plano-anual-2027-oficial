const XLSX = require('xlsx');
const path = require('path');

const matFile = path.resolve('src/data/planilhas/PLANILHA DOS MATERIAIS.xlsx');
const matWb = XLSX.readFile(matFile);
const matSheet = matWb.Sheets[matWb.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(matSheet, { header: 1 });

console.log('Total raw rows in Excel:', rawRows.length);
// Find header row
for (let i = 0; i < Math.min(10, rawRows.length); i++) {
  console.log(`Row ${i}:`, rawRows[i]);
}
