import type { MonthlyAttribution } from '../types';

export interface YtdSource {
  label: string;
  profiles: NonNullable<MonthlyAttribution['ytd']>;
}

/**
 * Busca, del mes mas reciente al mas antiguo, el primero que traiga el bloque
 * YTD con datos.
 *
 * No todos los meses lo traen: depende de si el Excel de ese mes se subio como
 * una pestaña por mes o como hoja unica (ver `contributorsProcessor.ts`), asi
 * que no basta con mirar el ultimo. La usan tanto la pestaña "Acumulado" de la
 * pantalla como la diapositiva de contribuidores del PowerPoint, para que las
 * dos enseñen siempre el mismo acumulado.
 */
export function findYtdSource(attributions: any[]): YtdSource | null {
  const source = attributions.find(
    (a) => a?.ytd && a.ytd.some((p: any) => p.contrib.length > 0 || p.detract.length > 0)
  );
  return source?.ytd ? { label: source.label, profiles: source.ytd } : null;
}
