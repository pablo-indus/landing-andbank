import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, Key } from 'lucide-react';

interface AdminModalProps {
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const handleUpload = async () => {
    if (!file || !password) {
      setError("Por favor, introduce la contraseña y selecciona un archivo.");
      return;
    }
    setLoading(true);
    setUploadMessage('');
    setError('');

    try {
      const formData = new FormData();
      const isJson = file.name.endsWith('.json');
      if (isJson) formData.append('json', file); else formData.append('excel', file);
      formData.append('password', password);

      const res = await fetch(isJson ? '/api/upload-json' : '/api/upload-excel', {
        method: 'POST',
        body: formData
      });

      let data = null;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
      }

      if (res.ok) {
        setUploadMessage('Datos actualizados correctamente. Refresca la página para ver los cambios.');
        setFile(null);
        setPassword('');
      } else {
        if (res.status === 401) {
          setError('Contraseña incorrecta.');
        } else {
          setError(data?.error || 'Error: Formato de Excel no válido o archivo dañado. Asegúrate de que el Excel contenga las columnas correctas de perfiles de inversión (Conservador, etc.) y los campos esperados.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ha ocurrido un error');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
            <Key size={16} className="text-zinc-500" /> Panel de Administración
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
           <div>
             <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
               Contraseña Maestra
             </label>
             <input 
               type="password" 
               value={password}
               onChange={e => setPassword(e.target.value)}
               className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
               placeholder="Introduce la contraseña para actualizar datos"
               required 
             />
           </div>

           <div>
             <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
               Subir Informe Excel
             </label>
             <p className="text-xs text-zinc-500 mb-4">
               Sube el reporte en Excel o un archivo JSON procesado directamente.
             </p>
             
             <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
               <input 
                 type="file" 
                 id="excel-upload" 
                 accept=".xlsx,.xls,.csv,.json" 
                 className="hidden" 
                 onChange={(e) => setFile(e.target.files?.[0] || null)}
               />
               <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                 <Upload size={32} className="text-zinc-400 mb-2" />
                 <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">
                   {file ? file.name : 'Haz clic para seleccionar el archivo Excel o JSON'}
                 </span>
               </label>
             </div>
           </div>

           {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}
           {uploadMessage && <p className="text-green-600 dark:text-green-400 text-xs font-medium text-center">{uploadMessage}</p>}

           <button 
             onClick={handleUpload}
             disabled={!file || !password || loading}
             className="w-full bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold uppercase tracking-wider text-xs py-2.5 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
           >
             {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
             {loading ? (file?.name.endsWith('.json') ? 'Guardando JSON...' : 'Procesando Excel...') : 'Subir y Actualizar'}
           </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
