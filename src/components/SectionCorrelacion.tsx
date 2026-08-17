import React, { useState, useEffect } from 'react';
import { PROFILES } from '../data/portfolioData';
import { useMonthlyReports } from '../hooks/useMonthlyReports';

/**
 * Color de una celda de la matriz.
 *
 * La escala va de casi blanco en -1 a rojo corporativo en +1, pasando por un
 * naranja apagado en 0. Se interpola en HSL y no en RGB por dos motivos:
 *
 *   - En RGB, mezclar un rojo oscuro con un crema claro pasa por marrones
 *     grisaceos: el tono se ensucia justo en la mitad de la escala, que es donde
 *     estan la mayoria de los datos. Manteniendo la saturacion alta en el centro
 *     (85%) el naranja intermedio sigue siendo un color y no un barro.
 *   - Asi la diferencia entre dos celdas la lleva sobre todo la luminosidad, que
 *     es la dimension que el ojo ordena mejor y la que sigue funcionando en una
 *     impresion en blanco y negro.
 *
 * Los tramos no son simetricos a proposito. Las correlaciones entre fondos de
 * una misma cartera se amontonan entre 0,3 y 0,9, asi que ese tramo se lleva
 * dos tercios del recorrido de luminosidad (76 -> 43) y el tramo negativo, casi
 * vacio, se queda en los claros (96 -> 76).
 */
const SCALE: { t: number; h: number; s: number; l: number }[] = [
  { t: 0, h: 18, s: 65, l: 96 },   // -1: casi blanco, con un punto de calido
  { t: 0.5, h: 24, s: 85, l: 76 }, //  0: naranja apagado
  { t: 1, h: 2, s: 74, l: 43 },    // +1: rojo corporativo, vivo pero no negro
];

/** Luminosidad por debajo de la cual el texto va en blanco. */
const LIGHT_TEXT_BELOW = 58;

function correlationHsl(val: number): { css: string; l: number } {
  const t = (Math.max(-1, Math.min(1, val)) + 1) / 2;

  let i = 0;
  while (i < SCALE.length - 2 && t > SCALE[i + 1].t) i++;
  const from = SCALE[i];
  const to = SCALE[i + 1];
  const k = (t - from.t) / (to.t - from.t);

  const mix = (a: number, b: number) => a + (b - a) * k;
  const l = mix(from.l, to.l);
  return { css: `hsl(${mix(from.h, to.h)}, ${mix(from.s, to.s)}%, ${l}%)`, l };
}

const cellStyle = (val: number): React.CSSProperties => {
  const { css, l } = correlationHsl(val);
  return { backgroundColor: css, color: l < LIGHT_TEXT_BELOW ? '#fff' : '#5b2317' };
};

/** La leyenda se dibuja con la misma funcion, para que no puedan separarse. */
const LEGEND_STOPS = [-1, -0.5, 0, 0.5, 1];
const legendGradient = `linear-gradient(to right, ${LEGEND_STOPS.map(
  (v, i) => `${correlationHsl(v).css} ${(i / (LEGEND_STOPS.length - 1)) * 100}%`
).join(', ')})`;

export const SectionCorrelacion: React.FC = () => {
  // Las matrices de la ultima subida; si no hay documento, las empaquetadas.
  const { correlations } = useMonthlyReports();
  const [activeProfile, setActiveProfile] = useState<string>('Moderado');

  useEffect(() => {
    const handleApply = (e: any) => {
      setActiveProfile(PROFILES[e.detail]);
    };
    window.addEventListener('apply-profile', handleApply);
    return () => window.removeEventListener('apply-profile', handleApply);
  }, []);

  // En el orden de la web, no en el que vengan las claves del documento.
  const available = PROFILES.filter((p) => correlations[p]?.labels?.length);
  const data = correlations[activeProfile];

  return (
    <section id="correlacion" className="pt-10 scroll-mt-28">
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          09
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Matriz de Correlación
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Correlación entre los fondos de la cartera seleccionada (1 año)
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm space-y-6">
        {/* Profile Toggles */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-zinc-100">
          {available.map((pName) => {
            const isActive = activeProfile === pName;
            return (
              <button
                key={pName}
                onClick={() => setActiveProfile(pName)}
                className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {pName}
              </button>
            );
          })}

          {/* Escala de color: sin ella los tonos solo se pueden comparar entre si. */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">-1</span>
            <div
              className="h-2.5 w-28 rounded-full border border-zinc-200 dark:border-zinc-700"
              style={{ background: legendGradient }}
              title="Escala de correlación"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">+1</span>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          {data ? (
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700"></th>
                  {data.labels.map((l: string, i: number) => (
                    <th key={i} className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium max-w-[80px] truncate" title={l}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row: number[], i: number) => (
                  <tr key={i}>
                    <td className="p-2 border-r border-zinc-100 font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-xs max-w-[200px] truncate" title={data.labels[i]}>
                      {i + 1}. {data.labels[i]}
                    </td>
                    {row.map((val: number, j: number) => (
                      <td key={j} className="p-0.5 border border-zinc-50 dark:border-zinc-800">
                        {j <= i ? (
                          <div
                            className="w-full h-full min-h-[28px] flex items-center justify-center font-mono font-bold rounded-sm"
                            style={cellStyle(val)}
                            title={`${data.labels[i]} / ${data.labels[j]}: ${val.toFixed(2)}`}
                          >
                            {i === j ? '—' : val.toFixed(2)}
                          </div>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">Datos no disponibles para este perfil.</div>
          )}
        </div>

        {/*
          El descargo va plegado, en segundo plano, igual que la composicion de
          los benchmarks en Rendimiento: quien ya sabe leer la matriz no lo
          necesita delante, y quien no, lo encuentra donde lo va a buscar.
        */}
        <details className="group text-xs">
          <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5 select-none opacity-80 hover:opacity-100 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 w-fit">
            <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
            Qué significa la correlación en esta tabla
          </summary>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 rounded-lg mt-2 ml-2 p-4 shadow-sm space-y-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              Cada celda mide <strong className="font-bold text-zinc-800 dark:text-zinc-200">en qué medida dos fondos de la
              cartera se han movido en la misma dirección</strong> durante el último año. Va de −1 a +1 y no dice nada sobre
              cuánto han ganado ni cuánto riesgo tienen: solo si suben y bajan a la vez.
            </p>

            <ul className="space-y-1">
              <li className="flex gap-2">
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 w-12 shrink-0">+1,00</span>
                <span>Se mueven igual. Tener los dos apenas diversifica.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 w-12 shrink-0">0,00</span>
                <span>No hay relación entre sus movimientos.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 w-12 shrink-0">−1,00</span>
                <span>Se mueven al revés: cuando uno sube, el otro baja.</span>
              </li>
            </ul>

            <p>
              <strong className="font-bold text-zinc-800 dark:text-zinc-200">Un ejemplo.</strong> Dos fondos de renta variable
              global suelen salir alrededor de 0,90: en un mal mes caen prácticamente lo mismo, así que repartir el dinero
              entre los dos no protege la cartera. Un fondo de renta fija de gobiernos frente a uno de bolsa suele salir
              mucho más bajo —cerca de 0 o negativo—, y ahí sí: cuando uno sufre, el otro amortigua.
            </p>

            <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
              Calculada sobre el último año de datos. Es una foto del pasado reciente, no una promesa: en las crisis las
              correlaciones tienden a subir y activos que parecían independientes caen juntos.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
};
