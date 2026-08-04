import React from 'react';
import { PROFILE_KPIS } from '../data/portfolioData';

export const KpiStrip: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {PROFILE_KPIS.map((kpi) => (
          <div
            key={kpi.name}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: kpi.color }}
            />
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-xs transform -rotate-12 inline-block shrink-0"
                style={{ backgroundColor: kpi.color }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 truncate">
                {kpi.name}
              </span>
            </div>

            <div className="space-y-1 mt-2">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium">YTD 2026</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums text-sm">
                  +{kpi.p2026YTD.toFixed(1).replace('.', ',')}%
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs pt-1 border-t border-zinc-100">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium">Junio</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-300 tabular-nums text-xs">
                  +{kpi.pJune.toFixed(1).replace('.', ',')}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
