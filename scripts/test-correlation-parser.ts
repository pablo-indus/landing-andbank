/**
 * Comprueba el parser de correlaciones contra el export de Morningstar.
 *
 * Uso: node scripts/test-correlation-parser.ts "<CorrelacionesGestionadas.xlsx>"
 *
 * Ademas de leer el archivo comprueba tres cosas que no se ven mirando la
 * pantalla:
 *
 *   - que cada matriz sea cuadrada, simetrica y con unos en la diagonal;
 *   - que ningun valor se salga de [-1, 1];
 *   - que el reparto hoja -> perfil sea el correcto, comparando con
 *     src/data/corrData.ts. No para dar por bueno el estatico —es mas antiguo y
 *     las carteras han cambiado— sino porque si dos perfiles estuvieran
 *     intercambiados, las listas de fondos no se pareceran a las de antes.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { processCorrelationWorkbook } from '../src/utils/correlationProcessor.ts';
import { FUND_CORR } from '../src/data/corrData.ts';

const path = process.argv[2];
if (!path) {
  console.error('Falta la ruta del archivo de correlaciones.');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
const { profiles, summary, orderWarning } = processCorrelationWorkbook(wb);

let problems = 0;

console.log('=============== HOJAS ===============');
for (const row of summary) {
  console.log(`  ${row.profile.padEnd(14)} ${String(row.funds).padStart(3)} fondos | 1. ${row.first}`);
}
if (orderWarning) {
  console.log(`\n  ${orderWarning}`);
  problems++;
}

console.log('\n=============== FORMA ===============');
for (const [profile, { labels, matrix }] of Object.entries(profiles)) {
  const n = labels.length;
  const issues: string[] = [];

  if (matrix.length !== n || matrix.some((r) => r.length !== n)) issues.push('no es cuadrada');
  for (let i = 0; i < n; i++) {
    if (matrix[i][i] !== 1) issues.push(`diagonal ${i} = ${matrix[i][i]}`);
    for (let j = 0; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-12) issues.push(`asimetrica en ${i},${j}`);
      if (matrix[i][j] < -1 || matrix[i][j] > 1) issues.push(`fuera de rango en ${i},${j}: ${matrix[i][j]}`);
    }
  }

  const values = matrix.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);
  console.log(
    `  ${profile.padEnd(14)} ${String(n).padStart(3)}x${n} | rango [${min.toFixed(2)}, ${max.toFixed(2)}]` +
      (issues.length ? ` | ${issues.slice(0, 3).join('; ')}` : ' | ok')
  );
  problems += issues.length;
}

console.log('\n=============== CONTRA EL ESTATICO ===============');
console.log('  (el estatico es de una cartera anterior: se compara el solape de nombres)');
for (const [profile, { labels }] of Object.entries(profiles)) {
  const old = (FUND_CORR as Record<string, { labels: string[] }>)[profile];
  if (!old) {
    console.log(`  ${profile.padEnd(14)} no estaba en corrData.ts`);
    continue;
  }
  // Los nombres largos de Morningstar cambian de sufijo entre exports
  // ("SIH Renta Fija C FI" vs "Sigma Investment House Renta Fija C FI"), asi que
  // se comparan las primeras palabras y no la cadena entera.
  const key = (s: string) => s.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
  const oldKeys = new Set(old.labels.map(key));
  const shared = labels.filter((l) => oldKeys.has(key(l))).length;
  const pct = Math.round((shared / Math.max(labels.length, old.labels.length)) * 100);
  const flag = pct < 40 ? '  <-- revisar, casi no coinciden' : '';
  console.log(
    `  ${profile.padEnd(14)} ${shared} de ${labels.length} fondos coinciden con los ${old.labels.length} de antes (${pct}%)${flag}`
  );
  if (pct < 40) problems++;
}

console.log(`\n${problems} problema(s).`);
process.exit(problems === 0 ? 0 : 1);
