/**
 * Filas de asset allocation que son el desglose de otra.
 *
 * En el bloque de divisas, "USD - directo" y "USD - indirecto" no son dos
 * exposiciones mas: son las dos mitades de la fila "USD", que ya esta arriba.
 * Sumadas con ella, el bloque parece dar el doble. Se marcan para poder
 * pintarlas distinto (en cursiva y sangradas) y que se vea de un vistazo que
 * cuelgan de la de encima.
 *
 * El criterio no es una lista de etiquetas escrita a mano: se busca el separador
 * y se comprueba que el trozo de la izquierda **sea** una fila anterior del
 * mismo bloque. Asi "Rating ESG · MSCI" no se marca (no hay ninguna fila que se
 * llame "Rating ESG") y si el libro estrenara un desglose de otra divisa
 * funcionaria solo.
 *
 * Lo usan la seccion de pantalla, la tabla del PDF y la del PowerPoint: si cada
 * una decidiera por su cuenta, el mismo dato saldria como desglose en un formato
 * y como fila independiente en otro.
 */
export function breakdownParent(label: unknown, previousLabels: string[]): string | null {
  const match = String(label ?? '').match(/^(.+?)\s+[-–—·]\s+(.+)$/);
  if (!match) return null;

  const parent = match[1].trim().toLowerCase();
  const found = previousLabels.find((l) => String(l).trim().toLowerCase() === parent);
  return found ?? null;
}
