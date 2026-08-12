import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { PROFILES } from '../data/portfolioData';

export interface ExportOptions {
  /** Indices de perfil, **siempre** de mas conservador a mas agresivo. */
  profiles: number[];
  /** Añadir la comparacion contra el indice de referencia de cada perfil. */
  withBenchmark: boolean;
}

interface PdfExportModalProps {
  onClose: () => void;
  onPrint: (options: ExportOptions) => void;
  onPowerPoint: (options: ExportOptions) => Promise<void> | void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({ onClose, onPrint, onPowerPoint }) => {
  const [selected, setSelected] = useState<number[]>([2]); // Default Moderado
  const [withBenchmark, setWithBenchmark] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleProfile = (idx: number) => {
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const allSelected = selected.length === PROFILES.length;
  const toggleAll = () => setSelected(allSelected ? [] : PROFILES.map((_, i) => i));

  /*
    El informe sale siempre de mas conservador a mas agresivo, no en el orden en
    que se hayan marcado las casillas. PROFILES ya esta en orden de riesgo, asi
    que basta con ordenar por indice. Antes, marcar Agresivo y luego Conservador
    daba un documento que empezaba por Agresivo, y la portada los listaba igual.
  */
  const options = (): ExportOptions => ({
    profiles: [...selected].sort((a, b) => a - b),
    withBenchmark,
  });

  const handlePrint = () => {
    if (selected.length === 0) return;
    onPrint(options());
  };

  const handlePowerPoint = async () => {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    try {
      await onPowerPoint(options());
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-zinc-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Configurar Informe</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                1. Seleccionar Perfiles
              </label>
              <button
                onClick={toggleAll}
                className="text-[10px] font-bold uppercase tracking-wider text-red-700 hover:text-red-800 cursor-pointer"
              >
                {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PROFILES.map((profile, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selected.includes(idx)}
                    onChange={() => toggleProfile(idx)}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-red-600 focus:ring-red-600"
                  />
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:text-zinc-100 transition-colors">
                    {profile}
                  </span>
                </label>
              ))}
            </div>
            {selected.length === 0 && (
              <p className="text-[10px] text-red-500 mt-2 font-medium">Debe seleccionar al menos un perfil.</p>
            )}
            <p className="text-[10px] text-zinc-400 mt-2">
              Los perfiles se ordenan de más conservador a más agresivo, sin importar el orden en que se marquen.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              2. Comparación
            </label>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={withBenchmark}
                onChange={(e) => setWithBenchmark(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-zinc-300 dark:border-zinc-600 text-red-600 focus:ring-red-600"
              />
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Comparar con el benchmark
                <span className="block text-[10px] font-medium text-zinc-400">
                  Backtest y Drawdown salen una vez por perfil, cada uno frente a su índice de referencia.
                </span>
              </span>
            </label>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded border border-zinc-100">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
              El informe incluirá:
            </p>
            <ul className="text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold list-disc list-inside mt-1 space-y-0.5">
              <li>Backtest con los parámetros actuales.</li>
              <li>Gráfico de Drawdown y eventos de estrés.</li>
              <li>Composición y Asset Allocation del fondo/s.</li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50 flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            onClick={handlePowerPoint}
            disabled={selected.length === 0 || busy}
            className="px-5 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold uppercase tracking-wider rounded hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {busy ? 'Generando...' : 'PowerPoint'}
          </button>
          <button
            onClick={handlePrint}
            disabled={selected.length === 0 || busy}
            className="px-6 py-2 bg-red-700 text-white text-[11px] font-bold uppercase tracking-wider rounded shadow hover:bg-red-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Generar PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
