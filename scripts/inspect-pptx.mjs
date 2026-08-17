import fs from 'fs';
import zlib from 'zlib';

const file = process.argv[2];
const buf = fs.readFileSync(file);

// Lee las entradas por sus cabeceras locales (PK\x03\x04).
const entries = new Map();
let i = 0;
while ((i = buf.indexOf('PK\x03\x04', i, 'latin1')) !== -1) {
  const method = buf.readUInt16LE(i + 8);
  const compSize = buf.readUInt32LE(i + 18);
  const nameLen = buf.readUInt16LE(i + 26);
  const extraLen = buf.readUInt16LE(i + 28);
  const name = buf.slice(i + 30, i + 30 + nameLen).toString();
  const start = i + 30 + nameLen + extraLen;
  if (compSize > 0) {
    const raw = buf.slice(start, start + compSize);
    try {
      entries.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
    } catch { /* descriptor de datos: se salta */ }
  }
  i = start + compSize;
}

const slides = [...entries.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
const charts = [...entries.keys()].filter(n => /^ppt\/charts\/chart\d+\.xml$/.test(n));
let tables = 0;
for (const s of slides) tables += (entries.get(s).toString().match(/<a:tbl>/g) ?? []).length;

console.log('firma', buf.slice(0, 2).toString(), '| tam', (buf.length / 1024).toFixed(0), 'KiB');
console.log('diapositivas', slides.length, '| graficos nativos', charts.length, '| tablas nativas', tables);

if (process.argv[3]) {
  const xml = entries.get(process.argv[3])?.toString() ?? '(no existe)';
  console.log(xml.slice(0, Number(process.argv[4] ?? 3000)));
}

// Titulo aproximado de cada diapositiva: los dos primeros textos que no sean la
// cabecera de marca.
if (process.env.TITLES) {
  const num = (n) => Number(n.match(/slide(\d+)\.xml/)[1]);
  for (const s of slides.sort((a, b) => num(a) - num(b))) {
    const texts = [...entries.get(s).toString().matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1])
      .filter(t => t && !t.startsWith('ANDBANK ·') && !t.startsWith('Consulta Histórica ·'));
    console.log(String(num(s)).padStart(2), '|', texts.slice(0, 3).join(' / ').slice(0, 90));
  }
}

// Nada puede salirse de la diapositiva (10 x 5,625 pulgadas).
{
  const EMU = 914400, Wm = 10 * EMU, Hm = 5.625 * EMU;
  let bad = 0;
  const num = (n) => Number(n.match(/slide(\d+)\.xml/)[1]);
  for (const s of slides.sort((a, b) => num(a) - num(b))) {
    const xml = entries.get(s).toString();
    for (const m of xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
      const [x, y, cx, cy] = m.slice(1).map(Number);
      if (x < -1000 || y < -1000 || x + cx > Wm + 1000 || y + cy > Hm + 1000) {
        bad++;
        console.log(`  desbordado en slide${num(s)}: x=${(x/EMU).toFixed(2)} y=${(y/EMU).toFixed(2)} w=${(cx/EMU).toFixed(2)} h=${(cy/EMU).toFixed(2)}`);
      }
    }
  }
  console.log(bad === 0 ? 'todo dentro de la diapositiva' : `${bad} objeto(s) fuera`);
}
