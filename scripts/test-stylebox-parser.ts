/**
 * Comprueba el parser del Style Box contra el archivo de Morningstar.
 *
 * Uso: node scripts/test-stylebox-parser.ts "<Datos_Box_1_Year.xlsx>"
 *
 * Compara celda a celda con src/data/styleBoxData.ts, que son las cifras que
 * habia escritas a mano. Comparar solo el numero de fechas no demuestra nada:
 * las dos columnas de cada perfil son intercambiables a simple vista y darlas
 * la vuelta moveria cada punto a su reflejo sin que nada fallara.
 *
 * Sale con codigo distinto de cero si algo no cuadra.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { processStyleBoxWorkbook } from '../src/utils/styleBoxProcessor.ts';
import { STYLE_BOX_DATA } from '../src/data/styleBoxData.ts';

const path = process.argv[2];
if (!path) {
  console.error('Falta la ruta del archivo de Style Box.');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
const { entries, asOf } = processStyleBoxWorkbook(wb);

console.log(`Fechas leidas: ${entries.length} (la mas reciente, ${asOf})`);
console.log(`Perfiles por fecha: ${Object.keys(entries[0].scores).join(', ')}\n`);

const oldByDate = new Map(STYLE_BOX_DATA.map((d) => [d.date, d.scores as Record<string, number[]>]));
let compared = 0;
let mismatches = 0;

for (const entry of entries) {
  const old = oldByDate.get(entry.date);
  if (!old) {
    console.log(`  fecha nueva, no estaba en el estatico: ${entry.date}`);
    continue;
  }
  for (const [profile, [size, style]] of Object.entries(entry.scores)) {
    const previous = old[profile];
    if (!previous) {
      console.log(`  ${entry.date} ${profile}: no estaba en el estatico`);
      mismatches++;
      continue;
    }
    // El estatico venia redondeado a un decimal.
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.05;
    compared++;
    if (!near(size, previous[0]) || !near(style, previous[1])) {
      mismatches++;
      console.log(
        `  ${entry.date} ${profile}: excel [${size.toFixed(1)}, ${style.toFixed(1)}] ` +
          `vs estatico [${previous[0]}, ${previous[1]}]`
      );
    }
  }
}

const missing = STYLE_BOX_DATA.filter((d) => !entries.some((e) => e.date === d.date));
if (missing.length) {
  console.log(`\nFechas del estatico que el archivo ya no trae: ${missing.map((d) => d.date).join(', ')}`);
}

console.log(`\n${compared} pares comparados, ${mismatches} discrepancias.`);
process.exit(mismatches === 0 ? 0 : 1);
