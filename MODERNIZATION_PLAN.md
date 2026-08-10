# Estado del proyecto — landing Andbank

Documento de traspaso. Si empiezas una conversacion nueva, lee SOLO este archivo:
contiene el estado actual, lo que falta y las trampas ya descubiertas.
Ultima actualizacion: 10 agosto 2026.

---

## 1. Que es esto

Landing interna para visualizar, comparar e imprimir datos de carteras modelo.
Los datos se actualizan cada mes subiendo archivos Excel desde la propia web, sin
tocar codigo y sin que haya que estar presente ningun tecnico.

**Arquitectura actual** (ya consolidada, no hay que rediseñar nada):

```
Excel -> parser determinista (src/utils/) -> Firebase Auth -> Firestore -> hook -> secciones
```

- Un solo proyecto Firebase: **`landing-gd`**, coleccion `monthly_reports`.
- Sin backend. Sin IA. Todo cliente + Firestore.
- `src/hooks/useMonthlyReports.ts` es la **unica** suscripcion a la base de datos.
- Reglas: lectura publica, escritura solo autenticado. Ya desplegadas y verificadas.
- Login: Firebase Auth, cuenta `pablobrown17@gmail.com`. El correo va en
  `VITE_ADMIN_EMAIL` para que el equipo solo escriba la contraseña.

**Documentos especiales** en `monthly_reports` (no son periodos):
`returns_data` (series netas del libro AA), `performance_data` (calculado desde VL,
todavia sin consumir por ninguna seccion).

---

## 2. Hecho y verificado

| Area | Estado |
|---|---|
| Backend Express, email PDF, parseo por IA, segundo proyecto Firebase | Eliminados |
| Contraseña falsa en cliente (`admin123`) | Sustituida por Firebase Auth |
| Reglas Firestore | Desplegadas. Escritura anonima devuelve 403 (comprobado) |
| Parser niveles de credito | Funciona. 30 periodos, 651 fondos |
| Parser historial de cambios | Funciona. 32 periodos, 89 decisiones, 194 movimientos |
| Parser contribuidores | Funciona. 6 perfiles, bloque MES + acumulado YTD |
| Parser rentabilidades (libro AA) | Funciona. 18 años, 66 meses, 67 volatilidad, KPIs y ventanas |
| Secciones conectadas a Firestore | Cambios, Credito, Contribuidores, KpiStrip, Rendimiento |
| Benchmarks reales en Backtest y Drawdown | Conectados (antes era una onda senoidal inventada) |
| Datos inventados en el repo | Eliminados (`HISTORICAL_ANNUAL`, `HISTORICAL_MONTHLY`) |

**Validaciones independientes que se pasaron** (no fiarse solo del mensaje verde):

- Rentabilidades netas: componer 2023-2025 reproduce la columna "Rentabilidad neta
  esperada" de COMISIONES@CONTRATOS con desviacion < 0,004 pp en los 4 perfiles.
- Ventanas: reconstruir `PRODUCT(1+r)^(12/N)-1` desde el mensual **guardado en
  Firestore** reproduce las 16 celdas del libro exactamente.
- KPIs: los 24 valores del codigo coincidian con la hoja `rentabilidades`.

---

## 3. Lo que falta

Por orden de valor:

1. **`BENCHMARK_DATA`** (`src/components/SectionRendimiento.tsx`, ~linea 6).
   Sigue escrito a mano. Por el mismo razonamiento que fallaba en `WINDOWS_DATA`,
   es muy probable que sean rentabilidades **brutas** de benchmark mostradas junto a
   rentabilidades netas de cartera. **Auditar antes de tocar.** Las series reales
   estan en `vlData.ts` con claves `b0`..`b5`.
2. **Asset allocation**. Las 6 pestañas de perfil del libro AA no tienen parser, asi
   que Composicion y Asset Allocation siguen con datos estaticos.
3. **Tamaño del bundle**: 4,6 MB porque `vlData.ts` lleva 12 series diarias. Los
   graficos submuestrean a ~400 puntos, asi que guardar cierres mensuales bastaria.
4. **`xlsx`**: avisos de seguridad altos sin parche en npm. Riesgo bajo (solo suben
   archivos usuarios autenticados). Solucion: distribucion oficial de SheetJS.
5. **PDF**: formato y orden. Falta que el usuario concrete que esta mal. Ya
   corregido: la portada tenia "Julio 2026" escrito a mano.
6. **Perfiles sin historico largo**: Conservador + y Agresivo + no tienen datos en
   ventanas de 1/2/3/5 años ni en el historico anual. Aparecen sin barra. Es
   correcto, pero conviene que el equipo lo sepa.

---

## 4. Trampas ya descubiertas (no repetirlas)

- **Los nombres de pestaña del Excel VL mienten.** La hoja
  "Investment Growth - Conservador" contiene la serie "Gestionada Conservadora +".
  Hay que identificar las series por la **celda de cabecera B1**, nunca por el nombre
  de la pestaña, o se intercambian dos perfiles de riesgo.
- **Varias hojas contienen mas de una tabla.** "Historico mensual" tiene las
  rentabilidades mensuales arriba y una tabla acumulada debajo, con los mismos
  nombres de perfil y las columnas desplazadas un mes. Hay que cortar al final de la
  primera tabla. Este fallo hizo que durante un tiempo el "mensual" fueran acumulados.
- **Las tablas auxiliares del libro se encabezan "Perfil"** (singular) y las buenas
  "Perfiles" (plural). Buscar por prefijo lee las equivocadas.
- **"AGRESIVA" es prefijo de "AGRESIVA +"**, igual con Conservadora. Comprobar el
  "+" primero o un perfil se queda vacio y el otro con el doble.
- **Las etiquetas de columna del libro AA estan mal**: dicen "(Ene 25-Ene 26)" pero
  la formula calcula los ultimos 12 meses hasta la fecha del archivo. Los numeros son
  correctos; la etiqueta no. Conviene que el equipo la corrija.
- **Comparar solo totales no demuestra nada.** El parser de cambios coincidia en
  decisiones y movimientos y aun asi 7 periodos diferian (saltos de linea CRLF).
  Comparar campo a campo.
- **`vlData.ts` y `generatedData.ts` son necesarios**, aunque parezcan huerfanos:
  `portfolioData.ts` los importa. `vlData.ts` son 1,2 MB en una sola linea, por eso
  `wc -l` dice 0. **No abrirlos enteros** (gasta muchisimo contexto).

---

## 5. Rutina mensual del equipo

1. Abrir la web, icono de llave arriba a la derecha, contraseña.
2. Elegir el tipo de informe en el desplegable y soltar el Excel.
3. Comprobar el mensaje verde.

| Tipo | Archivo | Comportamiento |
|---|---|---|
| Niveles de credito | NIVELES CREDITO GDC | **Reemplaza** todo el historico |
| Historial de cambios | Plantilla Pagina Cambios | **Reemplaza** todo el historico |
| Contribuidores | LEADING CONTRIBUTORS | **Añade** un mes |
| Rentabilidades netas | AA GDC 5 - ACTUAL | **Reemplaza** `returns_data` |

Antes de una subida que reemplaza, conviene una copia:

```
node scripts/backup-firestore.mjs
```

El JSON que genera vale como entrada del tipo "Historico completo (JSON)", asi que
se puede restaurar desde la propia web.

---

## 6. Comandos utiles

```
npm run dev                        # Vite en el puerto 5173 (ya no hay Express)
npx tsc --noEmit                   # comprobar tipos
node scripts/backup-firestore.mjs  # copia de monthly_reports
node scripts/inspect-excel.mjs "<ruta>"              # listar hojas
node scripts/inspect-excel.mjs "<ruta>" dump <hoja>  # volcar filas
node scripts/audit-hardcoded.ts "<AA>" "<VL>"        # cifras del codigo vs Excel
node scripts/generate-vldata.mjs "<VL>"              # regenerar vlData.ts
```

Los archivos Excel estan en `C:/Users/pablo/Desktop/__ANDBANK/Landing GD AI/`.

---

## 7. Como trabajar en este repo sin gastar contexto

- No abrir `src/data/vlData.ts`, `generatedData.ts` ni `generatedData.json`. Son
  megas de datos. Consultarlos siempre con un script de node que imprima solo lo
  que interesa.
- Para entender un Excel, usar `scripts/inspect-excel.mjs`, nunca volcar la hoja
  entera.
- Al verificar una subida, comparar dos copias de `backups/` con un script; no
  imprimir los JSON.
