import React, { useState, useMemo, useEffect } from 'react';
import { globalSettings } from '../store';
import { PROFILES, PROFILE_COLORS, HISTORICAL_VL } from '../data/portfolioData';

const TODAY = '2026-06-30';

// Los escenarios 2020 y 2022 usan datos reales de las carteras.
// El de 2008 NO: las series de Morningstar empiezan en 2010, asi que no existe
// dato real de esa crisis. Se conserva como ilustracion y va marcado como
// simulado para que no se confunda con rentabilidad historica.
const STRESS_SCENARIOS = [
  { id: '2020', label: 'COVID-19 (Feb-May 2020)', start: '2020-02-15', end: '2020-05-31', simulated: false },
  { id: '2022', label: 'Bear Market (2022)', start: '2021-12-31', end: '2022-10-31', simulated: false },
  { id: '2008', label: 'Crisis Financiera (2008) · Simulado', start: '2008-01-01', end: '2009-03-31', simulated: true }
];


interface Trajectory {
  dates: Date[];
  vals: number[];
  approx: boolean;
}

export function buildTrajectory(profileIdx: number, isBenchmark = false): Trajectory {
  // Las series reales de benchmark estan en las claves "b0".."b5" de vlData,
  // una por perfil (ver scripts/generate-vldata.mjs).
  // Antes el benchmark no se leia: se inventaba a partir de la propia cartera
  // (valor * 0.9 mas una onda senoidal), por lo que nunca podia ser una
  // comparacion real.
  const seriesKey = isBenchmark ? `b${profileIdx}` : String(profileIdx);
  const rawData = (HISTORICAL_VL as any)[seriesKey];

  // Sin serie no se dibuja nada. Antes habia aqui un respaldo que reconstruia la
  // curva a partir de HISTORICAL_ANNUAL/HISTORICAL_MONTHLY, pero esas tablas
  // contenian cifras inventadas (cada ano era un mismo numero base multiplicado
  // por 1/2/3.5/5/7/9 segun el perfil). Es preferible no pintar nada a pintar
  // rentabilidades que no existieron.
  if (!rawData || rawData.length === 0) {
    return { dates: [], vals: [], approx: true };
  }

  const step = Math.ceil(rawData.length / 400);
  const points = rawData
    .filter((_: any, i: number) => i % step === 0 || i === rawData.length - 1)
    .map((pt: any) => ({ d: new Date(pt.d + 'T00:00:00Z'), val: pt.v }));

  return {
    dates: points.map((p: any) => p.d),
    vals: points.map((p: any) => p.val),
    approx: false
  };
}

function trajValue(traj: Trajectory, d: Date): number {
  const { dates, vals } = traj;
  if (d <= dates[0]) return vals[0];
  if (d >= dates[dates.length - 1]) return vals[vals.length - 1];
  for (let i = 0; i < dates.length - 1; i++) {
    if (d >= dates[i] && d <= dates[i + 1]) {
      const frac = (d.getTime() - dates[i].getTime()) / (dates[i + 1].getTime() - dates[i].getTime());
      const lv = Math.log(vals[i]) + frac * (Math.log(vals[i + 1]) - Math.log(vals[i]));
      return Math.exp(lv);
    }
  }
  return vals[vals.length - 1];
}

export const SectionBacktest: React.FC<{ forcedProfileIndices?: number[]; isPrintMode?: boolean }> = ({ forcedProfileIndices, isPrintMode }) => {
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
    showBenchmark &&
    benchmarkOf !== undefined &&
    !!(HISTORICAL_VL as any)[`b${benchmarkOf}`]?.length;

  // 999 es el indice reservado que el resto del componente ya trata como "Benchmark".
  const renderIndices = hasBenchmark ? [...activeIndices, 999] : activeIndices;

  const trajectories = useMemo(() => {
    const map: Record<number, ReturnType<typeof buildTrajectory>> = {};
    activeIndices.forEach(pIdx => {
      map[pIdx] = buildTrajectory(pIdx);
    });
    if (hasBenchmark) {
      map[999] = buildTrajectory(benchmarkOf, true);
    }

    return map;
  }, [activeIndices, hasBenchmark, benchmarkOf]);
  
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

  const simResult = useMemo(() => {
    if (isStressTest) {
      const scenario = STRESS_SCENARIOS.find(s => s.id === stressScenario) || STRESS_SCENARIOS[0];
      const start = new Date(scenario.start);
      const end = new Date(scenario.end);
      const amount = initialAmount;
      
      const resDates: string[] = [];
      const capitalSeries: number[] = [];
      const valueSeriesByProfile: Record<number, number[]> = {};
      const finalValues: Record<number, number> = {};
      
      renderIndices.forEach(pIdx => {
        valueSeriesByProfile[pIdx] = [];
      });

      if (scenario.id === '2008') {
        // Curva ILUSTRATIVA, no historica: no hay datos reales de 2008
        // (las series empiezan en 2010). Se dibuja una caida teorica por perfil.
        const steps = 15;
        for (let i = 0; i <= steps; i++) {
          const d = new Date(start.getTime() + (end.getTime() - start.getTime()) * (i / steps));
          resDates.push(d.toISOString().slice(0, 10));
          capitalSeries.push(amount);
          
          renderIndices.forEach(pIdx => {
            let maxDrop = pIdx === 999 ? 0.50 : 0.05 + (pIdx % 10) * 0.08;
            // curve: drop down to maxDrop around step 12, then slight recovery
            let progress = i / steps;
            let drop = progress < 0.8 ? maxDrop * Math.sin((progress / 0.8) * Math.PI / 2) : maxDrop - (progress - 0.8) * 0.1;
            valueSeriesByProfile[pIdx].push(amount * (1 - drop));
          });
        }
      } else {
        // Use actual data for 2020 and 2022
        const datePoints = trajectories[renderIndices[0]].dates.filter(d => d >= start && d <= end);
        if (!datePoints.find(d => d.getTime() === end.getTime())) datePoints.push(end);
        
        const unitsByProfile: Record<number, number> = {};
        renderIndices.forEach(pIdx => {
           const vl = trajValue(trajectories[pIdx], start);
           unitsByProfile[pIdx] = amount / vl;
        });
        
        for (let i = 0; i < datePoints.length; i++) {
          const d = datePoints[i];
          resDates.push(d.toISOString().slice(0, 10));
          capitalSeries.push(amount);
          
          renderIndices.forEach(pIdx => {
            const vl = trajValue(trajectories[pIdx], d);
            valueSeriesByProfile[pIdx].push(unitsByProfile[pIdx] * vl);
          });
        }
      }

      renderIndices.forEach(pIdx => {
        finalValues[pIdx] = valueSeriesByProfile[pIdx][valueSeriesByProfile[pIdx].length - 1];
      });

      return { dates: resDates, capitalSeries, valueSeriesByProfile, totalCapital: amount, finalValues };
    }

    if (!startDateStr) return null;
    const start = new Date(startDateStr);
    const today = new Date(TODAY);
    if (start > today) return null;
    const events: { d: Date; amount: number }[] = [{ d: start, amount: initialAmount }];
    if (freq !== 'none' && freqAmount > 0) {
      let d = new Date(start);
      while (true) {
        d =
          freq === 'monthly'
            ? new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())
            : new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
        if (d > today) break;
        events.push({ d: new Date(d), amount: freqAmount });
      }
    }
    if (lumpDateStr && lumpAmount > 0) {
      const ld = new Date(lumpDateStr);
      if (ld >= start && ld <= today) events.push({ d: ld, amount: lumpAmount });
    }
    events.sort((a, b) => a.d.getTime() - b.d.getTime());
    
    // We only need one capital series
    const resDates: string[] = [];
    const capitalSeries: number[] = [];
    let currentCapital = 0;
    
    const valueSeriesByProfile: Record<number, number[]> = {};
    const finalValues: Record<number, number> = {};
    
    // Initialize units for each profile
    const unitsByProfile: Record<number, number> = {};
    renderIndices.forEach(pIdx => {
      unitsByProfile[pIdx] = 0;
      valueSeriesByProfile[pIdx] = [];
    });
    
    const trajRef = trajectories[activeIndices[0]];
    const datePoints = trajRef.dates.filter(d => d >= start && d <= today);
    if (!datePoints.find(d => d.getTime() === today.getTime())) datePoints.push(today);
    
    let eventIdx = 0;
    for (let i = 0; i < datePoints.length; i++) {
      const d = datePoints[i];
      while (eventIdx < events.length && events[eventIdx].d <= d) {
        const ev = events[eventIdx];
        currentCapital += ev.amount;
        renderIndices.forEach(pIdx => {
          const vl = trajValue(trajectories[pIdx], ev.d);
          unitsByProfile[pIdx] += ev.amount / vl;
        });
        eventIdx++;
      }
      resDates.push(d.toISOString().slice(0, 10));
      capitalSeries.push(currentCapital);
      
      renderIndices.forEach(pIdx => {
        const vl = trajValue(trajectories[pIdx], d);
        valueSeriesByProfile[pIdx].push(unitsByProfile[pIdx] * vl);
      });
    }
    
    renderIndices.forEach(pIdx => {
      finalValues[pIdx] = valueSeriesByProfile[pIdx][valueSeriesByProfile[pIdx].length - 1];
    });

    return { dates: resDates, capitalSeries, valueSeriesByProfile, totalCapital: currentCapital, finalValues };
  }, [startDateStr, initialAmount, freq, freqAmount, lumpDateStr, lumpAmount, trajectories, renderIndices, isStressTest, stressScenario]);

  // Cifras de cada perfil, que se pintan como tarjetas en pantalla y como tabla
  // en el PDF cuando hay muchos perfiles.
  const metricsOf = (pIdx: number) => {
    const finalValue = simResult ? simResult.finalValues[pIdx] : 0;
    const totalCapital = simResult ? simResult.totalCapital : 0;
    const gain = finalValue - totalCapital;
    const gainPct = totalCapital > 0 ? (gain / totalCapital) * 100 : 0;

    let annualizedPct = 0;
    if (totalCapital > 0 && startDateStr) {
      const startY = new Date(startDateStr).getFullYear();
      const endY = new Date(TODAY).getFullYear();
      const years = Math.max(1, endY - startY + (new Date(TODAY).getMonth() - new Date(startDateStr).getMonth()) / 12);
      annualizedPct = (Math.pow(finalValue / totalCapital, 1 / years) - 1) * 100;
    }

    return { finalValue, totalCapital, gain, gainPct, annualizedPct };
  };

  // Seis perfiles en tarjetas son media hoja de PDF. A partir de tres se
  // resumen en una tabla, que ademas deja compararlos de un vistazo.
  const kpisAsTable = !!isPrintMode && renderIndices.length > 2;

  // SVG Chart Dimensions
  const W = 900;
  const H = isPrintMode ? 320 : 350;
  const M = { t: 20, r: 40, b: 30, l: 60 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  let allVals: number[] = [...(simResult?.capitalSeries || [100000])];
  if (simResult?.valueSeriesByProfile) {
    renderIndices.forEach(pIdx => {
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-red-700 text-white w-8 h-8 rounded flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            3
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
            {isStressTest && STRESS_SCENARIOS.find(s => s.id === stressScenario)?.simulated && (
              <p className="text-[11px] font-bold text-red-900 ml-6 mt-1.5 bg-red-100 border border-red-300 rounded px-2 py-1 inline-block">
                Escenario simulado: no hay datos reales de carteras anteriores a 2010. Curva ilustrativa, no rentabilidad histórica.
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
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 ${isStressTest ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input 
                type="checkbox" 
                checked={showBenchmark} 
                onChange={(e) => setShowBenchmark(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-zinc-300 dark:border-zinc-600 focus:ring-red-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Comparar con Benchmark</span>
            </label>
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
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Fecha de Inicio
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
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Aportación Periódica
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
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
              {renderIndices.map((pIdx) => {
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
        {simResult && !kpisAsTable && renderIndices.map(pIdx => {
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
                {renderIndices.map(pIdx => (
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
              {renderIndices.map(pIdx => (
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
                  {renderIndices.map(pIdx => (
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
                {renderIndices.map(pIdx => (
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
