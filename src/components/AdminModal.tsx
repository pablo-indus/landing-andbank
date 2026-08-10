import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, Key, LogOut } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, deleteField } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { uploadHistoricalJson } from '../services/dataService';
import { processPerformanceExcel } from '../utils/performanceProcessor';
import { processCreditExcel } from '../utils/creditProcessor';
import { processChangesExcel } from '../utils/changesProcessor';
import { processContributorsExcel } from '../utils/contributorsProcessor';

interface AdminModalProps {
  onClose: () => void;
}

/**
 * Tipos de informe reconocidos. El usuario elige explicitamente en un desplegable
 * en lugar de depender del nombre del archivo: los nombres se cambian con facilidad
 * y provocaban que se procesara el informe equivocado sin avisar.
 */
type ReportType = 'credito' | 'cambios' | 'contribuidores' | 'rendimiento' | 'historico-json';

const REPORT_TYPES: { id: ReportType; label: string; hint: string; accept: string }[] = [
  {
    id: 'credito',
    label: 'Niveles de credito',
    hint: 'Ej. NIVELES CREDITO GDC.xlsx — reemplaza todos los niveles de credito existentes.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'cambios',
    label: 'Historial de cambios',
    hint: 'Ej. Plantilla Pagina Cambios.xlsx — una pestana por mes. Reemplaza todo el historial.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'contribuidores',
    label: 'Contribuidores y detractores',
    hint: 'Ej. LEADING CONTRIBUTORS - DETRACTORS.xlsx — anade el mes, sin borrar los anteriores.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'rendimiento',
    label: 'Rendimientos (carteras y benchmarks)',
    hint: 'Ej. VL - Carteras y Benchmarks.xlsx — recalcula rentabilidades y volatilidades.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'historico-json',
    label: 'Historico completo (JSON)',
    hint: 'Carga masiva de varios periodos a la vez. Solo para migraciones.',
    accept: '.json',
  },
];

/** Traduce los codigos de error de Firebase Auth a mensajes que el equipo pueda entender. */
const authErrorToSpanish = (code: string): string => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Contrasena incorrecta.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos e intentalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexion con el servidor. Revisa tu conexion a internet.';
    case 'auth/invalid-email':
      return 'La cuenta de administrador esta mal configurada (email invalido). Avisa al responsable tecnico.';
    default:
      return 'No se pudo iniciar sesion. Avisa al responsable tecnico.';
  }
};

export const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL ?? '';

  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(() => auth.currentUser !== null);
  const [reportType, setReportType] = useState<ReportType>('credito');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  const selectedType = REPORT_TYPES.find((t) => t.id === reportType)!;

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Introduce la contrasena.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSignedIn(true);
      setPassword('');
    } catch (err: any) {
      setError(authErrorToSpanish(err?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSignedIn(false);
    setUploadMessage('');
    setError('');
  };

  /** Sustituye por completo los niveles de credito: el Excel contiene todos los meses. */
  const uploadCredito = async (f: File) => {
    const creditUpdates = await processCreditExcel(f);

    if (Object.keys(creditUpdates).length === 0) {
      throw new Error(
        'No se encontro ninguna hoja de niveles de credito valida. Revisa que las hojas incluyan las columnas ISIN y DURACION.'
      );
    }

    const existing = await getDocs(collection(db, 'monthly_reports'));
    for (const d of existing.docs) {
      if (d.data().creditLevelSnapshots) {
        await updateDoc(d.ref, { creditLevelSnapshots: deleteField() });
      }
    }

    for (const [docId, snapshots] of Object.entries(creditUpdates)) {
      const ref = doc(db, 'monthly_reports', docId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { creditLevelSnapshots: snapshots, updatedAt: new Date().toISOString() });
      } else {
        await setDoc(ref, {
          periodLabel: docId.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          creditLevelSnapshots: snapshots,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return `Niveles de credito actualizados: ${Object.keys(creditUpdates).length} periodo(s).`;
  };

  /**
   * Sustituye todo el historial de cambios: el Excel contiene todos los meses,
   * asi que se limpia antes para que no queden periodos huerfanos de una
   * version anterior del archivo.
   */
  const uploadCambios = async (f: File) => {
    const blocks = await processChangesExcel(f);

    const existing = await getDocs(collection(db, 'monthly_reports'));
    for (const d of existing.docs) {
      if (d.data().historicalChanges) {
        await updateDoc(d.ref, { historicalChanges: deleteField() });
      }
    }

    for (const [docId, block] of Object.entries(blocks)) {
      const ref = doc(db, 'monthly_reports', docId);
      const snap = await getDoc(ref);
      const payload = { historicalChanges: [block], updatedAt: new Date().toISOString() };

      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, {
          periodLabel: docId.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          ...payload,
        });
      }
    }

    const decisions = Object.values(blocks).reduce((n, b) => n + b.batches.length, 0);
    return `Historial de cambios actualizado: ${Object.keys(blocks).length} periodo(s), ${decisions} decisiones.`;
  };

  /**
   * A diferencia de credito y cambios, aqui NO se borra lo anterior: el archivo
   * trae un solo mes, asi que cada subida anade un periodo al historico.
   */
  const uploadContribuidores = async (f: File) => {
    const { blocks, warning } = await processContributorsExcel(f);

    for (const [docId, block] of Object.entries(blocks)) {
      const ref = doc(db, 'monthly_reports', docId);
      const snap = await getDoc(ref);
      const payload = {
        monthlyAttributions: [block],
        updatedAt: new Date().toISOString(),
      };

      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, {
          periodLabel: block.label,
          ...payload,
        });
      }
    }

    const periods = Object.values(blocks).map((b) => b.label).join(', ');
    return `Contribuidores actualizados: ${periods}.${warning ? ` ${warning}` : ''}`;
  };

  const uploadRendimiento = async (f: File) => {
    const perfData = await processPerformanceExcel(f);

    if (Object.keys(perfData).length === 0) {
      throw new Error('No se pudieron leer las series de rentabilidad. Revisa que el archivo tenga las hojas esperadas.');
    }

    await setDoc(doc(db, 'monthly_reports', 'performance_data'), {
      ...perfData,
      updatedAt: new Date().toISOString(),
    });

    return 'Rendimientos y volatilidades recalculados correctamente.';
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecciona un archivo.');
      return;
    }

    setLoading(true);
    setError('');
    setUploadMessage('');

    try {
      let message: string;
      if (reportType === 'credito') message = await uploadCredito(file);
      else if (reportType === 'cambios') message = await uploadCambios(file);
      else if (reportType === 'contribuidores') message = await uploadContribuidores(file);
      else if (reportType === 'rendimiento') message = await uploadRendimiento(file);
      else message = await uploadHistoricalJson(file);

      setUploadMessage(message);
      setFile(null);
    } catch (err: any) {
      console.error(err);
      const raw = err?.message ?? '';
      setError(
        raw.includes('permission') || err?.code === 'permission-denied'
          ? 'Sin permisos para escribir en la base de datos. Vuelve a iniciar sesion.'
          : raw || 'No se pudo procesar el archivo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
            <Key size={16} className="text-zinc-500" /> Panel de Administracion
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {!signedIn ? (
            <>
              {!adminEmail && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Cuenta
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    placeholder="correo de administrador"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Contrasena
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder="Introduce la contrasena"
                  autoFocus
                />
              </div>

              {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}

              <button
                onClick={handleSignIn}
                disabled={!password || loading}
                className="w-full bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold uppercase tracking-wider text-xs py-2.5 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                {loading ? 'Verificando...' : 'Entrar'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">Sesion iniciada</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 font-bold uppercase tracking-wider hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <LogOut size={12} /> Salir
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  1. Tipo de informe
                </label>
                <select
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value as ReportType);
                    setFile(null);
                    setError('');
                    setUploadMessage('');
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  {REPORT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">{selectedType.hint}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  2. Archivo
                </label>
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="file"
                    id="report-upload"
                    accept={selectedType.accept}
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor="report-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload size={32} className="text-zinc-400 mb-2" />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">
                      {file ? file.name : 'Haz clic para seleccionar el archivo'}
                    </span>
                  </label>
                </div>
              </div>

              {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}
              {uploadMessage && (
                <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium text-center">{uploadMessage}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold uppercase tracking-wider text-xs py-2.5 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                {loading ? 'Procesando archivo...' : 'Subir y Actualizar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
