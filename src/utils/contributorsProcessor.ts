import * as XLSX from 'xlsx';
import { sheetNameToPeriod } from './changesProcessor.ts';

/**
 * Parser del archivo "LEADING CONTRIBUTORS - DETRACTORS".
 *
 * Cada hoja tiene cuatro bloques en paralelo, con el perfil escrito en la
 * primera fila de cada grupo:
 *
 *   col 1  perfil (lado YTD)          col 9   perfil (lado MES)
 *   col 2-4  CONTRIBUIDORES YTD       col 10-12  CONTRIBUIDORES MES
 *   col 5-7  DETRACTORES YTD          col 13-15  DETRACTORES MES
 *
 * Admite dos formatos:
 *   - una pestana por mes (formato objetivo, igual que niveles de credito)
 *   - una unica hoja con el mes ultimo (formato actual)
 *
 * En ambos casos se guarda el bloque MES como atribucion del periodo. El bloque
 * YTD se guarda aparte: acumula desde enero, asi que no tiene sentido
 * archivarlo como si fuera el dato de un mes concreto.
 */

export interface ContributorItem {
  f: string;
  r: number;
  c: number;
}

export interface ProfileAttribution {
  contrib: ContributorItem[];
  detract: ContributorItem[];
}

export interface AttributionBlock {
  month: string;
  label: string;
  /** Indexado por perfil, 0..5, en el mismo orden que PROFILES. */
  data: ProfileAttribution[];
  /** Mismo formato, acumulado del año. Solo en la hoja mas reciente. */
  ytd?: ProfileAttribution[];
}

/** El archivo usa el femenino ("CONSERVADORA"); la web usa el masculino. */
const PROFILE_ORDER = [
  { idx: 0, match: /^conservador[ao]\s*\+/ },
  { idx: 1, match: /^conservador[ao]$/ },
  { idx: 2, match: /^moderad[ao]$/ },
  { idx: 3, match: /^equilibrad[ao]$/ },
  { idx: 4, match: /^agresiv[ao]$/ },
  { idx: 5, match: /^agresiv[ao]\s*\+/ },
];

/**
 * Ojo: "conservadora" es prefijo de "conservadora +", y lo mismo con "agresiva".
 * Por eso se comprueba primero si lleva "+", antes de mirar el nombre base.
 */
const profileIndex = (raw: string): number | null => {
  const name = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

  if (/\+/.test(name)) {
    if (/^conservador[ao]/.test(name)) return 0;
    if (/^agresiv[ao]/.test(name)) return 5;
    return null;
  }

  const hit = PROFILE_ORDER.find((p) => p.match.test(name));
  return hit ? hit.idx : null;
};

const text = (row: any[], i: number): string => {
  const v = row?.[i];
  return v === null || v === undefined ? '' : String(v).trim();
};

const num = (row: any[], i: number): number => {
  const v = row?.[i];
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

/** Los porcentajes vienen en tanto por uno (0,0511 = 5,11%). */
const toPct = (value: number) => Number((value * 100).toFixed(4));

const emptyProfiles = (): ProfileAttribution[] =>
  Array.from({ length: 6 }, () => ({ contrib: [], detract: [] }));

interface BlockSpec {
  profileCol: number;
  contribCol: number;
  detractCol: number;
}

const YTD_SPEC: BlockSpec = { profileCol: 1, contribCol: 2, detractCol: 5 };
const MES_SPEC: BlockSpec = { profileCol: 9, contribCol: 10, detractCol: 13 };

function readBlock(rows: any[][], headerIdx: number, spec: BlockSpec): ProfileAttribution[] {
  const profiles = emptyProfiles();
  let current: number | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const label = text(row, spec.profileCol);
    if (label) {
      const idx = profileIndex(label);
      if (idx !== null) current = idx;
    }
    if (current === null) continue;

    const contribName = text(row, spec.contribCol);
    if (contribName) {
      profiles[current].contrib.push({
        f: contribName,
        r: toPct(num(row, spec.contribCol + 1)),
        c: toPct(num(row, spec.contribCol + 2)),
      });
    }

    const detractName = text(row, spec.detractCol);
    if (detractName) {
      profiles[current].detract.push({
        f: detractName,
        r: toPct(num(row, spec.detractCol + 1)),
        c: toPct(num(row, spec.detractCol + 2)),
      });
    }
  }

  return profiles;
}

/** Localiza la fila "Fondo | Retorno | Contribución". */
function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map((c: any) => String(c ?? '').toLowerCase()).join('|');
    if (joined.includes('fondo') && (joined.includes('contribu') || joined.includes('retorno'))) {
      return i;
    }
  }
  return -1;
}

const capitalise = (period: string) => {
  const [m, y] = period.split('_');
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${y}`;
};

/** Deduce el periodo del nombre del archivo cuando la hoja no lo indica. */
function periodFromFilename(fileName: string): { period: string; inferredYear: boolean } | null {
  const base = fileName.replace(/\.[^.]+$/, '');
  const direct = sheetNameToPeriod(base);
  if (direct) return { period: direct, inferredYear: false };

  // Sin año en el nombre: se asume el año en curso y se avisa al usuario.
  const withYear = sheetNameToPeriod(`${base} ${new Date().getFullYear()}`);
  return withYear ? { period: withYear, inferredYear: true } : null;
}

export interface ContributorsResult {
  blocks: Record<string, AttributionBlock>;
  /** Aviso a mostrar cuando el año se ha deducido en vez de leerse. */
  warning?: string;
}

export async function processContributorsExcel(file: File): Promise<ContributorsResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const blocks: Record<string, AttributionBlock> = {};
  let warning: string | undefined;

  const readSheet = (sheetName: string) =>
    XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: true,
    });

  // Formato objetivo: una pestana por mes.
  const monthSheets = workbook.SheetNames.map((name) => ({ name, period: sheetNameToPeriod(name) }))
    .filter((s): s is { name: string; period: string } => s.period !== null);

  if (monthSheets.length > 0) {
    for (const { name, period } of monthSheets) {
      const rows = readSheet(name);
      const headerIdx = findHeaderRow(rows);
      if (headerIdx === -1) continue;

      const data = readBlock(rows, headerIdx, MES_SPEC);
      if (data.every((p) => p.contrib.length === 0 && p.detract.length === 0)) continue;

      blocks[period] = { month: period, label: capitalise(period), data };
    }
  } else {
    // Formato actual: una sola hoja con el ultimo mes y el acumulado del año.
    const sheetName =
      workbook.SheetNames.find((n) => /cont.*detract/i.test(n)) ?? workbook.SheetNames[0];
    const rows = readSheet(sheetName);
    const headerIdx = findHeaderRow(rows);

    if (headerIdx === -1) {
      throw new Error(
        'No se encontro la fila de cabecera con las columnas "Fondo", "Retorno" y "Contribución".'
      );
    }

    const derived = periodFromFilename(file.name);
    if (!derived) {
      throw new Error(
        'No se pudo deducir a que mes corresponde el archivo. Renombra la pestana o el archivo ' +
          'incluyendo mes y año (por ejemplo "Junio 2026").'
      );
    }
    if (derived.inferredYear) {
      warning = `El archivo no indicaba el año: se ha asumido ${derived.period.split('_')[1]}.`;
    }

    const data = readBlock(rows, headerIdx, MES_SPEC);
    const ytd = readBlock(rows, headerIdx, YTD_SPEC);

    if (data.every((p) => p.contrib.length === 0 && p.detract.length === 0)) {
      throw new Error(
        'No se encontro ningun fondo en el bloque del mes. Revisa que los perfiles ' +
          '(CONSERVADORA, MODERADA, ...) esten en su columna habitual.'
      );
    }

    blocks[derived.period] = {
      month: derived.period,
      label: capitalise(derived.period),
      data,
      ytd,
    };
  }

  if (Object.keys(blocks).length === 0) {
    throw new Error('No se pudo leer ningun periodo del archivo de contribuidores.');
  }

  return { blocks, warning };
}
