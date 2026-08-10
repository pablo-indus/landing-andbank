import React, { useState, useMemo } from 'react';
import { PROFILES, PROFILE_COLORS, HISTORICAL_VL } from '../data/portfolioData';
import { ScrollableTabs } from './ScrollableTabs';

type Period = 'YTD' | '1Y' | '3Y' | '5Y' | 'Desde 2009';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'YTD', label: '2026 (YTD)' },
  { id: '1Y', label: '1 Año' },
  { id: '3Y', label: '3 Años' },
  { id: '5Y', label: '5 Años' },
  { id: 'Desde 2009', label: 'Desde 2009' }
];

export const SectionDrawdown: React.FC<{ forcedActiveIndices?: number[]; isPrintMode?: boolean }> = ({ forcedActiveIndices, isPrintMode }) => {
  const [activeIndicesState, setActiveIndices] = useState<number[]>([1, 2, 4]);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const activeIndices = forcedActiveIndices !== undefined ? forcedActiveIndices : activeIndicesState; // default Conservador, Moderado, Agresivo
    React.useEffect(() => {
    const handleApply = (e: any) => setActiveIndices([e.detail]);
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('5Y');

  const toggleProfile = (idx: number) => {
    if (showBenchmark) {
      setActiveIndices([idx]);
      return;
    }
    setActiveIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

const trajectories = useMemo(() => {
    const today = new Date('2026-06-30T00:00:00Z');
    let startDate = new Date('1900-01-01T00:00:00Z');
    
    if (selectedPeriod === 'YTD') {
      startDate = new Date('2025-12-31T00:00:00Z');
    } else if (selectedPeriod === '1Y') {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
    } else if (selectedPeriod === '3Y') {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 3);
    } else if (selectedPeriod === '5Y') {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 5);
    } else if (selectedPeriod === 'Desde 2009') {
      startDate = new Date('2009-01-01T00:00:00Z');
    }

    const makePoints = (pIdx: number, isBenchmark = false) => {
      let points: { d: Date; val: number }[] = [];
      
      // Serie real: "b0".."b5" son los benchmarks, "0".."5" las carteras.
      // Antes el benchmark se inventaba a partir de la propia cartera.
      const seriesKey = isBenchmark ? `b${pIdx}` : String(pIdx);
      const series = (HISTORICAL_VL as any)[seriesKey];

      // Sin serie no se dibuja nada. El respaldo anterior reconstruia la curva a
      // partir de HISTORICAL_ANNUAL/HISTORICAL_MONTHLY (cifras inventadas) y le
      // sumaba ruido senoidal. Mejor no pintar que pintar datos que no existieron.
      if (!series || series.length === 0) return [];

      const rawData = series.filter((pt: any) => new Date(pt.d + 'T00:00:00Z') >= startDate);

      let maxSoFar = 0;
      const allDdPoints = rawData.map((pt: any) => {
        const val = pt.v;
        if (val > maxSoFar) maxSoFar = val;
        const dd = maxSoFar === 0 ? 0 : (val / maxSoFar - 1) * 100;
        return { d: new Date(pt.d + 'T00:00:00Z'), dd };
      });

      const step = Math.ceil(allDdPoints.length / 400);
      let minDdIndex = 0;
      for (let i = 1; i < allDdPoints.length; i++) {
        if (allDdPoints[i].dd < allDdPoints[minDdIndex].dd) minDdIndex = i;
      }
      return allDdPoints.filter(
        (_: any, i: number) => i % step === 0 || i === allDdPoints.length - 1 || i === minDdIndex
      );
    };

    const res: any[] = PROFILES.map((_, pIdx) => makePoints(pIdx, false));

    // Con el benchmark activo solo hay un perfil seleccionado (ver toggleProfile),
    // asi que comparamos contra el benchmark de ese perfil. 999 es el indice que
    // el resto del componente ya pinta como "Benchmark".
    const benchmarkOf = activeIndices[0];
    if (showBenchmark && benchmarkOf !== undefined && (HISTORICAL_VL as any)[`b${benchmarkOf}`]?.length) {
      res[999] = makePoints(benchmarkOf, true);
    }

    return res;
  }, [selectedPeriod, showBenchmark, activeIndices]);

  // SVG Chart Dimensions
  const W = 900;
  const H = isPrintMode ? 280 : 350;
  const M = { t: 20, r: 40, b: 60, l: 60 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  // Global bounds
  let xMin = Infinity;
  let xMax = -Infinity;
  let maxDd = 0;

  // Incluimos el benchmark (indice 999) solo si se ha podido construir su serie.
  const renderIndices = trajectories[999] ? [...activeIndices, 999] : activeIndices;

  renderIndices.forEach(pIdx => {
    const pts = trajectories[pIdx];
    if (pts && pts.length > 0) {
      const minT = pts[0].d.getTime();
      const maxT = pts[pts.length - 1].d.getTime();
      if (minT < xMin) xMin = minT;
      if (maxT > xMax) xMax = maxT;
      
      pts.forEach(pt => {
        if (Math.abs(pt.dd) > maxDd) maxDd = Math.abs(pt.dd);
      });
    }
  });

  if (xMin === Infinity) {
    xMin = new Date('2009-01-01T00:00:00Z').getTime();
    xMax = new Date('2026-12-31T00:00:00Z').getTime();
  }
  if (xMax === xMin) {
    xMax = xMin + 1000;
  }

  // Round up to nearest 5
  let yMin = -Math.ceil((maxDd + 5) / 5) * 5;
  if (yMin >= 0) yMin = -5;

  const getX = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * iw;
  const getY = (val: number) => M.t + ((0 - val) / (0 - yMin)) * ih;

  // Generate X axis ticks (Years) dynamically
  const xTicks = [];
  const startYear = new Date(xMin).getFullYear();
  const endYear = new Date(xMax).getFullYear();
  const yearDiff = endYear - startYear;
  const tickStep = yearDiff > 10 ? 2 : 1;

  for (let y = startYear; y <= endYear + 1; y += tickStep) {
    const tDate = new Date(`${y}-01-01T00:00:00Z`);
    if (tDate.getTime() >= xMin && tDate.getTime() <= xMax) {
      xTicks.push({
        date: tDate,
        label: y.toString()
      });
    }
  }

  // Generate Y axis ticks
  const yTicks = [];
  for (let v = 0; v >= yMin; v -= 5) {
    yTicks.push(v);
  }

  
  const getClosestPt = (pts: {d: Date, dd: number}[], targetTime: number) => {
    if (!pts || !pts.length) return null;
    let closest = pts[0];
    let minDiff = Math.abs(pts[0].d.getTime() - targetTime);
    // Linear search is fine since max length is ~400
    for (let i = 1; i < pts.length; i++) {
      const diff = Math.abs(pts[i].d.getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pts[i];
      }
    }
    return closest;
  };

  return (
    <section id="drawdown" className={isPrintMode ? "" : "pt-10 scroll-mt-20"}>
      {!isPrintMode && (
<div className="flex items-start gap-4 border-b-2 break-inside-avoid border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          04
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Evolución de la Caída Máxima (Drawdown)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Mide la pérdida máxima desde el último pico histórico de la cartera
          </p>
        </div>
      </div>
)}

      <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg ${isPrintMode ? "p-2 space-y-3" : "p-5 shadow-sm space-y-6"}`}>
        {/* Profile Toggles or Legend */}
        {isPrintMode ? (
          <div className="flex flex-wrap gap-4 mb-2 justify-center">
            {renderIndices.map(pIdx => (
              <div key={pIdx} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx] }}></span>
                <span className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 tracking-wider">{pIdx === 999 ? 'Benchmark' : PROFILES[pIdx]}</span>
              </div>
            ))}
          </div>
        ) : (
        <div className="flex flex-col gap-4">
          <div className="border-b border-zinc-100 pb-4">
            <ScrollableTabs 
              tabs={PERIODS} 
              activeTab={selectedPeriod} 
              onTabChange={(id) => setSelectedPeriod(id as Period)}
              baseClass="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer"
              activeClass="bg-red-700 text-white shadow-xs"
              inactiveClass="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 border-b border-zinc-100 pb-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showBenchmark} 
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowBenchmark(checked);
                  if (checked && activeIndicesState.length > 1) {
                    setActiveIndices([activeIndicesState[0]]);
                  }
                }}
                className="w-4 h-4 text-red-600 rounded border-zinc-300 dark:border-zinc-600 focus:ring-red-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Comparar con Benchmark</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROFILES.map((pName, i) => {
            const isActive = activeIndices.includes(i);
            return (
              <button
                key={pName}
                onClick={() => toggleProfile(i)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:bg-zinc-800 hover:text-zinc-700 dark:text-zinc-300'
                }`}
                style={isActive ? { backgroundColor: PROFILE_COLORS[i] } : {}}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs transform -rotate-12 inline-block shrink-0"
                  style={{ backgroundColor: isActive ? '#fff' : PROFILE_COLORS[i] }}
                />
                {pName}
              </button>
            );
          })}
        </div>
        </div>
        )}

        {/* SVG Chart */}
        <div className="relative w-full overflow-hidden border border-zinc-100 rounded-lg bg-zinc-50 dark:bg-zinc-800/50/30">
          <svg
            className="w-full h-auto overflow-visible select-none"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={(e) => {
              if (activeIndices.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = ((e.clientX - rect.left) / rect.width) * W;
              const ratio = Math.max(0, Math.min(1, (mouseX - M.l) / iw));
              const t = xMin + ratio * (xMax - xMin);
              setHoverTime(t);
            }}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Crosshair */}
            {!isPrintMode && hoverTime !== null && renderIndices.length > 0 && (
              <g>
                <line
                  x1={getX(hoverTime)}
                  y1={M.t}
                  x2={getX(hoverTime)}
                  y2={M.t + ih}
                  className="stroke-zinc-800 dark:stroke-zinc-300"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {renderIndices.map(pIdx => {
                  const pts = trajectories[pIdx];
                  if (!pts) return null;
                  const pt = getClosestPt(pts, hoverTime);
                  if (!pt) return null;
                  return (
                    <circle
                      key={pIdx}
                      cx={getX(pt.d.getTime())}
                      cy={getY(pt.dd)}
                      r={5}
                      fill={pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx]}
                      stroke="#FFF"
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            )}
            
            {/* Grid Y */}
            {/* Historical Events Shading */}
                        {/* Historical Events Shading */}
            <g opacity="0.4">
              
              
              <line x1={getX(new Date('2025-04-01T00:00:00Z').getTime())} y1={M.t} x2={getX(new Date('2025-04-01T00:00:00Z').getTime())} y2={M.t + ih} stroke="#991B1B" strokeWidth={1.5} strokeDasharray="4 4" />
              <text x={getX(new Date('2025-04-01T00:00:00Z').getTime())} y={M.t + ih - 8} fontSize="11" fill="#991B1B" textAnchor="middle" fontWeight="bold">Liberation Day</text>


              <rect x={getX(new Date('2020-02-20T00:00:00Z').getTime())} y={M.t} width={getX(new Date('2020-04-01T00:00:00Z').getTime()) - getX(new Date('2020-02-20T00:00:00Z').getTime())} height={ih} fill="#FECACA" />
              <text x={getX(new Date('2020-03-01T00:00:00Z').getTime())} y={M.t + ih - 8} fontSize="9" fill="#991B1B" textAnchor="middle" fontWeight="bold">COVID-19</text>
              
              <rect x={getX(new Date('2022-01-01T00:00:00Z').getTime())} y={M.t} width={getX(new Date('2022-10-31T00:00:00Z').getTime()) - getX(new Date('2022-01-01T00:00:00Z').getTime())} height={ih} fill="#FECACA" />
              <text x={getX(new Date('2022-06-01T00:00:00Z').getTime())} y={M.t + ih - 8} fontSize="9" fill="#991B1B" textAnchor="middle" fontWeight="bold">Crisis 2022</text>
            </g>

            {yTicks.map(val => {
              const yPos = getY(val);
              return (
                <g key={val}>
                  <line
                    x1={M.l}
                    y1={yPos}
                    x2={M.l + iw}
                    y2={yPos}
                    className={val === 0 ? "stroke-slate-600 dark:stroke-zinc-500" : "stroke-zinc-200 dark:stroke-zinc-800"}
                    strokeWidth={val === 0 ? 1.5 : 1}
                  />
                  <text
                    x={M.l - 8}
                    y={yPos + 3}
                    className="fill-zinc-400 text-[10px] font-mono font-bold"
                    textAnchor="end"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Grid X */}
            {xTicks.map((tick, i) => {
              const xPos = getX(tick.date.getTime());
              return (
                <g key={i}>
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
                    className="fill-zinc-400 text-xs font-mono font-bold"
                    textAnchor="middle"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Lines and Hover Area */}
            {renderIndices.map(pIdx => {
              const pts = trajectories[pIdx];
              if (!pts || !pts.length) return null;
              
              const dPath = pts.map((pt, i) => {
                const x = getX(pt.d.getTime());
                const y = getY(pt.dd);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ');
              
              // Area path
              const areaPath = `${dPath} L ${getX(pts[pts.length - 1].d.getTime())} ${getY(0)} L ${getX(pts[0].d.getTime())} ${getY(0)} Z`;

              return (
                <g key={pIdx}>
                  <path
                    d={areaPath}
                    fill={pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx]}
                    fillOpacity={0.1}
                    className="pointer-events-none"
                  />
                  <path
                    d={dPath}
                    fill="none"
                    stroke={pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx]}
                    strokeWidth={1.5}
                    className="pointer-events-none drop-shadow-sm"
                  />
                  

                </g>
              );
            })}
            
            {/* Draw top axis border */}
            <line
              x1={M.l}
              y1={getY(0)}
              x2={M.l + iw}
              y2={getY(0)}
              stroke="#475569"
              strokeWidth={1.5}
            />
          </svg>

          {/* Tooltip */}
          {!isPrintMode && hoverTime !== null && activeIndices.length > 0 && (
            <div
              className="absolute z-50 bg-zinc-900 text-white p-2.5 rounded shadow-xl text-[10px] pointer-events-none transform -translate-x-1/2"
              style={{ left: `${(getX(hoverTime) / W) * 100}%`, top: `16px` }}
            >
              <div className="font-bold text-zinc-300 pb-1 border-b border-zinc-700 mb-1">
                {new Date(hoverTime).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
              </div>
              {renderIndices.map(pIdx => {
                const pts = trajectories[pIdx];
                if (!pts) return null;
                const pt = getClosestPt(pts, hoverTime);
                if (!pt) return null;
                return (
                  <div key={pIdx} className="flex items-center justify-between gap-3 text-white">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs inline-block" style={{ backgroundColor: pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx] }} />
                      <span style={{ color: pIdx === 999 ? '#4B5563' : PROFILE_COLORS[pIdx] }}>{pIdx === 999 ? 'Benchmark' : PROFILES[pIdx]}</span>
                    </div>
                    <span className="font-mono font-bold">
                      {pt.dd.toFixed(2).replace('.', ',')}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

        <div className="mt-4 text-[9px] font-medium text-zinc-400 text-left border-t border-zinc-100 pt-3">
          * Retornos históricos de clientes reales, netos de cualquier comisión aplicable (gestión, custodia, etc).
        </div>
    </section>
  );
};
