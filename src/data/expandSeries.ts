import type { SeriesPoint } from '../utils/seriesStats.ts';

/**
 * Serie diaria tal y como se guarda en vlData.ts: la fecha del primer dia y los
 * valores de los dias siguientes, uno por dia natural.
 */
export interface PackedSeries {
  /** Fecha del primer valor, "yyyy-mm-dd". */
  s: string;
  /** Un valor por dia natural consecutivo desde `s`. */
  v: number[];
}

const DAY_MS = 86400000;

/**
 * Devuelve la serie en el formato { d, v } que esperan las secciones.
 *
 * Las doce series de Morningstar son diarias y sin huecos —incluyen sabados y
 * domingos— asi que repetir la fecha en cada punto era guardar doce veces lo
 * mismo. Escritas como { "d": "2010-11-01", "v": 100.0279 } ocupaban unos 38
 * bytes por dia, de los cuales 29 eran la fecha y los nombres de campo; con la
 * fecha de inicio y el desplazamiento bastan 9. El archivo pasa de 2,4 MB a
 * 0,54 MB sin perder un solo punto.
 *
 * La expansion se hace una vez al cargar el modulo y devuelve exactamente la
 * misma estructura de antes, por lo que ninguna seccion cambia.
 */
export function expandDailySeries(packed: PackedSeries): SeriesPoint[] {
  const start = Date.parse(`${packed.s}T00:00:00Z`);
  return packed.v.map((v, i) => ({
    d: new Date(start + i * DAY_MS).toISOString().slice(0, 10),
    v,
  }));
}

/** Expande el objeto entero de series ("0".."5" y "b0".."b5"). */
export function expandAll(packed: Record<string, PackedSeries>): Record<string, SeriesPoint[]> {
  const out: Record<string, SeriesPoint[]> = {};
  for (const key of Object.keys(packed)) out[key] = expandDailySeries(packed[key]);
  return out;
}
