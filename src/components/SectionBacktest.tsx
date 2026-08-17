import React, { useState, useMemo, useEffect } from 'react';
import { globalSettings } from '../store';
import { PROFILES, PROFILE_COLORS } from '../data/portfolioData';
import { useMonthlyReports } from '../hooks/useMonthlyReports';
import { maxDrawdown } from '../utils/seriesStats';
import {
  TODAY,
  buildTrajectory,
  trajValue,
  simulateBacktest,
  backtestMetrics,
} from '../utils/backtestSim';

// Todos los escenarios menos el de 2008 usan datos reales de las carteras y de
// sus indices. El de 2008 NO: las series de Morningstar empiezan en noviembre de
// 2010 y las de benchmark en julio de 2011, asi que no existe dato real de esa
// crisis. Se conserva como ilustracion, va marcado como simulado y su caida se
// estima (ver `simulated2008Drops`).
//
// Un escenario real solo se pinta para las curvas cuya serie ya existia al
// empezar: `trajValue` devuelve el primer valor de la serie para cualquier fecha
// anterior, asi que una cartera que aun no habia nacido saldria como una linea
// plana —"no perdio nada"— en lugar de como un hueco.
const STRESS_SCENARIOS = [
  { id: '2020', label: 'COVID-19 (feb-may 2020)', start: '2020-02-15', end: '2020-05-31', simulated: false },
  { id: '2022', label: 'Inflación y subida de tipos (2022)', start: '2021-12-31', end: '2022-10-31', simulated: false },
  { id: '2023', label: 'Banca regional · SVB (2023)', start: '2023-02-28', end: '2023-05-31', simulated: false },
  { id: '2018', label: '4Q 2018 (oct-dic 2018)', start: '2018-09-28', end: '2018-12-31', simulated: false },
  { id: '2011', label: 'Crisis de deuda europea (2011-2012)', start: '2011-07-16', end: '2012-07-31', simulated: false },
  { id: '2008', label: 'Crisis financiera (2008) · Simulado', start: '2008-01-01', end: '2009-03-31', simulated: true },
];

/**
 * Retroceso de cada clase de activo entre enero de 2008 y marzo de 2009.
 *
 * Son supuestos declarados, no series: la crisis de 2008 queda fuera de todo el
 * historico disponible. Se aplican al asset allocation **real** de cada cartera,
 * que es lo unico que hace que el escenario distinga un perfil de otro.
 */
const CRISIS_2008_DROP: { match: string; drop: number }[] = [
  { match: 'monetario', drop: 0 },
  { match: 'fija', drop: 0.08 },
  { match: 'variable', drop: 0.55 },
  { match: 'alternativos', drop: 0.15 },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Caida estimada de 2008 por perfil, y la de su indice de referencia.
 *
 * La de la cartera sale de sus pesos por clase de activo. La del indice **no**
 * puede salir de ahi —no conocemos la composicion de la media de categoria de
 * Morningstar—, asi que se escala la de la cartera por la relacion medida entre
 * la caida maxima del indice y la de la cartera en el historico que si existe.
 * Antes era un 50% fijo, igual para los seis perfiles: el indice del perfil mas
 * conservador caia lo mismo que el del mas agresivo.
 */
function simulated2008Drops(
  allocationRows: any[] | undefined,
  vlSeries: Record<string, { d: string; v: number }[]>
): { port: (number | null)[]; bench: (number | null)[] } {
  const port = PROFILES.map(() => null as number | null);
  const bench = PROFILES.map(() => null as number | null);

  // Solo el bloque "Distribución de activos": debajo vienen geografia y divisas,
  // que suman otro 100% y doblarian el peso de la renta variable.
  const rows: any[] = [];
  let inside = false;
  for (const row of allocationRows ?? []) {
    if (row.isPct === null) inside = String(row.label).toLowerCase().includes('distribución de activos');
    else if (inside) rows.push(row);
  }

  PROFILES.forEach((_, pIdx) => {
    let weight = 0;
    let drop = 0;
    for (const row of rows) {
      const label = String(row.label).toLowerCase();
      const rule = CRISIS_2008_DROP.find((r) => label.includes(r.match));
      const w = typeof row.values[pIdx] === 'number' ? row.values[pIdx] : parseFloat(row.values[pIdx]);
      if (!rule || !Number.isFinite(w) || w <= 0) continue;
      weight += w;
      drop += (w / 100) * rule.drop;
    }
    // Sin pesos no hay estimacion posible: se deja en null y la curva no se pinta.
    if (weight <= 0) return;
    port[pIdx] = clamp(drop * (100 / weight), 0.01, 0.9);

    const p = vlSeries[String(pIdx)];
    const b = vlSeries[`b${pIdx}`];
    if (!p?.length || !b?.length) return;
    // Mismo tramo para los dos, o se compararia la caida de quince años con la
    // de siete.
    const from = p[0].d > b[0].d ? p[0].d : b[0].d;
    const ddP = maxDrawdown(p.filter((pt) => pt.d >= from));
    const ddB = maxDrawdown(b.filter((pt) => pt.d >= from));
    if (!ddP || !ddB) return;
    bench[pIdx] = clamp(port[pIdx]! * clamp(ddB / ddP, 0.4, 3), 0.01, 0.9);
  });

  return { port, bench };
}

export const SectionBacktest: React.FC<{
  forcedProfileIndices?: number[];
  isPrintMode?: boolean;
  /** El informe puede pedir el benchmark sin que nadie toque la casilla. */
  forcedShowBenchmark?: boolean;
}> = ({ forcedProfileIndices, isPrintMode, forcedShowBenchmark }) => {
  // Las curvas de la ultima subida del libro VL; si no hay documento, las
  // empaquetadas en `vlData.ts`. El asset allocation solo lo usa el escenario
  // simulado de 2008, para repartir su caida por clase de activo.
  const { vlSeries, assetAllocation } = useMonthlyReports();
  const [profileIdxState, setProfileIdx] = useState<number>(2);
  const [showBenchmark, setShowBenchmark] = useState<boolean>(false);
  const [isStressTest, setIsStressTest] = useState<boolean>(false);
  const [stressScenario, setStressScenario] = useState<string>('2020');
  const activeIndices = forcedProfileIndices !== undefined ? forcedProfileIndices : [profileIdxState];
  
  const [initialAmount, setInitialAmount] = useState<number>(globalSettings.backtest.initialAmount);
  const [startDateStr, setStartDateStr] = useState<string>(globalSettings.backtest.startDateStr);
  const [freq, setFreq] = useState<'none' | 'monthly' | 'quarterly'>(globalSettings.backtest.freq);
  const [freqAmount, setFreqAmount] = useState<number>(globalSettings.backtest.freqAmount);
  const [lumpDateStr, setLumpDateStr] = useState<string>(globalSettings.backtest.lumpDateStr);
  const [lumpAmount, setLumpAmount] = useState<number>(globalSettings.backtest.lumpAmount);

  useEffect(() => {
    globalSettings.backtest = { initialAmount, startDateStr, freq, freqAmount, lumpDateStr, lumpAmount };
  }, [initialAmount, startDateStr, freq, freqAmount, lumpDateStr, lumpAmount]);

    useEffect(() => {
    const handleApply = (e: any) => setProfileIdx(e.detail);
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // El benchmark se compara siempre contra el primer perfil activo: cada perfil
  // tiene el suyo propio, asi que mezclar varios a la vez no seria interpretable.
  const benchmarkOf = activeIndices[0];
  const hasBenchmark =
    (forcedShowBenchmark ?? showBenchmark) &&
    benchmarkOf !== undefined &&
    !!(vlSeries as any)[`b${benchmarkOf}`]?.length;

  // 999 es el indice reservado que el resto del componente ya trata como "Benchmark".
  const renderIndices = hasBenchmark ? [...activeIndices, 999] : activeIndices;

  const trajectories = useMemo(() => {
    const map: Record<number, ReturnType<typeof buildTrajectory>> = {};
    activeIndices.forEach(pIdx => {
      map[pIdx] = buildTrajectory(pIdx, false, vlSeries);
    });
    if (hasBenchmark) {
      map[999] = buildTrajectory(benchmarkOf, true, vlSeries);
    }

    return map;
  }, [activeIndices, hasBenchmark, benchmarkOf, vlSeries]);
  
  // La fecha minima es la del historico MAS CORTO de los que se pintan.
  // Importa con el benchmark activo: algunas series de benchmark empiezan despues
  // que la cartera (p.ej. Agresiva + arranca en 2018 y su indice en 2011, pero
  // Conservadora arranca en 2010 y su indice en 2011). Si se permitiera empezar
  // antes del inicio del benchmark, su linea saldria plana y la comparacion
  // pareceria mucho mejor de lo que es.
  const minDateAllowed = useMemo(
    () =>
      renderIndices
        .map(pIdx => trajectories[pIdx]?.dates[0])
        .filter(Boolean)
        .reduce((latest, d) => (d! > latest! ? d : latest))!
        .toISOString()
        .slice(0, 10),
    [trajectories, renderIndices]
  );

  const scenario = STRESS_SCENARIOS.find(s => s.id === stressScenario) || STRESS_SCENARIOS[0];

  /**
   * Curvas que el escenario elegido puede pintar de verdad.
   *
   * En un escenario real, una serie que empieza despues de la crisis no tiene
   * nada que enseñar: `trajValue` devolveria su primer valor para todas las
   * fechas anteriores y la curva saldria plana, que es justo lo que se lee como
   * "esta cartera aguanto la crisis sin caer". El simulado de 2008 usa su propio
   * corte: se pinta la que tiene pesos de asset allocation.
   */
  const drops2008 = useMemo(
    () => simulated2008Drops(assetAllocation[0]?.rows, vlSeries as any),
    [assetAllocation, vlSeries]
  );

  const stressCoverage = useMemo(() => {
    const start = new Date(scenario.start);
    const covered = renderIndices.filter(pIdx => {
      if (scenario.id === '2008') {
        const drop = pIdx === 999 ? drops2008.bench[benchmarkOf] : drops2008.port[pIdx];
        return drop !== null && drop !== undefined;
      }
      const traj = trajectories[pIdx];
      return !!traj && traj.dates.length > 0 && traj.dates[0] <= start;
    });
    return {
      covered,
      missing: renderIndices.filter(pIdx => !covered.includes(pIdx)),
    };
  }, [renderIndices, trajectories, scenario, drops2008, benchmarkOf]);

  const simResult = useMemo(() => {
    if (isStressTest) {
      const start = new Date(scenario.start);
      const end = new Date(scenario.end);
      const amount = initialAmount;
      const drawn = stressCoverage.covered;
      if (drawn.length === 0) return null;

      const resDates: string[] = [];
      const capitalSeries: number[] = [];
      const valueSeriesByProfile: Record<number, number[]> = {};
      const finalValues: Record<number, number> = {};

      drawn.forEach(pIdx => {
        valueSeriesByProfile[pIdx] = [];
      });

      if (scenario.id === '2008') {
        // Curva ILUSTRATIVA, no historica. La profundidad de cada una sale de
        // `simulated2008Drops`: el asset allocation real de la cartera para los
        // perfiles y la relacion medida indice/cartera para el benchmark.
        const steps = 15;
        for (let i = 0; i <= steps; i++) {
          const d = new Date(start.getTime() + (end.getTime() - start.getTime()) * (i / steps));
          resDates.push(d.toISOString().slice(0, 10));
          capitalSeries.push(amount);

          drawn.forEach(pIdx => {
            const maxDrop = (pIdx === 999 ? drops2008.bench[benchmarkOf] : drops2008.port[pIdx]) ?? 0;
            // Baja hasta el suelo en el 80% del recorrido y rebota un poco.
            const progress = i / steps;
            const drop = progress < 0.8
              ? maxDrop * Math.sin((progress / 0.8) * Math.PI / 2)
              : maxDrop - (progress - 0.8) * maxDrop * 0.5;
            valueSeriesByProfile[pIdx].push(amount * (1 - drop));
          });
        }
      } else {
        // Datos reales: se compran participaciones el primer dia del escenario
        // y se valoran dia a dia hasta el ultimo.
        const datePoints = trajectories[drawn[0]].dates.filter(d => d >= start && d <= end);
        if (!datePoints.find(d => d.getTime() === end.getTime())) datePoints.push(end);

        const unitsByProfile: Record<number, number> = {};
        drawn.forEach(pIdx => {
           const vl = trajValue(trajectories[pIdx], start);
           unitsByProfile[pIdx] = amount / vl;
        });

        for (let i = 0; i < datePoints.length; i++) {
          const d = datePoints[i];
          resDates.push(d.toISOString().slice(0, 10));
          capitalSeries.push(amount);

          drawn.forEach(pIdx => {
            const vl = trajValue(trajectories[pIdx], d);
            valueSeriesByProfile[pIdx].push(unitsByProfile[pIdx] * vl);
          });
        }
      }

      drawn.forEach(pIdx => {
        finalValues[pIdx] = valueSeriesByProfile[pIdx][valueSeriesByProfile[pIdx].length - 1];
      });

      return { dates: resDates, capitalSeries, valueSeriesByProfile, totalCapital: amount, finalValues };
    }

    // La simulacion normal vive en utils/backtestSim.ts: la comparte el
    // PowerPoint, para que los dos formatos no puedan dar cifras distintas.
    return simulateBacktest(
      { initialAmount, startDateStr, freq, freqAmount, lumpDateStr, lumpAmount },
      renderIndices,
      trajectories
    );
  }, [startDateStr, initialAmount, freq, freqAmount, lumpDateStr, lumpAmount, trajectories, renderIndices, isStressTest, scenario, stressCoverage, drops2008, benchmarkOf]);

  /** Curvas que se dibujan: en stress test, solo las que el escenario cubre. */
  const drawnIndices = isStressTest ? stressCoverage.covered : renderIndices;

  // Cifras de cada perfil, que se pintan como tarjetas en pantalla y como tabla
  // en el PDF cuando hay muchos perfiles.
  const metricsOf = (pIdx: number) => backtestMetrics(simResult, pIdx, startDateStr);

  // Seis perfiles en tarjetas son media hoja de PDF. A partir de tres se
  // resumen en una tabla, que ademas deja compararlos de un vistazo.
  const kpisAsTable = !!isPrintMode && drawnIndices.length > 2;

  // SVG Chart Dimensions
  const W = 900;
  const H = isPrintMode ? 320 : 350;
  const M = { t: 20, r: 40, b: 30, l: 60 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  let allVals: number[] = [...(simResult?.capitalSeries || [100000])];
  if (simResult?.valueSeriesByProfile) {
    drawnIndices.forEach(pIdx => {
      allVals.push(...simResult.valueSeriesByProfile[pIdx]);
    });
  } else {
    allVals.push(100000, 0);
  }
  let hi = Math.max(...allVals);
  let lo = Math.min(...allVals);
  const pad = (hi - lo) * 0.1 || 100;
  hi += pad;
  lo = Math.max(0, lo - pad);
  
  const datesCount = simResult?.dates.length || 0;
  const getX = (i: number) => M.l + (datesCount > 1 ? i / (datesCount - 1) : 0) * iw;
  const getY = (v: number) => M.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  return (
    <section id="simulador" className={isPrintMode ? "" : "pt-10 scroll-mt-28"}>
      {/* En el PDF el titulo lo pone la maqueta del informe, no la seccion. */}
      {!isPrintMode && (
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          03
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Backtest de Inversión
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Simula una inversión pasada con aportaciones periódicas y calcula el patrimonio final acumulado
          </p>
        </div>
      </div>
      )}

      <div className={`bg-white dark:bg-zinc-900 ${isPrintMode ? "space-y-2" : "border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm space-y-5"}`}>
        {!isPrintMode && (
          <>
        {/* Stress Test Toggle */}
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <input 
                type="checkbox" 
                checked={isStressTest} 
                onChange={(e) => setIsStressTest(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-600 cursor-pointer"
              />
              <span className="text-sm font-bold text-red-900 uppercase tracking-wider">Modo Stress Test</span>
            </label>
            <p className="text-xs text-red-700 ml-6">Simula el comportamiento de la cartera en caídas históricas extremas ({initialAmount.toLocaleString('es-ES')}€ iniciales).</p>
            {isStressTest && scenario.simulated && (
              <p className="text-[11px] text-red-900 ml-6 mt-1.5 bg-red-100 border border-red-300 rounded px-2 py-1 max-w-xl">
                <strong className="font-bold">Escenario simulado</strong>: no hay datos reales anteriores a noviembre de 2010
                (los índices arrancan en julio de 2011). La caída de cada cartera se estima aplicando a su asset allocation
                actual el retroceso de 2008 de cada clase de activo (renta variable −55%, renta fija −8%, alternativos −15%,
                monetario 0%), y la de su índice escalando esa caída por la relación medida entre la caída máxima del índice
                y la de esa misma cartera. Curva ilustrativa, no rentabilidad histórica.
              </p>
            )}
            {/*
              Una cartera que aun no existia en la crisis no se pinta: su curva
              saldria plana y eso se lee como "aguanto sin caer".
            */}
            {isStressTest && stressCoverage.missing.length > 0 && (
              <p className="text-[11px] text-red-900 ml-6 mt-1.5 bg-red-100 border border-red-300 rounded px-2 py-1 max-w-xl">
                Sin datos en este escenario:{' '}
                <strong className="font-bold">
                  {stressCoverage.missing.map(p => (p === 999 ? 'el benchmark' : PROFILES[p])).join(', ')}
                </strong>
                . {scenario.simulated
                  ? 'No hay pesos de asset allocation para estimar su caída.'
                  : `Su serie empieza después de ${new Date(scenario.start).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}.`}
              </p>
            )}
          </div>
          {isStressTest && (
            <select
              value={stressScenario}
              onChange={(e) => setStressScenario(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-red-300 text-red-900 rounded px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-800 min-w-[200px]"
            >
              {STRESS_SCENARIOS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Form Controls */}
        {/*
          La casilla del benchmark va en su propia fila, encima de la rejilla.
          Cuando estaba dentro de la primera celda, empujaba hacia abajo su
          etiqueta y su desplegable, y el "Perfil de inversion" quedaba una
          linea mas bajo que los otros tres campos.
        */}
        {/*
          En stress test se apagan solo los campos que el escenario decide por
          su cuenta —las fechas y las aportaciones—, no el bloque entero. El
          perfil, el importe inicial y la casilla del benchmark siguen vivos:
          son justo los que hay que poder cambiar para comparar una crisis entre
          perfiles, y antes obligaban a salir del modo, cambiar y volver a entrar.
        */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <label className="flex items-center gap-2 cursor-pointer mb-3 w-fit">
            <input
              type="checkbox"
              checked={showBenchmark}
              onChange={(e) => setShowBenchmark(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded border-zinc-300 dark:border-zinc-600 focus:ring-red-600 cursor-pointer"
            />
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Comparar con Benchmark</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Perfil de Inversión
            </label>
            <select
              value={profileIdxState}
              onChange={(e) => setProfileIdx(Number(e.target.value))}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2.5 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-800"
            >
              {PROFILES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Inversión Inicial
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-800"
              />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">€</span>
            </div>
            {initialAmount < 100000 && (
              <p className="text-[9px] font-bold text-red-600 mt-1 uppercase tracking-widest">
                Mínimo 100.000 €
              </p>
            )}
          </div>
          <div className={isStressTest ? 'opacity-40 pointer-events-none' : ''}>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Fecha de Inicio {isStressTest && <span className="normal-case tracking-normal">(la fija el escenario)</span>}
            </label>
            <input
              type="date"
              value={startDateStr}
              min={minDateAllowed}
              max={TODAY}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-800"
            />
          </div>
          <div className={isStressTest ? 'opacity-40 pointer-events-none' : ''}>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Aportación Periódica {isStressTest && <span className="normal-case tracking-normal">(no aplica)</span>}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={freq}
                onChange={(e) => setFreq(e.target.value as any)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200"
              >
                <option value="none">Ninguna</option>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
              </select>
              {freq !== 'none' && (
                <input
                  type="number"
                  value={freqAmount}
                  onChange={(e) => setFreqAmount(Number(e.target.value))}
                  className="w-20 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200"
                />
              )}
            </div>
          </div>
          </div>
        </div>

        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 ${isStressTest ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Aportación Puntual Adicional (Opcional):
            </span>
            <input
              type="date"
              value={lumpDateStr}
              min={startDateStr}
              max={TODAY}
              onChange={(e) => setLumpDateStr(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200"
            />
            <input
              type="number"
              value={lumpAmount || ''}
              onChange={(e) => setLumpAmount(Number(e.target.value))}
              placeholder="Importe €"
              className="w-28 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200"
            />
          </div>
          <span className="text-[10px] text-zinc-400 italic">
            El historial utilizable varía según la fecha de lanzamiento del perfil seleccionado.
          </span>
        </div>
        </>
        )}

        {/* KPIs en tabla: solo en el PDF y con tres perfiles o mas */}
        {simResult && kpisAsTable && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-900 text-white text-[8px] font-bold uppercase tracking-wider">
                <th className="px-2 py-1 text-left">Perfil</th>
                <th className="px-2 py-1 text-right">Capital aportado</th>
                <th className="px-2 py-1 text-right">Valor actual</th>
                <th className="px-2 py-1 text-right">Plusvalía</th>
                <th className="px-2 py-1 text-right">Rentabilidad</th>
                <th className="px-2 py-1 text-right">TIR anualizada</th>
              </tr>
            </thead>
            <tbody>
              {drawnIndices.map((pIdx) => {
                const m = metricsOf(pIdx);
                return (
                  <tr key={pIdx} className="border-b border-zinc-100">
                    <td className="px-2 py-[3px] text-[8.5px] font-bold uppercase tracking-wider" style={{ color: pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx] }}>
                      {pIdx === 999 ? 'Benchmark' : PROFILES[pIdx]}
                    </td>
                    <td className="px-2 py-[3px] text-[8.5px] text-right font-mono tabular-nums text-zinc-700">
                      {Math.round(m.totalCapital).toLocaleString('es-ES')} €
                    </td>
                    <td className="px-2 py-[3px] text-[8.5px] text-right font-mono tabular-nums font-bold text-zinc-900">
                      {Math.round(m.finalValue).toLocaleString('es-ES')} €
                    </td>
                    <td className={`px-2 py-[3px] text-[8.5px] text-right font-mono tabular-nums ${m.gain >= 0 ? "text-zinc-700" : "text-red-700"}`}>
                      {Math.round(m.gain).toLocaleString('es-ES')} €
                    </td>
                    <td className={`px-2 py-[3px] text-[8.5px] text-right font-mono tabular-nums ${m.gain >= 0 ? "text-zinc-700" : "text-red-700"}`}>
                      {m.gainPct.toFixed(1).replace('.', ',')}%
                    </td>
                    <td className="px-2 py-[3px] text-[8.5px] text-right font-mono tabular-nums font-bold text-zinc-900">
                      {m.annualizedPct.toFixed(1).replace('.', ',')}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* KPIs Results Grid */}
        {simResult && !kpisAsTable && drawnIndices.map(pIdx => {
          const { finalValue, gain, gainPct, annualizedPct } = metricsOf(pIdx);

          return (
          <div key={pIdx} className={isPrintMode ? "mb-2" : "mb-4"}>
          <h3 className={`font-bold uppercase tracking-wider ${isPrintMode ? "text-[10px] mb-1" : "text-xs mb-2"}`} style={{ color: pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx] }}>{pIdx === 999 ? 'Benchmark' : PROFILES[pIdx]}</h3>
          <div className={`grid grid-cols-2 sm:grid-cols-4 ${isPrintMode ? "gap-2" : "gap-3"}`}>
            <div className={`bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded text-center ${isPrintMode ? "p-1.5" : "p-3"}`}>
              <span className={`block font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isPrintMode ? "text-[8px]" : "text-[9.5px]"}`}>
                Capital Aportado
              </span>
              <span className={`block font-extrabold text-zinc-900 dark:text-zinc-100 font-mono ${isPrintMode ? "text-sm mt-0.5" : "text-base mt-1"}`}>
                {Math.round(simResult.totalCapital).toLocaleString('es-ES')} €
              </span>
            </div>
            <div className={`bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded text-center ${isPrintMode ? "p-1.5" : "p-3"}`}>
              <span className={`block font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isPrintMode ? "text-[8px]" : "text-[9.5px]"}`}>
                Valor Actual
              </span>
              <span className={`block font-extrabold text-zinc-900 dark:text-zinc-100 font-mono ${isPrintMode ? "text-sm mt-0.5" : "text-base mt-1"}`}>
                {Math.round(finalValue).toLocaleString('es-ES')} €
              </span>
            </div>
            <div className={`bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded text-center ${isPrintMode ? "p-1.5" : "p-3"}`}>
              <span className={`block font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isPrintMode ? "text-[8px]" : "text-[9.5px]"}`}>
                Plusvalía / Rentabilidad
              </span>
              <span className={`block font-extrabold font-mono ${isPrintMode ? "text-sm mt-0.5" : "text-base mt-1"} ${gain >= 0 ? "text-zinc-700 dark:text-zinc-300" : "text-red-700"}`}>
                {Math.round(gain).toLocaleString('es-ES')} € ({gainPct.toFixed(1).replace('.', ',')}%)
              </span>
            </div>
            <div className={`bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded text-center ${isPrintMode ? "p-1.5" : "p-3"}`}>
              <span className={`block font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isPrintMode ? "text-[8px]" : "text-[9.5px]"}`}>
                TIR Anualizada Aprox.
              </span>
              <span className={`block font-extrabold text-zinc-700 dark:text-zinc-300 font-mono ${isPrintMode ? "text-sm mt-0.5" : "text-base mt-1"}`}>
                {annualizedPct !== null
                  ? `${annualizedPct.toFixed(1).replace('.', ',')}%`
                  : '—'}
              </span>
            </div>
          </div>
          </div>
        )})}

        {/* Interactive SVG Line Chart */}
        {simResult && simResult.dates.length > 0 && (
          <div className="relative w-full overflow-hidden pt-2">
            {isPrintMode && (
              <div className="flex flex-wrap gap-4 mb-2 justify-center">
                {drawnIndices.map(pIdx => (
                  <div key={pIdx} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx] }}></span>
                    <span className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 tracking-wider">{pIdx === 999 ? 'Benchmark' : PROFILES[pIdx]}</span>
                  </div>
                ))}
              </div>
            )}
            <svg
              className="w-full h-auto overflow-visible select-none"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * W;
                const ratio = (mouseX - M.l) / iw;
                const closestIdx = Math.max(0, Math.min(simResult.dates.length - 1, Math.round(ratio * (simResult.dates.length - 1))));
                if (hoverIndex !== closestIdx) {
                  setHoverIndex(closestIdx);
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Y Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const val = lo + frac * (hi - lo);
                const yPos = getY(val);
                return (
                  <g key={frac}>
                    <line
                      x1={M.l}
                      y1={yPos}
                      x2={M.l + iw}
                      y2={yPos}
                      className="stroke-zinc-200 dark:stroke-zinc-800"
                      strokeWidth={1}
                    />
                    <text
                      x={M.l - 8}
                      y={yPos + 3.5}
                      className="fill-zinc-400 text-[9.5px] font-mono font-bold"
                      textAnchor="end"
                    >
                      {Math.round(val).toLocaleString('es-ES')} €
                    </text>
                  </g>
                );
              })}

              
              {/* X Gridlines */}
              {(() => {
                if (!simResult || simResult.dates.length < 2) return null;
                const numTicks = 6;
                const step = Math.floor((simResult.dates.length - 1) / (numTicks - 1));
                return Array.from({ length: numTicks }).map((_, i) => {
                  const dataIdx = Math.min(i * step, simResult.dates.length - 1);
                  const dStr = simResult.dates[dataIdx];
                  if (!dStr) return null;
                  const d = new Date(dStr);
                  const xPos = M.l + (dataIdx / (simResult.dates.length - 1)) * iw;
                  return (
                    <g key={`x-${i}`}>
                      <line
                        x1={xPos}
                        y1={M.t}
                        x2={xPos}
                        y2={M.t + ih}
                        stroke="#F1F5F9"
                        strokeWidth={1}
                      />
                      <text
                        x={xPos}
                        y={M.t + ih + 16}
                        className="fill-zinc-400 text-[10px] font-mono font-bold"
                        textAnchor="middle"
                      >
                        {d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '')}
                      </text>
                    </g>
                  );
                });
              })()}
              {/* Capital Path (Dashed) */}
              <path
                d={simResult.capitalSeries
                  .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v)}`)
                  .join(' ')}
                fill="none"
                className="stroke-slate-400 dark:stroke-zinc-500"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />

              {/* Portfolio Value Paths */}
              {drawnIndices.map(pIdx => (
                <path
                  key={pIdx}
                  d={simResult.valueSeriesByProfile[pIdx]
                    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v)}`)
                    .join(' ')}
                  fill="none"
                  stroke={pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* Crosshair & Tooltip */}
              {hoverIndex !== null && (
                <g>
                  <line
                    x1={getX(hoverIndex)}
                    y1={M.t}
                    x2={getX(hoverIndex)}
                    y2={M.t + ih}
                    className="stroke-zinc-800 dark:stroke-zinc-300"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  {drawnIndices.map(pIdx => (
                    <circle
                      key={pIdx}
                      cx={getX(hoverIndex)}
                      cy={getY(simResult.valueSeriesByProfile[pIdx][hoverIndex])}
                      r={5}
                      fill={pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx]}
                      stroke="#FFF"
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )}
            </svg>

            {/* Hover Tooltip Box */}
            {hoverIndex !== null && (
              <div
                className="absolute top-4 bg-zinc-900 text-white p-1.5 rounded shadow-lg text-[9px] pointer-events-none transform -translate-x-1/2"
                style={{ left: `${(getX(hoverIndex) / W) * 100}%` }}
              >
                <div className="font-bold text-zinc-300 pb-0.5 border-b border-zinc-700 mb-1 text-[8px]">
                  {simResult.dates[hoverIndex]}
                </div>
                {drawnIndices.map(pIdx => (
                <div key={pIdx} className="flex justify-between gap-3 text-white">
                  <span style={{ color: pIdx === 999 ? '#9CA3AF' : PROFILE_COLORS[pIdx] }}>Valor {pIdx === 999 ? 'Benchmark' : PROFILES[pIdx]}:</span>
                  <span className="font-mono font-bold">
                    {Math.round(simResult.valueSeriesByProfile[pIdx][hoverIndex]).toLocaleString('es-ES')} €
                  </span>
                </div>
                ))}
                <div className="flex justify-between gap-3 text-zinc-400">
                  <span>Capital Aportado:</span>
                  <span className="font-mono font-bold">
                    {Math.round(simResult.capitalSeries[hoverIndex]).toLocaleString('es-ES')} €
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ninguna de las curvas elegidas existia en la crisis seleccionada. */}
        {isStressTest && !simResult && (
          <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center">
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Sin datos para «{scenario.label}»
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              El histórico del perfil seleccionado empieza después de esta crisis. Elige otro escenario u otro perfil.
            </p>
          </div>
        )}

        <p className="text-[9px] text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/50/50 p-1.5 rounded mt-2">          Backtest construido sobre las rentabilidades anualizadas reales por ventana (1, 2, 3, 4, 5 años y desde 2009). Refleja el interés compuesto y las fechas exactas de las aportaciones.        </p>
      </div>
        {/* En el PDF el descargo va una sola vez, en el pie de cada hoja. */}
        {!isPrintMode && (
          <div className="mt-4 text-[9px] font-medium text-zinc-400 text-left border-t border-zinc-100 pt-3">
            * Retornos históricos de clientes reales, netos de cualquier comisión aplicable (gestión, custodia, etc).
          </div>
        )}
    </section>
  );
};
