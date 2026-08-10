import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Carga masiva del historico a partir de un archivo JSON.
 *
 * El JSON debe ser un objeto cuyas claves son los identificadores de periodo
 * (por ejemplo "enero_2026") y cuyos valores son los datos de ese mes.
 * Cada clave se guarda como un documento dentro de la coleccion 'monthly_reports'.
 *
 * El parseo de archivos Excel NO se hace aqui: cada tipo de informe tiene su
 * propio parser determinista en src/utils/ (ver creditProcessor.ts como referencia).
 */
export async function uploadHistoricalJson(file: File): Promise<string> {
  let historicalData: Record<string, unknown>;

  try {
    historicalData = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un JSON valido. Revisa que no este corrupto.');
  }

  if (typeof historicalData !== 'object' || historicalData === null || Array.isArray(historicalData)) {
    throw new Error(
      'El JSON debe ser un objeto con un periodo por clave (ej. {"enero_2026": {...}}), no una lista.'
    );
  }

  const periods = Object.entries(historicalData);
  if (periods.length === 0) {
    throw new Error('El JSON esta vacio: no contiene ningun periodo.');
  }

  try {
    await Promise.all(
      periods.map(([docId, documentData]) =>
        setDoc(doc(db, 'monthly_reports', docId), {
          ...(documentData as Record<string, unknown>),
          updatedAt: new Date().toISOString(),
        })
      )
    );
  } catch (error: any) {
    throw new Error(
      `No se pudo guardar en la base de datos: ${error?.message ?? 'error de conexion o permisos'}`
    );
  }

  return `Historial cargado: ${periods.length} periodo(s) actualizados.`;
}
