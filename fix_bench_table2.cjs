const fs = require('fs');
let content = fs.readFileSync('src/components/SectionRendimiento.tsx', 'utf8');

// The main table had its body replaced incorrectly, let's restore it from a backup if possible, or rewrite it.
// Let's first check what the main table was.
