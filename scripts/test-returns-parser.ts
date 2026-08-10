/**
 * Prueba del parser de rentabilidades contra el libro AA GDC.
 * Uso: node scripts/test-returns-parser.ts "<ruta AA GDC ....xlsx>"
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { processReturnsExcel } from '../src/utils/returnsProcessor.ts';

const path = process.argv[2];
const data = await processReturnsExcel(new File([readFileSync(path)], basename(path)) as any);

console.log('perfiles con datos :', data.profiles.join(', '));
console.log('perfiles SIN datos :', data.missingProfiles.join(', ') || '(ninguno)');
console.log('');
console.log(`anual      : ${data.annual.length} periodos  (${data.annual[0]?.period} -> ${data.annual.at(-1)?.period})`);
console.log(`mensual    : ${data.monthly.length} periodos  (${data.monthly[0]?.period} -> ${data.monthly.at(-1)?.period})`);
console.log(`volatilidad: ${data.volatility.length} periodos  (${data.volatility[0]?.period} -> ${data.volatility.at(-1)?.period})`);

console.log('\n--- rentabilidad anual (ultimos 6 años) ---');
console.log('año     ' + data.profiles.map((p) => p.padStart(13)).join(''));
for (const row of data.annual.slice(-6)) {
  console.log(
    row.period.padEnd(8) +
      data.profiles.map((p) => (row.byProfile[p] !== undefined ? `${row.byProfile[p].toFixed(2)}%` : '-').padStart(13)).join('')
  );
}

// VALIDACION CLAVE: componer 2023+2024+2025 debe reproducir la
// "Rentabilidad neta esperada" de la hoja COMISIONES@CONTRATOS.
const ESPERADO_NETO_3A: Record<string, number> = {
  Conservador: 13.92,
  Moderado: 17.68,
  Equilibrado: 21.60,
  Agresivo: 25.57,
};

console.log('\n--- validacion: 2023-2025 compuesto vs "neta esperada" de COMISIONES ---');
let allOk = true;
for (const profile of Object.keys(ESPERADO_NETO_3A)) {
  const factor = ['2023', '2024', '2025'].reduce((acc, year) => {
    const v = data.annual.find((r) => r.period === year)?.byProfile[profile];
    return v === undefined ? acc : acc * (1 + v / 100);
  }, 1);
  const computed = (factor - 1) * 100;
  const expected = ESPERADO_NETO_3A[profile];
  const diff = Math.abs(computed - expected);
  const ok = diff < 0.1;
  if (!ok) allOk = false;
  console.log(
    `  ${profile.padEnd(13)} calculado ${computed.toFixed(2).padStart(6)}%   esperado ${expected.toFixed(2).padStart(6)}%   dif ${diff.toFixed(3)}  ${ok ? 'OK' : 'DESVIACION'}`
  );
}
console.log(allOk ? '\n=> Confirmado: son cifras NETAS de comisiones.' : '\n=> No cuadra: revisar.');

console.log('\n--- volatilidad, ultimo periodo disponible ---');
const lastVol = data.volatility.at(-1);
if (lastVol) {
  console.log('  ' + lastVol.period);
  for (const [p, v] of Object.entries(lastVol.byProfile)) console.log(`    ${p.padEnd(13)} ${v.toFixed(2)}%`);
}

console.log('\n--- comprobacion de 2020 (el dato que la tabla inventada falseaba) ---');
const y2020 = data.annual.find((r) => r.period === '2020');
console.log('  real   :', JSON.stringify(y2020?.byProfile));
console.log('  inventado antes: Conservador +2.40%, Moderado +4.80%, Equilibrado +8.40%, Agresivo +12.00%');

console.log('\n--- hoja "rentabilidades": KPIs ---');
if (data.kpis) {
  console.log('  columnas:', data.kpis.columns.join(' | '));
  for (const [p, v] of Object.entries(data.kpis.rows)) {
    console.log('  ' + p.padEnd(15) + data.kpis.columns.map((c) => (v[c] === null ? '-' : v[c]!.toFixed(2) + '%').padStart(10)).join(''));
  }
} else console.log('  (no encontrada)');

console.log('\n--- hoja "rentabilidades": ventanas anualizadas ---');
if (data.windows) {
  console.log('  columnas:', data.windows.columns.join(' | '));
  for (const [p, v] of Object.entries(data.windows.rows)) {
    console.log('  ' + p.padEnd(15) + data.windows.columns.map((c) => (v[c] === null ? '-' : v[c]!.toFixed(2)).padStart(9)).join(''));
  }
} else console.log('  (no encontrada)');

console.log('\n--- contraste con los KPIs escritos a mano en la web ---');
const WEB: Record<string, { p2025: number; p2026: number; vol: number }> = {
  'Conservador +': { p2025: 2.8, p2026: 1.5, vol: 1.7 },
  Conservador: { p2025: 4.2, p2026: 2.3, vol: 2.3 },
  Moderado: { p2025: 6.7, p2026: 4.5, vol: 4.7 },
  Equilibrado: { p2025: 9.4, p2026: 5.8, vol: 6.3 },
  Agresivo: { p2025: 11.9, p2026: 7.8, vol: 7.2 },
  'Agresivo +': { p2025: 15.1, p2026: 10.7, vol: 9.7 },
};
const col = (needle: string) => data.kpis?.columns.find((c) => c.toLowerCase().includes(needle));
const c2025 = col('2025'), c2026 = data.kpis?.columns.find((c) => c.trim() === '2026'), cVol = col('volat');
for (const [p, w] of Object.entries(WEB)) {
  const row = data.kpis?.rows[p];
  const f = (a?: number | null, b?: number) => (a === undefined || a === null || b === undefined ? '?' : Math.abs(a - b) < 0.1 ? 'OK' : `DIF ${a.toFixed(2)} vs ${b}`);
  console.log(`  ${p.padEnd(15)} 2025 ${f(row?.[c2025!], w.p2025).padEnd(18)} 2026 ${f(row?.[c2026!], w.p2026).padEnd(18)} vol ${f(row?.[cVol!], w.vol)}`);
}
