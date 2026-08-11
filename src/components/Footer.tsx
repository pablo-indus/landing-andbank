import React from 'react';

interface FooterProps {
  /** Fecha real de los datos publicados. Llega desde `App`, que ya la tiene. */
  lastUpdated: Date | null;
}

/*
  Pie corporativo: identidad a la izquierda, nota legal a la derecha y una linea
  de cierre debajo.

  La version anterior repartia la informacion en tres columnas con rotulos rojos
  ("ALCANCE DEL DOCUMENTO", "DATOS") y una lista de pares etiqueta-valor
  alineados a los extremos. Parecia un panel de metricas inventado; un pie de
  banco es texto corrido, pequeño y sin color.

  El cierre de datos ya no va escrito a mano —antes decia "Julio 2026" a pelo, y
  en agosto seguia diciendo julio—. Si no hay fecha, porque la base de datos no
  responde y la web tira de los datos empaquetados, no se escribe ninguna:
  inventar un cierre es peor que no darlo.

  Los textos legales son los mismos que firman las hojas del informe PDF
  (`PrintReportLayout`), para que la web y el documento digan lo mismo.
*/
export const Footer: React.FC<FooterProps> = ({ lastUpdated }) => {
  // Mes y año por separado: pidiendolos juntos, el español intercala un "de"
  // ("agosto de 2026") que no encaja en una etiqueta de dos palabras.
  const month = lastUpdated?.toLocaleDateString('es-ES', { month: 'long' });
  const closeDate = month
    ? `${month.charAt(0).toUpperCase()}${month.slice(1)} ${lastUpdated!.getFullYear()}`
    : null;

  return (
    <footer className="mt-16 border-t-2 border-brand bg-ink text-zinc-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
        <div className="flex items-start gap-5 shrink-0">
          {/*
            Aqui va siempre la version en blanco sobre fondo transparente
            (`logo-knockout.png`, generada desde el propio JPG), no el JPG con
            una variante `dark:`. El pie es negro en los dos temas, asi que
            atarlo al modo oscuro dejaba el JPG —que trae su fondo blanco
            incrustado— pegado sobre el negro en modo claro, con el mismo aspecto
            de pegatina que se queria quitar.
          */}
          <img
            src="/logo-knockout.png"
            alt="Andbank"
            className="h-9 object-contain shrink-0"
          />

          <div className="border-l border-zinc-800 pl-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-200">
              Wealth Management SGIIC
            </p>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Mandatos Portfolio Funds (&lt;1MM €) · Informe ante Clientes
            </p>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-zinc-500 max-w-md lg:text-right">
          Documento ilustrativo de uso profesional exclusivo. Retornos netos de comisiones. Las
          rentabilidades pasadas no garantizan rentabilidades futuras.
          {closeDate && ` Datos cerrados a ${closeDate}.`}
        </p>
      </div>

      <div className="border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-zinc-600">
          <p className="uppercase tracking-[0.12em]">Navegando hacia un objetivo común</p>
          <p>© {new Date().getFullYear()} Andbank</p>
        </div>
      </div>
    </footer>
  );
};
