import * as XLSX from 'xlsx';
import type { CorrelationMatrix } from '../types.ts';

/**
 * Lee el export de correlaciones de Morningstar ("CorrelacionesGestionadas").
 *
 * Una hoja por perfil, **en orden de riesgo ascendente**: la primera es
 * Conservador + y la ultima Agresivo +. Cada hoja es una tabla triangular
 * inferior: la fila de cabecera numera las columnas y la primera celda de cada
 * fila trae "3   Nombre del fondo".
 *
 * A diferencia de los otros libros, aqui **no se puede identificar la hoja por
 * su nombre**: el export las llama a todas "Matriz de correlaciones entre f..."
 * y Excel resuelve el choque añadiendo "(1)", "(2)"... Es decir, el nombre dice
 * en que orden se exportaron, no de que perfil son. Por eso el orden se toma
 * como viene y se devuelve un resumen (perfil, numero de fondos y primer fondo)
 * para que quien sube el archivo pueda comprobarlo de un vistazo, ademas del
 * aviso automatico de `orderWarning`.
 */

/** Sube al cambiar la forma del documento. */
export const CORRELATION_SCHEMA_VERSION = 1;

/** Orden de perfiles de la web, que es el de las hojas del archivo. */
const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

/** Pistas de renta fija en el nombre de un fondo, para detectar el orden invertido. */
const FIXED_INCOME_HINTS = /corto plazo|renta fija|bond|credit|monetari|yield|govies|duration/i;

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** "3   Muzinich Enhancedyield S-T" -> "Muzinich Enhancedyield S-T". */
const stripIndex = (label: string) => norm(label).replace(/^\d+\s+/, '');

const toNumber = (cell: unknown): number | null => {
  if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  const text = norm(cell).replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

/**
 * Una hoja: nombres de fondo y matriz cuadrada.
 *
 * El archivo solo trae el triangulo inferior y aqui se refleja para dejar la
 * matriz completa, que es la forma que ya tenia `corrData.ts` y la que espera
 * la seccion. La diagonal se fuerza a 1: el archivo la trae, pero si un dia
 * llegara vacia una matriz con ceros en la diagonal se leeria como un fondo sin
 * correlacion consigo mismo.
 */
function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): CorrelationMatrix {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
  const body = rows.slice(1).filter((row) => stripIndex(String(row?.[0] ?? '')) !== '');

  const labels = body.map((row) => stripIndex(String(row[0])));
  const n = labels.length;
  if (n === 0) throw new Error(`La hoja "${sheetName}" no tiene ningun fondo.`);

  const matrix: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const value = toNumber(body[i][j + 1]);
      if (value === null) {
        throw new Error(
          `La hoja "${sheetName}" no trae la correlacion entre "${labels[i]}" y "${labels[j]}".`
        );
      }
      matrix[i][j] = value;
      matrix[j][i] = value;
    }
    matrix[i][i] = 1;
  }

  return { labels, matrix };
}

export interface CorrelationDB {
  schemaVersion: number;
  /** Una matriz por perfil, con el nombre que usa la web. */
  profiles: Record<string, CorrelationMatrix>;
  /** Perfil, numero de fondos y primer fondo, para comprobar el orden a ojo. */
  summary: { profile: string; funds: number; first: string }[];
  /** Aviso si el archivo parece venir en orden inverso. */
  orderWarning: string | null;
}

export function processCorrelationWorkbook(wb: XLSX.WorkBook): CorrelationDB {
  if (wb.SheetNames.length !== PROFILES.length) {
    throw new Error(
      `El archivo tiene ${wb.SheetNames.length} hojas y se esperaban ${PROFILES.length}, ` +
        'una por perfil y en orden de riesgo ascendente (Conservador + primero).'
    );
  }

  const profiles: Record<string, CorrelationMatrix> = {};
  const summary: CorrelationDB['summary'] = [];

  wb.SheetNames.forEach((sheetName, i) => {
    const parsed = parseSheet(wb.Sheets[sheetName], sheetName);
    profiles[PROFILES[i]] = parsed;
    summary.push({ profile: PROFILES[i], funds: parsed.labels.length, first: parsed.labels[0] });
  });

  /*
    Si las hojas vinieran del reves, cada perfil se llevaria la matriz de su
    opuesto y la seccion seguiria pintando una matriz creible: mismos colores,
    mismos numeros, fondos que ese perfil no tiene. La cartera mas conservadora
    esta hecha de renta fija y la mas agresiva de renta variable, asi que se
    comprueba eso mismo.
  */
  const conservative = profiles[PROFILES[0]].labels;
  const aggressive = profiles[PROFILES[PROFILES.length - 1]].labels;
  const fixedShare = (labels: string[]) =>
    labels.filter((l) => FIXED_INCOME_HINTS.test(l)).length / labels.length;

  const orderWarning =
    fixedShare(conservative) < fixedShare(aggressive)
      ? 'Aviso: la primera hoja parece mas de renta variable que la ultima. ' +
        'Comprueba que las hojas van de Conservador + a Agresivo + y no al reves.'
      : null;

  return { schemaVersion: CORRELATION_SCHEMA_VERSION, profiles, summary, orderWarning };
}

export async function processCorrelationExcel(file: File): Promise<CorrelationDB> {
  const buffer = await file.arrayBuffer();
  return processCorrelationWorkbook(XLSX.read(new Uint8Array(buffer), { type: 'array' }));
}
