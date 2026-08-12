import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, Key, LogOut, History, RotateCcw } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, deleteField } from 'firebase/firestore';
import { db, auth, firebaseReady } from '../firebase';
import { uploadHistoricalJson } from '../services/dataService';
import { processPerformanceExcel } from '../utils/performanceProcessor';
import { processCreditExcel } from '../utils/creditProcessor';
import { processChangesExcel } from '../utils/changesProcessor';
import { processContributorsExcel } from '../utils/contributorsProcessor';
import { processReturnsExcel } from '../utils/returnsProcessor';
import { processAllocationExcel } from '../utils/allocationProcessor';
import { processStyleBoxExcel } from '../utils/styleBoxProcessor';
import { processCorrelationExcel } from '../utils/correlationProcessor';
import { createBackup, listBackups, restoreBackup, DOCS_TOUCHED, type BackupSummary } from '../services/backups';

interface AdminModalProps {
  onClose: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Documentos que no son periodos. Ver seccion 1 del plan. */
const SPECIAL_DOC_IDS = [
  'returns_data',
  'allocation_data',
  'performance_data',
  'vl_series',
  'style_box_data',
  'correlation_data',
];

/**
 * Tipos de informe reconocidos. El usuario elige explicitamente en un desplegable
 * en lugar de depender del nombre del archivo: los nombres se cambian con facilidad
 * y provocaban que se procesara el informe equivocado sin avisar.
 */
type ReportType =
  | 'credito'
  | 'cambios'
  | 'contribuidores'
  | 'rentabilidades'
  | 'rendimiento'
  | 'stylebox'
  | 'correlaciones'
  | 'historico-json';

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
    id: 'rentabilidades',
    label: 'Rentabilidades netas (libro AA)',
    hint: 'Ej. AA GDC 5 - ACTUAL.xlsx — rentabilidades netas, composicion de carteras y asset allocation.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'rendimiento',
    label: 'Rendimientos (carteras y benchmarks)',
    hint: 'Ej. VL - Carteras y Benchmarks.xlsx — volatilidades y benchmarks del grafico de riesgo.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'stylebox',
    label: 'Style Box (Morningstar)',
    hint: 'Ej. Datos_Box_1_Year.xlsx — el export cubre un año, se suma al historico sin borrar los meses anteriores.',
    accept: '.xlsx,.xls',
  },
  {
    id: 'correlaciones',
    label: 'Matriz de correlaciones',
    hint: 'Ej. CorrelacionesGestionadas.xlsx — una hoja por perfil, de Conservador + a Agresivo +. Reemplaza las seis matrices.',
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
  // Sin configuracion de Firebase no hay objeto `auth`: se comprueba antes de
  // tocarlo, o el panel volveria a tumbar la pagina entera al abrirse.
  const [signedIn, setSignedIn] = useState(() => firebaseReady && auth.currentUser !== null);
  const [reportType, setReportType] = useState<ReportType>('credito');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const selectedType = REPORT_TYPES.find((t) => t.id === reportType)!;

  const refreshBackups = async () => {
    if (!firebaseReady) return;
    try {
      setBackups(await listBackups());
    } catch (err) {
      console.debug('No se pudieron leer las copias:', err);
    }
  };

  useEffect(() => {
    if (signedIn) void refreshBackups();
  }, [signedIn]);

  const handleRestore = async (id: string) => {
    setRestoring(id);
    setError('');
    setUploadMessage('');
    try {
      setUploadMessage(await restoreBackup(id));
      setConfirmRestore(null);
      await refreshBackups();
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo restaurar la copia.');
    } finally {
      setRestoring(null);
    }
  };

  const handleSignIn = async () => {
    setError('');
    if (!firebaseReady) {
      setError(
        'Esta publicacion no lleva configuracion de Firebase, asi que no se puede entrar ni subir nada. ' +
          'Hay que cargar las siete variables VITE_FIREBASE_* en Netlify (alcance "Builds") y volver a desplegar.'
      );
      return;
    }
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

  /**
   * Serie historica completa, no un mes suelto: se guarda en un unico documento
   * y cada subida lo reemplaza entero.
   */
  const uploadRentabilidades = async (f: File) => {
    const data = await processReturnsExcel(f);

    await setDoc(doc(db, 'monthly_reports', 'returns_data'), {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    const allocation = await uploadAllocation(f, data);

    const missing = data.missingProfiles.length
      ? ` Sin datos para: ${data.missingProfiles.join(' y ')}.`
      : '';
    return (
      `Rentabilidades netas actualizadas: ${data.annual.length} años, ` +
      `${data.monthly.length} meses, ${data.volatility.length} de volatilidad.${missing} ${allocation}`
    );
  };

  /**
   * Composicion y asset allocation, del mismo archivo y en la misma subida.
   *
   * El asset allocation del libro es una foto del momento, no una serie, asi que
   * el documento va acumulando una por periodo; la composicion si trae su propio
   * historico y se reemplaza entera.
   *
   * El periodo sale del ultimo mes de las rentabilidades del propio archivo. No
   * del nombre del archivo ni de la fecha de hoy: el libro se sube semanas
   * despues del cierre y fecharlo con "hoy" lo colocaria en un mes que todavia
   * no ha terminado.
   */
  const uploadAllocation = async (f: File, returns: Awaited<ReturnType<typeof processReturnsExcel>>) => {
    const period = [...returns.monthly].map((m: any) => m.period).sort().at(-1);
    if (!period) return 'No se pudo fechar el asset allocation: el archivo no trae meses.';

    const [year, month] = period.split('-');
    const label = `${MONTH_NAMES[Number(month) - 1]} ${year}`;

    const data = await processAllocationExcel(f, period, label);
    const ref = doc(db, 'monthly_reports', 'allocation_data');
    const snap = await getDoc(ref);

    const previous: any[] =
      snap.exists() && snap.data().schemaVersion === data.schemaVersion
        ? (snap.data().assetAllocation ?? [])
        : [];
    const assetAllocation = [
      data.assetAllocation,
      ...previous.filter((s: any) => s.period !== period),
    ].sort((a, b) => String(b.period).localeCompare(String(a.period)));

    await setDoc(ref, {
      schemaVersion: data.schemaVersion,
      assetAllocation,
      composition: data.composition,
      updatedAt: new Date().toISOString(),
    });

    return (
      `Asset allocation de ${label} guardado (${assetAllocation.length} periodos) ` +
      `y composicion con ${data.composition.length} fechas de rebalanceo.`
    );
  };

  const uploadRendimiento = async (f: File) => {
    // Si falta alguna serie, processPerformanceExcel dice cual. Antes se
    // comprobaba aqui que el resultado no viniera vacio, lo que solo detectaba
    // el caso de que fallaran las doce a la vez.
    const { performance, vlSeries } = await processPerformanceExcel(f);

    const updatedAt = new Date().toISOString();

    await setDoc(doc(db, 'monthly_reports', 'performance_data'), {
      ...performance,
      updatedAt,
    });

    /*
      Las curvas diarias van en su propio documento porque son grandes (unos
      560 KiB) y porque no las lee lo mismo: `performance_data` lo consume el
      grafico de retorno/riesgo, y esto Backtest y Drawdown. Antes esas dos
      secciones dibujaban el `vlData.ts` empaquetado y una subida no las
      cambiaba: el mensaje salia verde y las curvas seguian acabando en el
      cierre anterior.
    */
    await setDoc(doc(db, 'monthly_reports', 'vl_series'), {
      ...vlSeries,
      updatedAt,
    });

    const days = vlSeries.series['0']?.v.length ?? 0;
    return (
      `Volatilidades y benchmarks actualizados con el cierre de ${performance.asOf ?? 'la ultima fecha del archivo'}. ` +
      `Curvas de Backtest y Drawdown actualizadas hasta ${vlSeries.asOf ?? '?'} (${days} dias por serie).`
    );
  };

  /**
   * Style Box: se **suma** al historico, no lo reemplaza.
   *
   * El export de Morningstar cubre un año movil, asi que reemplazar el
   * documento entero borraria un mes por cada subida y la seccion se quedaria
   * siempre con doce pestañas moviendose hacia adelante. Las fechas que ya
   * estaban se pisan con las del archivo nuevo (Morningstar revisa las
   * puntuaciones cuando llegan las carteras definitivas de los fondos).
   */
  const uploadStyleBox = async (f: File) => {
    const data = await processStyleBoxExcel(f);

    const ref = doc(db, 'monthly_reports', 'style_box_data');
    const snap = await getDoc(ref);
    const previous: any[] =
      snap.exists() && snap.data().schemaVersion === data.schemaVersion
        ? (snap.data().entries ?? [])
        : [];

    const incoming = new Set(data.entries.map((e) => e.period));
    const entries = [...data.entries, ...previous.filter((e: any) => !incoming.has(e.period))].sort(
      (a, b) => String(b.period).localeCompare(String(a.period))
    );

    await setDoc(ref, {
      schemaVersion: data.schemaVersion,
      entries,
      updatedAt: new Date().toISOString(),
    });

    const added = entries.length - previous.length;
    return (
      `Style Box actualizado hasta ${data.asOf}: ${data.entries.length} fecha(s) en el archivo, ` +
      `${entries.length} en el historico (${added} nueva(s)).`
    );
  };

  /**
   * Correlaciones: el archivo trae los seis perfiles, asi que reemplaza entero.
   *
   * El mensaje enumera perfil, numero de fondos y primer fondo porque las hojas
   * del export no se pueden identificar por su nombre —Excel las llama a todas
   * igual y las numera— y el reparto se hace por posicion. Si un dia el export
   * saliera en otro orden, la seccion pintaria matrices creibles del perfil
   * equivocado; leyendo esa lista se ve en dos segundos.
   */
  const uploadCorrelaciones = async (f: File) => {
    const data = await processCorrelationExcel(f);

    await setDoc(doc(db, 'monthly_reports', 'correlation_data'), {
      schemaVersion: data.schemaVersion,
      profiles: data.profiles,
      updatedAt: new Date().toISOString(),
    });

    const detail = data.summary.map((s) => `${s.profile}: ${s.funds} (1. ${s.first})`).join(' · ');
    return `Correlaciones actualizadas. ${detail}.${data.orderWarning ? ` ${data.orderWarning}` : ''}`;
  };

  /**
   * Documentos que esa subida va a pisar, para copiarlos antes de tocarlos.
   *
   * Credito, cambios y contribuidores escriben en los documentos de periodo del
   * propio Excel, y no se sabe cuales hasta parsearlo, asi que se copian todos
   * los periodos existentes. Los documentos especiales quedan fuera: esas
   * subidas no los tocan, y copiar `vl_series` (560 KiB) en cada subida de
   * credito seria arrastrar medio mega por nada.
   */
  const docsToBackup = async (type: ReportType): Promise<string[]> => {
    const explicit = DOCS_TOUCHED[type];
    if (explicit) return explicit;

    const all = await getDocs(collection(db, 'monthly_reports'));
    const ids = all.docs.map((d) => d.id);
    if (type === 'historico-json') return ids;
    return ids.filter((id) => !SPECIAL_DOC_IDS.includes(id));
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
      /*
        Copia antes de escribir nada. Si la copia falla se para la subida: sin
        ella, un Excel mal exportado deja la base en un estado que solo se puede
        deshacer volviendo a encontrar el archivo bueno.
      */
      let backup;
      try {
        backup = await createBackup(await docsToBackup(reportType), selectedType.label);
      } catch (err: any) {
        // Se para la subida a proposito. Lo mas probable es que falten las
        // reglas nuevas, y en ese caso el aviso tiene que decir que hacer: si
        // esto se dejara pasar en silencio, el sistema anticagadas estaria
        // apagado justo el dia que hiciera falta.
        throw new Error(
          'No se pudo crear la copia de seguridad, asi que no se ha subido nada. ' +
            'Si es la primera vez despues de un despliegue, hay que publicar las reglas ' +
            'de Firestore (firestore.rules) para que exista la coleccion "backups". ' +
            `Detalle: ${err?.message ?? 'error desconocido'}`
        );
      }

      let message: string;
      if (reportType === 'credito') message = await uploadCredito(file);
      else if (reportType === 'cambios') message = await uploadCambios(file);
      else if (reportType === 'contribuidores') message = await uploadContribuidores(file);
      else if (reportType === 'rentabilidades') message = await uploadRentabilidades(file);
      else if (reportType === 'rendimiento') message = await uploadRendimiento(file);
      else if (reportType === 'stylebox') message = await uploadStyleBox(file);
      else if (reportType === 'correlaciones') message = await uploadCorrelaciones(file);
      else message = await uploadHistoricalJson(file);

      setUploadMessage(
        message + (backup ? ` Copia de seguridad guardada (${backup.docIds.length} documento(s)).` : '')
      );
      setFile(null);
      void refreshBackups();
    } catch (err: any) {
      console.error(err);
      const raw = err?.message ?? '';
      // El aviso de copia de seguridad fallida ya explica que hacer (publicar
      // firestore.rules) y no se debe tapar: su "Detalle" incluye el error
      // original de Firebase, que suele decir "insufficient permissions", asi
      // que el filtro generico de abajo lo confundiria con un problema de sesion.
      const isBackupError = raw.startsWith('No se pudo crear la copia de seguridad');
      setError(
        isBackupError
          ? raw
          : raw.includes('permission') || err?.code === 'permission-denied'
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

              {/*
                Cada subida deja una copia de lo que habia justo antes. Se
                conservan las diez ultimas: restaurar devuelve esos documentos a
                su estado anterior y no toca nada mas.
              */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  <History size={13} className="text-zinc-400" /> Deshacer una subida
                </p>

                {backups.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">
                    Todavia no hay copias. Se crea una automaticamente antes de cada subida.
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {backups.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 text-[11px] border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{b.label}</p>
                          <p className="text-[10px] text-zinc-500">
                            {new Date(b.createdAt).toLocaleString('es-ES', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                            {' · '}
                            {b.docIds.length} doc.
                          </p>
                        </div>

                        {confirmRestore === b.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleRestore(b.id)}
                              disabled={restoring !== null}
                              className="px-2 py-1 bg-red-700 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-red-800 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                            >
                              {restoring === b.id && <Loader2 size={11} className="animate-spin" />}
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmRestore(null)}
                              className="px-2 py-1 text-zinc-500 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestore(b.id)}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 border border-zinc-300 dark:border-zinc-600 rounded text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <RotateCcw size={11} /> Restaurar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
