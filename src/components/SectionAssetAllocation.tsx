import React, { useState } from 'react';
import { ASSET_ALLOCATION_SNAPSHOTS, PROFILES, PROFILE_COLORS } from '../data/portfolioData';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ScrollableTabs } from './ScrollableTabs';

export const SectionAssetAllocation: React.FC<{ forcedActiveIndices?: number[]; isPrintMode?: boolean }> = ({ forcedActiveIndices, isPrintMode }) => {
  const getColorForLabel = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('monetario')) return '#121212';
    if (l.includes('fija')) return '#E0E0E0';
    if (l.includes('variable')) return '#EF5350';
    if (l.includes('commodities') || l.includes('oro')) return '#D4C77E';
    if (l.includes('alternativos')) return '#800020';
    return '#9CA3AF';
};
  const [activePeriod, setActivePeriod] = useState<string>(
    ASSET_ALLOCATION_SNAPSHOTS[0].period
  );

  const snapshot =
    ASSET_ALLOCATION_SNAPSHOTS.find((s) => s.period === activePeriod) ||
    ASSET_ALLOCATION_SNAPSHOTS[0];


  const activeProfileIndices = forcedActiveIndices !== undefined && forcedActiveIndices.length > 0 
    ? forcedActiveIndices 
    : PROFILES.map((_, i) => i).filter(pIdx => {
        return snapshot.rows.some(row => row.isPct !== null && row.values[pIdx] !== null && row.values[pIdx] !== undefined && row.values[pIdx] !== 0);
      });
  return (
    <section id="aa-global" className={isPrintMode ? "" : "pt-10 scroll-mt-20"}>
      {!isPrintMode && (
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          08
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Asset Allocation · Resumen Global
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Distribución por clase de activo, geografía de Renta Variable, exposición a divisas y métricas de Renta Fija
          </p>
        </div>
      </div>
      )}

      <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg ${isPrintMode ? "p-2 space-y-2" : "p-5 shadow-sm space-y-5"}`}>
        {/* Time Snapshot Tabs */}
        {!isPrintMode && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-100">
          {ASSET_ALLOCATION_SNAPSHOTS.map((snap) => {
            const isActive = snap.period === activePeriod;
            return (
              <button
                key={snap.period}
                onClick={() => setActivePeriod(snap.period)}
                className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {snap.label}
              </button>
            );
          })}
        </div>
        )}

        
        {/* Pie Charts */}
        <div className="pt-4 border-t border-zinc-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-4">Distribución de Activos por Perfil</h3>
          <div className={`break-inside-avoid grid gap-4 ${isPrintMode ? (activeProfileIndices.length <= 2 ? "grid-cols-2" : activeProfileIndices.length === 3 ? "grid-cols-3" : activeProfileIndices.length === 4 ? "grid-cols-2" : "grid-cols-3") : "grid-cols-2 md:grid-cols-3 lg:grid-cols-3"}`}>
            {activeProfileIndices.map((pIdx) => {
              const p = PROFILES[pIdx];
              let mainRows = [];
              let insideMain = false;
              for (const r of snapshot.rows) {
                  if (r.isPct === null) {
                      if (r.label.toLowerCase().includes('distribución de activos')) {
                          insideMain = true;
                      } else {
                          insideMain = false;
                      }
                  } else if (insideMain) {
                      mainRows.push(r);
                  }
              }

              const data = mainRows.map((row, idx) => ({
                  name: row.label,
                  value: typeof row.values[pIdx] === 'number' ? row.values[pIdx] : parseFloat(row.values[pIdx]) || 0,
                  originalIndex: idx
              })).filter(d => d.value > 0);

              if (data.length === 0) return null;

              

              return (
                <div key={p} className="flex flex-col items-center bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 rounded-lg p-3">
                  <h4 className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-center h-8 flex items-center justify-center">
                      {p}
                  </h4>
                  <div className={`w-full flex justify-center items-center ${isPrintMode ? "h-40" : "h-52"}`}>
                      {isPrintMode ? (
                          <PieChart width={160} height={160}>
                              <Pie
                                  data={data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={30}
                                  outerRadius={75}
                                  paddingAngle={2}
                                  dataKey="value" isAnimationActive={false}
                                  stroke="none"
                              >
                                  {data.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={getColorForLabel(entry.name)} />
                                  ))}
                              </Pie>
                          </PieChart>
                      ) : (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={data}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={30}
                                      outerRadius={85}
                                      paddingAngle={2}
                                      dataKey="value" isAnimationActive={true}
                                      stroke="none"
                                  >
                                      {data.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={getColorForLabel(entry.name)} />
                                      ))}
                                  </Pie>
                                  <Tooltip 
                                      formatter={(val) => `${Number(val).toFixed(1).replace('.', ',')}%`}
                                      contentStyle={{ fontSize: '10px', borderRadius: '4px', padding: '4px 8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                      itemStyle={{ padding: 0 }}
                                  />
                              </PieChart>
                          </ResponsiveContainer>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
            {(() => {
                let mainRows = [];
                let insideMain = false;
                for (const r of snapshot.rows) {
                    if (r.isPct === null) {
                        if (r.label.toLowerCase().includes('distribución de activos')) {
                            insideMain = true;
                        } else {
                            insideMain = false;
                        }
                    } else if (insideMain) {
                        mainRows.push(r);
                    }
                }
                
                return mainRows.map((row, idx) => (
                  <div key={row.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: getColorForLabel(row.label) }}></span>
                    <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">{row.label}</span>
                  </div>
                ));
            })()}
          </div>
        </div>

        
        {/* Global AA Table */}
        <div className={isPrintMode ? "" : "overflow-x-auto"}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-900 dark:bg-zinc-800 text-white border-b-2 border-red-600 text-[10px] font-bold uppercase tracking-wider">
                <th className={`px-3 ${isPrintMode ? "py-1" : "py-3"}`}>Categoría / Métrico</th>
                {activeProfileIndices.map((pIdx) => (
                  <th key={PROFILES[pIdx]} className={`px-3 text-right ${isPrintMode ? "py-1" : "py-3"}`}>
                    {PROFILES[pIdx]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(() => {
                const visibleRows = [];
                let currentHeaderIdx = -1;
                
                snapshot.rows.forEach((row, idx) => {
                  if (row.isPct === null) {
                    // It's a header
                    currentHeaderIdx = visibleRows.length;
                    visibleRows.push({ ...row, originalIdx: idx, keep: false });
                  } else {
                    // It's a data row, check if it has any non-zero, non-null value
                    const hasValue = row.values.some(v => v !== null && v !== undefined && v !== 0 && v !== '0.0' && v !== '0,0');
                    if (hasValue) {
                      visibleRows.push({ ...row, originalIdx: idx, keep: true });
                      // Mark header to keep
                      if (currentHeaderIdx !== -1) {
                        visibleRows[currentHeaderIdx].keep = true;
                      }
                    }
                  }
                });
                
                return visibleRows.filter(r => r.keep).map((row) => {
                  if (row.isPct === null) {
                    return (
                      <tr
                        key={row.originalIdx}
                        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase tracking-wider text-[10px] border-y border-zinc-200 dark:border-zinc-700"
                      >
                        <td colSpan={activeProfileIndices.length + 1} className={`px-3 ${isPrintMode ? "py-0.5 text-[9px]" : "py-2"}`}>
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.originalIdx} className="hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors break-inside-avoid">
                      <td className={`px-3 font-medium text-zinc-800 dark:text-zinc-200 ${isPrintMode ? "py-0.5 text-[9px]" : "py-2"}`}>
                        {row.label}
                      </td>
                      {activeProfileIndices.map((pIdx) => {
                        const v = row.values[pIdx];
                        return (
                        <td
                          key={pIdx}
                          className={`px-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300 ${isPrintMode ? "py-0.5 text-[9px]" : "py-2"}`}
                        >
                          {v === null || v === undefined || v === 0 ? (
                            <span className="text-zinc-300">—</span>
                          ) : row.isPct ? (
                            typeof v === 'number' ? (
                              `${v.toFixed(1).replace('.', ',')}%`
                            ) : (
                              `${v}%`
                            )
                          ) : (
                            v
                          )}
                        </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
