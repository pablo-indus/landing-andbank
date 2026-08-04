import React, { useState, useMemo } from 'react';
import { HISTORICAL_CHANGES } from '../data/portfolioData';

export const SectionCambios: React.FC<{ isPrintMode?: boolean }> = ({ isPrintMode }) => {
  const [activePeriodIdx, setActivePeriodIdx] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    const results: typeof HISTORICAL_CHANGES = [];
    HISTORICAL_CHANGES.forEach(blk => {
      const hits = blk.batches.filter(b => {
        const txt = (b.rationale + ' ' + b.entries.concat(b.exits).map(m => m.instrument + ' ' + m.tag + ' ' + m.meta).join(' ')).toLowerCase();
        return txt.includes(q);
      });
      if (hits.length > 0) {
        results.push({ ...blk, batches: hits });
      }
    });
    return results;
  }, [searchQuery]);

  const currentBlock = HISTORICAL_CHANGES[activePeriodIdx] || HISTORICAL_CHANGES[0];

  const handlePrev = () => {
    if (activePeriodIdx < HISTORICAL_CHANGES.length - 1) setActivePeriodIdx(activePeriodIdx + 1);
  };
  const handleNext = () => {
    if (activePeriodIdx > 0) setActivePeriodIdx(activePeriodIdx - 1);
  };

  const renderBatch = (batch: any, batchIdx: number) => {
    const hasOut = batch.exits.length > 0;
    const hasIn = batch.entries.length > 0;

    const getTypeStyles = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('compra')) return 'bg-emerald-100 text-emerald-800';
      if (t.includes('venta')) return 'bg-red-100 text-red-800';
      if (t.includes('aumento')) return 'bg-blue-100 text-blue-800';
      if (t.includes('reducci')) return 'bg-orange-100 text-orange-800';
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200';
    };

    const MvItem = ({ m, kind }: { m: any, kind: 'exit' | 'entry', key?: number|string }) => {
      return (
        <div className="flex items-center gap-2 text-[10.5px] min-w-0 flex-wrap mb-1.5">
          <span className={`text-[7.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${getTypeStyles(m.type)}`}>{m.type}</span>
          <b className="font-bold text-zinc-900 dark:text-zinc-100">{m.instrument}</b>
          {m.tag && <span className="text-[9px] text-zinc-500 dark:text-zinc-400">{m.tag}</span>}
          {m.meta && <span className="text-[9px] text-zinc-500 dark:text-zinc-400 ml-auto flex-shrink-0">· {m.meta}</span>}
        </div>
      );
    };

    return (
      <div key={batchIdx} className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm flex flex-col mb-4 break-inside-avoid">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_40px_1fr] items-stretch">
          
          <div className={`p-3 min-w-0 ${hasOut ? 'bg-[#FDF8F7]' : ''}`}>
            <h5 className={`text-[8px] font-bold tracking-wider uppercase mb-2 flex items-center gap-1.5 ${hasOut ? 'text-red-800' : 'text-zinc-400'}`}>Salidas · reducciones</h5>
            <div className="flex flex-col">
              {batch.exits.map((m: any, i: number) => <MvItem key={i} m={m} kind="exit" />)}
            </div>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-r from-[#FDF8F7] to-[#FAF9F7] text-zinc-400 text-lg border-y md:border-y-0 md:border-x border-dashed border-zinc-200 dark:border-zinc-700 py-1 md:py-0">
            <span className="transform md:rotate-0 rotate-90 scale-75 md:scale-100">→</span>
          </div>
          
          <div className={`p-3 min-w-0 ${hasIn ? 'bg-[#FAF9F7]' : ''}`}>
            <h5 className="text-[8px] font-bold tracking-wider uppercase mb-2 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">Entradas · aumentos</h5>
            <div className="flex flex-col">
              {batch.entries.map((m: any, i: number) => <MvItem key={i} m={m} kind="entry" />)}
            </div>
          </div>
          
        </div>
        {batch.rationale && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 p-3 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900">
            <span className="block text-[7.5px] font-bold tracking-widest uppercase text-zinc-400 mb-1">Racional</span>
            {batch.rationale}
          </div>
        )}
      </div>
    );
  };

  return (
    <section id="cambios" className={isPrintMode ? "" : "pt-10 scroll-mt-20"}>
      {!isPrintMode && (
        <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-zinc-900 pb-3 mb-6 gap-4">
          <div className="flex items-start gap-4">
            <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
              06
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Historial de Cambios
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                Movimientos realizados en las carteras modelo y racional de inversión de cada decisión.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 justify-start md:justify-end max-w-md pt-1">
             {[
               { label: 'Compra', colorClass: 'bg-emerald-100 text-emerald-800' },
               { label: 'Venta', colorClass: 'bg-red-100 text-red-800' },
               { label: 'Aumento', colorClass: 'bg-blue-100 text-blue-800' },
               { label: 'Reducción', colorClass: 'bg-orange-100 text-orange-800' },
             ].map((leg) => (
                <div key={leg.label} className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <span className={`px-1.5 py-0.5 rounded text-[7.5px] ${leg.colorClass}`}>{leg.label}</span>
                </div>
             ))}
          </div>
        </div>
      )}
      
      <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg ${isPrintMode ? "p-2" : "p-5 shadow-sm"}`}>        
        {!isPrintMode && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
              <button 
                onClick={handlePrev} 
                disabled={activePeriodIdx >= HISTORICAL_CHANGES.length - 1 || !!searchQuery}
                className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-800/50 disabled:opacity-30 border-r border-zinc-200 dark:border-zinc-700 font-bold"
              >‹</button>
              <button 
                onClick={handleNext} 
                disabled={activePeriodIdx <= 0 || !!searchQuery}
                className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-800/50 disabled:opacity-30 font-bold"
              >›</button>
            </div>
            <select 
              className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 min-w-[160px]"
              value={activePeriodIdx}
              onChange={(e) => setActivePeriodIdx(parseInt(e.target.value))}
              disabled={!!searchQuery}
            >
              {HISTORICAL_CHANGES.map((blk, i) => (
                <option key={i} value={i}>{blk.period}</option>
              ))}
            </select>
            <input 
              type="text" 
              placeholder="Buscar fondo, clase de activo o racional..." 
              className="flex-1 min-w-[200px] border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-[11px] text-zinc-800 dark:text-zinc-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className={isPrintMode ? "" : "max-h-[600px] overflow-y-auto pr-1"}>
          {filteredData ? (
            filteredData.length > 0 ? (
              filteredData.map((blk, i) => (
                <div key={i} className="mb-6 break-inside-avoid">
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded px-3 py-2 sticky top-0 z-10 mb-3">
                    <span className="w-2.5 h-2 rounded-sm bg-zinc-400"></span>
                    {blk.period}
                    <span className="ml-auto text-[8.5px] text-zinc-500 dark:text-zinc-400 font-bold">{blk.batches.length} decisión(es)</span>
                  </div>
                  {blk.batches.map((batch, bIdx) => renderBatch(batch, bIdx))}
                </div>
              ))
            ) : (
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 p-4 italic">Sin resultados para «{searchQuery}».</div>
            )
          ) : (
            currentBlock.batches.map((batch, bIdx) => renderBatch(batch, bIdx))
          )}
        </div>
      </div>
    </section>
  );
};
