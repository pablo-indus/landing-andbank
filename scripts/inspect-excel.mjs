/**
 * Inspector de archivos Excel: sirve para ver la estructura real de un libro
 * antes de escribir un parser para el.
 *
 * Uso:
 *   node scripts/inspect-excel.mjs "<ruta.xlsx>"                    -> lista las hojas
 *   node scripts/inspect-excel.mjs "<ruta.xlsx>" dump <hoja> [filas] -> vuelca las filas
 *
 * <hoja> puede ser el nombre o el indice numerico.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const file = process.argv[2];
const mode = process.argv[3] || 'sheets';
const target = process.argv[4];
const maxRows = Number(process.argv[5] || 12);

if (!file) {
  console.error('Falta la ruta del archivo.');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(file), { type: 'buffer', cellDates: true });

if (mode === 'sheets') {
  console.log('SHEETS:', wb.SheetNames.length);
  wb.SheetNames.forEach((n, i) => {
    const ws = wb.Sheets[n];
    const ref = ws['!ref'];
    const r = XLSX.utils.decode_range(ref || 'A1:A1');
    console.log(`  [${i}] "${n}"  rows=${ref ? r.e.r + 1 : 0} cols=${ref ? r.e.c + 1 : 0}`);
  });
} else if (mode === 'dump') {
  const name = /^\d+$/.test(target) ? wb.SheetNames[Number(target)] : target;
  const ws = wb.Sheets[name];
  if (!ws) {
    console.error(`No existe la hoja "${target}".`);
    process.exit(1);
  }
  console.log(`SHEET: "${name}"`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });
  rows.slice(0, maxRows).forEach((row, i) => {
    const cells = (row || []).map((c) => {
      if (c === null || c === undefined) return '·';
      if (c instanceof Date) return c.toISOString().slice(0, 10);
      const s = String(c);
      return s.length > 22 ? s.slice(0, 22) + '…' : s;
    });
    console.log(String(i).padStart(3) + ' | ' + cells.join(' | '));
  });
  console.log(`... filas totales: ${rows.length}`);
}
