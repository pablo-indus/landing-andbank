import * as XLSX from 'xlsx';

/**
 * Parser del archivo "Plantilla Pagina Cambios.xlsx".
 *
 * Cada pestana es un mes. Dentro de cada pestana:
 *   - fila de cabecera: Cartera | Asset Class | Operación | Instrumento | Racional
 *   - un GRUPO empieza cada vez que la columna "Cartera" tiene texto
 *   - el racional se escribe solo en la primera fila del grupo
 *   - las filas en blanco separan grupos visualmente
 *
 * Un grupo es una decision completa: siempre hay al menos dos movimientos,
 * porque lo que se vende hay que recolocarlo en otro sitio.
 *
 * Sustituye al parseo por IA: el mismo archivo daba resultados distintos entre
 * ejecuciones y no habia forma de saber cual era correcto.
 */

export interface ChangeMovement {
  type: string;
  instrument: string;
  tag: string;
  meta: string;
}

export interface ChangeBatch {
  rationale: string;
  entries: ChangeMovement[];
  exits: ChangeMovement[];
}

export interface ChangeBlock {
  period: string;
  batches: ChangeBatch[];
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Abreviaturas tal y como aparecen en las pestanas ("Nov 2021", "Sept 2023", "Ene 2022"). */
const MONTH_ALIASES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/** "Sept 2023" -> "septiembre_2023". Devuelve null si la pestana no es un mes. */
export function sheetNameToPeriod(sheetName: string): string | null {
  const normalized = sheetName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const yearMatch = normalized.match(/(20\d{2})/);
  if (!yearMatch) return null;

  // Se prueban primero las formas largas para que "sept" no se resuelva como "sep".
  const candidates = Object.keys(MONTH_ALIASES).sort((a, b) => b.length - a.length);
  const monthKey = candidates.find((alias) => new RegExp(`\\b${alias}`).test(normalized));
  if (!monthKey) return null;

  return `${MONTHS[MONTH_ALIASES[monthKey] - 1]}_${yearMatch[1]}`;
}

const cell = (row: any[] | undefined, idx: number): string => {
  if (!row || idx < 0) return '';
  const value = row[idx];
  if (value === null || value === undefined) return '';
  // Los racionales llevan saltos de linea de Excel (CRLF). Se normalizan a LF
  // para que dos lecturas del mismo archivo den exactamente el mismo texto y
  // las comparaciones entre versiones no muestren diferencias falsas.
  return String(value).replace(/\r\n/g, '\n').trim();
};

/**
 * Compra/Incrementa son entradas; Venta/Disminuye son salidas.
 * En las pestanas antiguas van en minuscula ("venta", "compra").
 */
const classify = (operation: string): 'entry' | 'exit' | null => {
  const op = operation.toLowerCase();
  if (/compra|increment|aumenta/.test(op)) return 'entry';
  if (/venta|vende|disminuye|reduc/.test(op)) return 'exit';
  return null;
};

export async function processChangesExcel(file: File): Promise<Record<string, ChangeBlock>> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const result: Record<string, ChangeBlock> = {};
  const skipped: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const period = sheetNameToPeriod(sheetName);
    if (!period) {
      skipped.push(sheetName);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: true,
    });

    // Cabecera: la fila que contiene a la vez "Cartera" y "Operación".
    let headerIdx = -1;
    let colCartera = -1;
    let colAsset = -1;
    let colOperacion = -1;
    let colInstrumento = -1;
    let colRacional = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const find = (re: RegExp) =>
        row.findIndex((c: any) => typeof c === 'string' && re.test(c.trim().toLowerCase()));

      const cartera = find(/^cartera$/);
      const operacion = find(/^operaci/);
      if (cartera !== -1 && operacion !== -1) {
        headerIdx = i;
        colCartera = cartera;
        colOperacion = operacion;
        colAsset = find(/^asset|^clase/);
        colInstrumento = find(/^instrumento|^fondo/);
        colRacional = find(/^racional|^justific/);
        break;
      }
    }

    if (headerIdx === -1) {
      skipped.push(sheetName);
      continue;
    }

    const batches: ChangeBatch[] = [];
    let current: ChangeBatch | null = null;
    let currentCarteras = '';

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const cartera = cell(row, colCartera);
      const operacion = cell(row, colOperacion);
      const instrumento = cell(row, colInstrumento);

      // Texto en "Cartera" = empieza una decision nueva.
      if (cartera) {
        if (current && (current.entries.length || current.exits.length)) batches.push(current);
        currentCarteras = cartera;
        current = { rationale: '', entries: [], exits: [] };
      }

      if (!current) continue;

      // El racional puede estar en la primera fila del grupo o en una posterior.
      const racional = cell(row, colRacional);
      if (racional && !current.rationale) current.rationale = racional;

      if (!operacion || !instrumento) continue;

      const kind = classify(operacion);
      if (!kind) continue;

      const movement: ChangeMovement = {
        type: operacion.charAt(0).toUpperCase() + operacion.slice(1).toLowerCase(),
        instrument: instrumento,
        tag: cell(row, colAsset),
        meta: currentCarteras,
      };

      if (kind === 'entry') current.entries.push(movement);
      else current.exits.push(movement);
    }

    if (current && (current.entries.length || current.exits.length)) batches.push(current);
    if (batches.length === 0) {
      skipped.push(sheetName);
      continue;
    }

    // Pestanas duplicadas del mismo mes (p.ej. "May 2024" y "May 2024 (2)")
    // se acumulan en el mismo periodo en lugar de pisarse.
    if (result[period]) result[period].batches.push(...batches);
    else result[period] = { period, batches };
  }

  if (Object.keys(result).length === 0) {
    throw new Error(
      'No se encontro ninguna hoja de cambios valida. Cada pestana debe llamarse como el mes ' +
        '(ej. "Mayo 2026") y contener una fila de cabecera con las columnas Cartera y Operación.' +
        (skipped.length ? ` Hojas ignoradas: ${skipped.join(', ')}.` : '')
    );
  }

  return result;
}
