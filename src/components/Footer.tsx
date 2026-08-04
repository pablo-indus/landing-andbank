import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-zinc-900 text-white border-t-4 border-red-700 py-6 mt-16 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-6">
          {/* Logo mark */}
          <div className="flex items-center bg-white dark:bg-zinc-900 p-2 rounded">
            <img src="/logo.png" alt="Andbank" className="h-8 object-contain" onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Andbank_logo.png/320px-Andbank_logo.png';
            }} />
          </div>
          <div className="text-center sm:text-left mb-2">
            <div className="font-bold uppercase text-zinc-200 tracking-wide text-[11px]">
              WEALTH MANAGEMENT SGIIC
            </div>
            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
              Mandatos Portfolio Funds (&lt;1MM €) · Informe ante Clientes
            </p>
          </div>
        </div>

        <div className="text-center md:text-right text-[10px] text-zinc-400 uppercase tracking-wider space-y-0.5">
          <div className="font-semibold text-zinc-300">
            Navegando hacia un objetivo común
          </div>
          <div>Datos cerrados a Julio 2026 · Uso Profesional Exclusivo</div>
        </div>
      </div>
    </footer>
  );
};
