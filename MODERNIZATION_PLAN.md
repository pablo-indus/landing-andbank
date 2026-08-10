# Firestore data pipeline rebuild — handoff brief

> **ESTADO: Fase 1 completada, Fase 2 parcial.** Ver "Estado de ejecucion" al final del
> documento antes de continuar. Dos afirmaciones de la version original de este plan eran
> FALSAS y estan corregidas mas abajo — no borres `generatedData.ts` ni `vlData.ts`.

This file is the full context for a rebuild task. Read it fully before touching code — it
supersedes any assumptions you'd otherwise make from just reading the source, because several
parts of this repo are dead code left over from an earlier architecture and will mislead you if
you treat them as current.

## What this app is

Internal-only landing page (non-confidential data within the company) for visualizing, comparing,
printing, and showcasing investment portfolio data to clients. Data is refreshed monthly by a
non-technical team member: they open the site, log in, and upload one of several Excel files that
the team generates each month. The engineer who owns this app (the user you're working with) will
not be present for these monthly updates — the whole upload flow must work unattended, with clear
Spanish-language error messages when a file is wrong, because the uploader cannot debug a stack
trace.

## Confirmed architecture problems (audited directly against the code, not assumed)

1. **Two Firebase projects in play simultaneously**, never reconciled:
   - `src/firebase.ts` — env-var configured, collection `monthly_reports`, one doc per period.
     **This is the one to keep.**
   - `src/lib/firebase.ts` — hardcoded to a different project (`norse-xray-zj9st`), collection
     `appData/latest`. This is a leftover from an earlier Google AI Studio scaffold and should be
     deleted along with everything that depends on it.

2. **Three parallel/competing data-loading mechanisms**, only one of which is real:
   - `src/main.tsx` mutates the static data module in place at boot
     (`PROFILE_KPIS.length = 0; PROFILE_KPIS.push(...)`) if `appData/latest` (wrong project) has
     data. Fragile, dead in practice since nothing writes to that project anymore. Delete.
   - `src/context/DataContext.tsx` duplicates that same fetch into React state via `useData()` —
     but `useData()` has zero consumers anywhere in the app. Fully dead. Delete (its replacement
     is described in Phase 2 below).
   - `App.tsx` has a live `onSnapshot` listener on `monthly_reports`, but only uses the result as
     a boolean ("do we have any doc yet") to decide whether to render sections — the actual data
     it receives is thrown away. Needs to be fixed to actually feed data downstream, or removed
     in favor of the Phase 2 hook.

3. **Only 2 of 12 sections actually read from Firestore**: `SectionCambios.tsx` and
   `SectionCredito.tsx` (both import `db` from `src/firebase.ts` directly and do a one-time
   `getDocs()` — not a live listener despite appearances). Every other section
   (`SectionRendimiento`, `SectionComposicion`, `SectionAssetAllocation`, `SectionContribuidores`,
   `SectionBacktest`, `SectionDrawdown`, `SectionPerfilador`, `SectionStyleBox`, `KpiStrip`,
   `PdfExportModal`) imports static data directly from `src/data/portfolioData.ts` /
   `corrData.ts` / `styleBoxData.ts` and will never reflect an upload.

4. **`AdminModal.tsx` uploads branch into 3 inconsistent shapes** based on filename substring
   matching:
   - Filename contains "carteras y benchmarks" → writes `monthly_reports/performance_data` in a
     shape **no component reads anywhere**. Dead write path.
   - Filename contains "niveles"/"credito" → deterministic parser (`creditProcessor.ts`) →
     writes `creditLevelSnapshots`, correctly consumed by `SectionCredito`. This is the one
     working example to model the rest on.
   - Everything else → sent to Gemini AI (`dataService.ts`, model id `gemini-3.5-flash` —
     verify this is even a real model before relying on it) to freely structure into JSON. Of
     the fields it produces, only `historicalChanges` is consumed (by `SectionCambios`);
     `assetAllocation` and `monthlyAttributions` are computed and stored but never rendered.

5. **A real Express backend exists** (`server.ts`, `server/upload.ts`, `server/firebase-admin.ts`,
   `app/applet/server.ts`) but is mostly unreachable — `AdminModal` bypasses its
   `/api/upload-excel`/`/api/upload-json` routes entirely and writes to Firestore directly from
   the browser. The one route that **is** used is `/api/send-report` (email a PDF via nodemailer),
   called from `PrintReportLayout.tsx`. **Decision: the email feature is being dropped** — the
   user only wants the client-side "download as PDF" flow (already implemented, needs formatting
   fixes, see Phase 4). This means the entire backend has no remaining purpose and can be deleted.

6. **Security gap**: `AdminModal.tsx`'s password check is a plain JS string comparison
   (`import.meta.env.VITE_ADMIN_PASSWORD`, bundled client-side, trivially bypassable via
   devtools) with a weak fallback (`'admin123'`). `firestore.rules` only covers the `appData`
   collection (the one being deleted) — it does not cover `monthly_reports`, the collection
   actually in use. Whatever is actually stopping unauthorized writes to `monthly_reports` today
   is unclear from the rules file alone. This needs a real fix, not a cosmetic one — see Phase 1.

7. ~~**Orphaned files**, unused by anything, safe to delete~~ **CORRECCION (verificado en
   codigo):** esto era FALSO y habria roto la aplicacion entera.
   - `src/data/generatedData.ts` — **NO BORRAR.** `src/data/portfolioData.ts:1` lo importa, y
     `portfolioData.ts` alimenta 10 secciones.
   - `src/data/vlData.ts` — **NO BORRAR.** `src/data/portfolioData.ts:2` lo importa. Ademas no
     esta vacio: son 1,2 MB en una sola linea (por eso `wc -l` devolvia 0).
   - `src/data/generatedData.json` y `src/data/vlData.json` — gemelos en JSON de los `.ts`
     anteriores. Ningun archivo de `src/` los importa, pero son datos del usuario: se han
     dejado intactos deliberadamente.
   - `src/data/historicalData.ts` — este si estaba huerfano de verdad. Borrado.
   - Artefactos del scaffold de AI Studio (`firebase-blueprint.json`,
     `firebase-applet-config.json`, `metadata.json`) — borrados.
   - Scripts sueltos en la raiz (`check_alerts.ts`, `check_funds.cjs`, `print_periods.cjs`,
     `test_dd.cjs`, `test_dd.js`, `test_pimco3.cjs`, `update_json.cjs`, `update_json2.cjs`,
     `changes.txt`) — no estaban en el plan original y no se han tocado. Parecen scripts de
     trabajo de la epoca del script de Python; confirmar con el usuario antes de borrarlos.

## Decisions already made (do not re-litigate these — ask the user only if you hit a case these don't cover)

- **Single Firebase project**: keep the one `src/firebase.ts` points to, collection
  `monthly_reports`, one document per period. Delete `src/lib/firebase.ts` and everything that
  depends on the other project.
- **Parsing**: deterministic, per-file-type parsers only (the pattern already proven in
  `src/utils/creditProcessor.ts` and `src/utils/performanceProcessor.ts`). No AI/Gemini parsing
  anywhere. Remove `@google/genai` and the AI branch in `src/services/dataService.ts`.
- **No backend server**: the email-PDF feature is being dropped entirely (not worth the
  maintenance). Delete `server.ts`, `server/upload.ts`, `server/firebase-admin.ts`,
  `app/applet/server.ts`, and the `email-pdf` event wiring in `App.tsx`/`PdfExportModal.tsx`.
  Drop `express`, `nodemailer`, `multer`, `cors`, `firebase-admin` from `package.json`.
- **Auth**: since there's no server left to gate uploads, replace the fake client-side password
  check with real Firebase Authentication (email/password, one or a few named team accounts).
  Firestore rules should require `request.auth != null` for writes to `monthly_reports`, and
  allow public read (matches the "internal, non-confidential" nature of the data). This closes
  the security gap without requiring any server to run.
- **PDF export stays**: client-side download-as-PDF (`PrintReportLayout.tsx`,
  `PdfExportModal.tsx`) is a real, wanted feature — it's just buggy (formatting/ordering). Fix,
  don't remove.

## Phased plan

### Phase 1 — Cut dead architecture, close the security gap
- Delete the files listed in "orphaned files" and "no backend server" above.
- Remove the corresponding now-unused dependencies from `package.json`.
- Add Firebase Authentication; replace the AdminModal password box with real sign-in.
- Rewrite `firestore.rules`: public read + auth-required write on `monthly_reports` only.

### Phase 2 — One canonical data layer, every section wired to it
- Replace the deleted `DataContext` with a single hook (e.g. `useMonthlyReports()`) that fetches
  all `monthly_reports` docs once and exposes a normalized shape matching `src/types.ts`.
- Migrate all static-only sections onto this hook, one at a time, diffing against current
  rendered output so nothing silently regresses.
- Keep `portfolioData.ts` etc. as a fallback/seed for now (don't delete) so an empty or
  partially-filled Firestore collection doesn't blank sections during rollout. Revisit removal
  once live data is trusted end to end.
- Fix (or remove in favor of the new hook) `App.tsx`'s `onSnapshot` that currently discards the
  data it fetches.

### Phase 3 — Deterministic parser per Excel file type
- The user uploads several distinct Excel files monthly, each feeding different sections. Get an
  explicit mapping from the user (file → sheet(s) → Firestore fields → section) before writing
  parsers — don't guess column names from the existing AI prompt's field list, confirm against
  real sample files.
- Extend the `creditProcessor.ts`/`performanceProcessor.ts` pattern to cover: asset allocation,
  composition, contributors/attribution, historical changes (currently AI-parsed — needs a
  deterministic replacement), backtest series, style box, correlation.
- Replace AdminModal's filename-substring sniffing with an explicit "tipo de informe" dropdown —
  filenames get renamed by people; a dropdown is more robust than string matching.
- Every parser must fail with a specific, Spanish, non-technical error message identifying what's
  wrong (e.g. "no encontré la columna ISIN en la hoja X") — the uploader cannot read a stack
  trace.

### Phase 4 — PDF export fixes
- Independent of the above. Fix formatting/ordering issues in `PrintReportLayout.tsx` /
  `PdfExportModal.tsx`. No data-layer dependency.

### Phase 5 — Verify & document
- Upload one real file per type; confirm only the intended section(s) update.
- Add a visible "última actualización" timestamp somewhere so the team can see the pipeline is
  alive.
- Write a one-page doc for the non-technical teammate: recognized file types (or dropdown
  options), how to log in, what success/failure looks like.

---

# Estado de ejecucion

## Hecho y verificado (`tsc --noEmit` limpio, `vite build` OK, app cargada en el navegador sin errores de consola)

**Fase 1 — completa**
- Borrado el backend Express completo (`server.ts`, `server/`, `app/`) y la funcion de email.
- Borrado el segundo proyecto Firebase (`src/lib/firebase.ts`), el `DataContext` muerto, el
  parcheo de modulos en `main.tsx`, `src/data/historicalData.ts` y los artefactos de AI Studio.
- `package.json`: scripts pasados a Vite puro (`dev` era `tsx ./server.ts` y habria dejado de
  funcionar tras borrar el backend). Eliminadas las dependencias `express`, `nodemailer`,
  `multer`, `cors`, `firebase-admin`, `@google/genai`, `dotenv`, `tsx`, `esbuild` y ademas
  `html2canvas` + `jspdf` (solo los usaba la ruta de email; la descarga real usa `window.print()`).
- `dataService.ts`: eliminado el parseo por IA. Queda solo la carga masiva de JSON historico.
- `AdminModal.tsx`: reescrito. Firebase Authentication real en lugar de comparar una cadena en
  el cliente (antes: `VITE_ADMIN_PASSWORD || 'admin123'`, visible en el bundle). Desplegable
  explicito de tipo de informe en lugar de adivinar por el nombre del archivo. Errores en
  castellano.
- `firestore.rules`: reescritas para cubrir `monthly_reports` (antes solo cubria `appData`,
  la coleccion que ya no se usa). Lectura publica, escritura solo autenticada.

**Fase 2 — parcial**
- Creado `src/hooks/useMonthlyReports.ts`: suscripcion unica a `monthly_reports`, con la logica
  de ordenacion que antes estaba duplicada en dos componentes.
- `SectionCambios` y `SectionCredito` migrados al hook (cada uno abria su propia conexion).
- `App.tsx`: el `onSnapshot` que descartaba sus datos ahora usa el hook.
- Las secciones ya no se ocultan si la base de datos esta vacia (antes se ocultaban las 11,
  aunque 10 no dependen de la base de datos). Ahora se muestra un aviso no bloqueante.
- Anadida la fecha de "ultima actualizacion" (era un punto de la Fase 5).

## Pendiente de accion del usuario (bloquea la seguridad)

Hecho ya: proveedor Email/Password habilitado, cuenta `pablobrown17@gmail.com` creada, y
`VITE_ADMIN_EMAIL` configurado en `.env` (el panel ya solo pide contrasena).

**Falta desplegar las reglas.** Hallazgo importante: el proyecto real es `landing-gd` y **no
existia `firebase.json` ni `.firebaserc`**, por lo que `firestore.rules` no se ha desplegado
nunca desde este repositorio — el archivo era decorativo. Las reglas vivas son las que haya en
la consola, probablemente las de modo de prueba (escritura abierta a cualquiera), que es lo que
explica que las subidas desde el navegador funcionaran sin autenticacion.

Ya se han creado `firebase.json` y `.firebaserc` apuntando a `landing-gd`, asi que el despliegue
es un solo comando (requiere `firebase login` interactivo, por eso lo hace el usuario):

    npx firebase-tools login
    npx firebase-tools deploy --only firestore:rules

Mientras no se ejecute, la base de datos sigue abierta a escritura publica.

### Credencial expuesta pendiente de revocar

`VITE_GEMINI_API_KEY` estaba en `.env` y, por ser una variable `VITE_*`, se incluia en el
bundle publico. Se ha eliminado de `.env` (copia de seguridad en `.env.backup-preauth`), pero
**la clave sigue activa en Google AI Studio y conviene revocarla**, porque estuvo expuesta.
Tambien se ha eliminado `VITE_ADMIN_PASSWORD`, que ya no se usa.

## Pendiente — Fase 2 restante

Las 10 secciones que leen de `portfolioData.ts` siguen sin conectar. No se han migrado a
proposito: migrarlas sin que exista el parser que genera sus datos (Fase 3) no aporta nada y
arriesga romper secciones que hoy funcionan.

Excepcion de alto valor, ya investigada: `SectionRendimiento.tsx` tiene tablas
**hardcodeadas dentro del propio componente** (`BENCHMARK_DATA`, `PORTFOLIO_VOL_DATA`) que se
corresponden casi exactamente con lo que ya calcula `performanceProcessor.ts` y que ya se
guarda en `monthly_reports/performance_data`. El mapeo es:

| Componente | Documento `performance_data` |
|---|---|
| `BENCHMARK_DATA[perfil].bmk` | `[perfil].benchmark.name` |
| `BENCHMARK_DATA[perfil]['1Y'\|'3Y'\|'5Y'\|'YTD']` | `[perfil].benchmark.returns[...]` |
| `BENCHMARK_DATA[perfil].vol1Y/vol3Y/vol5Y` | `[perfil].benchmark.volatilities[...]` |
| `PORTFOLIO_VOL_DATA[perfil]` | `[perfil].volatilities` |
| `PROFILE_KPIS` / `WINDOWS_DATA` | `[perfil].returns` |

**No se ha aplicado este cambio deliberadamente**: sustituye cifras financieras que se enseñan
a clientes por cifras calculadas. Antes de hacerlo, el usuario debe subir el Excel de
rendimientos y comparar el resultado calculado contra las cifras actuales, para confirmar que
`performanceProcessor.ts` calcula lo que se espera.

## Comparacion cartera vs benchmark: rebasar SIEMPRE

Al comparar una cartera con su benchmark hay que partir de una **fecha de inicio
comun**. Las series no empiezan a la vez: MSCI World arranca en 2011 y la cartera
Agresiva + en 2018, asi que comparar sus valores finales (157,64 vs 596,05) le da
al indice seis años y medio de ventaja. Rebasando ambos a 100 en la fecha comun:

| Perfil | Inicio comun | Cartera | Benchmark | Diferencia |
|---|---|---|---|---|
| Conservador + | 2011-07-16 | 39,5% | 14,8% | +24,6 pp cartera |
| Conservador | 2011-07-16 | 39,4% | 36,4% | +3,1 pp cartera |
| Moderado | 2011-11-17 | 72,1% | 81,8% | -9,6 pp benchmark |
| Equilibrado | 2011-11-17 | 113,6% | 68,6% | +44,9 pp cartera |
| Agresivo | 2012-11-17 | 122,8% | 133,0% | -10,2 pp benchmark |
| Agresivo + | 2018-01-01 | 57,6% | 179,0% | -121,3 pp benchmark |

La aplicacion ya lo hace bien: el backtest normaliza en la fecha de inicio
(`units = importe / valor_en_inicio`) y el drawdown es relativo al maximo movil.
Ademas la fecha minima seleccionable es la de la serie mas corta en pantalla.

Nota para el usuario: el benchmark de Agresiva + es MSCI World, 100% renta
variable. Si la cartera no lo es, la comparacion le es estructuralmente
desfavorable — es una decision de eleccion de benchmark, no un problema de datos.

## Pendiente — Fase 3 (bloqueada)

No se pueden escribir los parsers restantes sin ver los archivos Excel reales. Hace falta del
usuario, por cada archivo mensual: el archivo de ejemplo, que hojas contiene, y a que seccion
de la web alimenta cada una. Los parsers existentes (`creditProcessor.ts`,
`performanceProcessor.ts`) son la plantilla a seguir.

## Fase 4 — parcial

Hecho: la fecha de portada de `PrintReportLayout.tsx` estaba **escrita a mano** ("Julio 2026")
y salia mal en cualquier otro mes. Ahora se deriva de la fecha real de los datos
(`lastUpdated`), con la fecha actual como respaldo.

Pendiente: el usuario describio el PDF como "un poco raro, necesita trabajo de formato y
orden" pero no detallo que esta mal. Hace falta que concrete que secciones salen
desordenadas o con mal formato, o un PDF de ejemplo con los problemas señalados.
