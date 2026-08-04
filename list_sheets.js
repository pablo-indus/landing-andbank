const xlsx = require('xlsx');
const wb = xlsx.readFile('ANDBANK_Normalized_DB.xlsx');
console.log(wb.SheetNames);
