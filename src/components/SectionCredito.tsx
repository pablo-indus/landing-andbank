import React, { useState, useEffect } from 'react';
import { useMonthlyReports } from '../hooks/useMonthlyReports';
import { ScrollableTabs } from './ScrollableTabs';

// 1. Clasificación inteligente
const getCategory = (fundName: string): string => {
  const name = (fundName || '').toUpperCase();
  
  if (name.includes("ODDO BHF EURO CREDIT SHORT")) return "RENTA FIJA ALTO RENDIMIENTO";
  
  if (name.includes("SHORT TERM") || name.includes("CORTO PLAZO") || name.includes("SECURITE") || 
      name.includes("NATIXIS CREDIT EURO") || name.includes("AHORRO") || name.includes("GOVERNMENT SH DUR") || 
      name.includes("SHORT DUR") || name.includes("FLOT RATE") || name.includes("FLOATING") || name.includes("ULTRA SHORT")) {
    return "RF CORTO PLAZO";
  }

  if (name.includes("HIGH YIELD") || name.includes(" HY ") || name.includes("ROBECO HY") || 
      name.includes("CANDRIAM") || name.includes("M-G GLB FLTNG RTE HY") || name.includes("M&G FRN HY") || 
      name.includes("CREDIT OPPORTUNITIES") || name.includes("AXA WF US HIGH") || name.includes("SUB DEBT")) {
    return "RENTA FIJA ALTO RENDIMIENTO";
  }

  if (name.includes("EMERGING") || name.includes("EM BOND") || name.includes("ASIA HY") || 
      name.includes("DPAM BONDS EM") || name.includes("EURIZON") || name.includes("BNY MELLON EM")) {
    return "RENTA FIJA EMERGENTE";
  }

  return "RENTA FIJA GLOBAL";
};

const categoryOrder = ["RF CORTO PLAZO", "RENTA FIJA GLOBAL", "RENTA FIJA ALTO RENDIMIENTO", "RENTA FIJA EMERGENTE", "OTROS"];

const getValue = (obj: any, keys: string[]) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      return obj[k];
    }
  }
  return null;
};

export const SectionCredito: React.FC<{ isPrintMode?: boolean }> = ({ isPrintMode }) => {
  // Los snapshots llegan ya ordenados (mas reciente primero) desde la fuente unica.
  const { creditSnapshots: snapshots, loading, error } = useMonthlyReports();
  const [activePeriod, setActivePeriod] = useState<string>('');

  // Al cargar (o si cambian los datos), seleccionamos el periodo mas reciente.
  useEffect(() => {
    if (snapshots.length > 0) {
      setActivePeriod((prev) => prev || `${snapshots[0].period}_${snapshots[0].label}`);
    }
  }, [snapshots]);

  if (loading) return <section id="credito" className={isPrintMode ? "" : "pt-10 scroll-mt-20 mb-12"}><div className="flex items-center justify-center p-12 text-sm font-medium text-zinc-500 animate-pulse">Cargando métricas de crédito...</div></section>;
  if (error || snapshots.length === 0) return <section id="credito" className={isPrintMode ? "" : "pt-10 scroll-mt-20 mb-12"}><div className="flex items-center justify-center p-12 text-sm font-bold text-red-500 bg-red-50 rounded-lg">{error || "No hay datos disponibles."}</div></section>;

  const snapshot = snapshots.find((s) => (s.period + '_' + s.label) === activePeriod) || snapshots[0];
  const validFunds = snapshot.funds.filter((fund: any) => fund.ytw !== 0 || fund.duration !== 0 || fund.pctIG !== 0 || fund.pctHY !== 0 || (fund.rating && fund.rating !== '-'));

  // 4. AUTO-CORRECCIÓN DE DECIMALES (Aplica a todas las columnas)
  const allPcts = validFunds.flatMap((f:any) => [
    parseFloat(getValue(f, ['pctIG', '% IG', 'ig']) || '0'),
    parseFloat(getValue(f, ['pctHY', '% HY', 'hy']) || '0'),
    parseFloat(getValue(f, ['nrOtros', '% NR/OTROS']) || '0'),
    parseFloat(getValue(f, ['govies', 'pctGovies', '% GOVIES']) || '0'),
    parseFloat(getValue(f, ['credito', 'pctCredito', '% CRÉDITO', '% CREDITO']) || '0'),
    parseFloat(getValue(f, ['cash', 'pctCash', '% CASH']) || '0')
  ]);
  const maxPct = Math.max(...allPcts.filter((n: number) => !isNaN(n)), 0);
  const multPct = (maxPct > 0 && maxPct <= 1.5) ? 100 : 1; 

  const allYTWs = validFunds.map((f:any) => parseFloat(getValue(f, ['ytw', 'YIELD (YTW)', 'yield']) || '0'));
  const maxYTW = Math.max(...allYTWs.filter((n: number) => !isNaN(n)), 0);
  const multYTW = (maxYTW > 0 && maxYTW <= 0.3) ? 100 : 1; 

  const allVolas = validFunds.map((f:any) => parseFloat(getValue(f, ['vola3y', 'vola', 'VOLA 3Y', 'volatilidad3y']) || '0'));
  const maxVola = Math.max(...allVolas.filter((n: number) => !isNaN(n)), 0);
  const multVola = (maxVola > 0 && maxVola <= 0.6) ? 100 : 1;

  const groupedFunds = validFunds.reduce((acc: any, fund: any) => {
    const cat = getCategory(fund.name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fund);
    return acc;
  }, {});

  return (
    <section id="credito" className={isPrintMode ? "" : "pt-10 scroll-mt-20 mb-12"}>
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">09</span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">Niveles de Crédito Históricos</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Evolución de la calidad crediticia, Yield (YTW), Duración y perfil de riesgo de los fondos de Renta Fija</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm space-y-5">
        <div className="border-b border-zinc-100 pb-2">
          <ScrollableTabs 
            tabs={snapshots.map((s: any) => ({ id: s.period + '_' + s.label, label: s.label }))} 
            activeTab={activePeriod} 
            onTabChange={(id) => setActivePeriod(id)}
            baseClass="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer"
            activeClass="bg-red-700 text-white shadow-xs"
            inactiveClass="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100"
          />
        </div>

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
              {categoryOrder.map(category => {
                if (!groupedFunds[category]) return null;
                return (
                  <React.Fragment key={`cat-${category}`}>
                    <tr className="bg-red-700">
                      <td colSpan={13} className="py-1 px-2 font-bold text-white text-[10px] tracking-widest uppercase">{category}</td>
                    </tr>
                    {groupedFunds[category].map((fund: any) => {
                      
                      const duration = parseFloat(getValue(fund, ['duration', 'DURACIÓN', 'duracion']) || '0');
                      const ytw = parseFloat(getValue(fund, ['ytw', 'YIELD (YTW)', 'yield']) || '0') * multYTW;
                      
                      const ig = parseFloat(getValue(fund, ['pctIG', '% IG', 'ig']) || '0') * multPct;
                      const hy = parseFloat(getValue(fund, ['pctHY', '% HY', 'hy']) || '0') * multPct;
                      
                      // Lógica refinada para el NR/Otros:
                      let nrOtros = 0;
                      if (fund.nrOtros !== null && fund.nrOtros !== undefined) {
                         nrOtros = fund.nrOtros * multPct;
                      } else {
                         nrOtros = Math.max(0, 100 - ig - hy);
                      }
                      
                      const goviesStr = getValue(fund, ['govies', 'pctGovies', '% GOVIES']);
                      const creditoStr = getValue(fund, ['credito', 'pctCredito', '% CRÉDITO', '% CREDITO']);
                      const cashStr = getValue(fund, ['cash', 'pctCash', '% CASH']);
                      const otrosStr = getValue(fund, ['otros', 'pctOtros', '% OTROS']);
                      const volaStr = getValue(fund, ['vola3y', 'vola', 'VOLA 3Y', 'volatilidad3y']);

                      const govies = goviesStr !== null ? parseFloat(goviesStr) * multPct : null;
                      const credito = creditoStr !== null ? parseFloat(creditoStr) * multPct : null;
                      const cash = cashStr !== null ? parseFloat(cashStr) * multPct : null;
                      const otros = otrosStr !== null ? parseFloat(otrosStr) * multPct : null;
                      const vola = volaStr !== null ? parseFloat(volaStr) * multVola : null;

                      return (
                        <tr key={fund.isin || fund.name} className="hover:bg-zinc-50 dark:bg-zinc-800/50 transition-colors border-b border-zinc-100 last:border-0">
                          <td className="py-2 px-2 font-bold text-zinc-900 dark:text-zinc-100 border-r border-dotted border-zinc-300 dark:border-zinc-600">{fund.name}</td>
                          <td className="py-2 px-2 font-mono text-zinc-400 text-[9px] border-r border-dotted border-zinc-300 dark:border-zinc-600">{fund.isin}</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-800 dark:text-zinc-200 tabular-nums border-r border-dotted border-zinc-300 dark:border-zinc-600">{duration.toFixed(2).replace('.', ',')}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums border-r border-dotted border-zinc-300 dark:border-zinc-600">{ytw.toFixed(2).replace('.', ',')}%</td>
                          <td className="py-2 px-2 text-center font-bold text-red-700 bg-red-50/50">{fund.rating}</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-700 dark:text-zinc-300 font-bold tabular-nums border-l-2 border-dotted border-zinc-400">{ig.toFixed(1).replace('.', ',')}%</td>
                          <td className="py-2 px-2 text-right font-mono text-red-700 font-bold tabular-nums">{hy.toFixed(1).replace('.', ',')}%</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums border-r-2 border-dotted border-zinc-400">{nrOtros.toFixed(1).replace('.', ',')}%</td>
                          
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">{govies !== null && !isNaN(govies) ? govies.toFixed(1).replace('.', ',') + '%' : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">{credito !== null && !isNaN(credito) ? credito.toFixed(1).replace('.', ',') + '%' : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">{cash !== null && !isNaN(cash) ? cash.toFixed(1).replace('.', ',') + '%' : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums border-r-2 border-dotted border-zinc-400">{otros !== null && !isNaN(otros) ? otros.toFixed(1).replace('.', ',') + '%' : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">{vola !== null && !isNaN(vola) ? vola.toFixed(2).replace('.', ',') + '%' : '—'}</td>
                        </tr>
                      );
                    })}
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