import * as XLSX from 'xlsx';
import type { StyleBoxSnapshot } from '../types.ts';

/**
 * Lee el Style Box de Morningstar ("Holdings-Based Style Trail").
 *
 * El archivo es una tabla plana: una fila por cierre mensual y dos columnas por
 * perfil, "Size Score" (eje Y: Small/Mid/Large) y "Style Score" (eje X:
 * Value/Core/Growth). La exportacion cubre un año movil, asi que **cada subida
 * añade sus doce fechas al historico en vez de reemplazarlo**: de lo contrario
 * cada mes se perderia el mes mas antiguo.
 *
 * Las puntuaciones de Morningstar van de -100 a 400 y el recuadro de 3x3 ocupa
 * de 0 a 300 (los cortes estan en 100 y 200). Los valores fuera de ese rango no
 * son un error del archivo y no se recortan aqui: `SectionStyleBox` los sujeta
 * al borde al pintarlos, que es lo unico que se puede hacer con un punto que
 * cae fuera del recuadro.
 */

/** Sube al cambiar la forma del documento. */
export const STYLE_BOX_SCHEMA_VERSION = 1;

/** La hoja del export de Morningstar. Si cambia de nombre, se usa la primera. */
const SHEET_NAME = 'Holdings-Based Style Trail';

/**
 * Como se llama cada perfil en la cabecera del archivo, y como se llama en la
 * web. Morningstar usa el femenino ("Gestionada Agresiva") y la web el
 * masculino ("Agresivo").
 *
 * La correspondencia se busca por cabecera **exacta**, no por prefijo:
 * "Gestionada Agresiva" es prefijo de "Gestionada Agresiva +" y buscar por
 * prefijo dejaria un perfil con las cifras del otro.
 */
const PROFILE_HEADERS: [excel: string, web: string][] = [
  ['Gestionada Conservadora +', 'Conservador +'],
  ['Gestionada Conservadora', 'Conservador'],
  ['Gestionada Moderada', 'Moderado'],
  ['Gestionada Equilibrada', 'Equilibrado'],
  ['Gestionada Agresiva', 'Agresivo'],
  ['Gestionada Agresiva +', 'Agresivo +'],
];

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Fecha de la fila, en "yyyy-mm-dd".
 *
 * El export viene con la fecha como texto "dd/mm/yyyy", pero el mismo archivo
 * abierto y vuelto a guardar en Excel la convierte en numero de serie. Ya paso
 * con las fechas de rebalanceo del libro AA, asi que aqui se aceptan las tres
 * formas y se rechaza lo que no encaje en ninguna.
 */
function parseDate(cell: unknown): string | null {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);

  if (typeof cell === 'number' && cell > 0) {
    const parsed = XLSX.SSF.parse_date_code(cell);
    if (!parsed) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }

  const text = norm(cell);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "2026-06-30" -> "30/06/2026", que es lo que se lee en las pestañas. */
const toDisplayDate = (period: string): string => {
  const [y, m, d] = period.split('-');
  return `${d}/${m}/${y}`;
};

const toNumber = (cell: unknown): number | null => {
  if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  const text = norm(cell).replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

export interface StyleBoxDB {
  schemaVersion: number;
  entries: StyleBoxSnapshot[];
  /** Fecha mas reciente del archivo, para el mensaje del panel. */
  asOf: string | null;
}

export function processStyleBoxWorkbook(wb: XLSX.WorkBook): StyleBoxDB {
  const sheetName = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error('El archivo no tiene ninguna hoja.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
  const header = (rows[0] ?? []).map(norm);

  // Se localiza cada columna por su cabecera. Si el export cambia el orden de
  // los perfiles —o añade uno— las cifras siguen yendo a su sitio.
  const columns = PROFILE_HEADERS.map(([excel, web]) => ({
    web,
    size: header.indexOf(`${excel} Size Score`),
    style: header.indexOf(`${excel} Style Score`),
  })).filter((c) => c.size !== -1 && c.style !== -1);

  if (columns.length === 0) {
    throw new Error(
      'No se reconocio ninguna columna de perfil. La cabecera debe decir ' +
        '"Gestionada <perfil> Size Score" y "Gestionada <perfil> Style Score".'
    );
  }

  const entries: StyleBoxSnapshot[] = [];
  for (const row of rows.slice(1)) {
    const period = parseDate(row?.[0]);
    if (!period) continue;

    const scores: Record<string, [number, number]> = {};
    for (const col of columns) {
      const size = toNumber(row[col.size]);
      const style = toNumber(row[col.style]);
      // Un perfil sin cifras se omite; la seccion no pinta su recuadro. Poner
      // un cero lo dibujaria en la esquina "Small Value" como si fuera real.
      if (size === null || style === null) continue;
      scores[col.web] = [size, style];
    }

    if (Object.keys(scores).length === 0) continue;
    entries.push({ date: toDisplayDate(period), period, scores });
  }

  if (entries.length === 0) {
    throw new Error('No se encontro ninguna fila con fecha y puntuaciones validas.');
  }

  entries.sort((a, b) => b.period.localeCompare(a.period));

  return {
    schemaVersion: STYLE_BOX_SCHEMA_VERSION,
    entries,
    asOf: entries[0].date,
  };
}

export async function processStyleBoxExcel(file: File): Promise<StyleBoxDB> {
  const buffer = await file.arrayBuffer();
  return processStyleBoxWorkbook(XLSX.read(new Uint8Array(buffer), { type: 'array' }));
}
