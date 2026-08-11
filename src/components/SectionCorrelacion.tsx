import React, { useState, useEffect } from 'react';
import { PROFILES } from '../data/portfolioData';
import { FUND_CORR } from '../data/corrData';

export const SectionCorrelacion: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<string>("Moderado");

  useEffect(() => {
    const handleApply = (e: any) => {
      setActiveProfile(PROFILES[e.detail]);
    };
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);
  const data = FUND_CORR[activeProfile as keyof typeof FUND_CORR];

  const getColorStyle = (val: number) => {
    // val goes from -1 to 1
    // Yellow: rgb(250, 204, 21) -> -1
    // Red: rgb(220, 38, 38) -> 1
    const normalized = (val + 1) / 2; // 0 to 1
    const r = Math.round(250 + (220 - 250) * normalized);
    const g = Math.round(204 + (38 - 204) * normalized);
    const b = Math.round(21 + (38 - 21) * normalized);
    return { 
      backgroundColor: `rgb(${r}, ${g}, ${b})`,
      color: val > 0.5 ? '#fff' : '#451a03'
    };
  };

  return (
    <section id="correlacion" className="pt-10 scroll-mt-28">
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          05
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Matriz de Correlación
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Correlación entre los fondos de la cartera seleccionada (1 año)
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm space-y-6">
        {/* Profile Toggles */}
        <div className="flex flex-wrap gap-2 pb-2 border-b border-zinc-100">
          {Object.keys(FUND_CORR).map((pName) => {
            const isActive = activeProfile === pName;
            return (
              <button
                key={pName}
                onClick={() => setActiveProfile(pName)}
                className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {pName}
              </button>
            );
          })}
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          {data ? (
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700"></th>
                  {data.labels.map((l: string, i: number) => (
                    <th key={i} className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium max-w-[80px] truncate" title={l}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row: number[], i: number) => (
                  <tr key={i}>
                    <td className="p-2 border-r border-zinc-100 font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-xs max-w-[200px] truncate" title={data.labels[i]}>
                      {i + 1}. {data.labels[i]}
                    </td>
                    {row.map((val: number, j: number) => (
                      <td key={j} className="p-0.5 border border-zinc-50">
                        {j <= i ? (
                          <div 
                            className="w-full h-full min-h-[28px] flex items-center justify-center font-mono font-bold rounded-sm"
                            style={getColorStyle(val)}
                            title={`${data.labels[i]} / ${data.labels[j]}`}
                          >
                            {i === j ? '—' : val.toFixed(2)}
                          </div>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">Datos no disponibles para este perfil.</div>
          )}
        </div>
      </div>
    </section>
  );
};
