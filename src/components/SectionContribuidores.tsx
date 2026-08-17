import React, { useState, useEffect } from 'react';
import { MONTHLY_ATTRIBUTIONS, PROFILES } from '../data/portfolioData';
import { useMonthlyReports } from '../hooks/useMonthlyReports';
import { findYtdSource } from '../utils/attributionYtd';

export const SectionContribuidores: React.FC<{ forcedProfileIdx?: number; forcedActiveIndices?: number[]; isPrintMode?: boolean }> = ({ forcedProfileIdx = 2, forcedActiveIndices, isPrintMode }) => {
  const { attributions } = useMonthlyReports();

  // Los datos estaticos siguen como respaldo hasta que la base de datos tenga
  // suficientes meses cargados; asi la seccion nunca queda en blanco.
  const blocks = React.useMemo(() => {
    if (attributions.length === 0) return MONTHLY_ATTRIBUTIONS as any[];

    // El acumulado del año viene dentro de cada bloque mensual, no como periodo
    // propio (acumula desde enero, asi que archivarlo como un mes lo falsearia).
    // Se expone como una pestaña mas, con los valores del mes mas reciente que
    // lo traiga: si el ultimo Excel subido no incluyera el bloque YTD, no tiene
    // sentido dejar la pestaña en blanco en vez de mostrar el ultimo disponible.
    const ytdSource = findYtdSource(attributions);
    const ytdTab = ytdSource
      ? [{ month: `ytd`, label: `Acumulado ${ytdSource.label.split(' ').pop()}`, data: ytdSource.profiles }]
      : [];

    // El acumulado va primero -tambien como pestaña por defecto- y detras los
    // meses, del mas reciente al mas antiguo.
    return [...ytdTab, ...attributions];
  }, [attributions]);

  const [profileIdx, setProfileIdx] = useState<number>(forcedProfileIdx);
  const [activeMonthKey, setActiveMonthKey] = useState<string>('');

  useEffect(() => {
    const handleApply = (e: any) => {
      setProfileIdx(e.detail);
    };
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);

  // Al llegar (o cambiar) los datos, se selecciona el mes mas reciente.
  useEffect(() => {
    if (blocks.length > 0) {
      setActiveMonthKey((prev) =>
        prev && blocks.some((b: any) => b.month === prev) ? prev : blocks[0].month
      );
    }
  }, [blocks]);

  if (blocks.length === 0) return null;

  const activeAttributionBlock = blocks.find((a: any) => a.month === activeMonthKey) || blocks[0];

  const profileAttribution = activeAttributionBlock.data[profileIdx] || { contrib: [], detract: [] };
  const profilesToRender = forcedActiveIndices ? forcedActiveIndices : [profileIdx];

  return (
    <section id="contribuidores" className={isPrintMode ? "" : "pt-10 scroll-mt-28"}>
      {!isPrintMode && (
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          05
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Top 5 Contribuidores y Detractores
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Fondos que más han sumado o restado a la rentabilidad de cada perfil por mes o periodo
          </p>
        </div>
      </div>

      )}
      <div className={`bg-white dark:bg-zinc-900 ${isPrintMode ? "" : "border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm"} space-y-5`}>
        {/* Fixed Aligned Header Controls */}
        {!isPrintMode && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Perfil:
            </label>
            <select
              value={profileIdx}
              onChange={(e) => setProfileIdx(Number(e.target.value))}
              className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-800"
            >
              {PROFILES.map((p, i) => (
                <option key={p} value={i}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Time Horizon / Monthly Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {blocks.map((attr: any) => {
              const isActive = attr.month === activeMonthKey;
              return (
                <button
                  key={attr.month}
                  onClick={() => setActiveMonthKey(attr.month)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700 hover:text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {attr.label}
                </button>
              );
            })}
          </div>
        </div>

        )}
        {/* Tables Grid: Contribuidores vs Detractores */}
        {/* Tables Grid: Contribuidores vs Detractores */}
        <div className="flex flex-col gap-6">
        {profilesToRender.map(pIdx => {
            const pAttr = activeAttributionBlock.data[pIdx] || { contrib: [], detract: [] };
            return (
              <div key={pIdx} className="break-inside-avoid w-full">
              {isPrintMode && profilesToRender.length > 1 && (
                  <div className="col-span-full border-b border-zinc-200 dark:border-zinc-700 mt-2 mb-1 pb-1">
                      <h3 className="text-[11px] font-extrabold uppercase text-zinc-800 dark:text-zinc-200">{PROFILES[pIdx]}</h3>
                  </div>
              )}
          <div className={`grid gap-4 ${isPrintMode ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2"}`}>
          {/* Contribuidores */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden shadow-2xs">
            <div className={`bg-zinc-900 dark:bg-zinc-800 text-white border-b-2 border-red-600 ${isPrintMode ? "px-2 py-1.5" : "px-4 py-2.5"} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Top Contribuidores
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">
                {activeAttributionBlock.label}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ${isPrintMode ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700`}>
                    <th className={isPrintMode ? "py-1 px-2" : "py-2.5 px-3"}>Fondo</th>
                    <th className={`text-right ${isPrintMode ? "py-1 px-2" : "py-2.5 px-3"}`}>Retorno</th>
                    <th className={`text-right ${isPrintMode ? "py-1 px-2" : "py-2.5 px-3"}`}>Contribución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pAttr.contrib.length > 0 ? (
                    pAttr.contrib.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors">
                        <td className={`font-medium text-zinc-800 dark:text-zinc-200 ${isPrintMode ? "py-1 px-2 text-[9px]" : "py-2.5 px-3"}`}>
                          {item.f}
                        </td>
                        <td className={`text-right font-mono font-bold ${isPrintMode ? "py-1 px-2 text-[9px]" : "py-2.5 px-3"} ${item.r > 0 ? "text-emerald-600" : item.r < 0 ? "text-rose-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {item.r > 0 ? '+' : ''}{item.r.toFixed(2).replace('.', ',')}%
                        </td>
                        <td className={`text-right font-mono font-bold ${isPrintMode ? "py-1 px-2 text-[9px]" : "py-2.5 px-3"} ${item.c > 0 ? "text-emerald-600" : item.c < 0 ? "text-rose-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {item.c > 0 ? '+' : ''}{item.c.toFixed(2).replace('.', ',')}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-4 text-center text-zinc-400 italic text-xs"
                      >
                        Sin contribuidores destacados en este periodo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detractores */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden shadow-2xs">
            <div className={`bg-zinc-900 dark:bg-zinc-800 text-white border-b-2 border-red-600 ${isPrintMode ? "px-2 py-1.5" : "px-4 py-2.5"} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Top Detractores
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">
                {activeAttributionBlock.label}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ${isPrintMode ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700`}>
                    <th className={isPrintMode ? "py-1 px-2" : "py-2.5 px-3"}>Fondo</th>
                    <th className={`text-right ${isPrintMode ? "py-1 px-2" : "py-2.5 px-3"}`}>Retorno</th>
                    <th className={`text-right ${isPrintMode ? "py-1 px-2" : "py-2.5 px-3"}`}>Contribución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pAttr.detract.length > 0 ? (
                    pAttr.detract.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors">
                        <td className={`font-medium text-zinc-800 dark:text-zinc-200 ${isPrintMode ? "py-1 px-2 text-[9px]" : "py-2.5 px-3"}`}>
                          {item.f}
                        </td>
                        <td className={`text-right font-mono font-bold ${isPrintMode ? "py-1 px-2 text-[9px]" : "py-2.5 px-3"} ${item.r > 0 ? "text-emerald-600" : item.r < 0 ? "text-rose-600" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {item.r > 0 ? '+' : ''}{item.r.toFixed(2).replace('.', ',')}%
                        </td>
                        <td className={`text-right font-mono font-bold ${isPrintMode ? "py-1 px-2 text-[9px]" : "py-2.5 px-3"} ${item.c > 0 ? "text-emerald-600" : item.c < 0 ? "text-rose-600" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {item.c > 0 ? '+' : ''}{item.c.toFixed(2).replace('.', ',')}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-4 text-center text-zinc-400 italic text-xs"
                      >
                        Sin detractores reportados en este periodo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
                    </div>
          </div>
            );
        })}
        </div>
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
