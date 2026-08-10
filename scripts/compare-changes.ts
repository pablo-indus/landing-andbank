/**
 * Compara lo que produce el parser determinista con lo que hay ahora en
 * Firestore (que se genero con IA), usando la copia de seguridad mas reciente.
 *
 * Uso: node scripts/compare-changes.ts "<ruta xlsx>" "<ruta backup.json>"
 */
import { readFileSync } from 'node:fs';
import { processChangesExcel } from '../src/utils/changesProcessor.ts';

const [, , xlsxPath, backupPath] = process.argv;

const parsed = await processChangesExcel(
  new File([readFileSync(xlsxPath)], 'cambios.xlsx') as any
);
const backup = JSON.parse(readFileSync(backupPath, 'utf8'));

// Lo que hay hoy en la base de datos, por periodo.
const current: Record<string, any[]> = {};
for (const [docId, doc] of Object.entries<any>(backup)) {
  for (const block of doc.historicalChanges ?? []) {
    const period = block.period ?? docId;
    (current[period] ??= []).push(...(block.batches ?? []));
  }
}

const countMovements = (batches: any[]) =>
  batches.reduce((n, b) => n + (b.entries?.length ?? 0) + (b.exits?.length ?? 0), 0);

const periods = [...new Set([...Object.keys(parsed), ...Object.keys(current)])].sort();

let onlyNew = 0;
let onlyOld = 0;
const diffs: string[] = [];

console.log('periodo            IA(dec/mov)   parser(dec/mov)');
for (const p of periods) {
  const oldBatches = current[p] ?? [];
  const newBatches = parsed[p]?.batches ?? [];
  const o = `${oldBatches.length}/${countMovements(oldBatches)}`;
  const n = `${newBatches.length}/${countMovements(newBatches)}`;
  if (!current[p]) onlyNew++;
  if (!parsed[p]) onlyOld++;
  const flag = o !== n ? '   <-- distinto' : '';
  if (o !== n) diffs.push(p);
  console.log('  ' + p.padEnd(18) + o.padEnd(14) + n.padEnd(12) + flag);
}

console.log('');
console.log(`periodos solo en el parser : ${onlyNew}`);
console.log(`periodos solo en la IA     : ${onlyOld}`);
console.log(`periodos con cifras distintas: ${diffs.length} de ${periods.length}`);

const totalOld = Object.values(current).reduce((n, b) => n + countMovements(b), 0);
const totalNew = Object.values(parsed).reduce((n, b) => n + countMovements(b.batches), 0);
console.log(`\nmovimientos totales  IA: ${totalOld}   parser: ${totalNew}`);
