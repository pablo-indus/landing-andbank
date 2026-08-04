const fs = require('fs');
let code = fs.readFileSync('src/components/SectionDrawdown.tsx', 'utf8');

code = code.replace(
  `return { d: pt.d, val: dd };`,
  `return { d: pt.d, dd: dd } as any;` // cast as any because points was typed {d, val}
);

code = code.replace(
  `if (isBenchmark) {
        return points.map((p, i) => ({ d: p.d, val: p.val * 1.1 + Math.sin(i / 10) * 0.5 }));
      }`,
  ``
);

fs.writeFileSync('src/components/SectionDrawdown.tsx', code);
