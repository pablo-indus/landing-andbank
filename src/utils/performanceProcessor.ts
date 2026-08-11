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

/** Sube al cambiar la forma del documento de series diarias. */
export const VL_SERIES_SCHEMA_VERSION = 1;

/**
 * Serie diaria comprimida, en el mismo formato que `src/data/vlData.ts`: la
 * fecha del primer dia y un valor por dia natural. `expandSeries.ts` la
 * devuelve a `{ d, v }`.
 */
export interface PackedSeries {
  s: string;
  v: number[];
}

export interface VlSeriesDB {
  schemaVersion: number;
  /** Ultimo dia del archivo, "yyyy-mm-dd". Solo informativo. */
  asOf: string | null;
  /** "0".."5" carteras, "b0".."b5" sus benchmarks. */
  series: Record<string, PackedSeries>;
}

export interface PerformanceUpload {
  performance: PerformanceDB;
  vlSeries: VlSeriesDB;
}

/** Orden de perfiles de la web; coincide con el de las listas de vlSeries. */
const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

const DAY_MS = 86400000;

/**
 * Comprime una serie a { fecha de inicio, valores por dia }.
 *
 * Es la misma compresion que hace `scripts/generate-vldata.mjs`, incluida la
 * comprobacion de huecos: solo vale si la serie es diaria y sin faltas, que es
 * como las exporta Morningstar (trae tambien sabados y domingos). Si faltara un
 * dia, el desplazamiento dejaria de corresponder con la fecha y todas las curvas
 * posteriores saldrian corridas **sin que nada se quejara**. Por eso se
 * comprueba en vez de darlo por hecho.
 *
 * Los valores se redondean a 4 decimales: sobre cifras de 100 a 600 es una
 * precision de 1 entre 10 millones, invisible en un grafico, y ahorra la mitad
 * del documento.
 */
function packSeries(series: SeriesPoint[], key: string): PackedSeries {
  if (series.length === 0) throw new Error(`La serie "${key}" viene vacia.`);
  const start = Date.parse(`${series[0].d}T00:00:00Z`);
  series.forEach((p, i) => {
    const expected = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    if (p.d !== expected) {
      throw new Error(`La serie "${key}" tiene un hueco: se esperaba ${expected} y vino ${p.d}.`);
    }
  });
  return { s: series[0].d, v: series.map((p) => Number(p.v.toFixed(4))) };
}

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

export async function processPerformanceExcel(file: File): Promise<PerformanceUpload> {
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

  /*
    Las curvas diarias, para Backtest y Drawdown.

    Hasta ahora esas dos secciones dibujaban el `vlData.ts` empaquetado en el
    bundle, asi que una subida mensual no las tocaba: daban el mensaje verde y
    seguian terminando en el cierre anterior. Las estadisticas de arriba no les
    sirven —son resumenes por ventana, no series—, asi que hay que guardar los
    puntos.
  */
  const packed: Record<string, PackedSeries> = {};
  PORTFOLIO_SERIES.forEach((name, i) => {
    packed[String(i)] = packSeries(series.get(name)!, String(i));
  });
  BENCHMARK_SERIES.forEach((name, i) => {
    packed[`b${i}`] = packSeries(series.get(name)!, `b${i}`);
  });

  const lastDay = Object.values(packed).reduce<string | null>((max, s) => {
    const end = new Date(Date.parse(`${s.s}T00:00:00Z`) + (s.v.length - 1) * DAY_MS)
      .toISOString()
      .slice(0, 10);
    return !max || end > max ? end : max;
  }, null);

  /*
    Un documento de Firestore no puede pasar de 1 MiB y el limite no avisa: la
    escritura falla entera. Hoy las doce series ocupan unos 560 KiB y crecen unos
    40 KiB al año, asi que hay margen para una decada larga, pero conviene
    enterarse por un mensaje claro y no por un error de la libreria.
  */
  const approxBytes = Object.values(packed).reduce((n, s) => n + s.v.length * 9 + 32, 0);
  if (approxBytes > 900 * 1024) {
    throw new Error(
      `Las series diarias ocupan unos ${Math.round(approxBytes / 1024)} KiB y un documento de ` +
        `Firestore admite 1.024 KiB. Hay que repartirlas en varios documentos antes de seguir.`
    );
  }

  return {
    performance: { schemaVersion: PERFORMANCE_SCHEMA_VERSION, asOf, profiles },
    vlSeries: { schemaVersion: VL_SERIES_SCHEMA_VERSION, asOf: lastDay, series: packed },
  };
}
