import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PROFILES } from '../data/portfolioData';
import { SectionBacktest } from './SectionBacktest';
import { SectionDrawdown } from './SectionDrawdown';
import { SectionRendimiento } from './SectionRendimiento';
import { SectionContribuidores } from './SectionContribuidores';
import { globalSettings } from '../store';
import { useMonthlyReports } from '../hooks/useMonthlyReports';
import { allocationBlocks, compositionBlocks, type PrintBlock } from './printBlocks';

/*
  El informe se pagina aqui, no en el navegador.

  Antes se volcaban las secciones de pantalla una detras de otra y el navegador
  cortaba por donde le tocaba: titulos al pie de una hoja con su grafico en la
  siguiente, un donut partido por la mitad y el descargo de responsabilidad
  ocupando una pagina entera.

  Ahora cada seccion se descompone en bloques que caben en una pagina, se miden
  en un contenedor oculto y se reparten: un bloque nunca se parte, las tablas
  largas se cortan entre categorias y repiten cabecera, y cada hoja lleva su
  cabecera, su pie y su numero de pagina. Si cambian los margenes de `@page` en
  `index.css`, hay que mover `PAGE_BODY_PX` con ellos.
*/

/** Alto util de una hoja, ya descontados cabecera y pie. A4 menos 12 mm. */
const PAGE_BODY_PX = 935;
/** Por debajo de esto una hoja se considera un rabo y se reparte con la anterior. */
const STUB_PAGE_PX = 320;
/** Alto del rotulo "(continuación)" que encabeza un grupo partido entre hojas. */
const CONT_LABEL_PX = 18;
/** Separacion vertical entre bloques de una misma hoja (space-y-3). */
const BLOCK_GAP_PX = 12;

const LOGO = '/logo.jpg';

interface PrintReportLayoutProps {
  profiles: number[];
}

const SectionHeading: React.FC<{ n: number; title: string; note?: string }> = ({ n, title, note }) => (
  <div className="flex items-baseline gap-2 border-b-2 border-[#7A1611] pb-1 mb-2">
    <span className="text-[10px] font-extrabold text-[#E32119] tabular-nums">{String(n).padStart(2, '0')}</span>
    <h2 className="text-[12px] font-extrabold uppercase tracking-wider text-zinc-900">{title}</h2>
    {note && <span className="ml-auto text-[8px] font-medium text-zinc-500">{note}</span>}
  </div>
);

/** Reparte los bloques en hojas usando la altura real medida de cada uno. */
function paginate(
  blocks: PrintBlock[],
  heights: Record<string, number>,
  headHeights: Record<string, number>,
  firstOfGroup: Record<string, string>
): PrintBlock[][] {
  // Alto que ocupa una lista de bloques puesta en una hoja. Los bloques
  // consecutivos de la misma tabla se dibujan dentro de un solo <table>, asi que
  // ni llevan separacion entre ellos ni repiten cabecera.
  const heightOfPage = (list: PrintBlock[]) => {
    let total = 0;
    let openGroup: string | undefined;
    list.forEach((b, i) => {
      // Los bloques de una tabla (los que traen cabecera) se funden en un solo
      // <table> y van pegados; los de un grupo sin cabecera se apilan separados.
      const merged = !!b.group && b.group === openGroup && !!b.head;
      if (i > 0 && !merged) total += BLOCK_GAP_PX;
      if (b.group && b.group !== openGroup) {
        if (b.head) total += headHeights[b.group] ?? 0;
        // El grupo viene de la hoja anterior: lleva el rotulo "(continuación)".
        if (firstOfGroup[b.group] !== b.key) total += CONT_LABEL_PX;
      }
      total += heights[b.key] ?? 0;
      openGroup = b.group;
    });
    return total;
  };

  const pages: PrintBlock[][] = [];
  let current: PrintBlock[] = [];

  blocks.forEach((block, idx) => {
    // Un bloque marcado `keepWithNext` (un titulo, por ejemplo) solo entra en la
    // hoja si tambien cabe lo que viene detras; si no, arrastra el salto. La
    // cadena se sigue hasta el final: si no, un titulo pegado a un grafico que a
    // su vez esta pegado a su tabla se quedaba solo al pie de la hoja.
    const chain = [block];
    let last = idx;
    while (blocks[last].keepWithNext && blocks[last + 1]) {
      last += 1;
      chain.push(blocks[last]);
    }

    if (current.length > 0 && heightOfPage([...current, ...chain]) > PAGE_BODY_PX) {
      pages.push(current);
      current = [];
    }

    current.push(block);
  });

  if (current.length > 0) pages.push(current);

  // Una ultima hoja con cuatro lineas queda ridicula. Si ha salido asi, se le
  // baja contenido de la anterior hasta que las dos tengan un tamaño decente.
  const lastIdx = pages.length - 1;
  if (lastIdx > 0) {
    while (
      pages[lastIdx].length > 0 &&
      pages[lastIdx - 1].length > 1 &&
      heightOfPage(pages[lastIdx]) < STUB_PAGE_PX
    ) {
      const previous = pages[lastIdx - 1];
      const moved = previous[previous.length - 1];
      // No se mueve un bloque que arrastra al siguiente: se separaria del suyo.
      if (previous[previous.length - 2]?.keepWithNext) break;
      const candidate = [moved, ...pages[lastIdx]];
      if (heightOfPage(candidate) > PAGE_BODY_PX) break;
      // Tampoco vale vaciar la hoja anterior para llenar la ultima.
      if (heightOfPage(previous.slice(0, -1)) < PAGE_BODY_PX * 0.65) break;
      previous.pop();
      pages[lastIdx] = candidate;
    }
  }

  return pages;
}

/** Dibuja los bloques de una hoja, uniendo en una sola tabla los del mismo grupo. */
function renderBlocks(blocks: PrintBlock[], firstOfGroup: Record<string, string>) {
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (!block.group) {
      out.push(<div key={block.key}>{block.body}</div>);
      i += 1;
      continue;
    }

    const group = block.group;
    const run: PrintBlock[] = [];
    while (i < blocks.length && blocks[i].group === group) {
      run.push(blocks[i]);
      i += 1;
    }

    const isContinuation = firstOfGroup[group] !== run[0].key;
    const label = isContinuation && (
      <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
        {run[0].groupTitle} (continuación)
      </p>
    );

    out.push(
      <div key={`${group}-${run[0].key}`}>
        {label}
        {run[0].head ? (
          <table className="w-full border-collapse table-fixed">
            {run[0].cols}
            {run[0].head}
            {run.map((b) => (
              <React.Fragment key={b.key}>{b.body}</React.Fragment>
            ))}
          </table>
        ) : (
          <div className="space-y-3">
            {run.map((b) => (
              <div key={b.key}>{b.body}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return out;
}

export const PrintReportLayout: React.FC<PrintReportLayoutProps> = ({ profiles }) => {
  // La portada mostraba "Julio 2026" escrito a mano, asi que salia mal en
  // cualquier otro mes. Ahora refleja la fecha real de los datos publicados.
  const { lastUpdated, composition, assetAllocation } = useMonthlyReports();
  const coverDate = (lastUpdated ?? new Date()).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  const coverDateLabel = coverDate.charAt(0).toUpperCase() + coverDate.slice(1);
  const profileNames = profiles.map((p) => PROFILES[p]).join(' · ');

  /*
    El informe se imprime siempre en claro. Las secciones que se reutilizan de
    la pantalla llevan variantes `dark:` por todas partes, asi que si la clase
    `dark` sigue puesta al imprimir salen cuatro secciones con fondo negro y las
    otras dos en blanco. Aqui se quita mientras la maqueta esta montada, pase lo
    que pase antes (el boton, Ctrl+P o un re-render).
  */
  useLayoutEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    if (hadDark) root.classList.remove('dark');
    return () => {
      if (hadDark) root.classList.add('dark');
    };
  }, []);

  useEffect(() => {
    const defaultTitle = document.title;
    const profileNamesFile = profiles.map((p) => PROFILES[p]).join('_').replace(/[^a-zA-Z0-9_]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    document.title = `Mandatos_${profileNamesFile}_${dateStr}`;
    return () => {
      document.title = defaultTitle;
    };
  }, [profiles]);

  const compositionSnapshot = composition[0];
  const allocationSnapshot = assetAllocation[0];

  const blocks = useMemo<PrintBlock[]>(() => {
    const list: PrintBlock[] = [];

    // 1. Rendimiento
    list.push({
      key: 'rendimiento',
      body: (
        <>
          <SectionHeading n={1} title="Resumen de Rendimiento" note="Rentabilidad anualizada neta por ventana" />
          <SectionRendimiento forcedActiveIndices={profiles} isPrintMode />
        </>
      ),
    });

    // 2. Backtest
    list.push({
      key: 'backtest',
      body: (
        <>
          <SectionHeading
            n={2}
            title="Simulación de Backtest"
            note={`Capital inicial ${globalSettings.backtest.initialAmount.toLocaleString('es-ES')} €`}
          />
          <SectionBacktest forcedProfileIndices={profiles} isPrintMode />
        </>
      ),
    });

    // 3. Contribuidores: un bloque por perfil, que es por donde tiene sentido
    // cortar. Van como grupo para que el rotulo de continuacion salga una vez
    // por hoja y no encima de cada perfil.
    profiles.forEach((p, idx) => {
      list.push({
        key: `contrib-${p}`,
        group: 'contribuidores',
        groupTitle: 'Análisis de contribuidores',
        keepWithNext: idx === 0 && profiles.length > 1,
        body: (
          <>
            {idx === 0 && (
              <SectionHeading n={3} title="Análisis de Contribuidores" note="Top 5 por contribución a la rentabilidad" />
            )}
            {profiles.length > 1 && (
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-800 mb-1">
                {PROFILES[p]}
              </h3>
            )}
            <SectionContribuidores forcedActiveIndices={[p]} isPrintMode />
          </>
        ),
      });
    });

    // 4. Desglose de fondos
    const compBlocks = compositionBlocks(compositionSnapshot, profiles);
    if (compBlocks.length > 0) {
      list.push({
        key: 'composicion-head',
        keepWithNext: true,
        body: (
          <SectionHeading
            n={4}
            title="Desglose de Fondos Subyacentes"
            note={compositionSnapshot?.label ? `Rebalanceo ${compositionSnapshot.label}` : undefined}
          />
        ),
      });
      list.push(...compBlocks);
    }

    // 5. Drawdown
    list.push({
      key: 'drawdown',
      body: (
        <>
          <SectionHeading n={5} title="Análisis de Drawdown y Estrés" note="Caída desde el último máximo" />
          <SectionDrawdown forcedActiveIndices={profiles} isPrintMode />
        </>
      ),
    });

    // 6. Asset allocation
    const aaBlocks = allocationBlocks(allocationSnapshot, profiles);
    if (aaBlocks.length > 0) {
      list.push({
        key: 'aa-head',
        keepWithNext: true,
        body: (
          <SectionHeading
            n={6}
            title="Asset Allocation y Distribución Estratégica"
            note={allocationSnapshot?.label ? `Foto ${allocationSnapshot.label}` : undefined}
          />
        ),
      });
      list.push(...aaBlocks);
    }

    return list;
  }, [profiles, compositionSnapshot, allocationSnapshot]);

  const signature = blocks.map((b) => b.key).join('|');
  const measureRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{
    signature: string;
    heights: Record<string, number>;
    headHeights: Record<string, number>;
  } | null>(null);

  useLayoutEffect(() => {
    if (measured?.signature === signature) return;
    const root = measureRef.current;
    if (!root) return;

    const heights: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>('[data-block]').forEach((el) => {
      heights[el.dataset.block!] = el.getBoundingClientRect().height;
    });

    const headHeights: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>('[data-head]').forEach((el) => {
      headHeights[el.dataset.head!] = el.getBoundingClientRect().height;
    });

    setMeasured({ signature, heights, headHeights });
  }, [signature, measured]);

  const groupHeads = useMemo(() => {
    const first: Record<string, string> = {};
    // Bloques de tabla, agrupados: se miden dentro de una sola tabla para que
    // los anchos de columna sean los definitivos.
    const tables: { group: string; cols: React.ReactNode; head: React.ReactNode; blocks: PrintBlock[] }[] = [];

    blocks.forEach((b) => {
      if (!b.group) return;
      if (!(b.group in first)) first[b.group] = b.key;
      if (!b.head) return;
      const table = tables.find((t) => t.group === b.group);
      if (table) table.blocks.push(b);
      else tables.push({ group: b.group, cols: b.cols, head: b.head, blocks: [b] });
    });

    return { first, tables };
  }, [blocks]);

  const pages = useMemo(
    () =>
      measured?.signature === signature
        ? paginate(blocks, measured.heights, measured.headHeights, groupHeads.first)
        : [],
    [blocks, measured, signature, groupHeads]
  );

  const totalPages = pages.length + 1;

  return (
    <div
      id="report-container"
      className="bg-white text-zinc-900 font-sans"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Portada: la de siempre —logo arriba, banda roja y bloque gris—, que es
          la que sigue el estilo corporativo. */}
      <div className="report-cover">
        <div className="flex-1 bg-white p-12 flex items-start justify-end">
          <img src={LOGO} alt="Andbank" className="h-24 object-contain mt-4 mr-4" />
        </div>

        <div className="h-8 bg-[#E32119] w-full" />

        <div className="h-[40%] bg-[#BDBDBD] p-12 pt-16 pr-16 flex flex-col items-end text-right">
          <h1 className="text-4xl font-bold text-[#333333] tracking-tight mb-8">Consulta Histórica</h1>
          <p className="text-xl font-bold text-[#333333] mb-8">{coverDateLabel}</p>
          <div className="text-lg font-bold text-[#444444] flex flex-col items-end gap-1 mt-auto pb-4">
            {profiles.map((p) => (
              <span key={p}>{PROFILES[p]}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Hojas de contenido */}
      {pages.map((pageBlocks, idx) => (
        <div key={idx} className="report-page">
          <header className="flex items-end justify-between border-b border-zinc-300 pb-1.5 mb-3">
            <div>
              <p className="text-[7px] font-bold uppercase tracking-[0.25em] text-zinc-400">Andbank · Carteras modelo</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                Consulta Histórica · {coverDateLabel}
              </p>
            </div>
            <img src={LOGO} alt="Andbank" className="h-5 object-contain" />
          </header>

          <div className="flex-1 space-y-3">{renderBlocks(pageBlocks, groupHeads.first)}</div>

          <footer className="mt-3 pt-1.5 border-t border-zinc-200 flex items-center justify-between gap-4 text-[7px] text-zinc-400">
            <span className="uppercase tracking-wider font-bold truncate max-w-[35%]">{profileNames}</span>
            <span className="truncate">
              Documento ilustrativo · Retornos netos de comisiones · Las rentabilidades pasadas no garantizan
              rentabilidades futuras
            </span>
            <span className="font-mono font-bold whitespace-nowrap">
              {idx + 2} / {totalPages}
            </span>
          </footer>
        </div>
      ))}

      {/* Medicion: fuera de pantalla y oculto al imprimir. */}
      <div className="report-measure" ref={measureRef} aria-hidden>
        {blocks
          .filter((b) => !b.head)
          .map((b) => (
            <div key={b.key} data-block={b.key}>
              {b.body}
            </div>
          ))}
        {groupHeads.tables.map((table) => (
          <table key={table.group} className="w-full border-collapse table-fixed">
            {table.cols}
            {React.isValidElement(table.head)
              ? React.cloneElement(table.head as React.ReactElement<any>, { 'data-head': table.group })
              : table.head}
            {table.blocks.map((b) =>
              React.isValidElement(b.body)
                ? React.cloneElement(b.body as React.ReactElement<any>, { key: b.key, 'data-block': b.key })
                : b.body
            )}
          </table>
        ))}
      </div>
    </div>
  );
};
