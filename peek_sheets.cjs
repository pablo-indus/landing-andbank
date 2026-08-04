const xlsx = require('xlsx');
const wb = xlsx.readFile('ANDBANK_Normalized_DB.xlsx');
for (const name of wb.SheetNames) {
    console.log("Sheet:", name);
    const sheet = wb.Sheets[name];
    console.log(xlsx.utils.sheet_to_json(sheet).slice(0, 3));
}
