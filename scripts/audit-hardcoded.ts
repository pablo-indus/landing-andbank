/**
 * Audita TODAS las cifras escritas a mano en el codigo contra el libro AA GDC
 * y las series VL, antes de sustituirlas por datos de Firestore.
 *
 * El objetivo es distinguir tres casos:
 *   - coincide        -> el dato del codigo es correcto y actual
 *   - desfasado       -> venia de una version anterior del archivo
 *   - sin equivalente -> no esta en el archivo, hay que decidir que hacer
 *
 * Uso: node scripts/audit-hardcoded.ts "<AA GDC.xlsx>" "<VL.xlsx>"
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { processReturnsExcel } from '../src/utils/returnsProcessor.ts';

const [, , aaPath, vlPath] = process.argv;
const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

const data = await processReturnsExcel(new File([readFileSync(aaPath)], basename(aaPath)) as any);

const src = readFileSync('src/data/portfolioData.ts', 'utf8');
const rend = readFileSync('src/components/SectionRendimiento.tsx', 'utf8');

const near = (a: number | null | undefined, b: number | null | undefined, tol = 0.15) => {
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  return Math.abs(a - b) <= tol;
};
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '   -  ' : v.toFixed(2).padStart(6));

let issues = 0;

// ---------------------------------------------------------------- PROFILE_KPIS
console.log('=============== PROFILE_KPIS vs hoja "rentabilidades" ===============');
const kpiBlock = src.match(/export const PROFILE_KPIS[\s\S]*?\n\];/)?.[0] ?? '';
const kpiEntries = [...kpiBlock.matchAll(/name:\s*'([^']+)'[\s\S]*?p2025:\s*(-?[\d.]+)[\s\S]*?p2026YTD:\s*(-?[\d.]+)[\s\S]*?pJune:\s*(-?[\d.]+)[\s\S]*?volatility:\s*(-?[\d.]+)/g)];
const kcol = (needle: string) => data.kpis?.columns.find((c) => c.toLowerCase().includes(needle));
const c2025 = kcol('2025');
const c2026 = data.kpis?.columns.find((c) => c.trim() === '2026');
const cVol = kcol('volat');
const cMes = data.kpis?.columns.find((c) => /^[a-záéíóú]+$/i.test(c) && !/volat/i.test(c));

console.log(`columna del mes detectada: "${cMes}"`);
console.log('perfil           campo      codigo   excel   estado');
for (const m of kpiEntries) {
  const [, name, p2025, p2026, pJune, vol] = m;
  const row = data.kpis?.rows[name];
  const checks: [string, number, number | null | undefined][] = [
    ['2025', +p2025, row?.[c2025!]],
    ['2026YTD', +p2026, row?.[c2026!]],
    ['mes', +pJune, cMes ? row?.[cMes] : undefined],
    ['volat', +vol, row?.[cVol!]],
  ];
  for (const [label, code, excel] of checks) {
    const ok = near(code, excel);
    if (!ok) issues++;
    console.log(`  ${name.padEnd(15)}${label.padEnd(10)}${fmt(code)}  ${fmt(excel)}   ${ok ? 'coincide' : '*** DIFIERE ***'}`);
  }
}

// --------------------------------------------------------------- WINDOWS_DATA
console.log('\n=============== WINDOWS_DATA vs tabla de ventanas ===============');
const winBlock = src.match(/export const WINDOWS_DATA[\s\S]*?\n\};/)?.[0] ?? '';
const cats = [...(winBlock.match(/cats:\s*\[([^\]]+)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
const rows = [...winBlock.matchAll(/\[([^\]\[]*?)\],\s*\/\//g)].map((m) =>
  m[1].split(',').map((s) => (s.trim() === 'null' ? null : parseFloat(s.trim())))
);
const winCol = (needle: string) => data.windows?.columns.find((c) => c.toLowerCase().includes(needle));
const MAP: Record<string, string | undefined> = {
  '1 año': winCol('1 año'),
  '2 años': winCol('2 años'),
  '3 años': winCol('3 años'),
  '5 años': winCol('5 años'),
  'Desde 2009': winCol('desde inicio'),
};
console.log('ventana        perfil           codigo   excel   estado');
cats.forEach((cat, ci) => {
  const excelCol = MAP[cat];
  if (!excelCol) {
    console.log(`  ${cat.padEnd(14)} (sin columna equivalente en el Excel)`);
    return;
  }
  PROFILES.forEach((p, pi) => {
    const code = rows[ci]?.[pi];
    const excel = data.windows?.rows[p]?.[excelCol];
    const ok = near(code, excel);
    if (!ok) issues++;
    console.log(`  ${cat.padEnd(14)} ${p.padEnd(15)}${fmt(code)}  ${fmt(excel)}   ${ok ? 'coincide' : '*** DIFIERE ***'}`);
  });
});

// ------------------------------------------------- PORTFOLIO_VOL_DATA (Rendimiento)
console.log('\n=============== PORTFOLIO_VOL_DATA vs volatilidad del Excel ===============');
const volBlock = rend.match(/const PORTFOLIO_VOL_DATA[\s\S]*?\n\};/)?.[0] ?? '';
const volRows = [...volBlock.matchAll(/'([^']+)':\s*\{\s*'1Y':\s*(-?[\d.]+),\s*'3Y':\s*(-?[\d.]+),\s*'5Y':\s*(-?[\d.]+)/g)];
const lastVol = data.volatility.at(-1);
console.log(`(el Excel solo da volatilidad puntual; se compara 1Y contra ${lastVol?.period})`);
console.log('perfil           1Y codigo  1Y excel  estado');
for (const m of volRows) {
  const [, name, v1] = m;
  const excel = lastVol?.byProfile[name];
  const ok = near(+v1, excel, 0.3);
  if (!ok && excel !== undefined) issues++;
  console.log(`  ${name.padEnd(15)}${fmt(+v1)}   ${fmt(excel)}   ${excel === undefined ? '(sin dato en Excel)' : ok ? 'coincide' : '*** DIFIERE ***'}`);
}

console.log('\n====================================================');
console.log(issues === 0 ? 'Sin discrepancias.' : `${issues} discrepancias detectadas.`);
