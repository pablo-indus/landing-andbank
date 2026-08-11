import React from 'react';

interface HeroProps {
  /** Fecha real de los datos publicados. Llega desde `App`, que ya la tiene. */
  lastUpdated: Date | null;
}

/*
  Cabecera de portada.

  Ha pasado por dos versiones malas. La primera llevaba dos rectangulos girados y
  translucidos cruzando el fondo y la fecha escrita a mano. La segunda quito los
  rectangulos pero amontono tres recursos rojos —banda superior, pastilla con
  borde y barra vertical junto al titulo— y con tanto adorno seguia sin parecer
  un documento serio.

  Aqui el rojo aparece una sola vez, en un filete corto sobre el antetitulo, que
  es el recurso de toda la vida de una portada corporativa. Lo demas lo hacen la
  jerarquia y el espacio.
*/
export const Hero: React.FC<HeroProps> = ({ lastUpdated }) => {
  // Mes y año por separado: pidiendolos juntos, el español intercala un "de"
  // ("agosto de 2026") que no encaja en una etiqueta de dos palabras.
  const month = lastUpdated?.toLocaleDateString('es-ES', { month: 'long' });
  const period = month
    ? `${month.charAt(0).toUpperCase()}${month.slice(1)} ${lastUpdated!.getFullYear()}`
    : null;

  return (
    <div className="bg-ink text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-14 lg:pb-20">
        <div className="w-8 h-0.5 bg-brand mb-5" />

        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Mandatos Portfolio Funds (&lt;1MM €)
          {period && <span className="text-zinc-600"> · Cierre {period}</span>}
        </p>

        <h1 className="mt-3 text-[1.75rem] sm:text-[2.1rem] lg:text-[2.4rem] font-semibold tracking-tight leading-[1.15] max-w-3xl">
          Rentabilidades y Asset Allocation
        </h1>

        <p className="mt-4 text-[13px] sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
          Seguimiento interactivo de los seis perfiles de Mandatos Portfolio Funds. Analiza
          rentabilidades, realiza simulaciones de backtest y revisa la composición y métricas de
          cada cartera.
        </p>
      </div>
    </div>
  );
};
