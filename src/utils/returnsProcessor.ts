import * as XLSX from 'xlsx';

/**
 * Parser de las hojas de rentabilidad del libro "AA GDC".
 *
 *   "Historico anual"             rentabilidad por año, desde 2009
 *   "Historico mensual"           rentabilidad por mes, desde 2021
 *   "Historico mensual STD DEV"   volatilidad por mes, desde 2020-12
 *
 * Estas cifras son NETAS de comisiones. Comprobado contra la hoja
 * COMISIONES@CONTRATOS: componiendo 2023-2025 del "Historico anual" sale
 * 13,89% / 17,67% / 21,59% para Conservador / Moderado / Equilibrado, que
 * coincide con su columna "Rentabilidad neta esperada" (13,92 / 17,68 / 21,60).
 * Las series diarias de Morningstar (VL) son BRUTAS, por lo que no sirven para
 * lo que la web declara mostrar ("netos de cualquier comision aplicable").
 *
 * Solo hay datos de cuatro perfiles: Conservador, Moderado, Equilibrado y
 * Agresivo. Conservador + y Agresivo + no aparecen en ninguna de las tres hojas.
 * Por eso se devuelve un objeto por nombre de perfil y no una lista de seis
 * posiciones: asi la ausencia es explicita y nadie la rellena por error con un
 * cero que parezca un dato real.
 */

export interface ReturnRow {
  /** "2009" para lo anual, "2021-01" para lo mensual. */
  period: string;
  byProfile: Record<string, number>;
}

export interface ReturnsData {
  annual: ReturnRow[];
  monthly: ReturnRow[];
  volatility: ReturnRow[];
  /** Perfiles realmente presentes en el archivo. */
  profiles: string[];
  /** Perfiles que la web muestra pero para los que no hay datos. */
  missingProfiles: string[];
}

const ALL_PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Reconoce el nombre de perfil de la primera columna. */
const matchProfile = (raw: string): string | null => {
  const name = normalise(raw);
  if (!name) return null;
  const hit = ALL_PROFILES.find((p) => normalise(p) === name);
  return hit ?? null;
};

const toNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace('%', '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

/** Los valores vienen en tanto por uno (0,0418 = 4,18%). */
const toPct = (n: number) => Number((n * 100).toFixed(4));

/** Cabecera de columna -> etiqueta de periodo. Acepta años sueltos y fechas. */
const headerToPeriod = (value: any, kind: 'annual' | 'monthly'): string | null => {
  if (value === null || value === undefined || value === '') return null;

  if (kind === 'annual') {
    const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
    return Number.isInteger(n) && n >= 2000 && n <= 2100 ? String(n) : null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** Localiza la fila cuya primera celda es "Perfiles". */
const findHeaderRow = (rows: any[][]): number =>
  rows.findIndex((row) => row && String(row[0] ?? '').trim().toLowerCase().startsWith('perfil'));

function readSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  kind: 'annual' | 'monthly'
): { rows: ReturnRow[]; profiles: string[] } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], profiles: [] };

  const grid = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true,
  });

  const headerIdx = findHeaderRow(grid);
  if (headerIdx === -1) return { rows: [], profiles: [] };

  const header = grid[headerIdx];
  const columns: { col: number; period: string }[] = [];
  for (let c = 1; c < header.length; c++) {
    const period = headerToPeriod(header[c], kind);
    if (period) columns.push({ col: c, period });
  }

  const byPeriod = new Map<string, Record<string, number>>();
  const profiles: string[] = [];

  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const profile = matchProfile(String(row[0] ?? ''));
    if (!profile) continue;
    profiles.push(profile);

    for (const { col, period } of columns) {
      const raw = toNumber(row[col]);
      if (raw === null) continue;
      if (!byPeriod.has(period)) byPeriod.set(period, {});
      byPeriod.get(period)![profile] = toPct(raw);
    }
  }

  const rows = [...byPeriod.entries()]
    .map(([period, byProfile]) => ({ period, byProfile }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { rows, profiles };
}

/** Busca una hoja por palabras clave, tolerando variaciones de nombre. */
const findSheet = (workbook: XLSX.WorkBook, ...required: string[]): string | undefined =>
  workbook.SheetNames.find((name) => {
    const n = normalise(name);
    return required.every((token) => n.includes(token));
  });

export async function processReturnsExcel(file: File): Promise<ReturnsData> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });

  // "STD DEV" lleva tambien "mensual", asi que se localiza primero y se excluye
  // al buscar la hoja de rentabilidad mensual.
  const volSheet = findSheet(workbook, 'std');
  const annualSheet = findSheet(workbook, 'historico', 'anual');
  const monthlySheet = workbook.SheetNames.find((name) => {
    const n = normalise(name);
    return n.includes('historico') && n.includes('mensual') && !n.includes('std');
  });

  if (!annualSheet && !monthlySheet) {
    throw new Error(
      'No se encontraron las hojas de rentabilidad. El libro debe incluir ' +
        '"Historico anual" y/o "Historico mensual".'
    );
  }

  const annual = annualSheet ? readSheet(workbook, annualSheet, 'annual') : { rows: [], profiles: [] };
  const monthly = monthlySheet ? readSheet(workbook, monthlySheet, 'monthly') : { rows: [], profiles: [] };
  const volatility = volSheet ? readSheet(workbook, volSheet, 'monthly') : { rows: [], profiles: [] };

  const profiles = [...new Set([...annual.profiles, ...monthly.profiles, ...volatility.profiles])];

  if (profiles.length === 0) {
    throw new Error(
      'No se reconocio ningun perfil. La primera columna debe contener los nombres ' +
        '(Conservador, Moderado, Equilibrado, Agresivo).'
    );
  }

  if (annual.rows.length === 0 && monthly.rows.length === 0) {
    throw new Error('Las hojas de rentabilidad no contenian ningun periodo legible.');
  }

  return {
    annual: annual.rows,
    monthly: monthly.rows,
    volatility: volatility.rows,
    profiles,
    missingProfiles: ALL_PROFILES.filter((p) => !profiles.includes(p)),
  };
}
