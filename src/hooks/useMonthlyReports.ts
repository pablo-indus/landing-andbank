import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
