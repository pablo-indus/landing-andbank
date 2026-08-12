import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Copias automaticas antes de cada subida.
 *
 * Antes de escribir nada, la subida guarda el contenido actual de los
 * documentos que va a pisar. Si el Excel venia mal, o el parser entendio otra
 * cosa, se vuelve al estado anterior desde el propio panel en vez de tener que
 * localizar el archivo bueno y volver a subirlo.
 *
 * Se copia **solo lo que la subida va a tocar**, no la coleccion entera: una
 * copia completa arrastraria las curvas diarias (unos 560 KiB) en cada subida
 * aunque no cambien, y ademas ningun documento de Firestore puede pasar de
 * 1 MiB.
 *
 * Por eso mismo cada documento copiado va en su propio documento —
 * `backups/{id}/docs/{docId}`— y no todos dentro de uno: una subida de niveles
 * de credito toca treinta periodos, y los treinta juntos no caben.
 */

/** Cuantas copias se conservan. Las mas antiguas se van borrando. */
const KEEP = 10;

export interface BackupSummary {
  id: string;
  createdAt: string;
  /** Que subida la genero, en palabras ("Niveles de credito"). */
  label: string;
  /**
   * Nombre del Excel que se subio a continuacion.
   *
   * Sin esto, dos subidas del mismo tipo salen identicas en la lista —mismo
   * titulo, mismo numero de documentos— y solo se distinguen por la hora, que
   * no dice nada sobre que datos traia cada una. Las copias anteriores a este
   * cambio no lo llevan, asi que puede faltar.
   */
  fileName?: string;
  /** Identificadores de los documentos guardados. */
  docIds: string[];
}

/** Identificador ordenable y legible: 2026-08-11T173012Z. */
const newBackupId = () => new Date().toISOString().replace(/[-:.]/g, '').replace(/(\d{8})T(\d{6}).*/, '$1T$2Z');

/**
 * Guarda el estado actual de esos documentos.
 *
 * Los que no existan se anotan igualmente como "no existia", porque restaurar
 * tiene que poder deshacer tambien la creacion de un documento nuevo: si la
 * subida de Style Box estrena `style_box_data`, volver atras es borrarlo, no
 * dejarlo con el contenido malo.
 *
 * Devuelve null si no se pudo copiar nada; quien llama decide si sigue.
 */
export async function createBackup(
  docIds: string[],
  label: string,
  fileName?: string
): Promise<BackupSummary | null> {
  if (docIds.length === 0) return null;

  const id = newBackupId();
  const saved: string[] = [];

  for (const docId of docIds) {
    const snap = await getDoc(doc(db, 'monthly_reports', docId));
    await setDoc(doc(db, 'backups', id, 'docs', docId), {
      existed: snap.exists(),
      data: snap.exists() ? snap.data() : null,
    });
    saved.push(docId);
  }

  const summary: BackupSummary = {
    id,
    createdAt: new Date().toISOString(),
    label,
    // Solo si lo hay: Firestore rechaza los campos con valor `undefined`.
    ...(fileName ? { fileName } : {}),
    docIds: saved,
  };
  await setDoc(doc(db, 'backups', id), summary);

  await pruneOldBackups();
  return summary;
}

/** Copias existentes, de la mas reciente a la mas antigua. */
export async function listBackups(): Promise<BackupSummary[]> {
  const snap = await getDocs(collection(db, 'backups'));
  return snap.docs
    .map((d) => d.data() as BackupSummary)
    .filter((b) => b?.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * Devuelve los documentos de esa copia a `monthly_reports`.
 *
 * Restaurar **no** toca los documentos que no estaban en la copia: si desde
 * entonces se ha subido otra cosa distinta, esa sigue como esta. Solo se
 * deshace lo que aquella subida cambio.
 */
export async function restoreBackup(id: string): Promise<string> {
  const meta = await getDoc(doc(db, 'backups', id));
  if (!meta.exists()) throw new Error('Esa copia ya no existe.');

  const docs = await getDocs(collection(db, 'backups', id, 'docs'));
  if (docs.empty) throw new Error('La copia no contiene ningun documento.');

  let restored = 0;
  let removed = 0;

  for (const d of docs.docs) {
    const payload = d.data() as { existed: boolean; data: any };
    const target = doc(db, 'monthly_reports', d.id);
    if (payload.existed && payload.data) {
      await setDoc(target, payload.data);
      restored += 1;
    } else {
      // No existia antes de aquella subida: deshacerla es quitarlo.
      await deleteDoc(target);
      removed += 1;
    }
  }

  const { label, fileName } = meta.data() as BackupSummary;
  const which = fileName ? `${label} (antes de subir ${fileName})` : label;
  return (
    `Restaurada la copia de ${which}: ${restored} documento(s) devuelto(s) a su estado anterior` +
    (removed > 0 ? ` y ${removed} eliminado(s), que no existian entonces.` : '.')
  );
}

/** Borra las copias que sobran de KEEP, con sus documentos. */
async function pruneOldBackups(): Promise<void> {
  const all = await listBackups();
  for (const old of all.slice(KEEP)) {
    const docs = await getDocs(collection(db, 'backups', old.id, 'docs'));
    for (const d of docs.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db, 'backups', old.id));
  }
}

/**
 * Que documentos toca cada tipo de subida.
 *
 * Credito y cambios escriben en todos los periodos del Excel, asi que su lista
 * no se puede saber de antemano: la calcula el propio flujo de subida leyendo
 * la coleccion, y por eso aqui van como null.
 */
export const DOCS_TOUCHED: Record<string, string[] | null> = {
  credito: null,
  cambios: null,
  contribuidores: null,
  rentabilidades: ['returns_data', 'allocation_data'],
  rendimiento: ['performance_data', 'vl_series'],
  stylebox: ['style_box_data'],
  correlaciones: ['correlation_data'],
  'historico-json': null,
};
