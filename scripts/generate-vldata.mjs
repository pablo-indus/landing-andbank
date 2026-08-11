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
// Los nombres de serie viven en un solo sitio: si aqui se cambiara el benchmark
// de un perfil y en la web no, el grafico rotularia una serie y pintaria otra.
import { PORTFOLIO_SERIES as PROFILE_SERIES, BENCHMARK_SERIES } from '../src/data/vlSeries.ts';

const src = process.argv[2];
if (!src) {
  console.error('Falta la ruta del Excel.');
  process.exit(1);
}

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

const DAY_MS = 86400000;

/**
 * Comprime la serie a { fecha de inicio, valores por dia }.
 *
 * Solo vale si la serie es diaria y sin huecos, que es como las exporta
 * Morningstar (traen tambien sabados y domingos). Si algun dia faltara, el
 * desplazamiento dejaria de corresponder con la fecha y las curvas saldrian
 * corridas, asi que se comprueba en lugar de darlo por hecho.
 *
 * Los valores se redondean a 4 decimales: sobre cifras de 100 a 600 eso es una
 * precision de 1 entre 10 millones, invisible en un grafico, y ahorra la mitad
 * del archivo.
 */
const pack = (series, key) => {
  const start = Date.parse(`${series[0].d}T00:00:00Z`);
  series.forEach((p, i) => {
    const expected = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    if (p.d !== expected) {
      throw new Error(`La serie "${key}" tiene un hueco: se esperaba ${expected} y vino ${p.d}.`);
    }
  });
  return { s: series[0].d, v: series.map((p) => Number(p.v.toFixed(4))) };
};

const packed = {};
for (const key of Object.keys(out)) packed[key] = pack(out[key], key);

writeFileSync(
  new URL('../src/data/vlData.ts', import.meta.url),
  '// Generado por scripts/generate-vldata.mjs. No editar a mano.\n' +
    "import { expandAll } from './expandSeries.ts';\n\n" +
    `export const vlData = expandAll(${JSON.stringify(packed)});\n`,
  'utf8'
);

console.log('vlData.ts regenerado.');
for (const key of Object.keys(out)) {
  const s = out[key];
  const label = key.startsWith('b') ? BENCHMARK_SERIES[+key.slice(1)] : PROFILE_SERIES[+key];
  console.log(`  ${key.padEnd(3)} ${String(s.length).padStart(5)} puntos  ${s[0].d} -> ${s[s.length - 1].d}  ${label}`);
}
