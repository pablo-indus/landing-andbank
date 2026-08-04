import React, { useState } from 'react';
import { COMPOSITION_SNAPSHOTS, PROFILES } from '../data/portfolioData';
import { ScrollableTabs } from './ScrollableTabs';

export const SectionComposicion: React.FC<{ forcedActiveIndices?: number[]; isPrintMode?: boolean }> = ({ forcedActiveIndices, isPrintMode }) => {
  const [profileIdxState, setProfileIdx] = useState<number>(2);
  const [activePeriod, setActivePeriod] = useState<string>(COMPOSITION_SNAPSHOTS[0].period);
    React.useEffect(() => {
    const handleApply = (e: any) => setProfileIdx(e.detail);
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const snapshot =
    COMPOSITION_SNAPSHOTS.find((s) => s.period === activePeriod) || COMPOSITION_SNAPSHOTS[0];

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const activeProfileIndices = PROFILES.map((_, i) => i).filter(pIdx => {
    if (forcedActiveIndices !== undefined) return forcedActiveIndices.includes(pIdx);
    return snapshot.categories.some(catGroup => catGroup.totals[pIdx] > 0);
  });

  return (
    <section id="composicion" className={isPrintMode ? "" : "pt-10 scroll-mt-20"}>
      {!isPrintMode && (
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          07
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Composición de la Cartera
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Peso de cada fondo por categoría y por perfil en cada fecha histórico-táctica · haz clic en una sección para plegarla/desplegarla
          </p>
        </div>
      </div>
      )}

      <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg ${isPrintMode ? "p-2 space-y-2" : "p-5 shadow-sm space-y-5"}`}>
        {/* Time Snapshot Tabs */}
        {!isPrintMode && (
          <div className="border-b border-zinc-100 pb-2">
            <ScrollableTabs 
              tabs={COMPOSITION_SNAPSHOTS.map(s => ({ id: s.period, label: s.label }))} 
              activeTab={activePeriod} 
              onTabChange={(id) => setActivePeriod(id)}
              baseClass="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer"
              activeClass="bg-red-700 text-white shadow-xs"
              inactiveClass="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}
        {/* Composition Table */}
        <div className={isPrintMode ? "" : "overflow-x-auto"}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-900 text-white border-b-2 border-red-600 text-[10px] font-bold uppercase tracking-wider">
                <th className={`px-3 ${isPrintMode ? "py-0.5 text-[8px]" : "py-3"}`}>Categoría / Fondo</th>
                <th className={`px-3 ${isPrintMode ? "py-0.5 text-[8px]" : "py-3"}`}>ISIN</th>
                {activeProfileIndices.map((pIdx) => (
                  <th key={PROFILES[pIdx]} className={`px-3 text-right ${isPrintMode ? "py-0.5 text-[8px]" : "py-3"}`}>
                    {PROFILES[pIdx]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {snapshot.categories.map((catGroup) => {
                const isCollapsed = !!collapsedCategories[catGroup.cat];
                const visibleItems = catGroup.items.filter(item => activeProfileIndices.some(pIdx => item.values[pIdx] !== null && item.values[pIdx] !== undefined && item.values[pIdx] !== 0));
                
                if (visibleItems.length === 0) return null;
                
                return (
                  <React.Fragment key={catGroup.cat}>
                    {/* Category Row */}
                    <tr onClick={() => toggleCategory(catGroup.cat)} className={`break-inside-avoid bg-zinc-700 text-white font-bold cursor-pointer hover:bg-zinc-800 transition-colors uppercase tracking-wider ${isPrintMode ? "text-[9px]" : "text-[10.5px]"}`}
                    >
                      <td className={`px-3 flex items-center gap-2 ${isPrintMode ? "py-0.5 text-[9px]" : "py-2.5"}`}>
                        <span className="text-zinc-300 text-xs">
                          {isCollapsed ? '▸' : '▾'}
                        </span>
                        {catGroup.cat}
                      </td>
                      <td className={`px-3 text-zinc-400 font-mono ${isPrintMode ? "py-0.5 text-[8px]" : "py-2.5 text-[10px]"}`}>
                        Categoría
                      </td>
                      {activeProfileIndices.map((pIdx) => {
                        const tot = catGroup.totals[pIdx];
                        return (
                          <td key={pIdx} className={`px-3 text-right font-mono tabular-nums ${isPrintMode ? "py-0.5 text-[9px]" : "py-2.5"}`}>
                            {tot > 0 ? `${tot.toFixed(2).replace('.', ',')}%` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Fund Item Rows */}
                    {!isCollapsed &&
                      visibleItems.map((item) => (
                        <tr key={item.isin || item.name} className="break-inside-avoid hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors bg-white dark:bg-zinc-900"
                        >
                          <td className={`px-3 pl-7 font-medium text-zinc-800 dark:text-zinc-200 ${isPrintMode ? "py-0.5 text-[9px]" : "py-2"}`}>
                            {item.name}
                          </td>
                          <td className={`px-3 font-mono text-zinc-400 ${isPrintMode ? "py-0.5 text-[8px]" : "py-2 text-[10px]"}`}>
                            {item.isin}
                          </td>
                          {activeProfileIndices.map((pIdx) => {
                            const v = item.values[pIdx];
                            return (
                              <td
                                key={pIdx}
                                className={`px-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300 ${isPrintMode ? "py-0.5 text-[9px]" : "py-2"}`}
                              >
                                {v !== null && v !== undefined && v !== 0
                                  ? `${v.toFixed(2).replace('.', ',')}%`
                                  : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
