import * as XLSX from 'xlsx';
import type { AssetAllocationSnapshot, AssetAllocationRow, CompositionSnapshot } from '../types.ts';

/**
 * Lee del libro AA las dos tablas que quedaban escritas a mano:
 *
 *   - Asset Allocation: hoja "Formatos", bloque "NIVELES ACTUALES". Es una foto
 *     del momento, no una serie, asi que cada subida añade (o pisa) un periodo.
 *   - Composicion: las seis pestañas de perfil, que si llevan historico: una
 *     columna por fecha de rebalanceo, 61 en el archivo actual.
 *
 * Van juntos porque salen del mismo archivo y se suben con el mismo boton que
 * las rentabilidades netas.
 */

/** Sube al cambiar la forma de los documentos. */
export const ALLOCATION_SCHEMA_VERSION = 1;

/** Orden de perfiles de la web. */
const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

/** Como se llama cada perfil en la cabecera de "Formatos". */
const FORMATOS_HEADERS = ['CONSERVADOR +', 'CONSERVADOR', 'MODERADO', 'EQUILIBRADO', 'AGRESIVO', 'AGRESIVO +'];

/** Pestaña de cada perfil. La de Conservador + lleva el "0%" en el nombre. */
const PROFILE_TABS = ['Conservador + 0%', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

type RowKind = 'group' | 'pct' | 'num' | 'text';

/**
 * Filas del bloque, en orden de presentacion.
 *
 * Es una lista explicita y no "todo lo que haya en la columna" a proposito: por
 * debajo del bloque siguen los pesos por gestora (P360, Andbank, Merchbanc...),
 * que no son asignacion de activos. Ademas, asi se nota si el libro deja de
 * traer una fila en lugar de que desaparezca en silencio.
 */
const ALLOCATION_SPEC: { sheet?: string; label: string; kind: RowKind }[] = [
  { label: 'Distribución de activos', kind: 'group' },
  { sheet: 'Monetario', label: 'Monetario', kind: 'pct' },
  { sheet: 'Renta Fija', label: 'Renta Fija', kind: 'pct' },
  { sheet: 'Renta Variable', label: 'Renta Variable', kind: 'pct' },
  { sheet: 'Alternativos', label: 'Alternativos', kind: 'pct' },
  { label: 'Renta Variable · geografía', kind: 'group' },
  { sheet: 'RV Europa', label: 'RV Europa', kind: 'pct' },
  { sheet: 'RV US', label: 'RV US', kind: 'pct' },
  { sheet: 'RV Global', label: 'RV Global', kind: 'pct' },
  { sheet: 'RV Temática', label: 'RV Temática', kind: 'pct' },
  { sheet: 'RV EM', label: 'RV EM', kind: 'pct' },
  { sheet: 'RV Japón', label: 'RV Japón', kind: 'pct' },
  { label: 'Divisas', kind: 'group' },
  { sheet: 'EUR', label: 'EUR', kind: 'pct' },
  { sheet: 'USD', label: 'USD', kind: 'pct' },
  { sheet: 'USD - DIRECTO', label: 'USD - directo', kind: 'pct' },
  { sheet: 'USD - INDIRECTO', label: 'USD - indirecto', kind: 'pct' },
  { sheet: 'GBP', label: 'GBP', kind: 'pct' },
  { sheet: 'JPY', label: 'JPY', kind: 'pct' },
  { label: 'Renta fija · métricas', kind: 'group' },
  { sheet: 'Duración Cartera', label: 'Duración cartera', kind: 'num' },
  { sheet: 'Rating Medio', label: 'Rating medio', kind: 'text' },
  { sheet: 'TIR', label: 'TIR', kind: 'pct' },
  { label: 'Sostenibilidad', kind: 'group' },
  { sheet: 'Rating ESG - MSCI', label: 'Rating ESG · MSCI', kind: 'text' },
];

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

type Grid = any[][];
const grid = (wb: XLSX.WorkBook, sheet: string): Grid =>
  XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheet], { header: 1, defval: null });

// ---------------------------------------------------------------- allocation

/**
 * Bloque "NIVELES ACTUALES" de la hoja "Formatos".
 *
 * La hoja lleva tres tablas pegadas: a la izquierda una con cinco perfiles y las
 * columnas descolocadas, en el centro esta, y a la derecha "NIVELES CIERRE", que
 * son niveles objetivo y no la cartera real. Se ancla en el titulo y se leen solo
 * las seis columnas que nombra su cabecera; las celdas sueltas que hay entre
 * ellas son restos de la tabla de al lado.
 */
export function parseAssetAllocation(wb: XLSX.WorkBook, period: string, label: string): AssetAllocationSnapshot {
  const rows = grid(wb, 'Formatos');
  if (!rows.length) throw new Error('El libro no trae la hoja "Formatos".');

  let titleRow = -1;
  let labelCol = -1;
  for (let r = 0; r < rows.length && titleRow === -1; r++) {
    const c = (rows[r] ?? []).findIndex((cell) => norm(cell).toUpperCase() === 'NIVELES ACTUALES');
    if (c !== -1) {
      titleRow = r;
      labelCol = c;
    }
  }
  if (titleRow === -1) throw new Error('No se encontro el bloque "NIVELES ACTUALES" en la hoja "Formatos".');

  const headerRow = rows.findIndex(
    (r, i) => i > titleRow && norm(r?.[labelCol]).toLowerCase().startsWith('categor')
  );
  if (headerRow === -1) throw new Error('El bloque "NIVELES ACTUALES" no tiene fila de cabecera.');

  // Las columnas de perfil no van seguidas ni a paso fijo. Se buscan por nombre,
  // y con coincidencia exacta: "CONSERVADOR" es prefijo de "CONSERVADOR +", y
  // buscar por prefijo deja un perfil vacio y otro con los datos del vecino.
  const header = rows[headerRow] ?? [];
  const cols = FORMATOS_HEADERS.map((name) => {
    const col = header.findIndex((cell, i) => i > labelCol && norm(cell).toUpperCase() === name);
    if (col === -1) throw new Error(`Falta la columna "${name}" en el bloque "NIVELES ACTUALES".`);
    return col;
  });

  const byLabel = new Map<string, any[]>();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const key = norm(rows[r]?.[labelCol]);
    if (key && !byLabel.has(key)) byLabel.set(key, rows[r]);
  }

  const missing: string[] = [];
  const out: AssetAllocationRow[] = ALLOCATION_SPEC.map((spec) => {
    if (spec.kind === 'group') return { label: spec.label, isPct: null, values: [] };

    const row = byLabel.get(spec.sheet!);
    if (!row) missing.push(spec.sheet!);

    const values = cols.map((c) => {
      const cell = row?.[c];
      if (cell === null || cell === undefined) return null;
      if (spec.kind === 'text') {
        const t = norm(cell);
        return t && t !== '-' ? t : null;
      }
      if (typeof cell !== 'number') return null;
      // Los porcentajes vienen como fraccion (0,89 = 89%); duracion y TIR no
      // comparten escala, por eso cada fila declara la suya.
      return Number((spec.kind === 'pct' ? cell * 100 : cell).toFixed(2));
    });

    return { label: spec.label, isPct: spec.kind === 'pct', values };
  });

  if (missing.length) {
    throw new Error(`El bloque "NIVELES ACTUALES" no trae estas filas: ${missing.join(', ')}.`);
  }

  return { period, label, rows: out };
}

// --------------------------------------------------------------- composition

/**
 * Fecha de una columna de rebalanceo, o null si la columna no lleva fecha.
 *
 * Hay dos formatos en el mismo libro: numero de serie de Excel en casi todas las
 * pestañas y texto "19-May-26" en la de Agresivo. Ademas, al convertir la hoja en
 * tabla Excel numero las cabeceras repetidas, asi que hay un "24-May-242" que es
 * el 24 de mayo de 2024 con un 2 pegado; por eso el patron no esta anclado al
 * final. Las columnas antiguas con nombre de mes suelto ("Noviembre", "Julio")
 * no tienen año y se descartan: inventarles uno seria peor que no mostrarlas.
 */
function columnDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === 'number' && value > 40000 && value < 60000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }

  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})/.exec(norm(value));
  if (!m) return null;
  const month = MONTHS_EN.indexOf(m[2].toLowerCase());
  if (month === -1) return null;
  return `${2000 + Number(m[3])}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS_ES[Number(m) - 1]} ${y}`;
};

/**
 * Historico de composicion a partir de las seis pestañas de perfil.
 *
 * Cada pestaña lleva los fondos en filas y una columna por fecha de rebalanceo,
 * pero no todas las carteras rebalancean el mismo dia: las fechas se unen y cada
 * fondo queda a null en los perfiles que no lo llevan o que no tocaron cartera
 * ese dia. Los fondos se identifican por ISIN, porque el mismo fondo aparece
 * escrito de forma distinta segun la pestaña ("Muzinich" y "MUZINICH").
 */
export function parseComposition(wb: XLSX.WorkBook): CompositionSnapshot[] {
  // isin -> { nombre, categoria, pesos: fecha -> [6] }
  const funds = new Map<string, { name: string; cat: string; weights: Map<string, (number | null)[]> }>();
  const dates = new Set<string>();

  PROFILE_TABS.forEach((tab, profileIdx) => {
    if (!wb.Sheets[tab]) throw new Error(`El libro no trae la pestaña "${tab}".`);
    const rows = grid(wb, tab);
    const header = rows[0] ?? [];

    const dated: { col: number; date: string }[] = [];
    for (let c = 4; c < header.length; c++) {
      const date = columnDate(header[c]);
      if (date) {
        dated.push({ col: c, date });
        dates.add(date);
      }
    }

    // La clase de activo solo se escribe en la primera fila de cada grupo.
    let cat = '';
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const group = norm(row[0]);
      if (group) cat = group;

      const isin = norm(row[3]).toUpperCase();
      const name = norm(row[2]);
      if (!isin || !name) continue;

      let fund = funds.get(isin);
      if (!fund) {
        fund = { name, cat, weights: new Map() };
        funds.set(isin, fund);
      }

      for (const { col, date } of dated) {
        const cell = row[col];
        if (typeof cell !== 'number') continue;
        let slot = fund.weights.get(date);
        if (!slot) {
          slot = [null, null, null, null, null, null];
          fund.weights.set(date, slot);
        }
        slot[profileIdx] = Number((cell * 100).toFixed(4));
      }
    }
  });

  // Mas reciente primero, como el resto de historicos de la web.
  return [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const byCat = new Map<string, { name: string; isin: string; values: (number | null)[] }[]>();

      for (const [isin, fund] of funds) {
        const values = fund.weights.get(date);
        // Un fondo sin peso en ninguna cartera ese dia no estaba en la cartera.
        if (!values || values.every((v) => v === null || v === 0)) continue;
        if (!byCat.has(fund.cat)) byCat.set(fund.cat, []);
        byCat.get(fund.cat)!.push({ name: fund.name, isin, values });
      }

      return {
        period: date,
        label: dateLabel(date),
        categories: [...byCat].map(([cat, items]) => ({
          cat,
          // Totales por perfil. Los usa la seccion para saber que perfiles tocaron
          // cartera ese dia y para arrastrar los que no (cleanCompositionSnapshots).
          totals: PROFILES.map((_, i) =>
            Number(items.reduce((a, it) => a + (it.values[i] ?? 0), 0).toFixed(4))
          ),
          items,
        })),
      };
    })
    .filter((snap) => snap.categories.length > 0);
}

// ------------------------------------------------------------------- entrada

export interface AllocationDB {
  schemaVersion: number;
  assetAllocation: AssetAllocationSnapshot;
  composition: CompositionSnapshot[];
}

export function processAllocationWorkbook(wb: XLSX.WorkBook, period: string, label: string): AllocationDB {
  return {
    schemaVersion: ALLOCATION_SCHEMA_VERSION,
    assetAllocation: parseAssetAllocation(wb, period, label),
    composition: parseComposition(wb),
  };
}

export async function processAllocationExcel(file: File, period: string, label: string): Promise<AllocationDB> {
  const buffer = await file.arrayBuffer();
  return processAllocationWorkbook(XLSX.read(new Uint8Array(buffer), { type: 'array' }), period, label);
}
