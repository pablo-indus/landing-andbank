const fs = require('fs');

const code = fs.readFileSync('src/data/portfolioData.ts', 'utf8');
const vlMatch = code.match(/export const HISTORICAL_VL = (.*?);/s);
// Actually, it might be in another file. Let's look for vlData.
