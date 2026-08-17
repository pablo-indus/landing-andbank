import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { PROFILES } from '../data/portfolioData';
import { allocationColor } from '../utils/allocationColors';
import { breakdownParent } from '../utils/allocationRows';

/*
  Piezas del informe impreso que no se pueden reutilizar de las secciones de
  pantalla: las tablas largas hay que poder cortarlas por un sitio elegido, no
  por donde caiga el borde de la hoja. Cada bloque es una unidad que cabe entera
  en una pagina; `PrintReportLayout` los mide y los reparte.
*/

export type PrintBlock = {
  key: string;
  /** Contenido. Si el bloque pertenece a un grupo, tiene que ser un <tbody>. */
  body: React.ReactNode;
  /** Tabla a la que pertenece el bloque; los consecutivos comparten cabecera. */
  group?: string;
  /** Rotulo que se repite cuando el grupo continua en la pagina siguiente. */
  groupTitle?: string;
  /** Cabecera <thead>, que se vuelve a dibujar en cada pagina del grupo. */
  head?: React.ReactNode;
  /**
   * <colgroup> de la tabla. Las columnas van a ancho fijo a proposito: si el
   * navegador las reparte segun el contenido, cada trozo de la tabla sale con
   * anchos distintos y lo medido en el reparto deja de valer para lo impreso.
   */
  cols?: React.ReactNode;
  /** Impide que el bloque se quede solo al pie de una pagina. */
  keepWithNext?: boolean;
};

const pct = (v: number, decimals = 2) => `${v.toFixed(decimals).replace('.', ',')}%`;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const TH = 'px-2 py-1 text-[8px] font-bold uppercase tracking-wider';
const TD = 'px-2 py-[3px] text-[8.5px]';

/**
 * La paleta vive en `utils/allocationColors` porque el PowerPoint pinta los
 * mismos donuts: si cada formato tuviera la suya, el informe cambiaria de
 * colores segun se exportara a PDF o a PPT.
 */
export const AA_COLORS = allocationColor;

/* ---------------------------------------------------------------- composicion */

export function compositionBlocks(snapshot: any, profiles: number[]): PrintBlock[] {
  if (!snapshot) return [];

  const pctCol = 9;
  const cols = (
    <colgroup>
      <col style={{ width: `${100 - 13 - pctCol * profiles.length}%` }} />
      <col style={{ width: '13%' }} />
      {profiles.map((p) => (
        <col key={p} style={{ width: `${pctCol}%` }} />
      ))}
    </colgroup>
  );

  const head = (
    <thead>
      <tr className="bg-zinc-900 text-white">
        <th className={`${TH} text-left`}>Categoría / Fondo</th>
        <th className={`${TH} text-left`}>ISIN</th>
        {profiles.map((p) => (
          <th key={p} className={`${TH} text-right whitespace-nowrap`}>
            {PROFILES[p]}
          </th>
        ))}
      </tr>
    </thead>
  );

  const blocks: PrintBlock[] = [];

  snapshot.categories.forEach((cat: any) => {
    const items = cat.items.filter((item: any) =>
      profiles.some((p) => item.values[p] !== null && item.values[p] !== undefined && item.values[p] !== 0)
    );
    if (items.length === 0) return;

    // Una categoria muy larga se parte, pero siempre entre fondos y repitiendo
    // su fila de titulo, nunca a mitad de una linea.
    chunk(items, 22).forEach((part, partIdx) => {
      blocks.push({
        key: `comp-${cat.cat}-${partIdx}`,
        group: 'composicion',
        groupTitle: 'Desglose de fondos subyacentes',
        head,
        cols,
        body: (
          <tbody>
            <tr className="bg-zinc-100 border-y border-zinc-300">
              <td className={`${TD} font-bold uppercase tracking-wider text-zinc-800`} colSpan={2}>
                {cat.cat}
                {partIdx > 0 && <span className="font-normal normal-case text-zinc-500"> (cont.)</span>}
              </td>
              {profiles.map((p) => (
                <td key={p} className={`${TD} text-right font-mono font-bold tabular-nums text-zinc-900`}>
                  {cat.totals[p] > 0 ? pct(cat.totals[p]) : '—'}
                </td>
              ))}
            </tr>
            {part.map((item: any) => (
              <tr key={item.isin || item.name} className="border-b border-zinc-100">
                <td className={`${TD} pl-4 text-zinc-800`}>{item.name}</td>
                <td className={`${TD} font-mono text-[7.5px] text-zinc-400`}>{item.isin}</td>
                {profiles.map((p) => {
                  const v = item.values[p];
                  return (
                    <td key={p} className={`${TD} text-right font-mono tabular-nums text-zinc-700`}>
                      {v !== null && v !== undefined && v !== 0 ? pct(v) : <span className="text-zinc-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ),
      });
    });
  });

  return blocks;
}

/* ------------------------------------------------------------ asset allocation */

/** Filas del bloque "Distribución de activos", que son las del grafico. */
function mainAllocationRows(snapshot: any) {
  const rows: any[] = [];
  let inside = false;
  for (const r of snapshot.rows) {
    if (r.isPct === null) {
      inside = r.label.toLowerCase().includes('distribución de activos');
    } else if (inside) {
      rows.push(r);
    }
  }
  return rows;
}

const AllocationDonut: React.FC<{ profile: number; rows: any[]; size: number }> = ({ profile, rows, size }) => {
  const data = rows
    .map((row) => ({
      name: row.label,
      value: typeof row.values[profile] === 'number' ? row.values[profile] : parseFloat(row.values[profile]) || 0,
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div className="flex items-center gap-3 border border-zinc-200 rounded p-2">
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={size * 0.27}
          outerRadius={size * 0.47}
          paddingAngle={1}
          dataKey="value"
          isAnimationActive={false}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={AA_COLORS(entry.name)} />
          ))}
        </Pie>
      </PieChart>
      <div className="flex-1 min-w-0">
        <h4 className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-900 border-b border-zinc-200 pb-0.5 mb-1">
          {PROFILES[profile]}
        </h4>
        {data.map((d) => (
          <div key={d.name} className="flex items-baseline justify-between gap-2 leading-tight">
            <span className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: AA_COLORS(d.name) }} />
              <span className="text-[8px] text-zinc-600 truncate">{d.name}</span>
            </span>
            <span className="text-[8.5px] font-mono font-bold tabular-nums text-zinc-900">{pct(d.value, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function allocationBlocks(snapshot: any, profiles: number[]): PrintBlock[] {
  if (!snapshot) return [];

  const blocks: PrintBlock[] = [];
  const mainRows = mainAllocationRows(snapshot);

  // Un donut por perfil, con sus pesos al lado: el grafico solo no dice nada.
  if (mainRows.length > 0) {
    const size = profiles.length === 1 ? 150 : 110;
    blocks.push({
      key: 'aa-donuts',
      keepWithNext: true,
      body: (
        <div className={`grid gap-2 ${profiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {profiles.map((p) => (
            <AllocationDonut key={p} profile={p} rows={mainRows} size={size} />
          ))}
        </div>
      ),
    });
  }

  const pctCol = profiles.length > 3 ? 12 : 15;
  const cols = (
    <colgroup>
      <col style={{ width: `${100 - pctCol * profiles.length}%` }} />
      {profiles.map((p) => (
        <col key={p} style={{ width: `${pctCol}%` }} />
      ))}
    </colgroup>
  );

  const head = (
    <thead>
      <tr className="bg-zinc-900 text-white">
        <th className={`${TH} text-left`}>Categoría / Métrica</th>
        {profiles.map((p) => (
          <th key={p} className={`${TH} text-right whitespace-nowrap`}>
            {PROFILES[p]}
          </th>
        ))}
      </tr>
    </thead>
  );

  // Las filas vienen en bloques encabezados por una fila sin porcentaje
  // (`isPct === null`). Se corta por ahi, que es donde el corte significa algo.
  const groups: { title: string; rows: any[] }[] = [];
  snapshot.rows.forEach((row: any) => {
    if (row.isPct === null) {
      groups.push({ title: row.label, rows: [] });
    } else if (groups.length > 0) {
      const hasValue = profiles.some(
        (p) => row.values[p] !== null && row.values[p] !== undefined && row.values[p] !== 0
      );
      if (hasValue) groups[groups.length - 1].rows.push(row);
    }
  });

  groups
    .filter((g) => g.rows.length > 0)
    .forEach((group, idx) => {
      blocks.push({
        key: `aa-${idx}`,
        group: 'allocation',
        groupTitle: 'Asset allocation',
        head,
        cols,
        body: (
          <tbody>
            <tr className="bg-zinc-100 border-y border-zinc-300">
              <td className={`${TD} font-bold uppercase tracking-wider text-zinc-800`} colSpan={profiles.length + 1}>
                {group.title}
              </td>
            </tr>
            {group.rows.map((row: any, rowIdx: number) => {
              // "USD - directo" y "USD - indirecto" desglosan "USD": van en
              // cursiva y sangradas para que no se sumen a ojo con su fila madre.
              const parent = breakdownParent(
                row.label,
                group.rows.slice(0, rowIdx).map((r: any) => String(r.label))
              );
              return (
              <tr key={row.label} className="border-b border-zinc-100">
                <td className={`${TD} ${parent ? 'pl-4 italic text-zinc-500' : 'text-zinc-800'}`}>{row.label}</td>
                {profiles.map((p) => {
                  const v = row.values[p];
                  return (
                    <td
                      key={p}
                      className={`${TD} text-right font-mono tabular-nums ${parent ? 'italic text-zinc-500' : 'text-zinc-700'}`}
                    >
                      {v === null || v === undefined || v === 0 ? (
                        <span className="text-zinc-300">—</span>
                      ) : row.isPct ? (
                        typeof v === 'number' ? pct(v, 1) : `${v}%`
                      ) : (
                        v
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        ),
      });
    });

  return blocks;
}
