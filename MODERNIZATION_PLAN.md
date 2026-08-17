# Estado del proyecto — landing Andbank

Documento de traspaso. Si empiezas una conversacion nueva, lee SOLO este archivo:
contiene el estado actual, lo que falta y las trampas ya descubiertas.
Ultima actualizacion: 17 agosto 2026 (las cajas resumen de perfil ya no dicen
"YTD 2026" / "Junio" a fuego: las etiquetas de ano y mes salen de la cabecera de
columna del Excel de rentabilidades, igual que las cifras). Antes de eso, misma
fecha: escenarios de crisis reales en el stress test y caida de 2008 estimada por
perfil, benchmark en el grafico de barras, nueve eventos macro en el drawdown,
tabla de composicion y de asset allocation mas legibles, descargo de la matriz de
correlacion, confirmacion al restaurar una copia y PowerPoint rehecho para
parecerse al PDF.
El 12 de agosto: informe en PowerPoint, comparacion con benchmark en los
informes, copias automaticas antes de cada subida, contador de uso y la tanda de
arreglos de formato que reviso el equipo; ese mismo dia, ya en produccion:
reglas publicadas, primera subida con copia, el panel deja de crecer sin tope y
cada copia guarda el nombre del Excel. El 11 de agosto, antes: Perfilador, Style
Box y Correlacion conectados a Firestore, escala de color nueva en la matriz,
estilo corporativo e informe PDF rehecho. **Ya no queda ninguna seccion leyendo
datos escritos a mano.**

> **Si tocas `firestore.rules`, hay que publicarlas a mano** en la consola de
> Firebase; el push a GitHub no las despliega. Las colecciones `backups` y
> `usage_stats` no existen sin sus reglas, y sin ellas **el panel no deja subir
> nada**: la copia de seguridad previa falla y la subida se para a proposito.
> Publicar **no es instantaneo** —tarda hasta un minuto largo en propagarse—,
> asi que si el error de permisos sigue justo despues de darle a *Publicar*,
> esperar y reintentar antes de tocar nada. Ya paso el 12 de agosto: se dieron
> por rotas las reglas cuando solo estaban propagandose.

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

**Documentos especiales** en `monthly_reports` (no son periodos): `returns_data`
(series netas del libro AA), `allocation_data` (composicion y asset allocation, del
mismo libro), `performance_data` (volatilidades y benchmarks del libro VL),
`vl_series` (las curvas diarias del mismo libro VL, para Backtest y Drawdown),
`style_box_data` (las fotos mensuales del Style Box de Morningstar) y
`correlation_data` (las seis matrices de correlacion).

`performance_data` y `vl_series` salen de la **misma** subida pero no son lo
mismo: el primero guarda **estadisticas por ventana** (1Y/3Y/5Y) y el segundo los
**puntos diarios**. Separarlos no es capricho: las curvas ocupan unos 560 KiB y
un documento de Firestore no puede pasar de 1 MiB.

**Quien manda sobre que cifra.** Las rentabilidades de cartera que se publican son
siempre las **netas del libro AA**. Las series VL son **brutas**: solo se usan para
volatilidad, para los benchmarks y para las curvas de Backtest y Drawdown. Mezclar
las dos como si fueran lo mismo ya ha causado un fallo (ver seccion 4).

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
| Grafico retorno/riesgo (`BENCHMARK_DATA`, `PORTFOLIO_VOL_DATA`) | Eliminados. Salen de `performance_data`, y de `vlData.ts` si aun no hay documento |
| Parser VL (`performanceProcessor`) | Reescrito: identifica las hojas por la cabecera B1 y calcula con `seriesStats` |
| Parser de composicion y asset allocation | Funciona. 61 fechas de rebalanceo, 29 fondos y 24 filas de asset allocation |
| Composicion y Asset Allocation conectadas a Firestore | Si, documento `allocation_data`. Caen a los estaticos si no esta |
| Datos inventados en el repo | Eliminados (`HISTORICAL_ANNUAL`, `HISTORICAL_MONTHLY`) |
| Tamaño del bundle | 4.620 kB -> 2.939 kB (gzip 1.136 -> 731). `vlData.ts` pasa de 2,41 MB a 0,54 MB |
| Avisos de seguridad de npm | 2 (altos), heredados de `pptxgenjs`. No llegan al navegador: ver seccion 4 |
| Informe PDF | Rehecho: A4 vertical, orden nuevo, paginacion propia, cabecera y pie con numero de hoja |
| Logo | `public/logo.jpg`. El `logo.png` anterior estaba corrupto y nadie lo usa ya |
| Estilo corporativo de la web | Cabecera, pie y portada rehechos. Paleta y tipografia unificadas en `index.css` |
| Tipografia | IBM Plex Sans, servida desde `public/fonts/` (no desde Google). Licencia OFL incluida |
| Logo sobre fondo oscuro | `public/logo-knockout.png`, la marca en blanco con fondo transparente |
| Despliegue | `netlify.toml` en el repo. Falta enlazar el sitio con GitHub desde el panel |
| Backtest y Drawdown conectados a Firestore | Si, documento `vl_series`. Caen a `vlData.ts` si no esta |
| Perfilador conectado a Firestore | Si. Las seis caidas maximas se calculan de las mismas series que Drawdown |
| Parser del Style Box | Funciona. 12 fechas, 6 perfiles. Reproduce el estatico en las 72 celdas |
| Style Box conectado a Firestore | Si, documento `style_box_data`. Cae a `styleBoxData.ts` si no esta |
| Parser de correlaciones | Funciona. 6 hojas, matrices simetricas de 11 a 28 fondos |
| Correlacion conectada a Firestore | Si, documento `correlation_data`. Cae a `corrData.ts` si no esta |
| Escala de color de la matriz | Rehecha en HSL: casi blanco en -1, naranja apagado en 0, rojo corporativo en +1, con leyenda |
| Informe en PowerPoint | 16:9, tablas y graficos nativos (editables). `utils/pptExport.ts`, cargado solo al pulsar el boton |
| Comparacion con benchmark en los informes | Opcional en PDF y PPT. Backtest y Drawdown salen una vez por perfil, cada uno con su indice |
| Orden de perfiles en los informes | Siempre de mas conservador a mas agresivo, no en el orden en que se marcan |
| Seleccionar todos los perfiles | Boton en el dialogo de exportar |
| Copias automaticas antes de cada subida | `services/backups.ts`. Se guardan las 10 ultimas y se restauran desde el panel. Cada una anota el **nombre del Excel** que se subio despues |
| Contador de uso | `services/usage.ts`. Visitas y descargas por dia, sin cookies ni terceros |
| Orden de secciones | Correlacion pasa a ir detras de Credito. Numeracion 00-10 renumerada |
| Escenarios del stress test | Seis: COVID, 2022, SVB 2023, 4Q 2018 y deuda europea 2011-12 con datos reales, mas 2008 estimado. Cada uno se pinta solo para las series que ya existian |
| Caida de 2008 por perfil | Sale del asset allocation real de cada cartera; la del indice, escalando esa caida por la relacion medida indice/cartera. Antes el indice era un -50% fijo para los seis |
| Benchmark en el grafico de barras | Casilla en Rendimiento, activa solo con un perfil. Seis periodos; "Desde 2009" no lleva porque los indices arrancan en julio de 2011 |
| Etiquetas de periodo del grafico de barras | Se dibujan una por grupo, ya no colgadas de "la barra del centro" |
| Eventos macro en Drawdown | Nueve, recortados al periodo visible y con las etiquetas repartidas en dos alturas |
| Columna ISIN de Composicion | Vacia en las filas de categoria (antes ponia "Categoría") |
| Desgloses de divisa | "USD - directo" y "USD - indirecto" salen en cursiva y sangradas en pantalla, PDF y PPT (`utils/allocationRows.ts`) |
| Descargo de la matriz de correlacion | Plegado, como el de la composicion de benchmarks |
| Confirmacion al restaurar | Dialogo propio que explica que hace, con el boton de confirmar en rojo |
| Informe en PowerPoint | Rehecho: portadillas de seccion, cabecera y pie con "x / total", grafico de barras de ventanas, tarjetas KPI, columna ISIN, donuts nativos, tabla de indices y descargo legal |
| Etiquetas "YTD" y del mes en las cajas resumen de perfil | Ya no van fijas ("YTD 2026", "Junio"): `adaptKpis` (`useMonthlyReports.ts`) devuelve tambien el nombre real de esas dos columnas del Excel, y `KpiStrip.tsx` las pinta tal cual |

**Validaciones independientes que se pasaron** (no fiarse solo del mensaje verde):

- Rentabilidades netas: componer 2023-2025 reproduce la columna "Rentabilidad neta
  esperada" de COMISIONES@CONTRATOS con desviacion < 0,004 pp en los 4 perfiles.
- Ventanas: reconstruir `PRODUCT(1+r)^(12/N)-1` desde el mensual **guardado en
  Firestore** reproduce las 16 celdas del libro exactamente.
- KPIs: los 24 valores del codigo coincidian con la hoja `rentabilidades`.
- Retorno/riesgo: las 54 celdas del grafico coinciden en tres lecturas
  independientes — el parser de subida, el `vlData.ts` empaquetado y una
  implementacion escrita aparte que lee el Excel de cero
  (`node scripts/audit-benchmarks.ts`). Comprobado ademas en el navegador que lo
  pintado coincide con esas cifras en las tres ventanas.
- Composicion: 251 de las 253 columnas perfil-fecha suman exactamente 100%. Las
  dos que no son las de enero y febrero de 2019 en Agresivo +, que suman 90% en el
  propio Excel (su fila de subtotal tambien dice 90). El parser reproduce el
  archivo, no lo cuadra.
- Asset allocation: activos, geografia y divisas suman 100% en los seis perfiles,
  y USD directo + indirecto cuadra con el USD total.
- Compresion de `vlData.ts`: mismo numero de puntos y mismas fechas de inicio y
  fin en las doce series, y `audit-benchmarks.ts` sigue dando las 54 celdas
  identicas. Comprobado en el navegador que Drawdown pinta sus seis curvas y
  Backtest las suyas.
- Cambio de `xlsx`: los cinco parsers (rentabilidades, cambios, contribuidores,
  composicion/allocation y benchmarks) pasan sus scripts con la version 0.20.3.
- PowerPoint: el archivo generado se abrio en el navegador y se leyo por dentro.
  Con los seis perfiles salen 21 diapositivas, 2 graficos nativos y 25 tablas
  nativas, 1,87 MB, y la firma del ZIP y el tipo MIME son los de un .pptx. Con un
  perfil y benchmark, 16 diapositivas y 2 graficos, cada uno con su serie de
  indice. Es decir: son objetos de PowerPoint de verdad, no imagenes.
- Paginacion del PDF despues de partir Backtest y Drawdown por perfil: un perfil
  sigue dando 4 hojas y los seis siguen dando 6, que son las cifras que ya
  estaban en este documento. Con benchmark, un perfil da 5 y dos perfiles 7.
- Alineacion del Backtest: las cuatro etiquetas y los cuatro campos del formulario
  arrancan exactamente en el mismo pixel (medido en el navegador a 1440 px).
- Historial de cambios: en la decision de febrero de 2026 —la que enseño el
  equipo— la columna de entradas tiene dos fondos y ahora los dos ocupan dos
  lineas. Comprobado ademas que la clase no se pone cuando la columna tiene un
  solo fondo.
- Style Box: las 72 celdas del archivo de Morningstar coinciden con las que
  habia escritas a mano (`node scripts/test-stylebox-parser.ts`). No basta con
  contar fechas: las dos columnas de cada perfil son intercambiables a ojo y
  darles la vuelta moveria cada punto a su reflejo sin que fallara nada.
- Benchmark del grafico de barras: la barra gris de "1 año" del perfil Moderado
  da 11,4%, exactamente lo que ya mostraba el grafico de retorno/riesgo para ese
  mismo indice y ventana. Son dos caminos distintos —uno lee `vl_series` y el
  otro `performance_data`— y coinciden porque los dos pasan por `windowStats`.
- Etiquetas del grafico de barras: con Conservador + y Agresivo + marcados (que
  no tienen dato en casi ninguna ventana) y añadiendo despues un tercer perfil,
  las siete etiquetas de periodo siguen ahi. Es el caso exacto que las hacia
  desaparecer.
- Eventos del drawdown: en "Desde 2009" salen los nueve, en 5 años solo los tres
  que caen dentro y en 1 año ninguno; **ningun** rectangulo se sale del area del
  grafico, y las nueve etiquetas se reparten en dos alturas sin solaparse
  (medido con `getBBox` en el navegador).
- Desgloses de divisa: las dos filas en cursiva suman la de su divisa madre en
  los seis perfiles (6,3 / 6,9 / 14,6 / 19,1 / 28,2 / 32,9), asi que lo que se
  marca como desglose es de verdad un desglose.
- Caida simulada de 2008: la del indice ya no es la misma para todos. Va de
  -6,1% en Conservador + a -57,6% en Agresivo +, y esta ultima queda cerca de lo
  que de verdad cayo el MSCI World en 2008-09, que es el indice de ese perfil.
- Dialogo de restaurar: montando su maqueta en el navegador con la pantalla a
  420 px de alto, la tarjeta se queda en 378 px, el boton rojo sigue visible y
  lo que se desplaza es el cuerpo.
- Paginacion del PDF **despues** de esta tanda: sigue dando 4 hojas con un
  perfil, 6 con los seis y 5 con un perfil y benchmark. Son las mismas cifras
  que ya estaban en este documento.
- PowerPoint: generado fuera del navegador con `scripts/check-ppt.mts` y leido
  por dentro. Un perfil da 18 diapositivas, los seis 23 y los seis con benchmark
  34, siempre con graficos y tablas nativos (19 y 31 en el ultimo caso), y
  **ningun objeto se sale de la diapositiva** en los cinco repartos probados.
  Ademas, un dato ausente en el grafico de ventanas se escribe como `<c:v></c:v>`
  —hueco— y no como un cero.
- Correlaciones: las seis matrices son cuadradas, simetricas, con unos en la
  diagonal y todos los valores dentro de [-1, 1]. Y como el reparto hoja ->
  perfil se hace **por posicion**, se comprueba ademas que las listas de fondos
  de cada perfil se parezcan a las de `corrData.ts`: coinciden entre el 86% y el
  94%, asi que ningun par de perfiles esta intercambiado
  (`node scripts/test-correlation-parser.ts`).

---

## 3. Lo que falta

Por orden de valor:

1. ~~**Publicar `firestore.rules`.**~~ **Hecho el 12 de agosto de 2026.** Las
   dos colecciones nuevas (`backups` y `usage_stats`) ya tienen reglas
   publicadas, y la primera subida de niveles de credito con copia de seguridad
   funciono (30 periodos, copia de 82 documentos). Queda escrito porque vuelve a
   hacer falta cada vez que se toque `firestore.rules`: desde la consola de
   Firebase, *Firestore Database -> Reglas*, pegar el contenido del archivo,
   publicar y **esperar a que propague** (hasta un minuto largo; el error de
   permisos sigue saliendo mientras tanto).

2. **Subir los archivos una vez** desde el panel. Ya no queda ninguna seccion
   leyendo datos escritos a mano —las siete subidas cubren la web entera— pero
   **una seccion no cambia hasta que su archivo se sube al menos una vez**:
   mientras no exista su documento, sigue pintando los datos empaquetados en el
   repo, que son los del ultimo despliegue.

   | Falta subir | Que desbloquea |
   |---|---|
   | Rentabilidades netas (libro AA) | Composicion y Asset Allocation, hoy con errores del pipeline antiguo (MERCHFONDO con peso 0 en 51 de las 61 fechas) |
   | Style Box (Morningstar) | El historico deja de ser doce fechas congeladas y empieza a acumular |
   | Matriz de correlaciones | Las seis matrices, hoy las del ultimo despliegue |

   El Perfilador es el unico que no necesita subida propia: sale de las mismas
   series que Drawdown, asi que se actualiza con el libro VL.

3. **Bundle, lo que queda**: 2.939 kB, de los cuales 1,71 MB son
   `generatedData.ts`. Desde que Cambios, Credito, Contribuidores y Composicion
   leen de Firestore, ese archivo **ya solo sirve de respaldo** por si la base de
   datos no responde. Quitarlo bajaria el bundle a la mitad otra vez, pero deja
   las secciones en blanco ante un fallo de Firestore: es una decision de
   producto, no una limpieza. Lo mismo con `src/data/vlData.json` y
   `vlData.raw` (1,2 MB entre los dos), que ya no los importa nadie —esos si se
   pueden borrar sin consecuencias, no entran en el bundle, solo pesan en el repo.
4. **Perfiles sin historico largo**: Conservador + y Agresivo + no tienen datos en
   ventanas de 1/2/3/5 años ni en el historico anual. Aparecen sin barra, y en el
   grafico de retorno/riesgo sin punto de cartera (su benchmark si sale, porque las
   series VL de ambos si llegan). Es correcto, pero conviene que el equipo lo sepa.
   Lo que si estaba mal y ya no: esos huecos se llevaban por delante las
   etiquetas de periodo del grafico de barras (ver seccion 4).
5. **Eje X del grafico de retorno/riesgo**: llega al 16% y ninguna serie pasa del
   13,3%. Estaba dimensionado para las volatilidades inventadas, que subian a 14,8.
   Se puede apretar, es solo presentacion.

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
- **Las series de benchmark del libro VL estan interpoladas los fines de semana.**
  `b0`..`b4` no repiten valor ni un solo dia en quince años, mientras que las
  carteras repiten valor los ~1.500 fines de semana. Calcular volatilidad diaria
  sobre eso la hunde: en la ventana de 3 años el benchmark del perfil Agresivo da
  6,8% diaria frente a 9,1% mensual, mientras que en la cartera los dos metodos
  coinciden. Con el metodo diario todos los benchmarks se van a la izquierda del
  grafico y parece que las carteras asumen mas riesgo que su indice. **La
  volatilidad se calcula siempre desde cierres mensuales** (`utils/seriesStats.ts`).
- **La hoja "Formatos" del libro AA lleva tres tablas pegadas.** La buena es la del
  centro, bajo el titulo "NIVELES ACTUALES". A la izquierda hay una con cinco
  perfiles y las columnas descolocadas, y a la derecha "NIVELES CIERRE", que son
  niveles objetivo y no la cartera real. Ademas las seis columnas de perfil no van
  a paso fijo (15, 16, 18, 20, 22, 24) y entre ellas quedan celdas sueltas de la
  tabla vecina: hay que anclarse en el titulo y leer solo las que nombra la
  cabecera.
- **Las fechas de rebalanceo vienen en dos formatos.** Numero de serie de Excel en
  casi todas las pestañas de perfil, y texto "19-May-26" en la de Agresivo. Encima,
  al convertir la hoja en tabla Excel numero las cabeceras repetidas: hay un
  "24-May-242" que es el 24 de mayo de 2024 con un 2 pegado. Las columnas antiguas
  con nombre de mes suelto ("Noviembre", "Julio") no llevan año y se descartan.
- **No todas las carteras rebalancean el mismo dia.** Una fecha puede traer cinco
  perfiles y dejar el sexto sin columna. Eso no significa cartera vacia: significa
  que sigue la anterior, y por eso `cleanCompositionSnapshots` la arrastra.
- **Un dato ausente no es un cero.** En el grafico de retorno/riesgo el codigo hacia
  `?? 0` con la rentabilidad, y en un eje que empieza en 0% eso pinta un punto que
  parece real. Conservador + y Agresivo + salian asi. Si falta el dato, no se pinta.
- **`vlData.ts` ya no se puede leer con una expresion regular.** Se guarda
  comprimido: por cada serie, la fecha del primer dia y un valor por dia natural
  (`expandSeries.ts` lo devuelve al formato `{ d, v }` al cargar el modulo). Los
  scripts que lo consultaban con `replace(/^export const vlData = /)` ahora lo
  importan. La compresion **solo es valida si la serie es diaria y sin huecos**;
  `generate-vldata.mjs` lo comprueba y falla si algun dia falta, porque un hueco
  descolocaria todas las fechas posteriores sin que nada se quejara.
- **`xlsx` no se instala desde npm.** En `package.json` apunta a
  `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, que es la distribucion
  oficial de SheetJS. La de npm se quedo en 0.18.5 con dos avisos altos sin
  parche. Si alguien hace `npm i xlsx` volvera a la version vieja y vulnerable.
- **Comparar solo totales no demuestra nada.** El parser de cambios coincidia en
  decisiones y movimientos y aun asi 7 periodos diferian (saltos de linea CRLF).
  Comparar campo a campo.
- **Que una cifra escrita a mano sea real no significa que este viva.** Las
  rentabilidades de `BENCHMARK_DATA` si salian de las series buenas, pero congeladas
  en el cierre de junio de 2026; solo se noto probando fecha a fecha cual las
  reproducia. Sus volatilidades, en la misma tabla y con el mismo aspecto, estaban
  inventadas en escalera. Auditar celda a celda, no tabla a tabla.
- **`public/logo.png` no era un PNG.** Era el JPG del logo guardado como texto:
  empieza por `ef bf bd`, que son caracteres de sustitucion de UTF-8, asi que
  ningun navegador podia decodificarlo. Como los `<img>` tenian un `onError` que
  apuntaba a Wikipedia, el fallo se veia como "el logo es raro", no como "el
  logo esta roto". Ahora todo apunta a `public/logo.jpg` y no hay respaldo
  externo. El PNG corrupto sigue en el repo y no lo usa nadie: se puede borrar.
- **El pie es negro en los dos temas, asi que su logo no depende del tema.** Un
  JPG no tiene transparencia, asi que sobre fondo oscuro va `logo-knockout.png`
  (la marca en blanco, generada desde el propio JPG). En la cabecera se elige con
  `dark:`, porque la cabecera si cambia de color; en el pie **no**, porque el pie
  es negro tambien en modo claro. Atarlo a `dark:` dejaba el JPG con su fondo
  blanco incrustado pegado sobre el negro, con aspecto de pegatina, y solo se
  veia en modo claro.
- **Un `IntersectionObserver` montado con `[]` no ve nada si la pantalla de carga
  esta puesta.** El observador que enciende la pestaña del menu se creaba en un
  efecto con dependencias vacias, y en ese momento `loading` todavia era true: no
  se pintaba ninguna seccion, `getElementById` devolvia null once veces y el
  observador se quedaba observando la nada **para siempre**. La pestaña activa se
  quedaba clavada en "Perfilador" hicieras lo que hicieras. Depende de
  `loadingDb`. Ademas se marca la primera seccion visible en orden de documento,
  no la ultima que avise: en un salto desde el menu entran varias en la franja a
  la vez.
- **`scroll-behavior: smooth` tambien afecta a `scrollIntoView`.** Comprobar la
  pestaña activa justo despues de saltar da resultados falsos, porque la pagina
  sigue moviendose. Hay que esperar a que pare (~1,5 s) antes de leer nada.
- **Medir una tabla por trozos solo vale si las columnas van a ancho fijo.** La
  maqueta del PDF mide cada `<tbody>` para saber cuanto ocupa, pero un `<tbody>`
  medido suelto reparte las columnas segun su propio contenido y dentro de la
  tabla final las reparte segun todas las filas: los nombres de fondo pasaban a
  dos lineas y la hoja se pasaba de largo. Las tablas del informe llevan
  `table-fixed` y un `<colgroup>` con porcentajes por eso.
- **El modo oscuro se colaba en el PDF.** Las cuatro secciones que se reutilizan
  de la pantalla (Rendimiento, Backtest, Contribuidores, Drawdown) llevan
  variantes `dark:`; las dos escritas para el informe, no. Si la clase `dark`
  seguia puesta al imprimir, salian cuatro secciones con fondo negro y dos en
  blanco, en el mismo documento. `PrintReportLayout` la quita mientras la
  maqueta esta montada y la devuelve al desmontarla, asi que da igual como se
  haya llegado a imprimir.
- **Una clase de Tailwind mal escrita puede salir negra en el PDF.** El
  contenedor del grafico de drawdown tenia `dark:bg-zinc-800/50/30` (dos
  opacidades). En pantalla no se notaba y al imprimir salia un rectangulo negro
  tapando la curva entera.
- **Un build sin las variables `VITE_*` dejaba la web EN BLANCO.** Vite sustituye
  `import.meta.env.VITE_*` por su valor literal al construir, asi que una
  variable ausente queda como `void 0` **dentro del bundle**: no es un fallo de
  ejecucion que se pueda reintentar, es codigo ya compilado. `firebase.ts`
  llamaba a `getAuth()` al importarse, lanzaba `auth/invalid-api-key` y la
  excepcion ocurria antes de que React montara nada. Ni pagina, ni aviso: un
  fallo de configuracion con aspecto de sitio roto. Paso en el primer despliegue
  desde GitHub, el 11 de agosto de 2026.

  Ahora `firebase.ts` comprueba la configuracion antes de inicializar y exporta
  `firebaseReady`; el hook y el panel lo consultan. Sin configuracion, la web
  carga con los datos empaquetados y ensena el aviso ambar, que es lo que este
  documento decia que pasaba desde el principio. Ademas `vite.config.ts` avisa
  al construir si falta alguna de las siete, para que se vea en el registro de
  Netlify y no en la cara del equipo.

  **En Netlify las variables tienen que tener alcance "Builds"**: son de tiempo
  de construccion, no de ejecucion. Una variable guardada solo con alcance
  "Functions" o "Runtime" no la ve Vite, y el sintoma es exactamente el mismo que
  si no existiera. Despues de cargarlas hay que **volver a desplegar**: las
  publicaciones ya hechas llevan los valores incrustados y no se actualizan
  solas.
- **Un documento de Firestore no puede pasar de 1 MiB, y el limite no avisa: la
  escritura falla entera.** Las doce curvas diarias de `vl_series` ocupan unos
  560 KiB y crecen unos 40 KiB al año, asi que hay margen para una decada larga.
  `processPerformanceExcel` mide el tamaño antes de escribir y falla con un
  mensaje claro por encima de 900 KiB; cuando llegue ese dia habra que repartir
  las series en varios documentos. No quitar esa comprobacion: sin ella, el dia
  que se pase, el equipo solo veria un error de la libreria de Firebase.
- **`vl_series` guarda las series comprimidas y eso solo vale si son diarias y
  sin huecos.** Es la misma compresion que `scripts/generate-vldata.mjs` (fecha de
  inicio mas un valor por dia natural), y por eso `packSeries` repite su
  comprobacion de huecos. Si faltara un dia, el desplazamiento dejaria de
  corresponder con la fecha y **todas** las curvas posteriores saldrian corridas
  sin que nada se quejara. `node scripts/audit-benchmarks.ts "<VL>"` compara ahora
  tambien esas doce series, dia a dia, contra el `vlData.ts` empaquetado.
- **La tipografia de la web es tambien la del informe.** `PrintReportLayout` monta
  su raiz con `font-sans`, y la maqueta **mide** la altura real de cada bloque para
  repartirlos en hojas. Cambiar `--font-sans` en `index.css` cambia esas medidas, y
  con ellas la paginacion, sin que nada se queje: el informe sale igual de bonito
  pero con una hoja mas o con un grafico separado de su tabla. Al tocar la
  tipografia hay que volver a contar hojas —`node scripts/print-pdf.mjs 2` da 4 y
  `node scripts/print-pdf.mjs 0,1,2,3,4,5` da 6— y comprobar que ninguna
  `.report-page` se pasa de su alto (271 mm = 1.024 px; si el bloque no cabe, el
  div crece y el navegador parte la hoja).
- **El alto de la cabecera esta escrito en tres sitios.** La cabecera son dos
  bandas (64 + 44 px). Ese numero se repite en la clase `scroll-mt-28` de cada
  seccion y en el `rootMargin` del `IntersectionObserver` de `App.tsx`. Si crece la
  cabecera y no se mueven los otros dos, los enlaces del menu dejan el titulo
  tapado y la pestaña activa se enciende una seccion antes de tiempo.
- **`pptxgenjs` trae dos avisos altos de npm que NO llegan al navegador.**
  Depende de `image-size`, que tiene dos fallos de denegacion de servicio en sus
  lectores de ICNS, JXL y HEIF, y no hay version parcheada. Ese modulo solo se
  usa en Node: al construir, Vite lo sustituye por un modulo vacio
  (`__vite-browser-external`), y en el paquete publicado no queda ni rastro de
  esos lectores —comprobado buscandolos en `dist/`. Ademas la unica imagen que
  se le pasa es el logo del propio repo. Es decir: `npm audit` dice 2 y el sitio
  publicado sigue teniendo 0. No "arreglarlo" con `npm audit fix --force`: eso
  instala pptxgenjs 1.1.5, de 2016, y se lleva por delante el informe entero.
- **El PowerPoint se carga solo al pulsar el boton.** `pptxgenjs` son 380 kB
  (130 kB comprimido) y solo hace falta cuando alguien exporta, asi que
  `Header.tsx` lo trae con un `import()` dinamico. Si algun dia se convierte en
  un import normal, esos 380 kB se los descarga tambien todo el que entra solo a
  mirar la web.
- **El backtest del PowerPoint y el de la pantalla son la misma funcion.**
  `utils/backtestSim.ts` la comparten los dos, a proposito: es la misma clase de
  fallo que las volatilidades del grafico de retorno/riesgo. Si el PPT llevara
  su propia cuenta, el mismo informe daria un patrimonio final distinto segun el
  formato y nadie lo notaria hasta que un cliente comparase los dos documentos.
  El modo stress test se queda fuera de `backtestSim` porque solo existe en
  pantalla y nunca sale en un informe.
- **La consistencia de lineas del historial de cambios se mide, y por eso no
  usa estado de React.** `MovesColumn` mira si alguna fila se ha partido en dos
  lineas y, si es asi, parte todas. Para saberlo tiene que medir la maqueta
  **natural**: quita la clase, mide y la vuelve a poner. Si eso se guardara en un
  `useState`, el re-render volveria a medir sobre la maqueta ya partida —que
  siempre parece partida— y la clase no se quitaria jamas aunque sobrara sitio.
  Por eso se toca `classList` directamente, que en este caso no es una chapuza
  sino la unica forma de que la medicion sea estable.
- **Con benchmark, el informe saca un bloque por perfil.** Cada cartera tiene su
  propio indice, asi que un solo grafico con seis carteras y seis indices no se
  puede leer, y dibujar solo el indice del primer perfil —que es lo que hace la
  seccion en pantalla, porque alli solo hay un perfil activo— pondria una curva
  suelta al lado de cinco carteras con las que no tiene nada que ver. Vale tanto
  para el PDF (`PrintReportLayout`) como para el PPT.
- **La copia de seguridad guarda un documento por documento, no todos en uno.**
  Una subida de niveles de credito toca treinta periodos, y treinta documentos
  dentro de uno se pasan del limite de 1 MiB de Firestore. Por eso viven en
  `backups/{id}/docs/{docId}`. Y se copia **solo lo que la subida va a tocar**:
  copiar la coleccion entera arrastraria `vl_series` (560 KiB) en cada subida de
  credito sin que cambie nada.
- **Restaurar tambien tiene que poder borrar.** Si una subida estrena un
  documento —como hizo `style_box_data`— deshacerla no es dejarlo con el
  contenido malo, es quitarlo. Por eso cada documento copiado guarda si existia
  antes, y no solo su contenido.
- **Una copia sin el nombre del archivo no sirve para elegir.** Dos subidas de
  niveles de credito salen identicas en la lista —mismo titulo, mismos 82
  documentos— y la hora no dice cual traia los datos buenos. `BackupSummary`
  lleva `fileName` desde el 12 de agosto; las copias anteriores no lo tienen y
  se muestran como "Archivo sin registrar". Ojo al guardarlo: Firestore rechaza
  los campos con valor `undefined`, asi que el campo se anade solo si lo hay.
- **Un error de subida no se puede clasificar por el texto de Firebase.** El
  aviso de "no se pudo crear la copia" incrusta el error original, que dice
  *"Missing or insufficient permissions"*; el filtro generico del panel buscaba
  la palabra `permission` y lo reescribia como "vuelve a iniciar sesion",
  mandando a rehacer login cuando lo que faltaba era publicar las reglas. El
  mensaje de la copia se reconoce por su principio y se deja pasar tal cual.
- **El panel de administracion tiene que estar limitado en alto.** Crece con el
  mensaje de resultado y con la lista de copias, y sin tope llego a empujar su
  propia cabecera fuera de la pantalla: la cruz quedaba inalcanzable y no habia
  forma de cerrarlo. La tarjeta es `max-h-[90vh] flex flex-col`, la cabecera
  `shrink-0` y el cuerpo `flex-1 overflow-y-auto`. La lista de copias **no**
  lleva su propio scroll: dos areas de scroll anidadas se pelean con la rueda.
  Ademas cierra con Escape, salvo mientras sube (cerrar no detiene la escritura,
  solo la oculta).
- **Un Excel de 0 KB entra sin quejarse hasta el parser.** Paso en produccion:
  dos meses con el mismo nombre de archivo, Python tenia abierto el de junio y
  al guardar el de julio quedo vacio. Se subio y el error no menciono el tamaño.
  Si un parser se queja de que no encuentra hojas, mirar el tamaño del archivo
  antes que el codigo.
- **El contador de uso no puede tumbar una descarga.** `trackEvent` no lanza
  nunca: si no hay permisos o no hay red, la metrica se pierde y ya esta. Se
  comprobo con las reglas todavia sin desplegar: la consola avisa y el
  PowerPoint se genera igual.
- **Las hojas del export de correlaciones no se pueden identificar por su
  nombre.** Las seis se llaman "Matriz de correlaciones entre f..." y es Excel
  quien deshace el empate numerandolas: "(1)", "(2)"... Ese numero dice en que
  orden se exportaron, no de que perfil son. Es la unica subida cuyo reparto se
  hace **por posicion** (ascendente: Conservador + primero, Agresivo + ultimo).
  Si el export saliera algun dia en otro orden, la seccion pintaria matrices
  perfectamente creibles del perfil equivocado, con fondos que esa cartera no
  tiene. Por eso `correlationProcessor` compara la proporcion de fondos de renta
  fija de la primera hoja con la de la ultima y avisa si parecen del reves, y por
  eso el mensaje verde enumera perfil, numero de fondos y primer fondo: se
  comprueba de un vistazo. El numero de fondos **no** sirve de comprobacion
  automatica: no es creciente (11, 22, 28, 27, 25, 17), sube y baja.
- **El color de la matriz se interpola en HSL, no en RGB.** Mezclar en RGB el
  rojo corporativo con el crema del extremo negativo pasa por marrones
  grisaceos, y justo en la mitad de la escala es donde se amontonan los datos
  (las correlaciones entre fondos de una misma cartera van casi todas de 0,3 a
  0,9). Manteniendo la saturacion alta en el centro, el naranja intermedio sigue
  siendo un color. Los tramos son asimetricos a proposito: de 0 a +1 la
  luminosidad recorre 76 -> 43 y de -1 a 0 solo 96 -> 76, porque el tramo
  negativo esta casi vacio. La leyenda se genera con la **misma** funcion
  (`SectionCorrelacion.tsx`), asi que no puede quedarse desfasada respecto a las
  celdas.
- **El export del Style Box es un año movil, asi que su subida suma, no
  reemplaza.** `Datos_Box_1_Year.xlsx` trae las ultimas doce fechas y nada mas.
  Si cada subida reemplazara el documento, el historico no crecería nunca:
  ganaria un mes por delante y perderia uno por detras. `uploadStyleBox` fusiona
  con lo guardado y deja que el archivo pise las fechas que ya estaban, porque
  Morningstar revisa las puntuaciones cuando le llegan las carteras definitivas
  de los fondos.
- **El Style Box de Conservador + no significa nada y por eso no se pinta.** Esa
  cartera casi no lleva renta variable: lo que mueve su puntuacion son los
  subyacentes con bonos convertibles de alguno de sus fondos. Salta entre -100 y
  400 de un mes a otro (en enero de 2026 cae a [-4,8, -100]). El parser lo lee
  igual —reproduce el archivo— y es `SectionStyleBox` quien lo excluye, asi que
  son cinco recuadros y no seis. Las puntuaciones de Morningstar van de -100 a
  400 y el recuadro de 3x3 solo cubre de 0 a 300, con los cortes en 100 y 200.
- **El Perfilador decia "Histórico desde 2009" y ninguna cartera llega a 2009.**
  Las series empiezan entre 2010 (Conservador) y 2018 (Agresivo +), asi que la
  caida maxima de Agresivo + no ha pasado por el 2020 completo ni por 2011 y no
  es comparable con las demas. Ahora cada fila dice desde que año hay datos.
  Ademas, con la tolerancia en 0% no cumple ningun perfil y aun asi se
  recomendaba el primero: el indice arrancaba en 0 y el aviso "Ninguna cartera
  cumple" no se mostraba nunca, porque se comprobaba `!== -1`.
- **Una etiqueta colgada de "la barra del centro" desaparece sola.** El grafico
  de barras dibujaba el rotulo del periodo en la barra cuyo indice fuera
  `floor(nº de perfiles / 2)`, pero ese indice se contaba sobre los perfiles
  **marcados** y la posicion sobre los que **tienen dato**. Con Conservador + y
  Agresivo + marcados —que no tienen historico en casi ninguna ventana— mas un
  tercer perfil, en la mayoria de los grupos solo quedaba una barra, su indice
  era 0 y el rotulo no se pintaba nunca. Ahora las etiquetas se dibujan aparte,
  una por periodo, y no dependen de que haya barras.
- **El `<svg>` de las secciones va con `overflow-visible`.** Las bandas de los
  eventos del drawdown se dibujaban siempre, con la coordenada que saliera: con
  el periodo en 1 o 3 años, la de 2020 caia en negativo y se pintaba a la
  izquierda del eje, encima de las etiquetas de porcentaje. Todo lo que se
  posicione por fecha hay que recortarlo al area del grafico y descartarlo si
  queda fuera de la ventana visible.
- **`trajValue` no dice "no hay dato": devuelve el primer valor de la serie.**
  En un escenario de stress test anterior al arranque de una cartera, eso pinta
  una linea perfectamente plana, que es exactamente como se lee "esta cartera
  aguanto la crisis sin caer". Por eso los escenarios reales comprueban que la
  serie ya existiera en la fecha de inicio y dejan fuera —diciendolo— a las que
  no. Con la crisis de deuda europea eso deja fuera a cuatro de los seis
  perfiles: solo Conservador + y Conservador llegan a julio de 2011.
- **La crisis de 2008 no esta en ningun dato y no puede estarlo.** Las carteras
  empiezan entre noviembre de 2010 y 2018, y **los seis indices arrancan el 16 de
  julio de 2011**. El escenario se conserva porque el equipo lo pide, pero su
  caida se **estima** y va marcada: la de la cartera aplicando a su asset
  allocation real un retroceso declarado por clase de activo (RV -55%, RF -8%,
  alternativos -15%, monetario 0%) y la del indice escalando esa cifra por la
  relacion medida entre la caida maxima del indice y la de esa misma cartera en
  el historico que si existe. No sustituir esos supuestos por una tabla de
  numeros bonitos sin dejar dicho de donde salen.
- **En stress test no se puede apagar el formulario entero.** Estaba con
  `pointer-events-none` sobre todo el bloque, asi que para comparar una crisis
  entre perfiles habia que salir del modo, cambiar de perfil y volver a entrar.
  Ahora solo se apagan la fecha y las aportaciones, que son las que decide el
  escenario; el perfil, el importe y la casilla del benchmark siguen vivos.
- **El `autoPage` de pptxgenjs crea diapositivas sin maqueta.** Las que se
  inventa para continuar una tabla larga salen sin cabecera, sin titulo de
  seccion, sin pie y sin numero, asi que el informe acababa con hojas de dos
  estilos. Las tablas largas del PowerPoint se reparten a mano
  (`paginatedTable`), cortando entre categorias y repitiendo el titulo con
  "(cont.)", que es lo mismo que hace la maqueta del PDF.
- **En una diapositiva, una tabla anclada a una `y` fija se sale por abajo.** La
  misma diapositiva lleva dos filas con un perfil y siete con los seis: con la
  coordenada escrita a mano, el caso de seis perfiles —el que mas se usa— se
  salia de la diapositiva sin que nada avisara. Se calcula con `tableTop()`,
  desde el pie hacia arriba, y el grafico se queda con lo que sobra.
  `scripts/inspect-pptx.mjs` comprueba que ningun objeto se salga.
- **PowerPoint no tiene campo de "numero total de diapositivas".** El "x / total"
  del pie hay que escribirlo, y por eso se añade al final, cuando el deck ya esta
  montado (`numberSlides`). Si se añade una diapositiva despues de esa llamada,
  sale sin numero.
- **Un `null` en la serie de un grafico nativo si vale.** pptxgenjs lo escribe
  como `<c:v></c:v>` y PowerPoint lo pinta como hueco, no como cero. Es lo que
  permite que Conservador + y Agresivo + no aparezcan con una barra a 0% en las
  ventanas que no tienen (ver "un dato ausente no es un cero").
- **`vlData.ts` y `generatedData.ts` son necesarios**, aunque parezcan huerfanos:
  `portfolioData.ts` los importa. `vlData.ts` son 1,2 MB en una sola linea, por eso
  `wc -l` dice 0. **No abrirlos enteros** (gasta muchisimo contexto).

---

## 4b. Donde vive esto

- Repositorio: `github.com/pablo-indus/landing-andbank`, rama `main`.
- Web publicada: **Netlify**, `https://andbank-gd.netlify.app/`.
- El `.env` no esta en el repo, asi que las siete variables tienen que estar
  puestas en Netlify o el build sale sin configuracion de Firebase: la web
  cargaria con los datos empaquetados y el panel de administracion no dejaria
  entrar. Son `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` y
  `VITE_ADMIN_EMAIL` (estan en el `.env` local y en `.env.example` sin valores).
- Build: `npm run build`, carpeta publicada `dist`. La configuracion esta en
  `netlify.toml` (comando, carpeta, Node 22 fijado y cabeceras de cache), asi que
  no hay que repetirla en el panel.
- **Para que el despliegue sea automatico** falta un paso que solo se puede dar
  desde el panel de Netlify: *Site configuration -> Build & deploy -> Link
  repository*, elegir `pablo-indus/landing-andbank` y la rama de produccion. Con
  el sitio enlazado, cada `git push` construye y publica solo; sin enlazar, sigue
  publicandose lo que se arrastre a mano y `netlify.toml` no hace nada.
- Al enlazarlo hay que cargar las siete variables `VITE_*` en *Environment
  variables*. Arrastrando la carpeta no hacian falta, porque el build salia del
  portatil con su `.env`; construyendo en Netlify, si.

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
| Rentabilidades netas | AA GDC 5 - ACTUAL | **Reemplaza** `returns_data` y la composicion; **añade** la foto de asset allocation del mes |
| Rendimientos (carteras y benchmarks) | VL - Carteras y Benchmarks | **Reemplaza** `performance_data` y `vl_series` |
| Style Box (Morningstar) | Datos_Box_1_Year | **Añade** las fechas del archivo al historico |
| Matriz de correlaciones | CorrelacionesGestionadas | **Reemplaza** las seis matrices |

El mensaje verde de esta ultima dice con que cierre mensual se ha quedado. Si el
archivo se exporto a mitad de mes, ese mes no cuenta: se usa el ultimo completo.

**Cada subida deja una copia automatica** de lo que habia justo antes, y en el
panel hay una lista con las diez ultimas y un boton de restaurar. Restaurar
devuelve solo los documentos que aquella subida toco; lo que se haya subido
despues por otro lado se queda como esta.

El boton **no restaura al pulsarlo**: abre un dialogo aparte que dice que copia
es, cuantos documentos toca y que pasa con lo subido despues, y ahi si esta el
boton rojo de confirmar. Antes la confirmacion aparecia en la propia linea de la
lista, justo donde acababa de estar el boton de restaurar: dos clics seguidos en
el mismo sitio deshacian una subida sin querer.

Para una copia en disco, fuera de Firebase:

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
node scripts/audit-benchmarks.ts "<VL>"              # grafico retorno/riesgo, 3 lecturas
node scripts/test-allocation-parser.ts "<AA>"       # composicion y asset allocation
node scripts/test-stylebox-parser.ts "<Datos_Box>"  # style box vs el estatico
node scripts/test-correlation-parser.ts "<Correlaciones>"  # forma y reparto por perfil
node scripts/generate-vldata.mjs "<VL>"              # regenerar vlData.ts
node scripts/print-pdf.mjs 2 informe.pdf             # el PDF sin tocar el navegador
BENCHMARK=1 node scripts/print-pdf.mjs 0,4 x.pdf     # el PDF con el indice de cada perfil
```

Para revisar el PowerPoint sin abrirlo (hace falta empaquetar antes, porque el
modulo importa rutas sin extension):

```
npx esbuild scripts/check-ppt.mts --bundle --platform=node --format=esm --outfile=scripts/.check-ppt.mjs
node scripts/.check-ppt.mjs 0,1,2,3,4,5 bench   # genera el .pptx en la raiz
node scripts/inspect-pptx.mjs <archivo.pptx>    # diapositivas, graficos, tablas y desbordes
TITLES=1 node scripts/inspect-pptx.mjs <archivo.pptx>   # ademas, el titulo de cada una
```

`inspect-pptx.mjs` avisa si algun objeto se sale de la diapositiva, que es el
fallo que no se ve hasta que alguien abre el archivo delante de un cliente.

`audit-benchmarks.ts` sale con codigo distinto de cero si algo no cuadra, asi que
sirve tal cual despues de regenerar `vlData.ts`.

Los archivos Excel estan en `C:/Users/pablo/Desktop/__ANDBANK/Landing GD AI/`.

---

## 7. Como trabajar en este repo sin gastar contexto

- No abrir `src/data/vlData.ts`, `generatedData.ts` ni `generatedData.json`. Son
  megas de datos. Consultarlos siempre con un script de node que imprima solo lo
  que interesa.
- `src/utils/performanceProcessor.ts` importa con extension (`./seriesStats.ts`),
  a diferencia del resto del proyecto. Es deliberado: `scripts/audit-benchmarks.ts`
  lo carga con node a secas y node no resuelve rutas sin extension. El tsconfig ya
  trae `allowImportingTsExtensions`.
- Para entender un Excel, usar `scripts/inspect-excel.mjs`, nunca volcar la hoja
  entera.
- Al verificar una subida, comparar dos copias de `backups/` con un script; no
  imprimir los JSON.

---

## 8. El informe PDF

Sigue sin haber generador de PDF: se imprime con el navegador. Lo que ha
cambiado es que **la paginacion la decide el componente, no el navegador**.

Antes se volcaban las secciones de pantalla una detras de otra y el navegador
cortaba por donde le tocaba: titulos al pie de una hoja con su grafico en la
siguiente, un donut partido por la mitad y el descargo de responsabilidad
ocupando una pagina para el solo.

**Como funciona ahora** (`src/components/PrintReportLayout.tsx`):

1. Cada seccion se descompone en **bloques** que caben en una hoja. Los graficos
   son un bloque; las tablas largas, un bloque por categoria.
2. Los bloques se dibujan en un contenedor oculto (`.report-measure`, del ancho
   exacto de la caja de A4) y se **mide** su altura real.
3. Con esas alturas se reparten en hojas: un bloque nunca se parte, un titulo
   nunca se queda solo al pie (`keepWithNext`, que ademas encadena), los trozos
   de una misma tabla se funden en un solo `<table>` y repiten cabecera, y si la
   ultima hoja sale con cuatro lineas se le baja contenido de la anterior.
4. Cada hoja se dibuja como un `.report-page` con cabecera de marca, cuerpo y
   pie con perfiles, descargo y numero de pagina. La portada es aparte
   (`.report-cover`): logo, banda roja y bloque gris, y va **a sangre** gracias a
   una hoja con nombre (`@page cover { margin: 0 }`), asi que el PDF hay que
   generarlo con `preferCSSPageSize` o pasando esos margenes a mano.

Piezas:

- `src/components/PdfExportModal.tsx` — el dialogo de perfiles. Dispara el
  evento `generate-pdf`, que escucha `App.tsx`.
- `src/components/PrintReportLayout.tsx` — portada, reparto en hojas y maqueta
  de cada hoja. `PAGE_BODY_PX` es el alto util; si se tocan los margenes de
  `@page` en `index.css`, hay que moverlo con ellos.
- `src/components/printBlocks.tsx` — las tablas del informe (composicion y asset
  allocation) y los donuts, escritos aparte de las secciones de pantalla.
- Las secciones con grafico (Rendimiento, Backtest, Drawdown, Contribuidores) se
  reutilizan con `isPrintMode`: en el PDF pierden tarjeta, controles y descargos
  sueltos, que ahora van una sola vez en el pie de cada hoja.
- `src/index.css` — `@page` (A4 **vertical**, 12 mm; antes era apaisada) y las
  reglas de `.report-page`.

**Orden de las secciones** (pedido por el usuario el 11 de agosto de 2026):
1 Rendimiento, 2 Backtest, 3 Contribuidores, 4 Desglose de fondos, 5 Drawdown,
6 Asset allocation.

**Los perfiles salen siempre de mas conservador a mas agresivo**, no en el orden
en que se marcan las casillas. Lo ordena el propio dialogo (`PdfExportModal`), asi
que vale para el PDF, para el PowerPoint y para `scripts/print-pdf.mjs`.

**Con la casilla de benchmark**, Backtest y Drawdown salen una vez por perfil en
lugar de una vez en total, cada uno con su indice de referencia. Un perfil pasa
de 4 hojas a 5; dos perfiles, a 7.

**El PowerPoint es otro camino distinto** (`src/utils/pptExport.ts`): no
reaprovecha la maqueta del PDF ni las secciones de pantalla, porque una hoja A4
vertical no cabe en una diapositiva 16:9. Construye el deck con tablas y graficos
nativos de PowerPoint —editables— a partir de los mismos datos del hook, de la
misma `simulateBacktest` y de las mismas `windowStats` y `maxDrawdown`. Si se
toca el contenido del informe hay que tocar los dos sitios: no comparten maqueta,
solo datos.

Desde el 17 de agosto se parece bastante mas al PDF:

- **Portada** igual que la del informe, con el pie de la sociedad gestora.
- **Portadilla por seccion** (banda roja, numero grande y subtitulo), y en cada
  diapositiva de contenido la **cabecera de marca**, el titulo numerado con su
  filete rojo, el **pie con el descargo** y la numeracion **"x / total"**.
- **Rendimiento** sale ahora con un grafico de barras nativo de las ventanas,
  ademas de la tabla. Con un solo perfil y la casilla de benchmark marcada se
  añade la serie del indice, igual que en pantalla.
- **Backtest**: tarjetas de KPI con una o dos curvas y tabla a partir de tres,
  que es el mismo corte que hace el PDF.
- **Desglose de fondos** con **columna de ISIN**, y varias categorias por
  diapositiva en lugar de una por categoria.
- **Drawdown** añade una tabla con la caida maxima de cada serie y desde que año
  hay datos, porque no todas empiezan a la vez.
- **Asset allocation** con **donuts nativos** por perfil y sus pesos al lado, y
  los desgloses de divisa en cursiva.
- **Diapositiva final de informacion legal** (naturaleza del documento, origen de
  las cifras y advertencia), que no lleva numero de seccion a proposito: no es
  una septima seccion del informe.

Tamaños de referencia: un perfil da 18 diapositivas, los seis 23, y los seis con
benchmark 34 (Backtest y Drawdown salen una vez por perfil, como en el PDF).

**Detalles que conviene no deshacer:**

- Las tablas del informe van con `table-fixed` y `<colgroup>`: sin eso lo medido
  no coincide con lo impreso (ver seccion 4).
- Con tres perfiles o mas, el Backtest resume sus cifras en una tabla en vez de
  en tarjetas: seis perfiles en tarjetas eran media hoja.
- El grafico de retorno/riesgo sigue sin salir en el PDF (`{!isPrintMode && ...}`
  en `SectionRendimiento`).
- Un perfil ocupa 4 hojas y los seis, 6.

En el dialogo de imprimir hay que dejar los margenes en "Predeterminado": el
tamaño y los margenes los fija `@page`, y si se cambian a mano el contenido de
cada hoja deja de cuadrar con la hoja.

Para revisar la maqueta despues de tocarla, `node scripts/print-pdf.mjs` genera
el PDF con el mismo motor que el dialogo de imprimir, sin dar clics.
