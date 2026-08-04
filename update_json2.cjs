const fs = require('fs');
const xlsx = require('xlsx');

const dbPath = 'ANDBANK_Normalized_DB.xlsx';
const jsonPath = 'src/data/generatedData.json';

const wb = xlsx.readFile(dbPath);
const sheet = wb.Sheets['Niveles_Master'];
const rows = xlsx.utils.sheet_to_json(sheet);

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const excelData = {};
for (const row of rows) {
    if (!row.Periodo_Sheet) continue;
    const p = row.Periodo_Sheet.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    if (!excelData[p]) excelData[p] = {};
    
    const fundName = row['GDC_1'] || row['FONDO'] || row['Instrumento'] || row['Blank_1'];
    const isin = row['ISIN'];
    if (!isin || !fundName) continue;
    
    excelData[p][isin] = {
        govies: row['%GOVIES'] !== undefined ? row['%GOVIES'] : row['%Govies'],
        credito: row['%CRÉDITO'] !== undefined ? row['%CRÉDITO'] : (row['%Crédito'] !== undefined ? row['%Crédito'] : row['%CREDITO']),
        cash: row['%CASH'] !== undefined ? row['%CASH'] : row['%Cash'],
        otros: row['%OTROS'] !== undefined ? row['%OTROS'] : row['%Otros'],
        vola3y: row['VOLA 3y'] !== undefined ? row['VOLA 3y'] : row['Vola 3y']
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
                
                const parseVal = (val, mult) => {
                    if (val === undefined || val === null || val === '') return null;
                    const parsed = parseFloat(val);
                    if (isNaN(parsed)) return null;
                    return parsed * mult;
                };

                fund.govies = parseVal(ex.govies, 100);
                fund.credito = parseVal(ex.credito, 100);
                fund.cash = parseVal(ex.cash, 100);
                fund.otros = parseVal(ex.otros, 100);
                fund.vola3y = parseVal(ex.vola3y, 100);
                count++;
            }
        }
    }
}

console.log(`Updated ${count} funds in JSON`);
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

const tsData = `export const generatedData = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync('src/data/generatedData.ts', tsData);

