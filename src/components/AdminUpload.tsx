// src/components/AdminUpload.tsx
import React, { useState } from 'react';
import { processAndUploadExcel } from '../services/dataService';

export const AdminUpload: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('Procesando archivo con Gemini AI...');

    try {
      const docId = await processAndUploadExcel(file);
      setStatus(`¡Éxito! Reporte guardado en la base de datos con el ID: ${docId}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg my-8 shadow-sm">
      <h3 className="font-extrabold text-lg mb-2 text-zinc-900 dark:text-zinc-100">
        Panel de Administración: Actualizar Datos
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Sube el archivo "ANDBANK_Normalized_DB.xlsx". La inteligencia artificial limpiará los datos, corregirá formatos y actualizará la base de datos automáticamente.
      </p>
      
      <div className="flex items-center gap-4">
        <label className="cursor-pointer bg-red-700 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wider py-2.5 px-5 rounded transition-colors shadow-sm">
          {loading ? 'Procesando...' : 'Subir Archivo Excel'}
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
            disabled={loading}
            className="hidden"
          />
        </label>
      </div>
      
      {status && (
        <div className={`mt-4 p-3 rounded text-xs font-medium border ${status.includes('Error') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {status}
        </div>
      )}
    </div>
  );
};