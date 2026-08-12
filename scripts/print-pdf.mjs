/*
  Genera el PDF del informe sin tocar el navegador a mano.

  Abre la web en un Chromium sin ventana, dispara el mismo evento que el boton
  "Generar PDF" y guarda el resultado con `Page.printToPDF`, que es el mismo
  motor que usa el dialogo de imprimir. Sirve para revisar la maqueta despues de
  tocarla sin repetir cinco clics cada vez.

  Uso (con `npm run dev` levantado):
    node scripts/print-pdf.mjs                      # perfil Moderado
    node scripts/print-pdf.mjs 0,1,2,3,4,5 todo.pdf # los seis perfiles
    BENCHMARK=1 node scripts/print-pdf.mjs 0,4      # con su indice de referencia

  Variables: APP_URL (por defecto http://localhost:5173), BROWSER (ruta al
  ejecutable de Chrome o Edge).
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Ordenados de mas conservador a mas agresivo, igual que el dialogo de la web.
const profiles = (process.argv[2] ?? '2').split(',').map(Number).sort((a, b) => a - b);
const withBenchmark = process.env.BENCHMARK === '1';
const out = process.argv[3] ?? 'informe.pdf';
const APP = process.env.APP_URL ?? 'http://localhost:5173';
// Puerto propio: con el 9222 pelado se acabaria hablando con un navegador que
// el usuario tenga abierto en modo depuracion.
const PORT = 9300 + Math.floor(Math.random() * 300);

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { existsSync } = await import('node:fs');
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error('No se ha encontrado Chrome ni Edge. Indica la ruta en BROWSER.');
  process.exit(1);
}

const child = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'print-pdf-'))}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false }
);

let version = null;
for (let i = 0; i < 40 && !version; i++) {
  await sleep(500);
  try {
    version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  } catch {
    /* aun arrancando */
  }
}
if (!version) {
  child.kill();
  throw new Error('el navegador no ha abierto el puerto de depuracion');
}

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg.method);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
// El ancho importa: la maqueta mide sus bloques con el ancho de la caja de A4.
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: APP });

for (let i = 0; i < 60 && !events.includes('Page.loadEventFired'); i++) await sleep(500);
for (let i = 0; i < 60; i++) {
  if (await evaluate(`!document.body.innerText.includes('Cargando base de datos')`)) break;
  await sleep(500);
}
await sleep(1500);

/*
  App.tsx llama a `window.print()` dentro de un setTimeout y acto seguido apaga
  el modo impresion. Anulando setTimeout durante el dispatch, la maqueta se
  queda montada y es CDP quien imprime.
*/
await evaluate(`
  (() => {
    const realTimeout = window.setTimeout;
    window.setTimeout = () => 0;
    window.dispatchEvent(new CustomEvent('generate-pdf', { detail: ${JSON.stringify({ profiles, withBenchmark })} }));
    window.setTimeout = realTimeout;
    return true;
  })()
`);

for (let i = 0; i < 40; i++) {
  if (await evaluate(`!!document.getElementById('report-container')`)) break;
  await sleep(250);
}
await sleep(4000);

const pages = await evaluate(`document.querySelectorAll('.report-cover, .report-page').length`);
if (!pages) {
  child.kill();
  throw new Error('la maqueta de impresion no se monto');
}

// El tamaño y los margenes los pone @page en index.css (A4 vertical, 12 mm, y
// la portada sin margenes), igual que cuando se imprime desde el dialogo.
const pdf = await send('Page.printToPDF', {
  printBackground: true,
  preferCSSPageSize: true,
});

writeFileSync(out, Buffer.from(pdf.data, 'base64'));
console.log(`${out}: ${pages} hojas`);

ws.close();
child.kill();
process.exit(0);
