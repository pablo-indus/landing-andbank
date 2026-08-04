const fs = require('fs');

let drawdown = fs.readFileSync('src/components/SectionDrawdown.tsx', 'utf8');

drawdown = drawdown.replace(
  `const dd = maxSoFar === 0 ? 0 : (pt.val / maxSoFar - 1) * 100;`,
  `const dd = maxSoFar === 0 ? 0 : (val / maxSoFar - 1) * 100;`
);

fs.writeFileSync('src/components/SectionDrawdown.tsx', drawdown);
