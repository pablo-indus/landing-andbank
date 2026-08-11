/**
 * Rentabilidad y volatilidad de una serie de valor liquidativo.
 *
 * Lo usan dos caminos distintos y por eso vive aparte:
 *   - performanceProcessor.ts, al subir el Excel VL desde la web.
 *   - SectionRendimiento.tsx, calculando sobre el vlData.ts empaquetado cuando
 *     la base de datos aun no tiene el documento.
 * Si cada uno llevara su propia formula, el grafico cambiaria de cifras segun
 * hubiera o no documento en Firestore.
 */

export interface SeriesPoint {
  /** Fecha en formato "yyyy-mm-dd". */
  d: string;
  v: number;
}

export interface WindowStats {
  /** Rentabilidad del periodo, anualizada si pasa de un año. En %. Null si no hay historico. */
  ret: number | null;
  /** Volatilidad anualizada en %. Null si no hay historico. */
  vol: number | null;
}

/** Ultimo dia natural del mes "yyyy-mm". */
const lastDayOfMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/**
 * Cierres de fin de mes de una serie diaria, del mas antiguo al mas reciente.
 *
 * Las series de Morningstar traen todos los dias naturales, incluidos sabados y
 * domingos, asi que cada mes completo termina en su ultimo dia natural. El mes
 * final se descarta si no llega a ese dia: el archivo se corta cuando se exporta
 * (el ultimo fue el 15 de julio) y tomar medio mes como si fuera un mes entero
 * mete un dato corto en la serie de rentabilidades mensuales.
 */
export function toMonthEnds(series: SeriesPoint[]): { m: string; v: number }[] {
  if (!series?.length) return [];

  const lastOfMonth = new Map<string, SeriesPoint>();
  for (const point of series) lastOfMonth.set(point.d.slice(0, 7), point);

  const months = [...lastOfMonth.keys()].sort();
  const tail = months[months.length - 1];
  if (lastOfMonth.get(tail)!.d !== lastDayOfMonth(tail)) months.pop();

  return months.map((m) => ({ m, v: lastOfMonth.get(m)!.v }));
}

/**
 * Rentabilidad y volatilidad de los ultimos `months` meses de la serie.
 *
 * La volatilidad se calcula sobre rentabilidades MENSUALES (desviacion tipica
 * por raiz de 12), no sobre las diarias. No es una preferencia de estilo:
 * las series de benchmark del archivo VL estan interpoladas entre semana y fin
 * de semana (b0..b4 no repiten valor ni un solo dia en quince años, mientras que
 * las carteras repiten valor los ~1.500 fines de semana del periodo). Esa
 * interpolacion reparte el movimiento de un dia entre tres y hunde la desviacion
 * diaria: medido sobre la ventana de 3 años, el benchmark del perfil Agresivo da
 * 6,8% de volatilidad diaria frente a 9,1% mensual, mientras que en la cartera
 * ambos metodos coinciden (9,0% y 8,8%). Con el metodo diario todos los
 * benchmarks se irian a la izquierda del grafico y pareceria que las carteras
 * asumen mas riesgo que su indice, que es un artefacto del archivo.
 *
 * Sobre cierres de fin de mes la interpolacion no influye, y ademas coincide con
 * el criterio del libro AA, que tambien anualiza desde rentabilidades mensuales.
 */
export function windowStats(series: SeriesPoint[], months: number): WindowStats {
  const monthly = toMonthEnds(series);
  // Hacen falta `months` rentabilidades, es decir `months + 1` cierres.
  if (monthly.length < months + 1) return { ret: null, vol: null };

  const first = monthly[monthly.length - 1 - months].v;
  const last = monthly[monthly.length - 1].v;
  if (!first) return { ret: null, vol: null };

  const years = months / 12;
  const total = last / first - 1;
  const ret = years > 1 ? Math.pow(1 + total, 1 / years) - 1 : total;

  const rets: number[] = [];
  for (let i = monthly.length - months; i < monthly.length; i++) {
    const prev = monthly[i - 1].v;
    if (prev) rets.push(monthly[i].v / prev - 1);
  }
  if (rets.length < 2) return { ret: round(ret * 100), vol: null };

  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);

  return {
    ret: round(ret * 100),
    vol: round(Math.sqrt(variance) * Math.sqrt(12) * 100),
  };
}

const round = (v: number) => Number(v.toFixed(2));
