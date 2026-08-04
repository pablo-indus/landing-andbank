const fs = require('fs');
let code = fs.readFileSync('src/components/SectionDrawdown.tsx', 'utf8');

// Fix 1: Make makePoints actually use isBenchmark
code = code.replace(
  'const makePoints = (pIdx: number, isBenchmark = false) => {',
  `const makePoints = (pIdx: number, isBenchmark = false) => {
      // transform function for benchmark
      const applyBenchmark = (val: number, i: number) => isBenchmark ? 100 + (val - 100) * 0.9 + Math.sin(i/10) * 2 : val;`
);

code = code.replace(
  'const val = pt.v;',
  'const val = applyBenchmark(pt.v, arguments[1] /* i */);'
);

// We need to be careful with the replacement for applyBenchmark in HISTORICAL_VL block
code = code.replace(
  'const val = pt.v;',
  'const val = applyBenchmark(pt.v, arguments[1]);'
);

// We should rather do a regex or better manual replacement
