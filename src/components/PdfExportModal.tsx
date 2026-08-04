import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PROFILES } from '../data/portfolioData';
import { Mail, Printer } from 'lucide-react';

interface PdfExportModalProps {
  onClose: () => void;
  onPrint: (profiles: number[]) => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({ onClose, onPrint }) => {
  const [selected, setSelected] = useState<number[]>([2]); // Default Moderado
  const [mode, setMode] = useState<'print' | 'email'>('print');
  const [emails, setEmails] = useState<string>('');
  const [subject, setSubject] = useState<string>('Consulta Histórica');
  const [message, setMessage] = useState<string>('Adjunto el reporte de consulta histórica.');


  const toggleProfile = (idx: number) => {
    setSelected(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handlePrint = () => {
    if (selected.length === 0) return;
    if (mode === 'print') {
      onPrint(selected);
    } else {
      const emailList = emails.split(',').map(e => e.trim()).filter(e => e.includes('@'));
      if (emailList.length === 0) {
        alert('Por favor introduzca al menos un email válido.');
        return;
      }
      
      const event = new CustomEvent('email-pdf', {
        detail: {
          profiles: selected,
          emails: emailList,
          subject,
          text: message
        }
      });
      window.dispatchEvent(event);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-zinc-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Configurar Informe PDF</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md">
            <button
              onClick={() => setMode('print')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${mode === 'print' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300'}`}
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
            <button
              onClick={() => setMode('email')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${mode === 'email' ? 'bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300'}`}
            >
              <Mail size={14} /> Enviar Email
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
              1. Seleccionar Perfiles
            </label>
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

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button 
            onClick={handlePrint}
            disabled={selected.length === 0}
            className="px-6 py-2 bg-red-700 text-white text-[11px] font-bold uppercase tracking-wider rounded shadow hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            Generar PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
