/**
 * Copia de seguridad de la coleccion 'monthly_reports'.
 *
 * Uso:  node scripts/backup-firestore.mjs
 *
 * Guarda un JSON con fecha en backups/. Conviene ejecutarlo antes de cualquier
 * subida que reemplace datos (la de niveles de credito borra los existentes).
 *
 * El archivo generado sirve tambien como entrada para "Historico completo (JSON)"
 * en el panel de administracion, asi que se puede restaurar desde la propia web.
 *
 * Solo lee: las reglas permiten lectura publica, por lo que no hace falta login.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Leemos .env a mano: este script corre fuera de Vite, que es quien normalmente
// se encarga de exponer las variables VITE_*.
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const eq = line.indexOf('=');
      return [line.slice(0, eq).trim(), line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

const snapshot = await getDocs(collection(getFirestore(app), 'monthly_reports'));

const backup = {};
snapshot.forEach((doc) => {
  backup[doc.id] = doc.data();
});

const docIds = Object.keys(backup);
if (docIds.length === 0) {
  console.error('AVISO: la coleccion esta vacia. No se ha escrito ninguna copia.');
  process.exit(1);
}

const dir = new URL('../backups/', import.meta.url);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = new URL(`monthly_reports-${stamp}.json`, dir);
writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');

const creditDocs = docIds.filter((id) => backup[id].creditLevelSnapshots?.length > 0);
const changeDocs = docIds.filter((id) => backup[id].historicalChanges?.length > 0);

console.log(`Copia guardada en backups/monthly_reports-${stamp}.json`);
console.log(`  documentos:              ${docIds.length}`);
console.log(`  con niveles de credito:  ${creditDocs.length}`);
console.log(`  con historial de cambios:${changeDocs.length}`);
process.exit(0);
