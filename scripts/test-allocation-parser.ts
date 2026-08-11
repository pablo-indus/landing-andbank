/**
 * Comprueba el parser de asset allocation y composicion contra el libro AA.
 *
 * Uso: node scripts/test-allocation-parser.ts "<AA GDC 5 - ACTUAL.xlsx>"
 *
 * Compara ademas la composicion recien parseada con la que hay en
 * src/data/generatedData.json, que venia del pipeline antiguo. No para dar por
 * buena una u otra, sino para ver donde difieren: coincidir en el numero de
 * snapshots no demuestra nada si los pesos estan cambiados.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseAssetAllocation, parseComposition } from '../src/utils/allocationProcessor.ts';

const path = process.argv[2];
if (!path) {
  console.error('Falta la ruta del libro AA.');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

// ------------------------------------------------------------ asset allocation
const aa = parseAssetAllocation(wb, '2026-06', 'Junio 2026');
console.log('=============== ASSET ALLOCATION ===============');
console.log('fila'.padEnd(26) + PROFILES.map((p) => p.slice(0, 8).padStart(9)).join(''));
for (const row of aa.rows) {
  if (!row.values.length) {
    console.log(`\n  [${row.label}]`);
    continue;
  }
  const cells = row.values.map((v) => (v === null ? '-' : typeof v === 'number' ? v.toFixed(2) : v).padStart(9)).join('');
  console.log('  ' + row.label.padEnd(24) + cells);
}

// Las columnas de reparto tienen que sumar 100 donde el perfil tenga cartera.
console.log('\nsumas de control (deben dar 100 o 0):');
const sumOf = (labels: string[]) =>
  PROFILES.map((_, i) =>
    labels.reduce((acc, l) => {
      const v = aa.rows.find((r) => r.label === l)?.values[i];
      return acc + (typeof v === 'number' ? v : 0);
    }, 0)
  );
const checks: [string, string[]][] = [
  ['activos', ['Monetario', 'Renta Fija', 'Renta Variable', 'Alternativos']],
  ['geografia', ['RV Europa', 'RV US', 'RV Global', 'RV Temática', 'RV EM', 'RV Japón']],
  ['divisa', ['EUR', 'USD', 'GBP', 'JPY']],
  ['USD dir+indir', ['USD - directo', 'USD - indirecto']],
];
let issues = 0;
for (const [name, labels] of checks) {
  const sums = sumOf(labels);
  const usd = name === 'USD dir+indir';
  const ok = sums.map((s, i) => {
    if (usd) {
      const total = aa.rows.find((r) => r.label === 'USD')?.values[i];
      return Math.abs(s - (typeof total === 'number' ? total : 0)) < 0.05;
    }
    return Math.abs(s - 100) < 0.1 || Math.abs(s) < 0.1;
  });
  if (ok.some((o) => !o)) issues++;
  console.log(`  ${name.padEnd(16)}${sums.map((s) => s.toFixed(2).padStart(9)).join('')}   ${ok.every((o) => o) ? 'ok' : '*** REVISAR ***'}`);
}

// --------------------------------------------------------------- composition
const comp = parseComposition(wb);
console.log('\n=============== COMPOSICION ===============');
console.log(`snapshots: ${comp.length}   de ${comp[comp.length - 1].period} a ${comp[0].period}`);
const last = comp[0];
console.log(`ultimo (${last.label}): ${last.categories.length} categorias, ${last.categories.reduce((a, c) => a + c.items.length, 0)} fondos`);
for (const cat of last.categories) {
  const sums = PROFILES.map((_, i) => cat.items.reduce((a, it) => a + (it.values[i] ?? 0), 0));
  console.log('  ' + cat.cat.slice(0, 30).padEnd(32) + sums.map((s) => s.toFixed(2).padStart(8)).join(''));
}
const totals = PROFILES.map((_, i) =>
  last.categories.reduce((a, c) => a + c.items.reduce((b, it) => b + (it.values[i] ?? 0), 0), 0)
);
console.log('  ' + 'TOTAL'.padEnd(32) + totals.map((s) => s.toFixed(2).padStart(8)).join(''));
totals.forEach((t, i) => {
  if (Math.abs(t - 100) > 0.5 && Math.abs(t) > 0.5) {
    issues++;
    console.log(`  *** ${PROFILES[i]} suma ${t.toFixed(2)}, no 100 ***`);
  }
});

// --------------------------------------------- contraste con el pipeline viejo
const old = JSON.parse(readFileSync('src/data/generatedData.json', 'utf8')).compositionSnapshots ?? [];
console.log(`\n--- contraste con generatedData.json (${old.length} snapshots) ---`);
const oldByPeriod = new Map(old.map((s: any) => [s.period, s]));
let compared = 0;
let diffs = 0;
for (const snap of comp) {
  const prev: any = oldByPeriod.get(snap.period);
  if (!prev) {
    console.log(`  ${snap.period}: no estaba en el historico antiguo`);
    continue;
  }
  const flat = (s: any) => {
    const m = new Map<string, (number | null)[]>();
    for (const c of s.categories) for (const it of c.items) m.set(String(it.isin).toUpperCase(), it.values);
    return m;
  };
  const a = flat(snap);
  const b = flat(prev);
  let cellDiffs = 0;
  for (const [isin, va] of a) {
    const vb = b.get(isin);
    if (!vb) continue;
    for (let i = 0; i < 6; i++) {
      const x = va[i] ?? 0;
      const y = vb[i] ?? 0;
      if (Math.abs(x - y) > 0.011) cellDiffs++;
    }
  }
  compared++;
  if (cellDiffs) {
    diffs++;
    console.log(`  ${snap.period}: ${cellDiffs} celdas distintas sobre ${a.size} fondos`);
  }
}
console.log(`  ${compared} periodos comparados, ${diffs} con diferencias`);

console.log('\n====================================================');
console.log(issues === 0 ? 'Sumas de control correctas.' : `${issues} comprobaciones a revisar.`);
process.exit(issues === 0 ? 0 : 1);
