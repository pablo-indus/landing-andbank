import { initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

// 1. Map Vite environment variables to a configuration object
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/*
  Si el build sale sin las variables `VITE_*`, esto reventaba y la web quedaba
  EN BLANCO.

  Paso en produccion el 11 de agosto de 2026, en el primer despliegue desde
  GitHub: las variables no estaban disponibles al construir, Vite dejo
  `apiKey: void 0` en el bundle y `getAuth()` lanzo `auth/invalid-api-key`. Como
  esto se ejecuta al **importar** el modulo, la excepcion ocurria antes de que
  React montara nada: ni pagina, ni aviso, ni error visible. Un fallo de
  configuracion se veia como un sitio roto.

  Lo que dice el documento de traspaso que deberia pasar —y lo que pasa ahora—
  es que la web cargue con los datos empaquetados y que solo el panel de
  administracion no deje entrar. `firebaseReady` es lo que consultan el hook y
  el panel para saberlo.
*/
export const firebaseReady =
  Boolean(firebaseConfig.apiKey) && Boolean(firebaseConfig.projectId) && Boolean(firebaseConfig.appId);

let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (firebaseReady) {
  const app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
} else {
  console.error(
    'Firebase sin configurar: faltan variables VITE_FIREBASE_* en el build. ' +
      'La web funciona con los datos empaquetados y el panel de administracion queda cerrado. ' +
      'En Netlify se cargan en Project configuration -> Environment variables, con alcance "Builds".'
  );
}

/*
  Se exportan con el tipo de siempre, no como `X | null`, para no obligar a
  comprobarlo en cada una de las llamadas. Quien los use tiene que mirar antes
  `firebaseReady`; es lo que hacen `useMonthlyReports` y `AdminModal`, que son
  los dos unicos sitios que entran aqui.
*/
export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;
