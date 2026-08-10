import React, { useState, useRef } from 'react';
import { PROFILES, PROFILE_COLORS } from '../data/portfolioData';
import { useMonthlyReports } from '../hooks/useMonthlyReports';
import { ScrollableTabs } from './ScrollableTabs';

const BENCHMARK_DATA: Record<string, { bmk: string, YTD: number, '1Y': number, '3Y': number, '5Y': number, vol1Y: number, vol3Y: number, vol5Y: number }> = {
  'Conservador +': { bmk: 'EAA Fund EUR Diversified Bond - Short Term', YTD: 0.79, '1Y': 1.77, '3Y': 3.32, '5Y': 1.15, vol1Y: 1.5, vol3Y: 1.6, vol5Y: 1.8 },
  'Conservador': { bmk: 'EAA Fund EUR Cautious Allocation - Global', YTD: 3.33, '1Y': 6.55, '3Y': 5.60, '5Y': 1.58, vol1Y: 3.2, vol3Y: 3.4, vol5Y: 3.5 },
  'Moderado': { bmk: 'EAA Fund EUR Moderate Allocation - Global', YTD: 5.79, '1Y': 11.49, '3Y': 8.15, '5Y': 3.20, vol1Y: 5.8, vol3Y: 6.0, vol5Y: 6.2 },
  'Equilibrado': { bmk: 'EAA Fund EUR Flexible Allocation - Global', YTD: 5.89, '1Y': 12.11, '3Y': 8.51, '5Y': 3.59, vol1Y: 7.5, vol3Y: 7.8, vol5Y: 8.0 },
  'Agresivo': { bmk: 'EAA Fund EUR Aggressive Allocation - Global', YTD: 8.91, '1Y': 17.20, '3Y': 11.11, '5Y': 5.35, vol1Y: 11.5, vol3Y: 11.2, vol5Y: 10.8 },
  'Agresivo +': { bmk: 'MSCI World NR EUR', YTD: 11.95, '1Y': 24.92, '3Y': 18.17, '5Y': 12.41, vol1Y: 14.8, vol3Y: 14.5, vol5Y: 13.9 }
};

const PORTFOLIO_VOL_DATA: Record<string, { '1Y': number, '3Y': number, '5Y': number }> = {
  'Conservador +': { '1Y': 1.7, '3Y': 1.8, '5Y': 1.9 },
  'Conservador': { '1Y': 2.3, '3Y': 2.5, '5Y': 2.6 },
  'Moderado': { '1Y': 4.7, '3Y': 4.9, '5Y': 5.1 },
  'Equilibrado': { '1Y': 6.3, '3Y': 6.5, '5Y': 6.8 },
  'Agresivo': { '1Y': 7.2, '3Y': 7.5, '5Y': 7.9 },
  'Agresivo +': { '1Y': 9.7, '3Y': 10.1, '5Y': 10.5 }
};

type Period = 'YTD' | '2025' | '1Y' | '2Y' | '3Y' | '5Y' | '2009';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'YTD', label: '2026 (YTD)' },
  { id: '2025', label: '2025' },
  { id: '1Y', label: '1 Año' },
  { id: '2Y', label: '2 Años' },
  { id: '3Y', label: '3 Años' },
  { id: '5Y', label: '5 Años' },
  { id: '2009', label: 'Desde 2009' }
];

export const SectionRendimiento: React.FC<{ forcedActiveIndices?: number[]; isPrintMode?: boolean }> = ({ forcedActiveIndices, isPrintMode }) => {
  // Cifras netas de comisiones del libro AA. Si la base de datos aun no las
  // tiene, el hook devuelve las estaticas y la seccion sigue funcionando.
  const { profileKpis, windows } = useMonthlyReports();

  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1Y');
  const [scatterPeriod, setScatterPeriod] = useState<Period>('1Y');
  const SCATTER_PERIODS: { id: Period; label: string }[] = [
    { id: '1Y', label: '1 Año' },
    { id: '3Y', label: '3 Años' },
    { id: '5Y', label: '5 Años' }
  ];
  const [visibleProfiles, setVisibleProfiles] = useState<boolean[]>(forcedActiveIndices ? [0,1,2,3,4,5].map(i => forcedActiveIndices.includes(i)) : [true, true, true, true, true, true]);
  
  React.useEffect(() => {
    const handleApply = (e: any) => {
      const updated = [false, false, false, false, false, false];
      updated[e.detail] = true;
      setVisibleProfiles(updated);
    };
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);

  const [tooltip, setTip] = useState<{ x: number; y: number; val: number; name: string } | null>(null);
  const [hoveredScatter, setHoveredScatter] = useState<{ x: number; y: number; title: string; stats: string; vol: string; color: string; isBench: boolean; } | null>(null);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleMouseEnterScatter = (data: any) => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setHoveredScatter(data);
  };
  const handleMouseLeaveScatter = () => {
    hideTimeout.current = setTimeout(() => {
      setHoveredScatter(null);
    }, 150);
  };
  const toggleProfile = (idx: number) => {
    const activeCount = visibleProfiles.filter(Boolean).length;
    if (visibleProfiles[idx] && activeCount === 1) return; // Prevent disabling all
    const updated = [...visibleProfiles];
    updated[idx] = !updated[idx];
    setVisibleProfiles(updated);
  };
  // Las ventanas se buscan por nombre, no por posicion. Antes se indexaba
  // directamente (values[4] para 5 años, values[5] para desde 2009), lo que
  // dependia de que la lista tuviera exactamente las seis entradas de entonces:
  // al quitar la de "4 años" esos indices habrian pasado a apuntar a otra
  // ventana sin que nada fallara visiblemente.
  const emptyRow = PROFILES.map(() => null);
  const windowRow = (label: string): (number | null)[] => {
    const idx = windows.cats.indexOf(label);
    return idx === -1 ? emptyRow : windows.values[idx];
  };

  const getPeriodData = (period: Period): (number | null)[] => {
    switch (period) {
      case 'YTD': return profileKpis.map(p => p.p2026YTD);
      case '2025': return profileKpis.map(p => p.p2025);
      case '1Y': return windowRow('1 año');
      case '2Y': return windowRow('2 años');
      case '3Y': return windowRow('3 años');
      case '5Y': return windowRow('5 años');
      case '2009': return windowRow('Desde 2009');
    }
  };
  
  // Chart rendering metrics for Bar Chart
  const W = 900;
  const H = 280;
  const M = { t: 26, r: 20, b: 40, l: 46 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const selectedProfileIndices = PROFILES.map((_, i) => i).filter((i) => visibleProfiles[i]);

  let chartBars: { id: string, label: string, val: number, color: string, name: string, groupIdx: number, barIdxInGroup: number, totalBarsInGroup: number, isLastInGroup: boolean }[] = [];
  
  const numGroups = PERIODS.length;
  const numBarsPerGroup = selectedProfileIndices.length;

  PERIODS.forEach((p, groupIdx) => {
    const pData = getPeriodData(p.id);
    let barsAdded = 0;
    const nonNullProfiles = selectedProfileIndices.filter(profileIdx => pData[profileIdx] !== null);
    nonNullProfiles.forEach((profileIdx, idx) => {
       const val = pData[profileIdx];
       chartBars.push({
          id: p.id + '-' + profileIdx,
          label: p.label,
          val: val,
          color: PROFILE_COLORS[profileIdx],
          name: p.label + ' - ' + PROFILES[profileIdx],
          groupIdx,
          barIdxInGroup: idx,
          totalBarsInGroup: nonNullProfiles.length,
          isLastInGroup: false
       });
       barsAdded++;
    });
    if (barsAdded > 0) {
      chartBars[chartBars.length - 1].isLastInGroup = true;
    }
  });

  let maxValue = 0;
  let minY = 0;
  chartBars.forEach((bar) => {
    if (bar.val > maxValue) maxValue = bar.val;
    if (bar.val < minY) minY = bar.val;
  });
  maxValue = maxValue || 1;
  
  const step = maxValue > 20 ? 5 : maxValue > 10 ? 2 : 1;
  const topY = Math.ceil(maxValue / step) * step;
  const bottomY = Math.floor(minY / step) * step;
  const getY = (v: number) => M.t + ih - ((v - bottomY) / (topY - bottomY)) * ih;
  
  const groupWidth = iw / numGroups;
  const totalBarsWidthInGroup = groupWidth * 0.8;
  const barWidth = Math.min(50, totalBarsWidthInGroup / (numBarsPerGroup || 1));
  const barGap = numBarsPerGroup > 1 ? Math.min(10, (totalBarsWidthInGroup - barWidth * numBarsPerGroup) / (numBarsPerGroup - 1)) : 0;
  const getBx = (groupIdx: number, barIdxInGroup: number, totalBarsInGroup: number) => {
    const groupCenter = M.l + (groupIdx + 0.5) * groupWidth;
    const totalW = totalBarsInGroup * barWidth + (totalBarsInGroup - 1) * barGap;
    const startX = groupCenter - totalW / 2;
    return startX + barIdxInGroup * (barWidth + barGap);
  };

  return (
    <section id="rendimiento" className={isPrintMode ? "" : "pt-10 scroll-mt-20"}>
      {!isPrintMode && (
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          01
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Rendimiento y Riesgo
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Analiza el retorno según el horizonte temporal y la rentabilidad ajustada por riesgo
          </p>
        </div>
      </div>
      )}
      
      <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg ${isPrintMode ? "p-2" : "p-5 shadow-sm"} space-y-4`}>
        
        {/* Controls */}
        {!isPrintMode && (
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-4">


          {/* Profile Legends */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {PROFILES.map((pName, i) => {
              const isVisible = visibleProfiles[i];
              return (
                <button
                  key={pName}
                  onClick={() => toggleProfile(i)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                    isVisible
                      ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:bg-zinc-800/50'
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 opacity-60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs transform -rotate-12 inline-block shrink-0"
                    style={{ backgroundColor: isVisible ? PROFILE_COLORS[i] : '#CBD5E1' }}
                  />
                  {pName}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Bar Chart SVG */}
        <div className="relative w-full overflow-hidden">
          <svg
            className="w-full h-auto overflow-visible select-none"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseLeave={() => setTip(null)}
          >
            {/* Y Grid */}
            {Array.from({ length: Math.floor((topY - bottomY) / step) + 1 }).map((_, idx) => {
              const val = bottomY + idx * step;
              const yPos = getY(val);
              return (
                <g key={val}>
                  <line
                    x1={M.l}
                    y1={yPos}
                    x2={W - M.r}
                    y2={yPos}
                    stroke={val === 0 ? '#475569' : '#F1F5F9'}
                    strokeWidth={val === 0 ? 1.5 : 1}
                  />
                  <text
                    x={M.l - 10}
                    y={yPos + 3.5}
                    className="fill-zinc-400 text-[10px] font-mono font-bold"
                    textAnchor="end"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {chartBars.map((bar) => {
              const val = bar.val;
              const bx = getBx(bar.groupIdx, bar.barIdxInGroup, bar.totalBarsInGroup);
              const y0 = getY(Math.min(0, Math.max(minY, 0)));
              const yVal = getY(val);
              const by = Math.min(y0, yVal);
              const bHeight = Math.abs(y0 - yVal);
              
              // Only draw label once per group, in the center
              const isCenterBar = bar.barIdxInGroup === Math.floor(numBarsPerGroup / 2);
              const groupCenter = M.l + (bar.groupIdx + 0.5) * groupWidth;

              return (
                <g key={bar.id}>
                  <rect
                    x={bx}
                    y={by}
                    width={barWidth}
                    height={bHeight}
                    fill={bar.color}
                    rx={2}
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                    onMouseEnter={() => setTip({ x: bx + barWidth / 2, y: by, val, name: bar.name })}
                  />
                  {bar.totalBarsInGroup <= 3 || Math.abs(bar.val) > Math.abs(maxValue)*0.05 ? (
                    <text
                      x={bx + barWidth / 2}
                      y={val >= 0 ? by - 6 : by + bHeight + 10}
                      className={`fill-zinc-800 dark:fill-zinc-200 font-mono font-bold ${bar.totalBarsInGroup > 4 ? "text-[8px]" : bar.totalBarsInGroup > 3 ? "text-[8.5px]" : "text-[9px] sm:text-[10px]"}`}
                      textAnchor={bar.totalBarsInGroup > 3 ? (val >= 0 ? "start" : "end") : "middle"}
                      transform={bar.totalBarsInGroup > 3 ? `rotate(-90 ${bx + barWidth / 2} ${val >= 0 ? by - 6 : by + bHeight + 10})` : undefined}
                    >
                      {val.toFixed(1).replace('.', ',')}%
                    </text>
                  ) : null}
                  {isCenterBar && (
                    <text
                      x={groupCenter}
                      y={H - 15}
                      className="fill-zinc-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"
                      textAnchor="middle"
                    >
                      {bar.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {!isPrintMode && (
        <>
        {/* Scatter Plot Retorno / Riesgo */}
        <div className="pt-6 mt-6 border-t border-zinc-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1">
                Retorno vs Volatilidad
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                Comparativa estática de las carteras frente a sus benchmarks
              </p>
            </div>
            <div className="w-full md:w-auto max-w-[300px]">
              <ScrollableTabs 
                tabs={SCATTER_PERIODS} 
                activeTab={scatterPeriod} 
                onTabChange={(id) => setScatterPeriod(id as Period)}
                baseClass="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer"
                activeClass="bg-red-700 text-white shadow-xs"
                inactiveClass="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          
          <div className="relative w-full overflow-hidden mb-6">
            <svg
              className="w-full h-auto overflow-visible select-none"
              viewBox={"0 0 900 320"}
              preserveAspectRatio="xMidYMid meet"
              onMouseLeave={() => setHoveredScatter(null)}
            >
              {(() => {
                const maxY = scatterPeriod === '1Y' ? 30 : scatterPeriod === '3Y' ? 20 : 15;
                const yTicks = scatterPeriod === '1Y' ? [0, 5, 10, 15, 20, 25, 30] : scatterPeriod === '3Y' ? [0, 5, 10, 15, 20] : [0, 5, 10, 15];
                const maxX = 16;
                const xTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16];
                
                return (
                  <>
                    {/* Y Grid */}
                    {yTicks.map((v) => {
                      const yPos = 30 + 240 - (v / maxY) * 240;
                      return (
                        <g key={v}>
                          <line
                            x1={60}
                            y1={yPos}
                            x2={60 + 800}
                            y2={yPos}
                            className={v === 0 ? "stroke-slate-600 dark:stroke-zinc-500" : "stroke-zinc-200 dark:stroke-zinc-800"}
                            strokeWidth={v === 0 ? 1.5 : 1}
                          />
                          <text
                            x={60 - 10}
                            y={yPos + 3.5}
                            className="fill-zinc-400 text-[10px] font-mono font-bold"
                            textAnchor="end"
                          >
                            {v}%
                          </text>
                        </g>
                      );
                    })}
                    <text
                      transform={"translate(14, 150) rotate(-90)"}
                      className="fill-zinc-400 text-[9px] font-bold tracking-widest uppercase"
                      textAnchor="middle"
                    >
                      {scatterPeriod === '1Y' ? 'RETORNO A 1 AÑO (%)' : scatterPeriod === '3Y' ? 'RETORNO ANUALIZADO A 3 AÑOS (%)' : 'RETORNO ANUALIZADO A 5 AÑOS (%)'}
                    </text>
                    
                    {/* X Grid */}
                    {xTicks.map((v) => {
                      const xPos = 60 + (v / maxX) * 800;
                      return (
                        <g key={v}>
                          <line
                            x1={xPos}
                            y1={30}
                            x2={xPos}
                            y2={30 + 240}
                            stroke={v === 0 ? '#475569' : '#F1F5F9'}
                            strokeWidth={1}
                          />
                          <text
                            x={xPos}
                            y={30 + 240 + 20}
                            className="fill-zinc-400 text-[10px] font-mono font-bold"
                            textAnchor="middle"
                          >
                            {v}%
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={60 + 800 / 2}
                      y={30 + 240 + 40}
                      className="fill-zinc-400 text-[9px] font-bold tracking-widest uppercase"
                      textAnchor="middle"
                    >
                      VOLATILIDAD ANUALIZADA (%)
                    </text>

                    {/* Draw benchmarks */}
                    {profileKpis.map((kpi, idx) => {
                      if (!visibleProfiles[idx]) return null;
                      const p = kpi.name;
                      let benchRet = 0; let benchVol = 0;
                      if (BENCHMARK_DATA[p]) {
                        benchRet = BENCHMARK_DATA[p][scatterPeriod as '1Y'|'3Y'|'5Y'] ?? 0;
                        benchVol = BENCHMARK_DATA[p][scatterPeriod === '1Y' ? 'vol1Y' : scatterPeriod === '3Y' ? 'vol3Y' : 'vol5Y'];
                      }
                      
                      const bx = 60 + (benchVol / maxX) * 800;
                      const by = 30 + 240 - (benchRet / maxY) * 240;
                      
                      return (
                        <g key={`bench-${idx}`} className="cursor-pointer"
                           onMouseEnter={() => handleMouseEnterScatter({
                              x: bx, y: by, 
                              title: `BMK ${kpi.name}`, 
                              stats: `Retorno: +${benchRet.toFixed(1).replace(".", ",")}%`, vol: `Vol: ${benchVol.toFixed(1).replace(".", ",")}%`, 
                              color: PROFILE_COLORS[idx],
                              isBench: true
                           })} onMouseLeave={handleMouseLeaveScatter}
                        >
                          <rect
                            x={bx - 4} y={by - 4} width={8} height={8}
                            fill={PROFILE_COLORS[idx]}
                            className="transition-transform hover:scale-125 shadow-sm"
                            style={{ transformOrigin: `${bx}px ${by}px` }}
                          />
                          <circle cx={bx} cy={by} r={6} fill="transparent" />
                        </g>
                      );
                    })}

                    {/* Draw portfolios */}
                    {profileKpis.map((kpi, idx) => {
                      if (!visibleProfiles[idx]) return null;
                      // the return for portfolios based on scatterPeriod:
                      const scatterLabel = scatterPeriod === '3Y' ? '3 años' : scatterPeriod === '5Y' ? '5 años' : '1 año';
                      const portRet = windowRow(scatterLabel)[idx] ?? 0;
                      const portVol = PORTFOLIO_VOL_DATA[kpi.name][scatterPeriod as '1Y'|'3Y'|'5Y'] ?? kpi.volatility;
                      const cx = 60 + (portVol / maxX) * 800;
                      const cy = 30 + 240 - (portRet / maxY) * 240;
                      
                      return (
                        <g key={`port-${idx}`} className="cursor-pointer"
                          onMouseEnter={() => handleMouseEnterScatter({
                              x: cx, y: cy, 
                              title: kpi.name, 
                              stats: `Retorno: +${portRet.toFixed(1).replace(".", ",")}%`, vol: `Vol: ${portVol.toFixed(1).replace(".", ",")}%`,
                              color: PROFILE_COLORS[idx],
                              isBench: false
                          })} onMouseLeave={handleMouseLeaveScatter}
                        >
                          <circle
                            cx={cx} cy={cy} r={8}
                            fill={PROFILE_COLORS[idx]}
                            className="transition-transform hover:scale-125 shadow-md stroke-2 stroke-white"
                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                          />
                          <circle cx={cx} cy={cy} r={10} fill="transparent" />
                        </g>
                      );
                    })}

                    {/* Tooltip Scatter */}
                    {hoveredScatter && (() => {
                      const isHigh = hoveredScatter.y < 50;
                      const yOffset = isHigh ? 10 : -48;
                      const tY = hoveredScatter.y + yOffset;
                      
                      const pnts = isHigh 
                        ? `${hoveredScatter.x-5},${hoveredScatter.y+10} ${hoveredScatter.x+5},${hoveredScatter.y+10} ${hoveredScatter.x},${hoveredScatter.y+4}`
                        : `${hoveredScatter.x-5},${hoveredScatter.y-10} ${hoveredScatter.x+5},${hoveredScatter.y-10} ${hoveredScatter.x},${hoveredScatter.y-4}`;
                        
                      return (
                      <g 
                        onMouseEnter={() => { if (hideTimeout.current) clearTimeout(hideTimeout.current); }}
                        onMouseLeave={handleMouseLeaveScatter}
                        style={{ cursor: 'default' }}
                      >
                        <defs>
                          <filter id="shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                          </filter>
                        </defs>
                        <rect 
                           x={hoveredScatter.x - 105} 
                           y={tY} 
                           width={210} 
                           height={38} 
                           rx={6} 
                           fill="white" 
                           className="stroke-zinc-200 dark:stroke-zinc-800"
                           filter="url(#shadow)"
                        />
                        <circle 
                           cx={hoveredScatter.x - 95} 
                           cy={tY + 11} 
                           r={3} 
                           fill={hoveredScatter.color} 
                         />
                        <text
                          x={hoveredScatter.x - 87}
                          y={tY + 13.5}
                          className="fill-zinc-900 text-[10px] font-extrabold uppercase tracking-tight"
                          textAnchor="start"
                        >
                          {hoveredScatter.title}
                        </text>
                        <text
                          x={hoveredScatter.x}
                          y={tY + 26}
                          className="fill-zinc-500 text-[9.5px] font-mono font-bold"
                          textAnchor="middle"
                        >
                          {hoveredScatter.stats} | {hoveredScatter.vol}
                        </text>
                        <polygon 
                           points={pnts}
                           fill="white" 
                         />
                      </g>
                    );})()}
                  </>
                );
              })()}
            </svg>
          </div>
          
          <details className="group mt-4 text-xs">
            <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-1.5 select-none opacity-80 hover:opacity-100 p-2 rounded hover:bg-zinc-50 dark:bg-zinc-800/50 w-fit">
              <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              Ver composición de los benchmarks de referencia
            </summary>
            <div className="bg-zinc-50 dark:bg-zinc-800/50/50 border border-zinc-100 rounded-lg overflow-hidden mt-2 ml-2 shadow-sm">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] text-zinc-600 dark:text-zinc-400">
                    <thead>
                        <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[9px] border-b border-zinc-200 dark:border-zinc-700">
                            <th className="py-2 px-4">Perfil</th>
                            <th className="py-2 px-4" colSpan={2}>Fondo / Índice de Referencia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {profileKpis.map((kpi, idx) => {
                            const p = kpi.name;
                            let bmkName = '';
                            if (BENCHMARK_DATA[p]) {
                              bmkName = BENCHMARK_DATA[p].bmk;
                            }
                            return (
                                <tr key={`bench-row-${idx}`} className="hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors">
                                    <td className="py-2.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PROFILE_COLORS[idx] }}></div>
                                        BMK {kpi.name}
                                    </td>
                                    <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]" colSpan={2}>{bmkName}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50/50 p-3 text-[10px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-100">
                <p><strong>Nota:</strong> Los benchmarks se construyen utilizando índices estándar del mercado para replicar la distribución de activos objetivo de cada perfil, sin considerar comisiones de gestión ni costes transaccionales.</p>
            </div>
            </div>
          </details>
        </div>
        </>
        )}
      </div>
        <div className="mt-4 text-[9px] font-medium text-zinc-400 text-left border-t border-zinc-100 pt-3">
          * Retornos históricos de clientes reales, netos de cualquier comisión aplicable (gestión, custodia, etc).
        </div>
    </section>
  );
};
