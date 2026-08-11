import React, { useState, useEffect } from 'react';
import { PROFILES, PROFILE_COLORS } from '../data/portfolioData';

const MAX_DD_HISTORY = [
  -7.66,  // Conservador +
  -9.82,  // Conservador
  -15.52, // Moderado
  -20.77, // Equilibrado
  -25.12, // Agresivo
  -29.01  // Agresivo +
];

export const SectionPerfilador: React.FC<{ isPrintMode?: boolean }> = ({ isPrintMode }) => {
  const [tolerancia, setTolerancia] = useState<number>(-12);
  const [showToast, setShowToast] = useState(false);
  const [toastProfile, setToastProfile] = useState('');

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  if (isPrintMode) return null;

  // Encontrar el perfil más agresivo que cumpla con la tolerancia
  // La tolerancia es un número negativo (ej. -12). 
  // Un perfil cumple si su MAX_DD >= tolerancia (ej. -9.82 >= -12)
  let recommendedIdx = 0;
  for (let i = MAX_DD_HISTORY.length - 1; i >= 0; i--) {
    if (MAX_DD_HISTORY[i] >= tolerancia) {
      recommendedIdx = i;
      break;
    }
  }

  return (
    <section id="perfilador" className="pt-10 scroll-mt-28">
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          00
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Perfilador de Riesgo (Drawdown)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Descubre qué cartera se ajusta a tu nivel de tolerancia a caídas máximas
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm flex flex-col md:flex-row gap-8 items-center">
        {/* Controles */}
        <div className="w-full md:w-1/3 space-y-6">
          <div>
            <label className="block text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-2">
              Caída Máxima Tolerada
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Ajusta el control deslizante para establecer la máxima pérdida temporal que estarías dispuesto a soportar en el peor escenario histórico.
            </p>
            
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm font-bold text-zinc-400">0%</span>
              <input 
                type="range" 
                min="0"
                max="35"
                step="1"
                value={Math.abs(tolerancia)}
                onChange={(e) => setTolerancia(-Number(e.target.value))}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <span className="text-sm font-bold text-zinc-400">-35%</span>
            </div>
            <div className="text-center mt-4">
              <span className="inline-block px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded text-xl font-extrabold text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                {tolerancia}%
              </span>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="w-full md:w-2/3 border-t md:border-t-0 md:border-l border-zinc-100 md:pl-8 pt-6 md:pt-0">
          <div className="mb-4">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Cartera Recomendada
            </h3>
            
            {recommendedIdx !== -1 ? (
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: PROFILE_COLORS[recommendedIdx] }}></div>
                  <h4 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {PROFILES[recommendedIdx]}
                  </h4>
                </div>
                <button 
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('apply-profile', { detail: recommendedIdx }));
                    setToastProfile(PROFILES[recommendedIdx]);
                    setShowToast(true);
                  }}
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-red-700 text-white rounded font-bold text-[11px] uppercase tracking-wider hover:bg-red-800 transition-colors"
                >
                  Aplicar este perfil a la web
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            ) : (
              <h4 className="text-xl font-extrabold text-zinc-400 tracking-tight">
                Ninguna cartera cumple
              </h4>
            )}
          </div>

          <div className="space-y-3 mt-6">
            <p className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-2">
              Evaluación por perfil (Histórico desde 2009)
            </p>
            {PROFILES.map((pName, idx) => {
              const dd = MAX_DD_HISTORY[idx];
              const passes = dd >= tolerancia;
              const isRecommended = idx === recommendedIdx;
              
              return (
                <div 
                  key={pName} 
                  className={`flex items-center justify-between p-2.5 rounded border transition-all ${
                    isRecommended 
                      ? 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-600 shadow-sm' 
                      : passes 
                        ? 'border-zinc-100 opacity-80' 
                        : 'border-zinc-100 opacity-40 grayscale'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PROFILE_COLORS[idx] }}></div>
                    <span className={`text-xs font-bold ${isRecommended ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {pName}
                    </span>
                    {isRecommended && (
                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                        Recomendada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">
                      {dd.toFixed(1).replace('.', ',')}%
                    </span>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center">
                      {passes ? (
                        <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
             <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
             </svg>
          </div>
          <div className="pr-2">
            <p className="text-[13px] font-bold text-white mb-0.5">Perfil Aplicado</p>
            <p className="text-[11px] text-zinc-400">Se ha aplicado <strong>{toastProfile}</strong> a todas las gráficas.</p>
          </div>
          <button 
            onClick={() => setShowToast(false)} 
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400 hover:text-white cursor-pointer ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </section>

  );
};
