import PptxGenJS from 'pptxgenjs';
import { PROFILES, PROFILE_COLORS } from '../data/portfolioData';
import { buildTrajectory, simulateBacktest, backtestMetrics, type BacktestParams } from './backtestSim';
import { maxDrawdown, windowStats } from './seriesStats';
import { allocationColorHex } from './allocationColors';
import { breakdownParent } from './allocationRows';
import { globalSettings } from '../store';
import type { AssetAllocationSnapshot, CompositionSnapshot, MonthlyAttribution } from '../types';

/**
 * Genera el informe en PowerPoint.
 *
 * A diferencia del PDF —que se imprime desde el navegador y sale como una
 * imagen del documento— aqui cada tabla es una tabla de PowerPoint y cada
 * grafico un grafico nativo: el equipo puede reordenar, recolorear o copiar una
 * diapositiva a otra presentacion sin volver a pedir nada. Ni un solo bloque de
 * este archivo pinta una imagen.
 *
 * La maqueta imita la del PDF (`PrintReportLayout`): misma portada, mismas seis
 * secciones en el mismo orden, cabecera y pie corporativos en cada hoja y
 * numeracion "x / total". Lo que **no** comparten es el codigo de maqueta: una
 * hoja A4 vertical no cabe en una diapositiva 16:9. Si se toca el contenido del
 * informe hay que tocar los dos sitios.
 *
 * Las cifras salen de las mismas funciones que la pantalla: `simulateBacktest`
 * para el backtest, `maxDrawdown` y las curvas de `vlSeries` para el drawdown y
 * `windowStats` para los indices. Nada se recalcula con una formula propia.
 */

/** Paleta corporativa, la misma que la portada del PDF. */
const RED = 'E32119';
const DARK_RED = '7A1611';
const GREY = 'BDBDBD';
const TEXT = '333333';
const MUTED = '767676';
const LINE = 'E4E4E7';
const SOFT = 'F4F4F5';
const ZEBRA = 'FAFAFA';
const BENCH = '4B5563';

const FONT = 'IBM Plex Sans';

/** Caja util de la diapositiva (LAYOUT_16x9 son 10 x 5,625 pulgadas). */
const M = { x: 0.45, w: 9.1 };
/** Primera y ultima coordenada vertical del cuerpo, entre cabecera y pie. */
const BODY_TOP = 1.18;
const BODY_BOTTOM = 4.98;

const DISCLAIMER =
  'Documento ilustrativo · Retornos netos de comisiones · Las rentabilidades pasadas no garantizan rentabilidades futuras';

const eur = (v: number) => `${Math.round(v).toLocaleString('es-ES')} €`;
const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(digits).replace('.', ',')}%`;

export interface PptData {
  profiles: number[];
  withBenchmark: boolean;
  coverDateLabel: string;
  windows: { cats: string[]; values: (number | null)[][] };
  attribution: MonthlyAttribution | null;
  composition: CompositionSnapshot | undefined;
  assetAllocation: AssetAllocationSnapshot | undefined;
  vlSeries: Record<string, { d: string; v: number }[]>;
  benchmarkNames: string[];
  /** Logo en data: URI. Se pasa desde fuera porque hay que leerlo del servidor. */
  logo: string | null;
}

/* ------------------------------------------------------------------ maqueta */

interface Deck {
  pptx: PptxGenJS;
  /** Todas las diapositivas en orden, para numerarlas cuando se sepa el total. */
  slides: PptxGenJS.Slide[];
  coverDateLabel: string;
  profileNames: string;
  logo: string | null;
}

/** Cabecera de marca: identidad, titulo del informe, logo y filete. */
function paintHeader(deck: Deck, slide: PptxGenJS.Slide) {
  slide.addText('ANDBANK · PORTFOLIO FUNDS', {
    x: M.x, y: 0.14, w: 6, h: 0.18,
    fontSize: 6.5, bold: true, color: MUTED, charSpacing: 2, fontFace: FONT,
  });
  slide.addText(`Consulta Histórica · ${deck.coverDateLabel}`, {
    x: M.x, y: 0.31, w: 6, h: 0.22,
    fontSize: 9, bold: true, color: TEXT, fontFace: FONT,
  });
  if (deck.logo) slide.addImage({ data: deck.logo, x: M.x + M.w - 1.05, y: 0.17, w: 1.05, h: 0.31 });
  slide.addShape('line', { x: M.x, y: 0.62, w: M.w, h: 0, line: { color: LINE, width: 0.75 } });
}

/** Pie con el descargo. El numero de hoja se añade al final, ver `numberSlides`. */
function paintFooter(deck: Deck, slide: PptxGenJS.Slide) {
  slide.addShape('line', { x: M.x, y: 5.04, w: M.w, h: 0, line: { color: LINE, width: 0.75 } });
  slide.addText(deck.profileNames.toUpperCase(), {
    x: M.x, y: 5.09, w: 2.9, h: 0.2,
    fontSize: 6, bold: true, color: MUTED, charSpacing: 0.8, fontFace: FONT,
  });
  slide.addText(DISCLAIMER, {
    x: M.x + 2.95, w: M.w - 3.75, y: 5.09, h: 0.2,
    fontSize: 6, color: MUTED, align: 'center', fontFace: FONT,
  });
}

/**
 * Numero y titulo de seccion, con el filete rojo debajo. Como en el PDF.
 *
 * Con `n = 0` sale sin numero: el descargo legal no es una septima seccion del
 * informe y numerarlo haria pensar que falta contenido.
 */
function paintHeading(slide: PptxGenJS.Slide, n: number, title: string, note?: string) {
  slide.addText(
    n > 0
      ? [
          { text: String(n).padStart(2, '0'), options: { color: RED, bold: true, fontSize: 11 } },
          { text: '   ' + title, options: { color: TEXT, bold: true, fontSize: 14 } },
        ]
      : [{ text: title, options: { color: TEXT, bold: true, fontSize: 14 } }],
    { x: M.x, y: 0.7, w: M.w * 0.68, h: 0.32, fontFace: FONT, valign: 'middle' }
  );
  if (note) {
    slide.addText(note, {
      x: M.x + M.w * 0.68, y: 0.7, w: M.w * 0.32, h: 0.32,
      fontSize: 8, color: MUTED, align: 'right', valign: 'middle', fontFace: FONT,
    });
  }
  slide.addShape('line', { x: M.x, y: 1.06, w: M.w, h: 0, line: { color: DARK_RED, width: 1.25 } });
}

/** Diapositiva de contenido: cabecera, titulo de seccion y pie, ya puestos. */
function contentSlide(deck: Deck, n: number, title: string, note?: string): PptxGenJS.Slide {
  const slide = deck.pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  paintHeader(deck, slide);
  paintHeading(slide, n, title, note);
  paintFooter(deck, slide);
  deck.slides.push(slide);
  return slide;
}

/**
 * Numera todas las diapositivas menos la portada, "x / total".
 *
 * Se hace al final porque PowerPoint no tiene un campo de "numero total de
 * diapositivas": hay que escribirlo, y hasta que el deck no esta montado no se
 * sabe cuantas son. Igual que el pie del PDF, que empieza a contar en 2 porque
 * la portada es la 1.
 */
function numberSlides(deck: Deck) {
  const total = deck.slides.length;
  deck.slides.forEach((slide, i) => {
    if (i === 0) return;
    slide.addText(`${i + 1} / ${total}`, {
      x: M.x + M.w - 0.75, y: 5.09, w: 0.75, h: 0.2,
      fontSize: 6.5, bold: true, color: MUTED, align: 'right', fontFace: FONT,
    });
  });
}

/* -------------------------------------------------------------- utilidades */

/** Muestrea una serie diaria a ~60 puntos: un grafico de PowerPoint con 5.000 no se abre. */
function sample<T>(arr: T[], target = 60): T[] {
  if (arr.length <= target) return arr;
  const step = Math.ceil(arr.length / target);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type Cell = { text: string; options?: any };

const th = (text: string, align: 'left' | 'center' | 'right' = 'center'): Cell => ({
  text,
  options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED }, align, valign: 'middle' },
});

/** Opciones comunes de tabla, para que todas las del informe se vean iguales. */
const tableOpts = (extra: Record<string, any> = {}) => ({
  x: M.x,
  w: M.w,
  fontFace: FONT,
  border: { type: 'solid' as const, color: LINE, pt: 0.5 },
  valign: 'middle' as const,
  ...extra,
});

/** Raya de cebra: sin ella, una tabla de veinte fondos se lee en diagonal. */
const zebra = (row: Cell[], idx: number): Cell[] =>
  idx % 2 === 0
    ? row
    : row.map((c) => ({ ...c, options: { ...(c.options ?? {}), fill: { color: ZEBRA } } }));

/** Una fila de tabla; `footnote` la arrastra a la diapositiva donde caiga. */
interface Row {
  cells: Cell[];
  footnote?: string;
}

/** Un bloque de filas con su fila de titulo (una categoria de fondos, por ejemplo). */
interface TableBlock {
  /** `cont` es true cuando el bloque continua desde la diapositiva anterior. */
  titleRow: (cont: boolean) => Cell[];
  rows: Row[];
}

/**
 * Reparte una tabla larga en varias diapositivas, cortando por bloques.
 *
 * No se usa el `autoPage` de pptxgenjs a proposito: las diapositivas que crea
 * por su cuenta salen sin cabecera, sin titulo de seccion, sin pie y sin
 * numero, asi que el informe acababa con hojas de dos estilos distintos. Aqui se
 * corta donde el corte significa algo —entre categorias, y si una no cabe,
 * repitiendo su titulo con "(cont.)"— igual que hace la maqueta del PDF.
 */
function paginatedTable(
  deck: Deck,
  opts: {
    n: number;
    title: string;
    note?: string;
    header: Cell[];
    colW: number[];
    fontSize: number;
    rowH: number;
    rowsPerSlide: number;
    blocks: TableBlock[];
  }
) {
  let pending: Cell[][] = [];
  let footnote: string | undefined;
  let slideIdx = 0;

  const flush = () => {
    if (pending.length === 0) return;
    const slide = contentSlide(
      deck, opts.n,
      slideIdx > 0 ? `${opts.title} (cont.)` : opts.title,
      opts.note
    );
    slide.addTable([opts.header, ...pending] as any,
      tableOpts({ y: BODY_TOP, colW: opts.colW, fontSize: opts.fontSize, rowH: opts.rowH }));
    if (footnote) {
      slide.addText(footnote, {
        x: M.x, y: BODY_BOTTOM - 0.22, w: M.w, h: 0.2,
        fontSize: 6.5, italic: true, color: MUTED, fontFace: FONT,
      });
    }
    pending = [];
    footnote = undefined;
    slideIdx += 1;
  };

  opts.blocks.forEach((block) => {
    // Un titulo de bloque no se queda solo al pie: si detras no cabe al menos
    // una fila suya, el corte se hace antes.
    if (pending.length > 0 && pending.length + 2 > opts.rowsPerSlide) flush();

    let cont = false;
    pending.push(block.titleRow(false));

    block.rows.forEach((row) => {
      if (pending.length >= opts.rowsPerSlide) {
        flush();
        cont = true;
        pending.push(block.titleRow(cont));
      }
      pending.push(row.cells);
      if (row.footnote) footnote = row.footnote;
    });
  });

  flush();
}

/** Tarjeta de KPI: recuadro claro con rotulo arriba y cifra grande debajo. */
function kpiTile(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  label: string, value: string, color = TEXT
) {
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.04,
    fill: { color: SOFT },
    line: { color: LINE, width: 0.75 },
  });
  slide.addText(label.toUpperCase(), {
    x: x + 0.05, y: y + 0.07, w: w - 0.1, h: 0.18,
    fontSize: 6.5, bold: true, color: MUTED, align: 'center', charSpacing: 0.6, fontFace: FONT,
  });
  slide.addText(value, {
    x: x + 0.05, y: y + 0.24, w: w - 0.1, h: 0.26,
    fontSize: 12, bold: true, color, align: 'center', fontFace: FONT,
  });
}

/**
 * Donde empieza una tabla que va anclada al pie del cuerpo.
 *
 * Se calcula, no se escribe a mano: la misma diapositiva lleva dos filas con un
 * perfil y siete con seis, y con la coordenada fija la tabla se salia por debajo
 * del pie —fuera de la diapositiva— justo en el caso de los seis perfiles, que
 * es el que mas se usa.
 */
const tableTop = (rows: number, rowH: number, reserve = 0) => BODY_BOTTOM - reserve - rows * rowH;

/** Meses de una ventana del libro AA ("3 años" -> 36). Null si no es movil. */
function windowMonths(cat: string): number | null {
  const match = String(cat).match(/^(\d+)\s*años?$/i);
  return match ? Number(match[1]) * 12 : null;
}

/**
 * Rentabilidad del indice en cada ventana, con la misma funcion que la web.
 *
 * "Desde 2009" se queda a null: las series de benchmark empiezan en julio de
 * 2011 y comparar diecisiete años de cartera con quince de indice no dice nada.
 */
function benchmarkWindows(series: { d: string; v: number }[] | undefined, cats: string[]): (number | null)[] {
  return cats.map((cat) => {
    const months = windowMonths(cat);
    if (!months || !series?.length) return null;
    return windowStats(series, months).ret;
  });
}

/** Filas del bloque "Distribución de activos", que son las del donut. */
function mainAllocationRows(snapshot: AssetAllocationSnapshot): any[] {
  const rows: any[] = [];
  let inside = false;
  for (const row of snapshot.rows as any[]) {
    if (row.isPct === null) inside = String(row.label).toLowerCase().includes('distribución de activos');
    else if (inside) rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ informe */

export async function buildPresentation(data: PptData): Promise<void> {
  const {
    profiles, withBenchmark, coverDateLabel, windows, attribution,
    composition, assetAllocation, vlSeries, benchmarkNames, logo,
  } = data;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Andbank';
  pptx.company = 'Andbank Wealth Management SGIIC';
  pptx.subject = 'Consulta Histórica de carteras modelo';
  pptx.title = `Consulta Histórica · ${coverDateLabel}`;

  const deck: Deck = {
    pptx,
    slides: [],
    coverDateLabel,
    profileNames: profiles.map((p) => PROFILES[p]).join(' · '),
    logo,
  };
  const color = (pIdx: number) => (pIdx === 999 ? BENCH : PROFILE_COLORS[pIdx].replace('#', ''));
  const nameOf = (pIdx: number, benchmarkOf?: number) =>
    pIdx === 999
      ? `Benchmark${benchmarkOf !== undefined && benchmarkNames[benchmarkOf] ? ` (${benchmarkNames[benchmarkOf]})` : ''}`
      : PROFILES[pIdx];

  // ---------------------------------------------------------------- portada
  const cover = pptx.addSlide();
  cover.background = { color: 'FFFFFF' };
  if (logo) cover.addImage({ data: logo, x: 7.3, y: 0.55, w: 2.2, h: 0.65 });
  cover.addShape('rect', { x: 0, y: 2.05, w: 10, h: 0.28, fill: { color: RED } });
  cover.addShape('rect', { x: 0, y: 2.33, w: 10, h: 3.295, fill: { color: GREY } });
  cover.addText('Consulta Histórica', {
    x: 0.6, y: 2.62, w: 8.8, h: 0.7,
    fontSize: 34, bold: true, color: TEXT, align: 'right', fontFace: FONT,
  });
  cover.addText(coverDateLabel, {
    x: 0.6, y: 3.32, w: 8.8, h: 0.4,
    fontSize: 18, bold: true, color: TEXT, align: 'right', fontFace: FONT,
  });
  cover.addText(profiles.map((p) => PROFILES[p]).join('\n'), {
    x: 0.6, y: 3.78, w: 8.8, h: 1.1,
    fontSize: 13, bold: true, color: '444444', align: 'right', fontFace: FONT,
  });
  cover.addText('Andbank Wealth Management SGIIC', {
    x: 0.6, y: 5.18, w: 8.8, h: 0.22,
    fontSize: 8, color: '555555', align: 'right', fontFace: FONT,
  });
  deck.slides.push(cover);

  // ------------------------------------------------------------ rendimiento
  if (windows.cats.length > 0) {
    // Con un solo perfil el indice cabe al lado de la cartera, periodo a
    // periodo. Con varios no: cada cartera tiene el suyo y seis pares de barras
    // por ventana no se pueden leer. Es la misma regla que en pantalla.
    const benchOf = withBenchmark && profiles.length === 1 ? profiles[0] : null;
    const benchValues = benchOf === null ? null : benchmarkWindows(vlSeries[`b${benchOf}`], windows.cats);

    const slide = contentSlide(deck, 1, 'Resumen de Rendimiento', 'Rentabilidad anualizada neta por ventana');

    const chartSeries: { name: string; labels: string[]; values: (number | null)[] }[] = profiles.map((p) => ({
      name: PROFILES[p],
      labels: windows.cats,
      values: windows.cats.map((_, i) => {
        const v = windows.values[i]?.[p];
        return v === undefined ? null : v;
      }),
    }));
    if (benchValues) {
      chartSeries.push({ name: `BMK ${PROFILES[benchOf!]}`, labels: windows.cats, values: benchValues });
    }

    const winRowH = 0.26;
    const winTop = tableTop(windows.cats.length + 1, winRowH, benchValues ? 0.26 : 0);

    slide.addChart('bar', chartSeries as any, {
      x: M.x, y: BODY_TOP, w: M.w, h: Math.max(1.4, winTop - 0.14 - BODY_TOP),
      barDir: 'col',
      barGapWidthPct: 40,
      chartColors: [...profiles.map((p) => color(p)), ...(benchValues ? [BENCH] : [])],
      showLegend: true,
      legendPos: 'b',
      legendFontSize: 8,
      catAxisLabelFontSize: 8,
      valAxisLabelFontSize: 8,
      valAxisLabelFormatCode: '0"%"',
      valGridLine: { style: 'solid', color: LINE, size: 0.5 },
      catGridLine: { style: 'none' },
    });

    const header = [th('Ventana', 'left'), ...profiles.map((p) => th(PROFILES[p]))];
    if (benchValues) header.push(th(`BMK ${PROFILES[benchOf!]}`));

    const rows = windows.cats.map((cat, i) =>
      zebra(
        [
          { text: cat, options: { bold: true, color: TEXT } },
          ...profiles.map((p) => ({ text: pct(windows.values[i]?.[p]), options: { align: 'center', color: TEXT } })),
          ...(benchValues ? [{ text: pct(benchValues[i]), options: { align: 'center', color: BENCH } }] : []),
        ],
        i
      )
    );

    slide.addTable([header, ...rows] as any, tableOpts({ y: winTop, fontSize: 10, rowH: winRowH }));

    if (benchValues) {
      slide.addText(
        'El índice no descuenta comisiones y su serie empieza en julio de 2011, así que la ventana «Desde 2009» no tiene comparación posible.',
        { x: M.x, y: BODY_BOTTOM - 0.24, w: M.w, h: 0.22, fontSize: 6.5, italic: true, color: MUTED, fontFace: FONT }
      );
    }

    // Contra que se compara cada cartera. En pantalla vive plegado bajo el
    // grafico de retorno/riesgo; aqui solo se saca si el informe lleva indice,
    // que es cuando hay algo que explicar.
    if (withBenchmark) {
      const refs = contentSlide(deck, 1, 'Índices de Referencia', 'Con qué se compara cada cartera');
      const refRows = profiles.map((p, i) =>
        zebra(
          [
            { text: PROFILES[p], options: { bold: true, color: PROFILE_COLORS[p].replace('#', '') } },
            { text: benchmarkNames[p] ?? '—', options: { color: TEXT } },
          ],
          i
        )
      );
      refs.addTable([[th('Perfil', 'left'), th('Fondo / índice de referencia', 'left')], ...refRows] as any,
        tableOpts({ y: BODY_TOP, colW: [2.6, 6.5], fontSize: 10, rowH: 0.3 }));
      refs.addText(
        'Cada perfil se compara con la media de su categoría Morningstar, salvo Agresivo +, que se compara con el índice ' +
        'MSCI World NR EUR. La rentabilidad de la cartera es neta de comisiones; la del índice no descuenta comisiones de ' +
        'gestión ni costes transaccionales.',
        { x: M.x, y: BODY_TOP + 0.35 + refRows.length * 0.3, w: M.w, h: 0.5, fontSize: 8, color: MUTED, fontFace: FONT }
      );
    }
  }

  // --------------------------------------------------------------- backtest
  const params: BacktestParams = { ...globalSettings.backtest };
  const trajFor = (indices: number[], benchmarkOf?: number) => {
    const map: Record<number, ReturnType<typeof buildTrajectory>> = {};
    indices.forEach((p) => { map[p] = buildTrajectory(p, false, vlSeries as any); });
    if (benchmarkOf !== undefined) map[999] = buildTrajectory(benchmarkOf, true, vlSeries as any);
    return map;
  };

  /*
    Con benchmark se dibuja una diapositiva por perfil: cada cartera tiene su
    propio indice de referencia, asi que meter seis carteras y seis indices en
    un grafico no se puede leer. Sin benchmark van todas juntas, que es como se
    comparan entre si.
  */
  const backtestGroups: { indices: number[]; benchmarkOf?: number }[] = withBenchmark
    ? profiles.map((p) => ({ indices: [p], benchmarkOf: p }))
    : [{ indices: profiles }];

  const backtestNote =
    `Capital inicial ${params.initialAmount.toLocaleString('es-ES')} € desde ` +
    params.startDateStr.split('-').reverse().join('/');

  backtestGroups.forEach((group) => {
    const renderIndices = group.benchmarkOf !== undefined ? [...group.indices, 999] : group.indices;
    const trajectories = trajFor(group.indices, group.benchmarkOf);
    const sim = simulateBacktest(params, renderIndices, trajectories);
    if (!sim) return;

    const label = group.benchmarkOf !== undefined ? ` · ${PROFILES[group.benchmarkOf]}` : '';
    const slide = contentSlide(deck, 2, `Simulación de Backtest${label}`, backtestNote);

    // Con una o dos curvas las cifras van en tarjetas y con mas en tabla, asi
    // que el alto que le queda al grafico depende de cuantas sean.
    const asTiles = renderIndices.length <= 2;
    const btTop = asTiles
      ? BODY_BOTTOM - renderIndices.length * 0.62
      : tableTop(renderIndices.length + 1, 0.24);

    const labels = sample(sim.dates).map((d) => d.slice(0, 7));
    slide.addChart(
      'line',
      renderIndices.map((pIdx) => ({
        name: nameOf(pIdx, group.benchmarkOf),
        labels,
        values: sample(sim.valueSeriesByProfile[pIdx]).map((v) => Math.round(v)),
      })),
      {
        x: M.x, y: BODY_TOP, w: M.w, h: Math.max(1.4, btTop - 0.16 - BODY_TOP),
        chartColors: renderIndices.map((p) => color(p)),
        lineSize: 2, lineSmooth: true, showLegend: true, legendPos: 'b',
        catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, legendFontSize: 8,
        valAxisLabelFormatCode: '#,##0 "€"',
        valGridLine: { style: 'solid', color: LINE, size: 0.5 },
        catGridLine: { style: 'none' },
        catAxisLabelFrequency: String(Math.ceil(labels.length / 10)),
      }
    );

    /*
      Con una o dos curvas las cifras van en tarjetas, como en pantalla; a
      partir de tres, en tabla. Seis perfiles en tarjetas ocuparian la
      diapositiva entera y no dejarian sitio al grafico, que es el mismo motivo
      por el que el PDF cambia a tabla.
    */
    if (asTiles) {
      renderIndices.forEach((pIdx, row) => {
        const m = backtestMetrics(sim, pIdx, params.startDateStr);
        const y = btTop + row * 0.62;
        slide.addText(nameOf(pIdx, group.benchmarkOf), {
          x: M.x, y, w: 1.5, h: 0.55,
          fontSize: 8, bold: true, color: color(pIdx), valign: 'middle', fontFace: FONT,
        });
        const tiles: [string, string][] = [
          ['Capital aportado', eur(m.totalCapital)],
          ['Valor actual', eur(m.finalValue)],
          ['Plusvalía', `${eur(m.gain)} (${pct(m.gainPct)})`],
          ['TIR anualizada', pct(m.annualizedPct)],
        ];
        const tw = (M.w - 1.55 - 0.15 * 3) / 4;
        tiles.forEach(([lbl, val], i) => {
          kpiTile(
            slide, M.x + 1.55 + i * (tw + 0.15), y, tw, 0.55, lbl, val,
            lbl === 'Plusvalía' && m.gain < 0 ? 'B91C1C' : TEXT
          );
        });
      });
    } else {
      const header = ['Perfil', 'Capital aportado', 'Valor actual', 'Plusvalía', 'Rentabilidad', 'TIR anualizada']
        .map((t, i) => th(t, i === 0 ? 'left' : 'center'));
      const rows = renderIndices.map((pIdx, i) => {
        const m = backtestMetrics(sim, pIdx, params.startDateStr);
        return zebra(
          [
            { text: nameOf(pIdx, group.benchmarkOf), options: { bold: true, color: color(pIdx) } },
            { text: eur(m.totalCapital), options: { align: 'center' } },
            { text: eur(m.finalValue), options: { align: 'center', bold: true } },
            { text: eur(m.gain), options: { align: 'center', color: m.gain < 0 ? 'B91C1C' : TEXT } },
            { text: pct(m.gainPct), options: { align: 'center', color: m.gain < 0 ? 'B91C1C' : TEXT } },
            { text: pct(m.annualizedPct), options: { align: 'center', bold: true } },
          ],
          i
        );
      });
      slide.addTable([header, ...rows] as any, tableOpts({ y: btTop, fontSize: 9, rowH: 0.24 }));
    }
  });

  // --------------------------------------------------------- contribuidores
  if (attribution) {
    const withData = profiles.filter((p) => {
      const block = attribution.data[p];
      return block && (block.contrib.length > 0 || block.detract.length > 0);
    });

    if (withData.length > 0) {
      withData.forEach((p) => {
        const block = attribution.data[p];
        const ytdBlock = attribution.ytd?.[p];
        const slide = contentSlide(deck, 3, `Análisis de Contribuidores · ${PROFILES[p]}`, attribution.label);

        const table = (items: typeof block.contrib, title: string, fill: string) => {
          const head = [{ text: title, options: { bold: true, color: 'FFFFFF', fill: { color: fill }, colspan: 3, align: 'center' } }];
          const sub = ['Fondo', 'Rent.', 'Contrib.'].map((t, i) => ({
            text: t,
            options: { bold: true, color: TEXT, fill: { color: SOFT }, align: i === 0 ? 'left' : 'center' },
          }));
          const rows = items.slice(0, 5).map((it, i) =>
            zebra(
              [
                { text: it.f, options: { color: TEXT } },
                { text: pct(it.r, 2), options: { align: 'center' } },
                { text: pct(it.c, 2), options: { align: 'center', bold: true } },
              ],
              i
            )
          );
          return [head, sub, ...rows];
        };

        // El bloque MES y el YTD van en la misma diapositiva, uno debajo del
        // otro: es la misma vista de pestañas que ofrece la pantalla, sin
        // obligar a pasar de diapositiva para ver el acumulado del año. El
        // desplazamiento del segundo bloque usa siempre 5 filas de margen
        // (el maximo que puede traer una tabla), para que no se solapen
        // aunque el mes tenga menos fondos que el acumulado.
        const rowH = 0.22;
        const blockRows = 2 + 5; // titulo + cabecera + hasta 5 fondos
        const caption = (text: string, y: number) =>
          slide.addText(text, {
            x: M.x, y, w: M.w, h: 0.18,
            fontSize: 8, bold: true, color: MUTED, charSpacing: 0.6, fontFace: FONT,
          });

        caption(`MES · ${attribution.label}`, BODY_TOP);
        const monthY = BODY_TOP + 0.2;
        slide.addTable(table(block.contrib, 'Mayores contribuidores', '15803D') as any,
          tableOpts({ x: M.x, y: monthY, w: 4.4, colW: [2.4, 1, 1], fontSize: 8.5, rowH }));
        slide.addTable(table(block.detract, 'Mayores detractores', 'B91C1C') as any,
          tableOpts({ x: M.x + 4.7, y: monthY, w: 4.4, colW: [2.4, 1, 1], fontSize: 8.5, rowH }));

        if (ytdBlock && (ytdBlock.contrib.length > 0 || ytdBlock.detract.length > 0)) {
          const ytdCapY = monthY + blockRows * rowH + 0.14;
          caption(`ACUMULADO ${attribution.label.split(' ').pop()}`, ytdCapY);
          const ytdY = ytdCapY + 0.2;
          slide.addTable(table(ytdBlock.contrib, 'Mayores contribuidores', '15803D') as any,
            tableOpts({ x: M.x, y: ytdY, w: 4.4, colW: [2.4, 1, 1], fontSize: 8.5, rowH }));
          slide.addTable(table(ytdBlock.detract, 'Mayores detractores', 'B91C1C') as any,
            tableOpts({ x: M.x + 4.7, y: ytdY, w: 4.4, colW: [2.4, 1, 1], fontSize: 8.5, rowH }));
        }
      });
    }
  }

  // ------------------------------------------------------ desglose de fondos
  if (composition) {
    const cats = composition.categories.filter((cat) =>
      cat.items.some((it) => profiles.some((p) => (it.values[p] ?? 0) > 0))
    );

    if (cats.length > 0) {
      // La columna de ISIN es la que trae el PDF y en pantalla; sin ella el
      // informe no identifica el fondo, solo lo nombra.
      const isinCol = 1.15;
      const pctCol = Math.min(0.95, (M.w - 2.6 - isinCol) / Math.max(profiles.length, 1));
      const colW = [M.w - isinCol - pctCol * profiles.length, isinCol, ...profiles.map(() => pctCol)];

      paginatedTable(deck, {
        n: 4,
        title: 'Desglose de Fondos Subyacentes',
        note: `Rebalanceo ${composition.label}`,
        header: [th('Categoría / Fondo', 'left'), th('ISIN', 'left'), ...profiles.map((p) => th(PROFILES[p]))],
        colW,
        fontSize: 8.5,
        rowH: 0.24,
        rowsPerSlide: 13,
        blocks: cats.map((cat) => ({
          titleRow: (cont) => [
            {
              text: cat.cat.toUpperCase() + (cont ? ' (CONT.)' : ''),
              options: { bold: true, color: TEXT, fill: { color: SOFT }, colspan: 2 },
            },
            ...profiles.map((p) => ({
              text: cat.totals[p] > 0 ? pct(cat.totals[p], 2) : '—',
              options: { bold: true, align: 'center', fill: { color: SOFT }, color: TEXT },
            })),
          ],
          rows: cat.items
            .filter((it) => profiles.some((p) => (it.values[p] ?? 0) > 0))
            .map((it, i) => ({
              cells: zebra(
                [
                  { text: it.name, options: { color: TEXT } },
                  { text: it.isin ?? '', options: { color: MUTED, fontSize: 7 } },
                  ...profiles.map((p) => ({
                    text: it.values[p] ? pct(it.values[p], 2) : '—',
                    options: { align: 'center', color: it.values[p] ? TEXT : MUTED },
                  })),
                ],
                i
              ),
            })),
        })),
      });
    }
  }

  // --------------------------------------------------------------- drawdown
  const drawdownGroups = withBenchmark
    ? profiles.map((p) => ({ indices: [p], benchmarkOf: p as number | undefined }))
    : [{ indices: profiles, benchmarkOf: undefined as number | undefined }];

  drawdownGroups.forEach((group) => {
    const keys = [
      ...group.indices.map((p) => ({ key: String(p), name: PROFILES[p], color: color(p) })),
      ...(group.benchmarkOf !== undefined
        ? [{ key: `b${group.benchmarkOf}`, name: nameOf(999, group.benchmarkOf), color: BENCH }]
        : []),
    ].filter((k) => vlSeries[k.key]?.length);

    if (keys.length === 0) return;

    const label = group.benchmarkOf !== undefined ? ` · ${PROFILES[group.benchmarkOf]}` : '';
    const slide = contentSlide(deck, 5, `Análisis de Drawdown${label}`, 'Caída desde el último máximo alcanzado');

    // Misma cuenta que SectionDrawdown: maximo movil y caida contra el.
    const series = keys.map((k) => {
      let peak = 0;
      const points = vlSeries[k.key].map((pt) => {
        if (pt.v > peak) peak = pt.v;
        return { d: pt.d, dd: peak === 0 ? 0 : (pt.v / peak - 1) * 100 };
      });
      // La caida maxima se calcula con la funcion que usa el Perfilador, sobre
      // la serie completa: muestrear primero podria saltarse justo el minimo.
      return { ...k, points: sample(points, 80), worst: maxDrawdown(vlSeries[k.key]), from: vlSeries[k.key][0].d };
    });

    const ddRowH = 0.22;
    const ddTop = tableTop(series.length + 1, ddRowH);

    // Todas las curvas comparten eje: se toman las etiquetas de la mas larga.
    const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a));
    slide.addChart(
      'line',
      series.map((s) => ({
        name: s.name,
        labels: longest.points.map((p) => p.d.slice(0, 7)),
        values: s.points.map((p) => Number(p.dd.toFixed(2))),
      })),
      {
        x: M.x, y: BODY_TOP, w: M.w, h: Math.max(1.4, ddTop - 0.16 - BODY_TOP),
        chartColors: series.map((s) => s.color),
        lineSize: 2, showLegend: true, legendPos: 'b',
        catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, legendFontSize: 8,
        valAxisLabelFormatCode: '0"%"',
        valGridLine: { style: 'solid', color: LINE, size: 0.5 },
        catGridLine: { style: 'none' },
        catAxisLabelFrequency: String(Math.ceil(longest.points.length / 10)),
      }
    );

    // Cada serie arranca en su propia fecha, asi que la caida maxima solo se
    // puede comparar sabiendo desde cuando. Es el mismo aviso que el Perfilador.
    const ddRows = series.map((s, i) =>
      zebra(
        [
          { text: s.name, options: { bold: true, color: s.color } },
          { text: s.from.slice(0, 4), options: { align: 'center', color: MUTED } },
          { text: pct(s.worst, 2), options: { align: 'center', bold: true, color: 'B91C1C' } },
        ],
        i
      )
    );
    slide.addTable(
      [[th('Serie', 'left'), th('Datos desde'), th('Caída máxima')], ...ddRows] as any,
      tableOpts({ y: ddTop, w: 5.6, colW: [3.0, 1.3, 1.3], fontSize: 8.5, rowH: ddRowH })
    );
  });

  // -------------------------------------------------------- asset allocation
  if (assetAllocation) {
    // Donuts nativos, uno por perfil, con sus pesos al lado: el grafico solo no
    // dice cuanto pesa cada tramo.
    const mainRows = mainAllocationRows(assetAllocation);
    if (mainRows.length > 0) {
      const perSlide = 6;
      chunk(profiles, perSlide).forEach((group, gi) => {
        const slide = contentSlide(
          deck, 6,
          `Distribución de Activos${gi > 0 ? ' (cont.)' : ''}`,
          `Foto ${assetAllocation.label}`
        );

        const cols = Math.min(3, group.length);
        const rows = Math.ceil(group.length / cols);
        const cellW = M.w / cols;
        const cellH = Math.min(1.85, (BODY_BOTTOM - BODY_TOP) / rows);

        group.forEach((p, i) => {
          const cx = M.x + (i % cols) * cellW;
          const cy = BODY_TOP + Math.floor(i / cols) * cellH;

          const slices = mainRows
            .map((row: any) => ({
              name: String(row.label),
              value: typeof row.values[p] === 'number' ? row.values[p] : parseFloat(row.values[p]) || 0,
            }))
            .filter((d) => d.value > 0);
          if (slices.length === 0) return;

          slide.addText(PROFILES[p], {
            x: cx, y: cy, w: cellW - 0.1, h: 0.22,
            fontSize: 9, bold: true, color: PROFILE_COLORS[p].replace('#', ''), fontFace: FONT,
          });
          slide.addChart(
            'doughnut',
            [{ name: PROFILES[p], labels: slices.map((s) => s.name), values: slices.map((s) => s.value) }],
            {
              x: cx - 0.12, y: cy + 0.18, w: cellH - 0.2, h: cellH - 0.24,
              chartColors: slices.map((s) => allocationColorHex(s.name)),
              holeSize: 55,
              showLegend: false,
              dataBorder: { pt: 1, color: 'FFFFFF' },
            }
          );
          slide.addTable(
            slices.map((s, si) =>
              zebra(
                [
                  { text: s.name, options: { color: TEXT } },
                  { text: pct(s.value), options: { align: 'right', bold: true, color: TEXT } },
                ],
                si
              )
            ) as any,
            {
              x: cx + cellH - 0.28, y: cy + 0.24, w: cellW - cellH + 0.1,
              colW: [(cellW - cellH + 0.1) * 0.62, (cellW - cellH + 0.1) * 0.38],
              fontFace: FONT, fontSize: 7, rowH: 0.16, border: { type: 'none' as const },
            }
          );
        });
      });
    }

    // Tabla completa, paginada a mano por las mismas razones que la de fondos.
    const groups: { title: string; rows: any[] }[] = [];
    (assetAllocation.rows as any[]).forEach((row) => {
      if (row.isPct === null) {
        groups.push({ title: String(row.label), rows: [] });
      } else if (groups.length > 0) {
        const hasValue = profiles.some(
          (p) => row.values[p] !== null && row.values[p] !== undefined && row.values[p] !== 0
        );
        if (hasValue) groups[groups.length - 1].rows.push(row);
      }
    });

    const pctCol = Math.min(1.15, (M.w - 3.0) / Math.max(profiles.length, 1));

    paginatedTable(deck, {
      n: 6,
      title: 'Asset Allocation',
      note: `Foto ${assetAllocation.label}`,
      header: [th('Categoría / Métrica', 'left'), ...profiles.map((p) => th(PROFILES[p]))],
      colW: [M.w - pctCol * profiles.length, ...profiles.map(() => pctCol)],
      fontSize: 8.5,
      rowH: 0.24,
      rowsPerSlide: 13,
      blocks: groups.filter((g) => g.rows.length > 0).map((group) => ({
        titleRow: (cont) => [
          {
            text: group.title.toUpperCase() + (cont ? ' (CONT.)' : ''),
            options: { bold: true, color: TEXT, fill: { color: SOFT }, colspan: profiles.length + 1 },
          },
        ],
        rows: group.rows.map((row: any, rowIdx: number) => {
          // "USD - directo" y "USD - indirecto" desglosan "USD": van en cursiva
          // y sangradas para que nadie las sume a su fila madre.
          const parent = breakdownParent(row.label, group.rows.slice(0, rowIdx).map((r: any) => String(r.label)));
          const style = parent ? { italic: true, color: MUTED } : { color: TEXT };
          return {
            footnote: parent
              ? 'Las filas en cursiva desglosan la que tienen encima y ya están incluidas en ella: USD directo más USD indirecto suman el USD total.'
              : undefined,
            cells: [
              { text: parent ? `    ${row.label}` : String(row.label), options: { ...style } },
              ...profiles.map((p) => {
                const v = row.values[p];
                const text = v === null || v === undefined || v === 0
                  ? '—'
                  : typeof v === 'number'
                    ? (row.isPct ? pct(v) : v.toFixed(2).replace('.', ','))
                    : String(v);
                return { text, options: { align: 'center', ...style } };
              }),
            ],
          };
        }),
      })),
    });
  }

  // -------------------------------------------------------------- descargo
  const legal = contentSlide(deck, 0, 'Información Legal', 'Condiciones de uso de este documento');
  legal.addText(
    [
      { text: 'Naturaleza del documento\n', options: { bold: true, fontSize: 10, color: TEXT } },
      {
        text:
          'Documento de carácter ilustrativo elaborado por Andbank Wealth Management SGIIC para uso interno y de asesoramiento. ' +
          'No constituye una oferta, una recomendación personalizada de inversión ni asesoramiento financiero, fiscal o legal.\n\n',
        options: { fontSize: 9, color: MUTED },
      },
      { text: 'Datos y rentabilidades\n', options: { bold: true, fontSize: 10, color: TEXT } },
      {
        text:
          'Las rentabilidades de las carteras son históricas, de clientes reales, y netas de cualquier comisión aplicable ' +
          '(gestión, custodia y otras). Los índices de referencia se muestran brutos: no descuentan comisiones de gestión ni ' +
          'costes transaccionales, por lo que la comparación les favorece. Las volatilidades se calculan sobre cierres ' +
          'mensuales. Cada cartera dispone de histórico desde una fecha distinta, indicada en la sección de drawdown.\n\n',
        options: { fontSize: 9, color: MUTED },
      },
      { text: 'Advertencia\n', options: { bold: true, fontSize: 10, color: TEXT } },
      {
        text:
          'Las rentabilidades pasadas no garantizan rentabilidades futuras. El valor de las inversiones puede fluctuar y el ' +
          'inversor puede no recuperar el capital invertido. Las simulaciones de backtest y de escenarios de estrés reconstruyen ' +
          'el comportamiento pasado de las carteras y no predicen su comportamiento futuro.',
        options: { fontSize: 9, color: MUTED },
      },
    ],
    { x: M.x, y: BODY_TOP, w: M.w, h: 3.6, fontFace: FONT, valign: 'top', lineSpacingMultiple: 1.1 }
  );
  legal.addText(`Datos a ${coverDateLabel}. Andbank Wealth Management SGIIC, S.A.U.`, {
    x: M.x, y: 4.62, w: M.w, h: 0.25,
    fontSize: 8, bold: true, color: TEXT, fontFace: FONT,
  });

  numberSlides(deck);

  const fileProfiles = profiles.map((p) => PROFILES[p]).join('_').replace(/[^a-zA-Z0-9_]/g, '');
  await pptx.writeFile({ fileName: `Mandatos_${fileProfiles}_${new Date().toISOString().slice(0, 10)}.pptx` });
}
