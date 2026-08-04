const fs = require('fs');
let text = fs.readFileSync('./src/data/generatedData.ts', 'utf8');
text = text.replace('export const generatedData = ', '');
text = text.slice(0, text.lastIndexOf(';'));
const data = JSON.parse(text);

for (const snap of data.creditLevelSnapshots) {
    let valid = snap.funds.filter(fund => fund.ytw !== 0 || fund.duration !== 0 || fund.pctIG !== 0 || fund.pctHY !== 0 || (fund.rating && fund.rating !== '-'));
    console.log(snap.label, snap.funds.length, valid.length);
}
