import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  PROFILES,
  PROFILE_COLORS,
  PROFILE_KPIS,
  WINDOWS_DATA,
  COMPOSITION_SNAPSHOTS,
  ASSET_ALLOCATION_SNAPSHOTS,
  cleanCompositionSnapshots,
} from '../data/portfolioData';
import { ALLOCATION_SCHEMA_VERSION } from '../utils/allocationProcessor';

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
    lastUpdated: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'monthly_reports'),
      (snapshot) => {
        const reports: { id: string; data: any }[] = [];
        let performance: any | null = null;
        let returns: any | null = null;
        let allocation: any | null = null;
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
