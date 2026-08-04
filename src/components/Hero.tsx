import React from 'react';

export const Hero: React.FC = () => {
  return (
    <div className="bg-zinc-900 text-white relative overflow-hidden border-b border-zinc-800">
      {/* Subtle decorative background angle */}
      <div 
        className="absolute -top-24 -right-24 w-96 h-[400%] bg-red-600/10 transform -rotate-12 pointer-events-none" 
      />
      <div 
        className="absolute -top-24 right-48 w-24 h-[400%] bg-white/5 transform -rotate-12 pointer-events-none" 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded">
            Mandatos Portfolio Funds (&lt;1MM €)
          </span>
          <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase">
            / Julio 2026
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white max-w-5xl leading-tight">
          Rentabilidades y{' '}
          <span className="relative inline-block text-white border-b-4 border-red-600 pb-0.5">
            Asset Allocation
          </span>
        </h1>

        <p className="mt-4 text-xs sm:text-sm text-zinc-300 max-w-5xl leading-relaxed">
          Seguimiento interactivo de los 6 perfiles de Mandatos Portfolio Funds. Analiza rentabilidades, realiza simulaciones de backtest y revisa la composición y métricas de cada cartera.
        </p>
      </div>
    </div>
  );
};
