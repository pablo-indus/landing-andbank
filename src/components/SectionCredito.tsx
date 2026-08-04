import React, { useState } from 'react';
import { CREDIT_LEVEL_SNAPSHOTS } from '../data/portfolioData';
import { ScrollableTabs } from './ScrollableTabs';


const categoryMap: Record<string, string> = {
  "PIMCO US SHORT TERM USD": "RF CORTO PLAZO",
  "GESCONSULT CORTO PLAZO I EUR*": "RF CORTO PLAZO",
  "MERCHBANC RF FLEXIBLE": "RENTA FIJA GLOBAL",
  "MUZINICH ENHANCEDYLD S-TERM EURH": "RENTA FIJA GLOBAL",
  "PARETO NORDIC CROSS CREDIT EURH": "RENTA FIJA GLOBAL",
  "DNCA ALPHA BONDS EUR": "RENTA FIJA GLOBAL",
  "SIH RENTA FIJA C FI": "RENTA FIJA GLOBAL",
  "SIH RENTA FIJA C": "RENTA FIJA GLOBAL",
  "MAN GLB INV GRADE OPP IH EUR": "RENTA FIJA GLOBAL",
  "ODDO BHF EURO CREDIT SHORT DURATION": "RENTA FIJA ALTO RENDIMIENTO",
  "CANDRIAM BONDS GLOBAL HY EURH": "RENTA FIJA ALTO RENDIMIENTO",
  "M&G EMERGING MARKETS BOND EUR": "RENTA FIJA EMERGENTE",
};

const categoryOrder = [
  "RF CORTO PLAZO",
  "RENTA FIJA GLOBAL",
  "RENTA FIJA ALTO RENDIMIENTO",
  "RENTA FIJA EMERGENTE",
  "OTROS"
];

export const SectionCredito: React.FC = () => {
  const [activePeriod, setActivePeriod] = useState<string>(
    CREDIT_LEVEL_SNAPSHOTS[0].period
  );

  const snapshot =
    CREDIT_LEVEL_SNAPSHOTS.find((s) => s.period === activePeriod) ||
    CREDIT_LEVEL_SNAPSHOTS[0];

  return (
    <section id="credito" className="pt-10 scroll-mt-20 mb-12">
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          09
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Niveles de Crédito Históricos
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Evolución de la calidad crediticia, Yield (YTW), Duración y perfil de riesgo de los fondos de Renta Fija
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm space-y-5">
        {/* Date Tabs */}
        <div className="border-b border-zinc-100 pb-2">
          <ScrollableTabs 
            tabs={CREDIT_LEVEL_SNAPSHOTS.map(s => ({ id: s.period, label: s.label }))} 
            activeTab={activePeriod} 
            onTabChange={(id) => setActivePeriod(id)}
            baseClass="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer"
            activeClass="bg-red-700 text-white shadow-xs"
            inactiveClass="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Credit Level Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-zinc-900 text-white border-b-2 border-red-600 text-[9px] font-bold uppercase tracking-wider">
                <th className="py-3 px-2 border-r border-dotted border-zinc-700">Fondo de Renta Fija</th>
                <th className="py-3 px-2 border-r border-dotted border-zinc-700">ISIN</th>
                <th className="py-3 px-2 text-right border-r border-dotted border-zinc-700">Duración</th>
                <th className="py-3 px-2 text-right border-r border-dotted border-zinc-700">Yield (YTW)</th>
                <th className="py-3 px-2 text-center">Rating</th>
                <th className="py-3 px-2 text-right border-l-2 border-dotted border-zinc-500">% IG</th>
                <th className="py-3 px-2 text-right">% HY</th>
                <th className="py-3 px-2 text-right border-r-2 border-dotted border-zinc-500">% NR/Otros</th>
                <th className="py-3 px-2 text-right">% Govies</th>
                <th className="py-3 px-2 text-right">% Crédito</th>
                <th className="py-3 px-2 text-right">% Cash</th>
                <th className="py-3 px-2 text-right border-r-2 border-dotted border-zinc-500">% Otros</th>
                <th className="py-3 px-2 text-right">Vola 3y</th>
              </tr>
            </thead>
            <tbody className="font-medium text-[11px] bg-white dark:bg-zinc-900 border-x-2 border-b-2 border-zinc-200 dark:border-zinc-700">
              {(() => {
                const validFunds = snapshot.funds.filter(fund => fund.ytw !== 0 || fund.duration !== 0 || fund.pctIG !== 0 || fund.pctHY !== 0 || (fund.rating && fund.rating !== '-'));
                
                const groupedFunds = validFunds.reduce((acc, fund) => {
                  const cat = categoryMap[fund.name] || "OTROS";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(fund);
                  return acc;
                }, {});

                const rows = [];

                categoryOrder.forEach(category => {
                  if (groupedFunds[category] && groupedFunds[category].length > 0) {
                    rows.push(
                      <tr key={`header-${category}`} className="bg-red-700">
                        <td colSpan={13} className="py-1 px-2 font-bold text-white text-[10px] tracking-widest uppercase">
                          {category}
                        </td>
                      </tr>
                    );
                    
                    groupedFunds[category].forEach(fund => {
                      const nrOtros = Math.max(0, 100 - (fund.pctIG || 0) - (fund.pctHY || 0));
                      rows.push(
                        <tr key={fund.isin || fund.name} className="hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors border-b border-zinc-100 last:border-0">
                          <td className="py-2 px-2 font-bold text-zinc-900 dark:text-zinc-100 border-r border-dotted border-zinc-300 dark:border-zinc-600">
                            {fund.name}
                          </td>
                          <td className="py-2 px-2 font-mono text-zinc-400 text-[9px] border-r border-dotted border-zinc-300 dark:border-zinc-600">
                            {fund.isin}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-800 dark:text-zinc-200 tabular-nums border-r border-dotted border-zinc-300 dark:border-zinc-600">
                            {fund.duration.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums border-r border-dotted border-zinc-300 dark:border-zinc-600">
                            {fund.ytw.toFixed(2).replace('.', ',')}%
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-red-700 bg-red-50/50">
                            {fund.rating}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-700 dark:text-zinc-300 font-bold tabular-nums border-l-2 border-dotted border-zinc-400">
                            {fund.pctIG.toFixed(1).replace('.', ',')}%
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-red-700 font-bold tabular-nums">
                            {fund.pctHY.toFixed(1).replace('.', ',')}%
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums border-r-2 border-dotted border-zinc-400">
                            {nrOtros.toFixed(1).replace('.', ',')}%
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                            {fund.govies !== undefined && fund.govies !== null ? fund.govies.toFixed(1).replace('.', ',') + '%' : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                            {fund.credito !== undefined && fund.credito !== null ? fund.credito.toFixed(1).replace('.', ',') + '%' : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                            {fund.cash !== undefined && fund.cash !== null ? fund.cash.toFixed(1).replace('.', ',') + '%' : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums border-r-2 border-dotted border-zinc-400">
                            {fund.otros !== undefined && fund.otros !== null ? fund.otros.toFixed(1).replace('.', ',') + '%' : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                            {fund.vola3y !== undefined && fund.vola3y !== null ? fund.vola3y.toFixed(2).replace('.', ',') + '%' : '—'}
                          </td>
                        </tr>
                      );
                    });
                  }
                });
                
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
