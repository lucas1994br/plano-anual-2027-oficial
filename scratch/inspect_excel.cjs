const XLSX = require('xlsx');
const path = require('path');

const matFile = path.resolve('src/data/planilhas/PLANILHA DOS MATERIAIS.xlsx');
const serFile = path.resolve('src/data/planilhas/SERVICOS EXISTENTES .xlsx');

const matWb = XLSX.readFile(matFile);
console.log('Materiais sheet names:', matWb.SheetNames);
const matSheet = matWb.Sheets[matWb.SheetNames[0]];
const matData = XLSX.utils.sheet_to_json(matSheet);
console.log('Materiais total rows:', matData.length);
if (matData.length > 0) {
  console.log('Materiais sample 1:', matData[0]);
}

const serWb = XLSX.readFile(serFile);
console.log('\nServicos sheet names:', serWb.SheetNames);
const serSheet = serWb.Sheets[serWb.SheetNames[0]];
const serData = XLSX.utils.sheet_to_json(serSheet);
console.log('Servicos total rows:', serData.length);
if (serData.length > 0) {
  console.log('Servicos sample 1:', serData[0]);
}
