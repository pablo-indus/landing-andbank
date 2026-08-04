const fs = require('fs');
let text = fs.readFileSync('./src/data/generatedData.ts', 'utf8');
text = text.replace('export const generatedData = ', '');
text = text.slice(0, text.lastIndexOf(';'));
const data = JSON.parse(text);

for (const snap of data.creditLevelSnapshots) {
    if (snap.label === 'ANÁLISIS 25-06 (2026)') {
        console.log(snap.funds[0]);
        break;
    }
}
