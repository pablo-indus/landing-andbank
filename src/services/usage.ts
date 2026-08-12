import { doc, increment, setDoc } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';

/**
 * Contador de uso propio, en la misma base de datos.
 *
 * Se eligio esto y no Google Analytics por una razon concreta: GA4 instala
 * cookies de terceros, y con ellas hace falta un banner de consentimiento que
 * esta web no tiene. Aqui no se guarda nada de quien visita —ni IP, ni
 * identificador, ni dispositivo— solo se suma uno a un contador del dia. No se
 * puede reconstruir el recorrido de una persona porque no hay a quien
 * atribuirlo.
 *
 * Lo que si permite es responder a la pregunta que se hizo: si la web se usa,
 * cuando son los picos y cuantos informes se descargan.
 *
 * Estructura: `usage_stats/{yyyy-mm}` con un mapa por dia y evento.
 *
 *   usage_stats/2026-08 = {
 *     days: { "2026-08-11": { visit: 14, pdf: 3, pptx: 1 } },
 *     totals: { visit: 220, pdf: 31, pptx: 4 }
 *   }
 *
 * Un documento por mes y no uno por dia para no llenar la coleccion, y aparte
 * de `monthly_reports` para que una restauracion de datos no arrastre las
 * metricas ni al reves.
 */

export type UsageEvent = 'visit' | 'pdf' | 'pptx';

/** Una visita por pestaña abierta, no una por render. */
const SESSION_KEY = 'andbank-usage-visit';

/**
 * Suma uno al contador. Nunca lanza: que falle una metrica no puede romper una
 * descarga ni dejar la web a medias.
 *
 * Las reglas de Firestore dan escritura solo a usuarios autenticados, asi que
 * `usage_stats` necesita su propia regla de "crear y sumar sin login". Mientras
 * no este desplegada, esto falla en silencio y la web funciona igual.
 */
export async function trackEvent(event: UsageEvent): Promise<void> {
  if (!firebaseReady) return;

  try {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const day = now.toISOString().slice(0, 10);

    await setDoc(
      doc(db, 'usage_stats', month),
      {
        days: { [day]: { [event]: increment(1) } },
        totals: { [event]: increment(1) },
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    // Sin permisos o sin red: la metrica se pierde y ya esta.
    console.debug('No se pudo registrar la metrica de uso:', err);
  }
}

/** Marca una visita, una sola vez por pestaña. */
export function trackVisitOnce(): void {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Navegacion privada sin sessionStorage: se cuenta igual, peor el dato que nada.
  }
  void trackEvent('visit');
}
