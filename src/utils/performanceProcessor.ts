import * as XLSX from 'xlsx';
// Con extension, a diferencia del resto del proyecto: scripts/audit-benchmarks.ts
// carga este modulo con node a secas, y node no resuelve rutas sin extension.
import { PORTFOLIO_SERIES, BENCHMARK_SERIES } from '../data/vlSeries.ts';
import { toMonthEnds, windowStats, type SeriesPoint } from './seriesStats.ts';

/**
 * Lee el Excel VL de Morningstar y deja en Firestore lo que necesita el grafico
 * de retorno/riesgo de SectionRendimiento: la volatilidad de cada cartera y la
 * rentabilidad y volatilidad de su benchmark.
 *
 * NO guarda rentabilidades de cartera. Las cifras de cartera que publica la web
 * son las netas de comisiones del libro AA (returns_data); las de este archivo
 * son brutas, y tener las dos en la base de datos bajo el mismo nombre ("1Y")
 * es pedir que alguien pinte una al lado de la otra. Para el eje de volatilidad
 * si sirven: una comision constante resta rentabilidad, no oscilacion.
 */

/** Sube al cambiar la forma del documento o el metodo de calculo. */
export const PERFORMANCE_SCHEMA_VERSION = 2;

/** Ventanas del grafico y su longitud en meses. */
export const WINDOW_MONTHS = { '1Y': 12, '3Y': 36, '5Y': 60 } as const;
export type WindowKey = keyof typeof WINDOW_MONTHS;

export interface PerformanceDB {
  schemaVersion: number;
  /** Ultimo cierre mensual completo del archivo, "yyyy-mm". */
  asOf: string | null;
  profiles: {
    [profile: string]: {
      volatilities: Record<WindowKey, number | null>;
      benchmark: {
        name: string;
        returns: Record<WindowKey, number | null>;
        volatilities: Record<WindowKey, number | null>;
      };
    };
  };
}

/** Orden de perfiles de la web; coincide con el de las listas de vlSeries. */
const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

/** "dd/mm/yyyy", una fecha de Excel o un numero de serie -> "yyyy-mm-dd". */
const toIso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  const [d, m, y] = String(value).split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/**
 * Indexa las hojas por el nombre real de la serie, que esta en la celda B1.
 *
 * Nunca por el nombre de la pestaña: "Investment Growth - Conservador" contiene
 * la serie "Gestionada Conservadora +", asi que fiarse del titulo intercambia
 * dos perfiles de riesgo. Tampoco por posicion, que es lo que hacia antes esta
 * funcion: hoy el orden de exportacion coincide, pero nada lo garantiza y el
 * fallo seria mudo.
 */
function indexBySeriesName(workbook: XLSX.WorkBook): Map<string, SeriesPoint[]> {
  const index = new Map<string, SeriesPoint[]>();

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
    });
    const seriesName = String(rows[0]?.[1] ?? '').trim();
    if (!seriesName) continue;

    const points = rows
      .slice(1)
      .filter((r) => r && r[0] != null && r[1] != null && !isNaN(Number(r[1])))
      .map((r) => ({ d: toIso(r[0]), v: Number(r[1]) }))
      .filter((p): p is SeriesPoint => p.d !== null)
      .sort((a, b) => a.d.localeCompare(b.d));

    if (points.length) index.set(seriesName, points);
  }

  return index;
}

export async function processPerformanceExcel(file: File): Promise<PerformanceDB> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const series = indexBySeriesName(workbook);

  const missing = [...PORTFOLIO_SERIES, ...BENCHMARK_SERIES].filter((name) => !series.has(name));
  if (missing.length) {
    throw new Error(`Faltan series en el archivo: ${missing.join(', ')}.`);
  }

  const windows = Object.keys(WINDOW_MONTHS) as WindowKey[];
  const blank = () => ({}) as Record<WindowKey, number | null>;

  const profiles: PerformanceDB['profiles'] = {};
  let asOf: string | null = null;

  PROFILES.forEach((profile, i) => {
    const portfolio = series.get(PORTFOLIO_SERIES[i])!;
    const benchmark = series.get(BENCHMARK_SERIES[i])!;

    const volatilities = blank();
    const benchReturns = blank();
    const benchVols = blank();

    for (const w of windows) {
      volatilities[w] = windowStats(portfolio, WINDOW_MONTHS[w]).vol;
      const b = windowStats(benchmark, WINDOW_MONTHS[w]);
      benchReturns[w] = b.ret;
      benchVols[w] = b.vol;
    }

    // El ultimo mes COMPLETO, no la ultima fecha del archivo: la exportacion se
    // corta a mitad de mes y esa fecha no corresponde a ningun dato del grafico.
    const lastMonth = toMonthEnds(portfolio).at(-1)?.m ?? null;
    if (lastMonth && (!asOf || lastMonth > asOf)) asOf = lastMonth;

    profiles[profile] = {
      volatilities,
      benchmark: { name: BENCHMARK_SERIES[i], returns: benchReturns, volatilities: benchVols },
    };
  });

  return { schemaVersion: PERFORMANCE_SCHEMA_VERSION, asOf, profiles };
}
