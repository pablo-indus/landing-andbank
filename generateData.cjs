const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('ANDBANK_Normalized_DB.xlsx');

const parseNiveles = (sheet) => {
    const rows = xlsx.utils.sheet_to_json(sheet);
    const snapshotsMap = {};
    for (const row of rows) {
        if (!row.Periodo_Sheet) continue;
        const periodName = row.Periodo_Sheet.trim();
        const fundName = row['GDC_1'] || row['FONDO'] || row['Instrumento'] || row['Blank_1']; // Checking exactly what the fund name column is. Let's see the keys above: GDC_1
        const isin = row['ISIN'];
        if (!isin || !fundName) continue;
        
        let rating = row['RATING'] || row['Rating'] || '-';
        let ytw = row['YIELD (YTW)'] || row['YIELD (YTW'] || row['YIELD'] || 0;
        let duration = row['DURACIÓN'] || row['DURACIÓN '] || 0;
        let pctIG = row['%IG'] || row['%IG '] || row['%IG\r\n'] || 0;
        let pctHY = row['%HY'] || row['%HY '] || row['%HY\r\n'] || 0;
        
        if (!snapshotsMap[periodName]) {
            snapshotsMap[periodName] = {
                period: periodName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                label: periodName,
                funds: []
            };
        }
        snapshotsMap[periodName].funds.push({
            name: fundName.toString().trim(),
            isin: isin.toString().trim(),
            rating: rating.toString().trim(),
            ytw: parseFloat(ytw) * 100 || 0,
            duration: parseFloat(duration) || 0,
            pctIG: parseFloat(pctIG) * 100 || 0,
            pctHY: parseFloat(pctHY) * 100 || 0
        });
    }
    return Object.values(snapshotsMap);
};

const parseCambios = (sheet) => {
    const rows = xlsx.utils.sheet_to_json(sheet);
    const snapshotsMap = {};
    for (const row of rows) {
        if (!row.Periodo_Sheet) continue;
        const periodName = row.Periodo_Sheet.trim();
        if (!snapshotsMap[periodName]) {
            snapshotsMap[periodName] = {
                period: periodName,
                batches: []
            };
        }
        
        const op = row['Operación'];
        const isExit = op === 'Venta' || op === 'Disminuye' || op === 'Cierre';
        const isEntry = op === 'Compra' || op === 'Aumenta' || op === 'Apertura' || op === 'Incrementa' || op === 'Incremento';
        
        const m = {
            type: op ? op.toLowerCase() : 'compra',
            tag: row['Asset Class'] || row['Cartera'] || 'General',
            instrument: row['Instrumento'] || '',
            meta: row['Cartera'] || ''
        };
        
        let addedToBatch = false;
        if (row['Racional']) {
            snapshotsMap[periodName].batches.push({
                rationale: row['Racional'],
                entries: isEntry ? [m] : [],
                exits: isExit ? [m] : []
            });
            addedToBatch = true;
        } else {
            if (snapshotsMap[periodName].batches.length > 0) {
                const lastBatch = snapshotsMap[periodName].batches[snapshotsMap[periodName].batches.length - 1];
                if (isEntry) lastBatch.entries.push(m);
                if (isExit) lastBatch.exits.push(m);
                addedToBatch = true;
            }
        }
        
        if (!addedToBatch) {
            snapshotsMap[periodName].batches.push({
                rationale: '',
                entries: isEntry ? [m] : [],
                exits: isExit ? [m] : []
            });
        }
    }
    return Object.values(snapshotsMap);
};

const parseContribuidores = (sheet) => {
    const rows = xlsx.utils.sheet_to_json(sheet);
    const snapshotsMap = {};
    for (const row of rows) {
        if (!row.Periodo || !row.Perfil) continue;
        const period = row.Periodo.trim(); // YTD or MES, etc. Actually we want to group by Month. Let's assume the excel is for one month. Wait, the prompt says "Original File: LEADING CONTRIBUTORS - DETRACTORS - Junio PBO.xlsx". Is it only June? The prompt says "Normalized Structure: A strict 6-column tabular ledger. The table now uses explicit tags: Perfil... Periodo (YTD or MES), and Tipo".
        // To properly map to MonthlyAttribution:
        // We will just create one for "Junio 2026" as an example if month is not in table, or maybe period is the month.
        // Let's print out Contribuidores rows to see exactly what we have.
    }
    return [];
};

console.log("Writing debug data to see exactly how to parse them.");
