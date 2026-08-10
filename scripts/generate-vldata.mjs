/**
 * Regenera src/data/vlData.ts a partir del Excel de Morningstar.
 *
 * Uso: node scripts/generate-vldata.mjs "<ruta VL - Carteras y Benchmarks.xlsx>"
 *
 * Salida: { "0".."5": carteras, "b0".."b5": sus benchmarks }
 *
 * IMPORTANTE: las carteras se identifican por la CABECERA de la columna B, no por
 * el nombre de la pestana. La hoja "Investment Growth - Conservador" contiene en
 * realidad la serie "Gestionada Conservadora +", asi que fiarse del nombre de la
 * pestana intercambia dos perfiles de riesgo sin previo aviso.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const src = process.argv[2];
if (!src) {
  console.error('Falta la ruta del Excel.');
  process.exit(1);
}

// Orden de perfiles tal y como los usa la web (PROFILES en portfolioData.ts).
const PROFILE_SERIES = [
  'Gestionada Conservadora +',
  'Gestionada Conservadora',
  'Gestionada Moderada',
  'Gestionada Equilibrada',
  'Gestionada Agresiva',
  'Gestionada Agresiva +',
];

// Benchmark asignado a cada perfil, en el mismo orden.
const BENCHMARK_SERIES = [
  'EAA Fund EUR Diversified Bond - Short Term',
  'EAA Fund EUR Cautious Allocation - Global',
  'EAA Fund EUR Moderate Allocation - Global',
  'EAA Fund EUR Flexible Allocation - Global',
  'EAA Fund EUR Aggressive Allocation - Global',
  'MSCI World NR EUR',
];

const wb = XLSX.read(readFileSync(src), { type: 'buffer' });

/** Indexa las hojas por el nombre real de la serie (celda B1). */
const bySeriesName = new Map();
for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
  const seriesName = String(rows[0]?.[1] ?? '').trim();
  if (seriesName) bySeriesName.set(seriesName, rows.slice(1));
}

/** "dd/mm/yyyy" -> "yyyy-mm-dd" (formato que ya espera la web). */
const toIso = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const [d, m, y] = String(value).split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const extract = (seriesName) => {
  const rows = bySeriesName.get(seriesName);
  if (!rows) throw new Error(`No se encontro la serie "${seriesName}" en el Excel.`);
  return rows
    .filter((r) => r && r[0] != null && r[1] != null && !isNaN(Number(r[1])))
    .map((r) => ({ d: toIso(r[0]), v: Number(r[1]) }))
    .filter((p) => p.d)
    .sort((a, b) => a.d.localeCompare(b.d));
};

const out = {};
PROFILE_SERIES.forEach((name, i) => {
  out[String(i)] = extract(name);
});
BENCHMARK_SERIES.forEach((name, i) => {
  out[`b${i}`] = extract(name);
});

writeFileSync(
  new URL('../src/data/vlData.ts', import.meta.url),
  `export const vlData = ${JSON.stringify(out)};\n`,
  'utf8'
);

console.log('vlData.ts regenerado.');
for (const key of Object.keys(out)) {
  const s = out[key];
  const label = key.startsWith('b') ? BENCHMARK_SERIES[+key.slice(1)] : PROFILE_SERIES[+key];
  console.log(`  ${key.padEnd(3)} ${String(s.length).padStart(5)} puntos  ${s[0].d} -> ${s[s.length - 1].d}  ${label}`);
}
