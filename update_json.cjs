const fs = require('fs');
const xlsx = require('xlsx');

const dbPath = 'ANDBANK_Normalized_DB.xlsx';
const jsonPath = 'src/data/generatedData.json';

const wb = xlsx.readFile(dbPath);
const sheet = wb.Sheets['Niveles_Master'];
const rows = xlsx.utils.sheet_to_json(sheet);

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Now we need to update data.creditLevelSnapshots
// The format is: data.creditLevelSnapshots[].funds[]
// We need to match by period and fund isin/name, or just re-parse the whole thing?
// Wait, the periods in json are like "an_lisis_25_06_2026", while in excel they are "ANÁLISIS 25-06 (2026)".
// Let's just create a map from the Excel file:

const excelData = {};
for (const row of rows) {
    if (!row.Periodo_Sheet) continue;
    const p = row.Periodo_Sheet.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    if (!excelData[p]) excelData[p] = {};
    
    const fundName = row['GDC_1'] || row['FONDO'] || row['Instrumento'] || row['Blank_1'];
    const isin = row['ISIN'];
    if (!isin || !fundName) continue;
    
    excelData[p][isin] = {
        govies: row['%GOVIES'] || row['%Govies'] || 0,
        credito: row['%CRÉDITO'] || row['%Crédito'] || row['%CREDITO'] || 0,
        cash: row['%CASH'] || row['%Cash'] || 0,
        otros: row['%OTROS'] || row['%Otros'] || 0,
        vola3y: row['VOLA 3y'] || row['Vola 3y'] || 0
    };
}

let count = 0;
for (const snap of data.creditLevelSnapshots) {
    const p = snap.period;
    if (excelData[p]) {
        for (const fund of snap.funds) {
            const isin = fund.isin;
            if (excelData[p][isin]) {
                const ex = excelData[p][isin];
                fund.govies = parseFloat(ex.govies) * 100 || 0;
                fund.credito = parseFloat(ex.credito) * 100 || 0;
                fund.cash = parseFloat(ex.cash) * 100 || 0;
                fund.otros = parseFloat(ex.otros) * 100 || 0;
                fund.vola3y = parseFloat(ex.vola3y) * 100 || 0;
                count++;
            }
        }
    }
}

console.log(`Updated ${count} funds in JSON`);
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

// Update generatedData.ts
const tsData = `export const generatedData = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync('src/data/generatedData.ts', tsData);

