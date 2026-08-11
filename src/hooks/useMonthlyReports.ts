import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';
import {
  PROFILES,
  PROFILE_COLORS,
  PROFILE_KPIS,
  WINDOWS_DATA,
  COMPOSITION_SNAPSHOTS,
  ASSET_ALLOCATION_SNAPSHOTS,
  HISTORICAL_VL,
  cleanCompositionSnapshots,
} from '../data/portfolioData';
import { STYLE_BOX_DATA } from '../data/styleBoxData';
import { FUND_CORR } from '../data/corrData';
import { ALLOCATION_SCHEMA_VERSION } from '../utils/allocationProcessor';
import { VL_SERIES_SCHEMA_VERSION } from '../utils/performanceProcessor';
import { STYLE_BOX_SCHEMA_VERSION } from '../utils/styleBoxProcessor';
import { CORRELATION_SCHEMA_VERSION } from '../utils/correlationProcessor';
import type { CorrelationMatrix, StyleBoxSnapshot } from '../types';
import { expandAll } from '../data/expandSeries';

/**
 * Fuente unica de datos para toda la landing.
 *
 * Se suscribe una sola vez a la coleccion 'monthly_reports' y reparte el
 * resultado a todas las secciones. Antes cada seccion abria su propia conexion
 * y repetia la logica de ordenacion, lo que provocaba que unas secciones
 * mostraran datos actualizados y otras no.
 *
 * Estructura de la coleccion:
 *   monthly_reports/{periodo}          -> datos de un mes (ej. "enero_2026")
 *   monthly_reports/performance_data   -> documento especial con rentabilidades
 */

/** Documentos especiales: no son periodos, no deben mezclarse con los meses. */
export const PERFORMANCE_DOC_ID = 'performance_data';
export const RETURNS_DOC_ID = 'returns_data';
export const ALLOCATION_DOC_ID = 'allocation_data';
export const VL_SERIES_DOC_ID = 'vl_series';
export const STYLE_BOX_DOC_ID = 'style_box_data';
export const CORRELATION_DOC_ID = 'correlation_data';

const MONTH_TO_NUM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Convierte "enero_2026" en un numero ordenable (202601). Devuelve 0 si no encaja. */
export const periodToSortKey = (period: string): number => {
  if (!period) return 0;
  const [monthName, yearStr] = period.split('_');
  const year = parseInt(yearStr, 10);
  const month = MONTH_TO_NUM[(monthName ?? '').toLowerCase()];
  if (!year || !month) return 0;
  return year * 100 + month;
};

/** Da formato legible: "enero_2026" -> "Enero 2026". */
export const formatPeriodLabel = (period: string): string => {
  if (!period) return '';
  const parts = period.split('_');
  if (parts.length !== 2) return period;
  return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)} ${parts[1]}`;
};

/**
 * Ordena las etiquetas de credito por la fecha que aparece en el titulo de la hoja.
 * Las pestanas sin ano explicito son las mas antiguas del historico.
 */
const extractDateFromLabel = (label: string) => {
  const year = label.match(/(20\d{2})/);
  const dayMonth = label.match(/(\d{1,2})[-/](\d{1,2})/);
  return {
    y: year ? parseInt(year[1], 10) : 1999,
    d: dayMonth ? parseInt(dayMonth[1], 10) : 0,
    m: dayMonth ? parseInt(dayMonth[2], 10) : 0,
  };
};

/**
 * Convierte la tabla de KPIs del libro AA al formato que usan los componentes.
 *
 * Los nombres de columna se buscan, no se fijan: la columna del mes cambia en
 * cada cierre ("Junio", luego "Julio"...) y darla por fija obligaria a tocar el
 * codigo todos los meses.
 */
function adaptKpis(kpis: any): typeof PROFILE_KPIS {
  if (!kpis?.columns || !kpis?.rows) return PROFILE_KPIS;

  const cols: string[] = kpis.columns;
  const col2025 = cols.find((c) => c.trim() === '2025');
  const col2026 = cols.find((c) => c.trim() === '2026');
  const colVol = cols.find((c) => /volat/i.test(c));
  // La columna del mes es la unica cuyo titulo es una palabra sin cifras.
  const colMonth = cols.find((c) => /^[a-záéíóúñ]+$/i.test(c.trim()) && !/volat/i.test(c));

  return PROFILES.map((name, i) => {
    const row = kpis.rows[name];
    const fallback = PROFILE_KPIS[i];
    if (!row) return fallback;
    const pick = (key: string | undefined, alt: number) =>
      key && row[key] !== null && row[key] !== undefined ? row[key] : alt;

    return {
      ...fallback,
      name: name as (typeof PROFILE_KPIS)[number]['name'],
      color: PROFILE_COLORS[i],
      p2025: pick(col2025, fallback.p2025),
      p2026YTD: pick(col2026, fallback.p2026YTD),
      pJune: pick(colMonth, fallback.pJune),
      volatility: pick(colVol, fallback.volatility),
    };
  });
}

/**
 * Convierte la tabla de ventanas al formato { cats, values[ventana][perfil] }.
 *
 * Solo se incluyen las ventanas que existen en el libro. La de "4 años" que
 * habia en el codigo no esta en el archivo, asi que desaparece en lugar de
 * mostrar una cifra sin respaldo. Conservador + y Agresivo + quedan a null en
 * las ventanas largas: no tienen historico suficiente y un cero se leeria como
 * un resultado real.
 */
function adaptWindows(windows: any): typeof WINDOWS_DATA {
  if (!windows?.columns || !windows?.rows) return WINDOWS_DATA;

  const find = (needle: string) =>
    (windows.columns as string[]).find((c) => c.toLowerCase().includes(needle));

  const spec: [string, string | undefined][] = [
    ['1 año', find('1 año')],
    ['2 años', find('2 años')],
    ['3 años', find('3 años')],
    ['5 años', find('5 años')],
    ['Desde 2009', find('desde inicio')],
  ];
  const present = spec.filter((s): s is [string, string] => Boolean(s[1]));
  if (present.length === 0) return WINDOWS_DATA;

  return {
    cats: present.map(([label]) => label),
    values: present.map(([, col]) =>
      PROFILES.map((p) => {
        const v = windows.rows[p]?.[col];
        return v === undefined ? null : v;
      })
    ),
  };
}

/**
 * Composicion y asset allocation del libro AA.
 *
 * Se comprueba `schemaVersion` por lo mismo que en performance_data: mientras no
 * se haya subido el libro con el parser nuevo, es preferible seguir con los datos
 * empaquetados a mostrar medio documento de una version anterior.
 */
function adaptAllocation(allocation: any) {
  if (allocation?.schemaVersion !== ALLOCATION_SCHEMA_VERSION) {
    return { composition: COMPOSITION_SNAPSHOTS, assetAllocation: ASSET_ALLOCATION_SNAPSHOTS };
  }

  const composition = Array.isArray(allocation.composition) && allocation.composition.length
    ? (cleanCompositionSnapshots(allocation.composition) as typeof COMPOSITION_SNAPSHOTS)
    : COMPOSITION_SNAPSHOTS;

  // Cada subida deja una foto; el documento las acumula, de la mas reciente a la
  // mas antigua.
  const assetAllocation = Array.isArray(allocation.assetAllocation) && allocation.assetAllocation.length
    ? ([...allocation.assetAllocation].sort((a, b) =>
        String(b.period).localeCompare(String(a.period))
      ) as typeof ASSET_ALLOCATION_SNAPSHOTS)
    : ASSET_ALLOCATION_SNAPSHOTS;

  return { composition, assetAllocation };
}

/**
 * Curvas diarias para Backtest y Drawdown.
 *
 * Se comprueba `schemaVersion` por lo mismo que en los otros documentos: mientras
 * no se haya subido el libro VL con el parser nuevo es preferible seguir con las
 * series empaquetadas que dibujar medio grafico.
 *
 * Las series llegan comprimidas (fecha de inicio y un valor por dia natural) y
 * `expandAll` las devuelve al formato `{ d, v }` que esperan las secciones, que
 * es el mismo que traia `vlData.ts`. Por eso las dos secciones no notan de donde
 * vienen.
 */
/*
  Expandir las doce series son unos 63.000 puntos, y este hook abre una
  suscripcion por componente que lo llama (App, KpiStrip, Backtest, Drawdown, la
  maqueta del informe...). Sin memoria, esa expansion se repetiria una vez por
  seccion y ademas en cada notificacion de Firestore, aunque lo que hubiera
  cambiado fuese otro documento. Se guarda la ultima, identificada por la fecha
  de la subida.
*/
let vlCache: { key: string; series: typeof HISTORICAL_VL } | null = null;

function adaptVlSeries(vl: any): typeof HISTORICAL_VL {
  if (vl?.schemaVersion !== VL_SERIES_SCHEMA_VERSION || !vl?.series) return HISTORICAL_VL;

  const key = `${vl.schemaVersion}|${vl.updatedAt ?? ''}|${vl.asOf ?? ''}`;
  if (vlCache?.key === key) return vlCache.series;

  try {
    const series = expandAll(vl.series) as typeof HISTORICAL_VL;
    vlCache = { key, series };
    return series;
  } catch (err) {
    // Una serie con un hueco descolocaria todas las fechas posteriores sin que
    // nada se quejara. Mejor las empaquetadas, que si estan comprobadas.
    console.error('vl_series ilegible, se usan las series empaquetadas:', err);
    return HISTORICAL_VL;
  }
}

/**
 * Style Box empaquetado, con la fecha tambien en formato ordenable.
 *
 * El archivo estatico solo trae "dd/mm/yyyy" porque es lo que se enseña en las
 * pestañas; el documento de Firestore guarda ademas `period` para poder ordenar
 * y para no repetir fecha entre subidas. Se completa aqui para que la seccion
 * no tenga que distinguir de donde vienen los datos.
 */
const STATIC_STYLE_BOX: StyleBoxSnapshot[] = STYLE_BOX_DATA.map((entry) => {
  const [d, m, y] = entry.date.split('/');
  const scores: Record<string, [number, number]> = {};
  for (const [profile, pair] of Object.entries(entry.scores)) scores[profile] = [pair[0], pair[1]];
  return { date: entry.date, period: `${y}-${m}-${d}`, scores };
}).sort((a, b) => b.period.localeCompare(a.period));

/**
 * Fotos mensuales del Style Box.
 *
 * El export de Morningstar cubre un año movil, asi que el documento las va
 * acumulando y aqui solo hay que ordenarlas. Como en los demas documentos, una
 * `schemaVersion` distinta significa que lo guardado es de otra forma: mejor
 * las empaquetadas que media seccion.
 */
function adaptStyleBox(styleBox: any): StyleBoxSnapshot[] {
  if (styleBox?.schemaVersion !== STYLE_BOX_SCHEMA_VERSION) return STATIC_STYLE_BOX;
  if (!Array.isArray(styleBox.entries) || styleBox.entries.length === 0) return STATIC_STYLE_BOX;

  return [...styleBox.entries].sort((a, b) => String(b.period).localeCompare(String(a.period)));
}

/**
 * Matrices de correlacion por perfil.
 *
 * El export trae los seis perfiles de una vez, asi que cada subida reemplaza el
 * documento entero: no es un historico, es la foto del ultimo calculo.
 */
function adaptCorrelation(correlation: any): Record<string, CorrelationMatrix> {
  const fallback = FUND_CORR as Record<string, CorrelationMatrix>;
  if (correlation?.schemaVersion !== CORRELATION_SCHEMA_VERSION) return fallback;
  if (!correlation.profiles || Object.keys(correlation.profiles).length === 0) return fallback;
  return correlation.profiles as Record<string, CorrelationMatrix>;
}

export interface MonthlyReportsState {
  /** Todos los documentos de periodo, del mas reciente al mas antiguo. */
  reports: { id: string; data: any }[];
  /** Bloques de cambios de cartera, del mas reciente al mas antiguo. */
  historicalChanges: any[];
  /** Snapshots de niveles de credito, del mas reciente al mas antiguo. */
  creditSnapshots: any[];
  /** Contribuidores y detractores por mes, del mas reciente al mas antiguo. */
  attributions: any[];
  /** Documento de rentabilidades calculadas, o null si aun no se ha subido. */
  performance: any | null;
  /** Series netas del libro AA (anual, mensual, volatilidad, KPIs). */
  returns: any | null;
  /** KPIs por perfil, ya en el formato de los componentes. Cae a los estaticos. */
  profileKpis: typeof PROFILE_KPIS;
  /** Ventanas de rentabilidad anualizada. Cae a las estaticas. */
  windows: typeof WINDOWS_DATA;
  /** Historico de composicion por fecha de rebalanceo. Cae a los estaticos. */
  composition: typeof COMPOSITION_SNAPSHOTS;
  /** Fotos de asset allocation, de la mas reciente a la mas antigua. Cae a las estaticas. */
  assetAllocation: typeof ASSET_ALLOCATION_SNAPSHOTS;
  /** Curvas diarias de Backtest y Drawdown. Caen a `vlData.ts` si no hay documento. */
  vlSeries: typeof HISTORICAL_VL;
  /** Fotos del Style Box, de la mas reciente a la mas antigua. Caen a las estaticas. */
  styleBox: StyleBoxSnapshot[];
  /** Matriz de correlaciones por perfil. Cae a `corrData.ts` si no hay documento. */
  correlations: Record<string, CorrelationMatrix>;
  /** Fecha de la ultima actualizacion registrada en la base de datos. */
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
}

export function useMonthlyReports(): MonthlyReportsState {
  const [state, setState] = useState<MonthlyReportsState>({
    reports: [],
    historicalChanges: [],
    creditSnapshots: [],
    attributions: [],
    performance: null,
    returns: null,
    profileKpis: PROFILE_KPIS,
    windows: WINDOWS_DATA,
    composition: COMPOSITION_SNAPSHOTS,
    assetAllocation: ASSET_ALLOCATION_SNAPSHOTS,
    vlSeries: HISTORICAL_VL,
    styleBox: STATIC_STYLE_BOX,
    correlations: FUND_CORR as Record<string, CorrelationMatrix>,
    lastUpdated: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Sin configuracion de Firebase no hay a quien preguntar. Se deja de cargar
    // y se avisa: la web se queda con los datos empaquetados y App pinta el
    // aviso ambar de siempre, en vez de girar el "Cargando..." para siempre.
    if (!firebaseReady) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'La web se ha publicado sin configuracion de Firebase.',
      }));
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'monthly_reports'),
      (snapshot) => {
        const reports: { id: string; data: any }[] = [];
        let performance: any | null = null;
        let returns: any | null = null;
        let allocation: any | null = null;
        let vlSeriesDoc: any | null = null;
        let styleBoxDoc: any | null = null;
        let correlationDoc: any | null = null;
        let lastUpdated: Date | null = null;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          const stamp = data.updatedAt ? new Date(data.updatedAt) : null;
          if (stamp && !isNaN(stamp.getTime()) && (!lastUpdated || stamp > lastUpdated)) {
            lastUpdated = stamp;
          }

          if (docSnap.id === PERFORMANCE_DOC_ID) {
            performance = data;
            return;
          }
          if (docSnap.id === RETURNS_DOC_ID) {
            returns = data;
            return;
          }
          if (docSnap.id === ALLOCATION_DOC_ID) {
            allocation = data;
            return;
          }
          if (docSnap.id === VL_SERIES_DOC_ID) {
            vlSeriesDoc = data;
            return;
          }
          if (docSnap.id === STYLE_BOX_DOC_ID) {
            styleBoxDoc = data;
            return;
          }
          if (docSnap.id === CORRELATION_DOC_ID) {
            correlationDoc = data;
            return;
          }
          reports.push({ id: docSnap.id, data });
        });

        reports.sort((a, b) => periodToSortKey(b.id) - periodToSortKey(a.id));

        const historicalChanges = reports
          .flatMap(({ data }) =>
            Array.isArray(data.historicalChanges) ? data.historicalChanges : []
          )
          .filter((block: any) => block?.batches?.length > 0)
          .sort((a: any, b: any) => periodToSortKey(b.period) - periodToSortKey(a.period));

        const creditSnapshots = reports
          .flatMap(({ id, data }) =>
            (Array.isArray(data.creditLevelSnapshots) ? data.creditLevelSnapshots : [])
              .filter((snap: any) => snap?.funds?.length > 0)
              .map((snap: any) => ({ ...snap, docId: id }))
          )
          .sort((a: any, b: any) => {
            const A = extractDateFromLabel(a.label ?? '');
            const B = extractDateFromLabel(b.label ?? '');
            if (A.y !== B.y) return B.y - A.y;
            if (A.m !== B.m) return B.m - A.m;
            if (A.d !== B.d) return B.d - A.d;
            return (b.label ?? '').localeCompare(a.label ?? '');
          });

        // Un bloque de atribucion por periodo, del mas reciente al mas antiguo.
        const attributions = reports
          .flatMap(({ data }) =>
            Array.isArray(data.monthlyAttributions) ? data.monthlyAttributions : []
          )
          .filter((block: any) => Array.isArray(block?.data) && block.data.length > 0)
          .sort((a: any, b: any) => periodToSortKey(b.month) - periodToSortKey(a.month));

        setState({
          reports,
          historicalChanges,
          creditSnapshots,
          attributions,
          performance,
          returns,
          profileKpis: adaptKpis(returns?.kpis),
          windows: adaptWindows(returns?.windows),
          ...adaptAllocation(allocation),
          vlSeries: adaptVlSeries(vlSeriesDoc),
          styleBox: adaptStyleBox(styleBoxDoc),
          correlations: adaptCorrelation(correlationDoc),
          lastUpdated,
          loading: false,
          error: null,
        });
      },
      (err) => {
        console.error('Error leyendo monthly_reports:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'No se pudo conectar con la base de datos.',
        }));
      }
    );

    return unsubscribe;
  }, []);

  return state;
}
