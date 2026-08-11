/**
 * Comprueba las cifras del grafico de retorno/riesgo (SectionRendimiento).
 *
 * El grafico puede alimentarse de dos sitios, y tienen que coincidir:
 *   A) el documento performance_data, que produce processPerformanceExcel al
 *      subir el Excel VL desde la web;
 *   B) el vlData.ts empaquetado, sobre el que la seccion calcula si aun no hay
 *      documento.
 *
 * Este script añade una tercera lectura, C, escrita aqui de cero y sin importar
 * seriesStats: si las tres coinciden celda a celda, el error tendria que estar
 * en las tres implementaciones a la vez. Comparar solo A con B no demostraria
 * nada, porque ambas llaman a la misma funcion.
 *
 * Uso: node scripts/audit-benchmarks.ts "<VL - Carteras y Benchmarks.xlsx>"
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import * as XLSX from 'xlsx';
import { processPerformanceExcel, WINDOW_MONTHS } from '../src/utils/performanceProcessor.ts';
import { windowStats } from '../src/utils/seriesStats.ts';
import { PORTFOLIO_SERIES, BENCHMARK_SERIES } from '../src/data/vlSeries.ts';
import { vlData } from '../src/data/vlData.ts';

const vlPath = process.argv[2];
if (!vlPath) {
  console.error('Falta la ruta del Excel VL.');
  process.exit(1);
}

const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];
const WINDOWS = Object.keys(WINDOW_MONTHS) as (keyof typeof WINDOW_MONTHS)[];

// ---------------------------------------------------------------- lectura C
// Implementacion independiente: parte del Excel, se queda con el ultimo dia de
// cada mes y descarta el mes final si no llega a su ultimo dia natural.
const wb = XLSX.read(readFileSync(vlPath), { type: 'buffer' });

const seriesByName = new Map<string, { d: string; v: number }[]>();
for (const sheet of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheet], { header: 1, defval: null });
  const name = String(rows[0]?.[1] ?? '').trim();
  if (!name) continue;
  const points = rows
    .slice(1)
    .filter((r) => r?.[0] != null && r?.[1] != null && !isNaN(Number(r[1])))
    .map((r) => {
      const [d, m, y] = String(r[0]).split('/');
      return { d: `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`, v: Number(r[1]) };
    })
    .sort((a, b) => a.d.localeCompare(b.d));
  if (points.length) seriesByName.set(name, points);
}

/** Rentabilidad anualizada y volatilidad, calculadas a mano sobre cierres mensuales. */
function refStats(name: string, months: number) {
  const pts = seriesByName.get(name)!;
  const closes = new Map<string, string>(); // mes -> ultima fecha vista
  const value = new Map<string, number>();
  for (const p of pts) {
    closes.set(p.d.slice(0, 7), p.d);
    value.set(p.d.slice(0, 7), p.v);
  }
  const ms = [...closes.keys()].sort();
  const tail = ms[ms.length - 1];
  const [ty, tm] = tail.split('-').map(Number);
  const lastNatural = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);
  if (closes.get(tail) !== lastNatural) ms.pop();

  if (ms.length < months + 1) return { ret: null, vol: null };

  const vals = ms.map((m) => value.get(m)!);
  const a = vals[vals.length - 1 - months];
  const b = vals[vals.length - 1];
  const years = months / 12;
  const total = b / a - 1;
  const ret = years > 1 ? Math.pow(1 + total, 1 / years) - 1 : total;

  const rs: number[] = [];
  for (let i = vals.length - months; i < vals.length; i++) rs.push(vals[i] / vals[i - 1] - 1);
  const mean = rs.reduce((x, y) => x + y, 0) / rs.length;
  const varc = rs.reduce((x, y) => x + (y - mean) ** 2, 0) / (rs.length - 1);

  return {
    ret: Number((ret * 100).toFixed(2)),
    vol: Number((Math.sqrt(varc) * Math.sqrt(12) * 100).toFixed(2)),
  };
}

// ---------------------------------------------------------------- lectura A
// La subida devuelve dos documentos: las estadisticas por ventana
// (`performance_data`, lo que compara este script) y las curvas diarias
// (`vl_series`, que alimentan Backtest y Drawdown y se comprueban al final).
const { performance: doc, vlSeries: uploadSeries } = await processPerformanceExcel(
  new File([readFileSync(vlPath)], basename(vlPath)) as any
);

// ---------------------------------------------------------------- lectura B
// vlData.ts se importa como modulo: desde que se guarda comprimido (fecha de
// inicio mas valores por dia) ya no se puede leer con una expresion regular.

// ------------------------------------------------------------------ compara
console.log(`ultimo mes completo del archivo: ${doc.asOf}`);
console.log('\nA = performance_data (subida web)   B = vlData.ts empaquetado   C = lectura independiente\n');
console.log('perfil          ventana  campo      A       B       C     estado');

let issues = 0;
const f = (v: number | null) => (v === null ? '     -' : v.toFixed(2).padStart(6));

PROFILES.forEach((profile, i) => {
  for (const w of WINDOWS) {
    const months = WINDOW_MONTHS[w];
    const stored = doc.profiles[profile];
    const packedPort = windowStats(vlData[String(i)] ?? [], months);
    const packedBench = windowStats(vlData[`b${i}`] ?? [], months);
    const refPort = refStats(PORTFOLIO_SERIES[i], months);
    const refBench = refStats(BENCHMARK_SERIES[i], months);

    const checks: [string, number | null, number | null, number | null][] = [
      ['vol cartera', stored.volatilities[w], packedPort.vol, refPort.vol],
      ['ret bmk', stored.benchmark.returns[w], packedBench.ret, refBench.ret],
      ['vol bmk', stored.benchmark.volatilities[w], packedBench.vol, refBench.vol],
    ];

    for (const [label, a, b, c] of checks) {
      // Tolerancia de un redondeo: el vlData empaquetado puede venir de una
      // exportacion anterior del mismo Excel.
      const ok = [b, c].every((x) => (a === null || x === null ? a === x : Math.abs(a - x) <= 0.01));
      if (!ok) issues++;
      console.log(
        `  ${profile.padEnd(14)}${w.padEnd(8)} ${label.padEnd(11)}${f(a)}  ${f(b)}  ${f(c)}   ${ok ? 'coincide' : '*** DIFIERE ***'}`
      );
    }
  }
});

// El nombre del benchmark tiene que ser el mismo en las tres listas.
PROFILES.forEach((profile, i) => {
  if (doc.profiles[profile].benchmark.name !== BENCHMARK_SERIES[i]) {
    issues++;
    console.log(`  *** ${profile}: el documento rotula "${doc.profiles[profile].benchmark.name}"`);
  }
});

/*
  Las curvas diarias que la subida guardaria en `vl_series`, contra el
  `vlData.ts` empaquetado.

  Es lo que dibujan Backtest y Drawdown, y desde que la subida las escribe hay
  dos origenes posibles: en la misma fecha los dos tienen que dar el mismo valor.
  No se exige el mismo numero de puntos, porque el Excel puede ser mas reciente
  que el vlData empaquetado; lo que no puede pasar es que un dia compartido
  valga una cosa aqui y otra alla, que es justo lo que delataria una compresion
  descolocada por un hueco.
*/
console.log('\nCurvas diarias (vl_series) contra vlData.ts empaquetado\n');
console.log('serie  puntos A  puntos B  comun  desde        hasta        estado');

const DAY = 86400000;

for (const key of Object.keys(uploadSeries.series)) {
  const packed = uploadSeries.series[key];
  const mine = new Map<string, number>();
  packed.v.forEach((v, i) => {
    mine.set(new Date(Date.parse(`${packed.s}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10), v);
  });

  const theirs = vlData[key] ?? [];
  let shared = 0;
  let diffs = 0;
  let firstDiff = '';
  for (const point of theirs) {
    const a = mine.get(point.d);
    if (a === undefined) continue;
    shared++;
    if (Math.abs(a - point.v) > 0.01) {
      diffs++;
      if (!firstDiff) firstDiff = `${point.d}: A=${a} B=${point.v}`;
    }
  }

  if (diffs > 0) issues++;
  if (shared === 0) issues++;

  const last = new Date(Date.parse(`${packed.s}T00:00:00Z`) + (packed.v.length - 1) * DAY)
    .toISOString()
    .slice(0, 10);
  const state = shared === 0 ? '*** SIN FECHAS COMUNES ***' : diffs === 0 ? 'coincide' : `*** ${diffs} DIFIEREN (${firstDiff}) ***`;
  console.log(
    `  ${key.padEnd(5)}${String(packed.v.length).padStart(8)}${String(theirs.length).padStart(10)}` +
      `${String(shared).padStart(7)}  ${packed.s}   ${last}   ${state}`
  );
}

console.log('\n====================================================');
console.log(issues === 0 ? 'Sin discrepancias.' : `${issues} discrepancias detectadas.`);
process.exit(issues === 0 ? 0 : 1);
