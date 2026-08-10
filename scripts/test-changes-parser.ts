/**
 * Prueba del parser de cambios contra el archivo real.
 * Uso: node scripts/test-changes-parser.ts "<ruta Plantilla Pagina Cambios.xlsx>"
 */
import { readFileSync } from 'node:fs';
import { processChangesExcel, sheetNameToPeriod } from '../src/utils/changesProcessor.ts';

const path = process.argv[2];
const file = new File([readFileSync(path)], 'Plantilla Pagina Cambios.xlsx');

const result = await processChangesExcel(file as any);

const periods = Object.keys(result);
console.log(`periodos detectados: ${periods.length}\n`);

let totalBatches = 0;
let totalMovements = 0;
let batchesWithoutRationale = 0;
let oneSidedBatches = 0;

for (const period of periods) {
  const block = result[period];
  totalBatches += block.batches.length;
  for (const b of block.batches) {
    totalMovements += b.entries.length + b.exits.length;
    if (!b.rationale) batchesWithoutRationale++;
    // Cada decision deberia tener al menos una salida y una entrada:
    // lo que se vende se recoloca.
    if (b.entries.length === 0 || b.exits.length === 0) oneSidedBatches++;
  }
}

console.log(`decisiones (batches): ${totalBatches}`);
console.log(`movimientos totales : ${totalMovements}`);
console.log(`sin racional        : ${batchesWithoutRationale}`);
console.log(`solo entradas o solo salidas: ${oneSidedBatches}`);

console.log('\nperiodos (orden del archivo):');
console.log('  ' + periods.join(', '));

const sample = result[periods[periods.length - 1]];
console.log(`\n--- ejemplo: ${sample.period} (${sample.batches.length} decisiones) ---`);
for (const b of sample.batches.slice(0, 2)) {
  console.log('  SALIDAS :', b.exits.map((m) => `${m.type} ${m.instrument} [${m.tag}]`).join(' | ') || '(ninguna)');
  console.log('  ENTRADAS:', b.entries.map((m) => `${m.type} ${m.instrument} [${m.tag}]`).join(' | ') || '(ninguna)');
  console.log('  PERFILES:', b.exits[0]?.meta ?? b.entries[0]?.meta);
  console.log('  RACIONAL:', (b.rationale || '(vacio)').slice(0, 100) + '...');
  console.log('');
}

console.log('--- comprobacion de nombres de pestana ---');
for (const name of ['Nov 2021', 'Sept 2023', 'Ene 2022', 'Mayo 2026', 'May 2024 (2)', 'Dic 2023']) {
  console.log(`  "${name}" -> ${sheetNameToPeriod(name)}`);
}
