import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

const FIREBASE_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_ADMIN_EMAIL',
];

/*
  Avisa, al construir, si faltan las variables de Firebase.

  Vite sustituye `import.meta.env.VITE_*` por su valor literal, asi que una
  variable ausente se convierte en `void 0` dentro del bundle y el fallo no
  aparece hasta que alguien abre la web. El 11 de agosto de 2026 el primer
  despliegue desde GitHub salio asi y la pagina quedo en blanco.

  Es un aviso y no un error: la web sabe funcionar sin base de datos, con los
  datos empaquetados, y a veces interesa construir asi. Lo que no puede pasar es
  que no se note, y en el registro de Netlify esto se ve.
*/
function warnOnMissingFirebaseEnv(mode: string): Plugin {
  return {
    name: 'avisa-si-falta-configuracion-de-firebase',
    apply: 'build',
    buildStart() {
      const env = loadEnv(mode, process.cwd(), '');
      const missing = FIREBASE_VARS.filter((name) => !env[name]);
      if (missing.length === 0) return;

      const line = '='.repeat(72);
      this.warn(
        `\n${line}\n` +
          `  ATENCION: se esta construyendo SIN configuracion de Firebase.\n` +
          `  Faltan ${missing.length} de ${FIREBASE_VARS.length} variables: ${missing.join(', ')}\n\n` +
          `  La web cargara con los datos empaquetados y el panel de administracion\n` +
          `  no dejara entrar. Si esto es un despliegue de verdad, hay que cargarlas en\n` +
          `  Netlify (Project configuration -> Environment variables) con alcance\n` +
          `  "Builds" y volver a desplegar.\n${line}\n`
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), warnOnMissingFirebaseEnv(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
