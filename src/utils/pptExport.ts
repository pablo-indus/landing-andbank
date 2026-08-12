import PptxGenJS from 'pptxgenjs';
import { PROFILES, PROFILE_COLORS } from '../data/portfolioData';
import { buildTrajectory, simulateBacktest, backtestMetrics, type BacktestParams } from './backtestSim';
import { globalSettings } from '../store';
import type { AssetAllocationSnapshot, CompositionSnapshot, MonthlyAttribution } from '../types';

/**
 * Genera el informe en PowerPoint.
 *
 * A diferencia del PDF —que se imprime desde el navegador y sale como una
 * imagen del documento— aqui cada tabla es una tabla de PowerPoint y cada
 * grafico un grafico nativo: el equipo puede reordenar, recolorear o copiar una
 * diapositiva a otra presentacion sin volver a pedir nada.
 *
 * Las cifras salen de las mismas funciones que la pantalla:
 * `simulateBacktest` para el backtest y las curvas de `vlSeries` para el
 * drawdown. Nada se recalcula con una formula propia.
 */

/** Paleta corporativa, la misma que la portada del PDF. */
const RED = 'E32119';
const DARK_RED = '7A1611';
const GREY = 'BDBDBD';
const TEXT = '333333';
const MUTED = '767676';

const FONT = 'IBM Plex Sans';

const eur = (v: number) =>
  `${Math.round(v).toLocaleString('es-ES')} €`;
const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '—' : `${v.toFixed(digits).replace('.', ',')}%`;

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

/** Cabecera de una diapositiva de contenido: numero, titulo y filete rojo. */
function addHeading(slide: PptxGenJS.Slide, n: number, title: string, note?: string) {
  slide.addText(
    [
      { text: String(n).padStart(2, '0'), options: { color: RED, bold: true, fontSize: 11 } },
      { text: '   ' + title, options: { color: TEXT, bold: true, fontSize: 15 } },
    ],
    { x: 0.4, y: 0.25, w: 9.2, h: 0.4, fontFace: FONT }
  );
  if (note) {
    slide.addText(note, {
      x: 0.4, y: 0.62, w: 9.2, h: 0.25,
      fontSize: 9, color: MUTED, fontFace: FONT,
    });
  }
  slide.addShape('line', {
    x: 0.4, y: 0.88, w: 9.2, h: 0,
    line: { color: DARK_RED, width: 1.5 },
  });
}

/** Pie con el descargo, igual que el del PDF. */
function addFooter(slide: PptxGenJS.Slide, profileNames: string) {
  slide.addText(
    `${profileNames}  ·  Documento ilustrativo · Retornos netos de comisiones · Las rentabilidades pasadas no garantizan rentabilidades futuras`,
    { x: 0.4, y: 5.28, w: 9.2, h: 0.22, fontSize: 6.5, color: MUTED, fontFace: FONT }
  );
}

/** Muestrea una serie diaria a ~60 puntos: un grafico de PowerPoint con 5.000 no se abre. */
function sample<T>(arr: T[], target = 60): T[] {
  if (arr.length <= target) return arr;
  const step = Math.ceil(arr.length / target);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

export async function buildPresentation(data: PptData): Promise<void> {
  const {
    profiles, withBenchmark, coverDateLabel, windows, attribution,
    composition, assetAllocation, vlSeries, benchmarkNames, logo,
  } = data;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Andbank';
  pptx.company = 'Andbank Wealth Management SGIIC';
  pptx.title = `Consulta Histórica · ${coverDateLabel}`;

  const profileNames = profiles.map((p) => PROFILES[p]).join(' · ');

  // ---------------------------------------------------------------- portada
  const cover = pptx.addSlide();
  cover.background = { color: 'FFFFFF' };
  if (logo) cover.addImage({ data: logo, x: 7.4, y: 0.5, w: 2.1, h: 0.62 });
  cover.addShape('rect', { x: 0, y: 2.05, w: 10, h: 0.28, fill: { color: RED } });
  cover.addShape('rect', { x: 0, y: 2.33, w: 10, h: 3.3, fill: { color: GREY } });
  cover.addText('Consulta Histórica', {
    x: 0.6, y: 2.7, w: 8.8, h: 0.7,
    fontSize: 34, bold: true, color: TEXT, align: 'right', fontFace: FONT,
  });
  cover.addText(coverDateLabel, {
    x: 0.6, y: 3.4, w: 8.8, h: 0.4,
    fontSize: 18, bold: true, color: TEXT, align: 'right', fontFace: FONT,
  });
  cover.addText(profiles.map((p) => PROFILES[p]).join('\n'), {
    x: 0.6, y: 3.9, w: 8.8, h: 1.5,
    fontSize: 13, bold: true, color: '444444', align: 'right', fontFace: FONT,
  });

  // ------------------------------------------------------------ rendimiento
  if (windows.cats.length > 0) {
    const slide = pptx.addSlide();
    addHeading(slide, 1, 'Resumen de Rendimiento', 'Rentabilidad anualizada neta por ventana');

    const header = [
      { text: 'Ventana', options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED } } },
      ...profiles.map((p) => ({
        text: PROFILES[p],
        options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED }, align: 'center' as const },
      })),
    ];
    const rows = windows.cats.map((cat, i) => [
      { text: cat, options: { bold: true, color: TEXT } },
      ...profiles.map((p) => ({
        text: pct(windows.values[i]?.[p]),
        options: { align: 'center' as const, color: TEXT },
      })),
    ]);

    slide.addTable([header, ...rows], {
      x: 0.4, y: 1.1, w: 9.2,
      fontSize: 11, fontFace: FONT, border: { type: 'solid', color: 'E4E4E7', pt: 0.5 },
      rowH: 0.32,
    });
    addFooter(slide, profileNames);
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

  backtestGroups.forEach((group, gi) => {
    const renderIndices = group.benchmarkOf !== undefined
      ? [...group.indices, 999]
      : group.indices;
    const trajectories = trajFor(group.indices, group.benchmarkOf);
    const sim = simulateBacktest(params, renderIndices, trajectories);
    if (!sim) return;

    const slide = pptx.addSlide();
    const label = group.benchmarkOf !== undefined ? ` · ${PROFILES[group.benchmarkOf]}` : '';
    addHeading(
      slide, 2, `Simulación de Backtest${label}`,
      `Capital inicial ${params.initialAmount.toLocaleString('es-ES')} € desde ${params.startDateStr.split('-').reverse().join('/')}`
    );

    const labels = sample(sim.dates).map((d) => d.slice(0, 7));
    slide.addChart(
      'line',
      renderIndices.map((pIdx) => ({
        name: pIdx === 999 ? `Benchmark (${benchmarkNames[group.benchmarkOf!] ?? 'índice'})` : PROFILES[pIdx],
        labels,
        values: sample(sim.valueSeriesByProfile[pIdx]).map((v) => Math.round(v)),
      })),
      {
        x: 0.4, y: 1.05, w: 9.2, h: 2.7,
        chartColors: renderIndices.map((p) => (p === 999 ? '4B5563' : PROFILE_COLORS[p].replace('#', ''))),
        lineSize: 2, lineSmooth: true, showLegend: true, legendPos: 'b',
        catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, legendFontSize: 9,
        valAxisLabelFormatCode: '#,##0 "€"',
        catAxisLabelFrequency: String(Math.ceil(labels.length / 10)),
      }
    );

    const header = ['Perfil', 'Capital aportado', 'Valor actual', 'Plusvalía', 'TIR anualizada'].map((t) => ({
      text: t,
      options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED }, align: 'center' as const },
    }));
    const rows = renderIndices.map((pIdx) => {
      const m = backtestMetrics(sim, pIdx, params.startDateStr);
      return [
        { text: pIdx === 999 ? 'Benchmark' : PROFILES[pIdx], options: { bold: true, color: TEXT } },
        { text: eur(m.totalCapital), options: { align: 'center' as const } },
        { text: eur(m.finalValue), options: { align: 'center' as const } },
        { text: `${eur(m.gain)} (${pct(m.gainPct)})`, options: { align: 'center' as const } },
        { text: pct(m.annualizedPct), options: { align: 'center' as const } },
      ];
    });
    slide.addTable([header, ...rows], {
      x: 0.4, y: 3.9, w: 9.2,
      fontSize: 10, fontFace: FONT, border: { type: 'solid', color: 'E4E4E7', pt: 0.5 }, rowH: 0.28,
    });
    addFooter(slide, profileNames);
    void gi;
  });

  // --------------------------------------------------------- contribuidores
  if (attribution) {
    profiles.forEach((p) => {
      const block = attribution.data[p];
      if (!block || (block.contrib.length === 0 && block.detract.length === 0)) return;

      const slide = pptx.addSlide();
      addHeading(slide, 3, `Análisis de Contribuidores · ${PROFILES[p]}`, attribution.label);

      const table = (items: typeof block.contrib, title: string, color: string) => {
        const header = [
          { text: title, options: { bold: true, color: 'FFFFFF', fill: { color }, colspan: 3 } },
        ];
        const sub = ['Fondo', 'Rent.', 'Contrib.'].map((t) => ({
          text: t, options: { bold: true, color: TEXT, fill: { color: 'F4F4F5' } },
        }));
        const rows = items.slice(0, 5).map((it) => [
          { text: it.f, options: { color: TEXT } },
          { text: pct(it.r, 2), options: { align: 'center' as const } },
          { text: pct(it.c, 2), options: { align: 'center' as const } },
        ]);
        return [header, sub, ...rows];
      };

      slide.addTable(table(block.contrib, 'Mayores contribuidores', '15803D') as any, {
        x: 0.4, y: 1.1, w: 4.4, colW: [2.4, 1, 1],
        fontSize: 9, fontFace: FONT, border: { type: 'solid', color: 'E4E4E7', pt: 0.5 }, rowH: 0.26,
      });
      slide.addTable(table(block.detract, 'Mayores detractores', 'B91C1C') as any, {
        x: 5.2, y: 1.1, w: 4.4, colW: [2.4, 1, 1],
        fontSize: 9, fontFace: FONT, border: { type: 'solid', color: 'E4E4E7', pt: 0.5 }, rowH: 0.26,
      });
      addFooter(slide, profileNames);
    });
  }

  // ------------------------------------------------------ desglose de fondos
  if (composition) {
    // Una diapositiva por categoria: en una sola no caben 29 fondos legibles.
    composition.categories.forEach((cat) => {
      const items = cat.items.filter((it) => profiles.some((p) => (it.values[p] ?? 0) > 0));
      if (items.length === 0) return;

      const slide = pptx.addSlide();
      addHeading(slide, 4, `Desglose de Fondos · ${cat.cat}`, `Rebalanceo ${composition.label}`);

      const header = [
        { text: 'Fondo', options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED } } },
        ...profiles.map((p) => ({
          text: PROFILES[p],
          options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED }, align: 'center' as const },
        })),
      ];
      const rows = items.map((it) => [
        { text: it.name, options: { color: TEXT } },
        ...profiles.map((p) => ({
          text: it.values[p] ? pct(it.values[p]) : '—',
          options: { align: 'center' as const },
        })),
      ]);
      const totals = [
        { text: 'Total categoría', options: { bold: true, color: TEXT, fill: { color: 'F4F4F5' } } },
        ...profiles.map((p) => ({
          text: pct(cat.totals[p]),
          options: { bold: true, align: 'center' as const, fill: { color: 'F4F4F5' } },
        })),
      ];

      slide.addTable([header, ...rows, totals], {
        x: 0.4, y: 1.1, w: 9.2,
        fontSize: 9, fontFace: FONT, border: { type: 'solid', color: 'E4E4E7', pt: 0.5 },
        autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.1,
      });
      addFooter(slide, profileNames);
    });
  }

  // --------------------------------------------------------------- drawdown
  const drawdownGroups = withBenchmark
    ? profiles.map((p) => ({ indices: [p], benchmarkOf: p as number | undefined }))
    : [{ indices: profiles, benchmarkOf: undefined as number | undefined }];

  drawdownGroups.forEach((group) => {
    const keys = [
      ...group.indices.map((p) => ({ key: String(p), name: PROFILES[p], color: PROFILE_COLORS[p].replace('#', '') })),
      ...(group.benchmarkOf !== undefined
        ? [{
            key: `b${group.benchmarkOf}`,
            name: `Benchmark (${benchmarkNames[group.benchmarkOf] ?? 'índice'})`,
            color: '4B5563',
          }]
        : []),
    ].filter((k) => vlSeries[k.key]?.length);

    if (keys.length === 0) return;

    const slide = pptx.addSlide();
    const label = group.benchmarkOf !== undefined ? ` · ${PROFILES[group.benchmarkOf]}` : '';
    addHeading(slide, 5, `Análisis de Drawdown${label}`, 'Caída desde el último máximo alcanzado');

    // Misma cuenta que SectionDrawdown: maximo movil y caida contra el.
    const series = keys.map((k) => {
      let peak = 0;
      const points = vlSeries[k.key].map((pt) => {
        if (pt.v > peak) peak = pt.v;
        return { d: pt.d, dd: peak === 0 ? 0 : (pt.v / peak - 1) * 100 };
      });
      return { ...k, points: sample(points, 80) };
    });

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
        x: 0.4, y: 1.05, w: 9.2, h: 3.9,
        chartColors: series.map((s) => s.color),
        lineSize: 2, showLegend: true, legendPos: 'b',
        catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, legendFontSize: 9,
        valAxisLabelFormatCode: '0"%"',
        catAxisLabelFrequency: String(Math.ceil(longest.points.length / 10)),
      }
    );
    addFooter(slide, profileNames);
  });

  // -------------------------------------------------------- asset allocation
  if (assetAllocation) {
    const slide = pptx.addSlide();
    addHeading(slide, 6, 'Asset Allocation y Distribución Estratégica', `Foto ${assetAllocation.label}`);

    const header = [
      { text: 'Concepto', options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED } } },
      ...profiles.map((p) => ({
        text: PROFILES[p],
        options: { bold: true, color: 'FFFFFF', fill: { color: DARK_RED }, align: 'center' as const },
      })),
    ];
    const rows = assetAllocation.rows.map((row) => {
      // Las filas de grupo no traen valores: se pintan como banda gris.
      if (row.isPct === null) {
        return [
          { text: row.label, options: { bold: true, color: TEXT, fill: { color: 'F4F4F5' }, colspan: profiles.length + 1 } },
        ];
      }
      return [
        { text: row.label, options: { color: TEXT } },
        ...profiles.map((p) => {
          const v = row.values[p];
          const text = v === null || v === undefined
            ? '—'
            : typeof v === 'number'
              ? (row.isPct ? pct(v) : v.toFixed(2).replace('.', ','))
              : String(v);
          return { text, options: { align: 'center' as const } };
        }),
      ];
    });

    slide.addTable([header, ...rows] as any, {
      x: 0.4, y: 1.1, w: 9.2,
      fontSize: 9, fontFace: FONT, border: { type: 'solid', color: 'E4E4E7', pt: 0.5 },
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.1,
    });
    addFooter(slide, profileNames);
  }

  const fileProfiles = profiles.map((p) => PROFILES[p]).join('_').replace(/[^a-zA-Z0-9_]/g, '');
  await pptx.writeFile({ fileName: `Mandatos_${fileProfiles}_${new Date().toISOString().slice(0, 10)}.pptx` });
}
