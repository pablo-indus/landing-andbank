const fs = require('fs');
let code = fs.readFileSync('server/upload.ts', 'utf8');
code = code.replace('let parsedData = {};', 'let parsedData: any = {};');
fs.writeFileSync('server/upload.ts', code);
