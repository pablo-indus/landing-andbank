import { HISTORICAL_VL } from '../data/portfolioData';

/**
 * La simulacion del Backtest, aparte de la seccion que la dibuja.
 *
 * Vive aqui porque la usan dos caminos: `SectionBacktest` en pantalla y en el
 * PDF, y `pptExport` al generar el PowerPoint. Si cada uno llevara su propia
 * cuenta, el mismo informe daria un patrimonio final distinto segun se
 * exportara a un formato o a otro, que es exactamente el fallo que ya se
 * arreglo con las volatilidades (ver seccion 4 del plan).
 *
 * El modo stress test NO esta aqui: solo existe en pantalla, nunca sale en un
 * informe.
 */

/** Ultimo dia con datos. El mismo que usa la seccion. */
export const TODAY = '2026-06-30';

export interface Trajectory {
  dates: Date[];
  vals: number[];
  approx: boolean;
}

export function buildTrajectory(
  profileIdx: number,
  isBenchmark = false,
  // Las curvas llegan desde fuera: si estan en Firestore son las de la ultima
  // subida, y si no las empaquetadas. Antes se leia `HISTORICAL_VL` aqui dentro,
  // asi que esta seccion se quedaba con el cierre del ultimo despliegue pasara
  // lo que pasara en la base de datos.
  seriesByKey: typeof HISTORICAL_VL = HISTORICAL_VL
): Trajectory {
  // Las series reales de benchmark estan en las claves "b0".."b5",
  // una por perfil (ver scripts/generate-vldata.mjs).
  // Antes el benchmark no se leia: se inventaba a partir de la propia cartera
  // (valor * 0.9 mas una onda senoidal), por lo que nunca podia ser una
  // comparacion real.
  const seriesKey = isBenchmark ? `b${profileIdx}` : String(profileIdx);
  const rawData = (seriesByKey as any)[seriesKey];

  // Sin serie no se dibuja nada. Antes habia aqui un respaldo que reconstruia la
  // curva a partir de HISTORICAL_ANNUAL/HISTORICAL_MONTHLY, pero esas tablas
  // contenian cifras inventadas (cada ano era un mismo numero base multiplicado
  // por 1/2/3.5/5/7/9 segun el perfil). Es preferible no pintar nada a pintar
  // rentabilidades que no existieron.
  if (!rawData || rawData.length === 0) {
    return { dates: [], vals: [], approx: true };
  }

  const step = Math.ceil(rawData.length / 400);
  const points = rawData
    .filter((_: any, i: number) => i % step === 0 || i === rawData.length - 1)
    .map((pt: any) => ({ d: new Date(pt.d + 'T00:00:00Z'), val: pt.v }));

  return {
    dates: points.map((p: any) => p.d),
    vals: points.map((p: any) => p.val),
    approx: false,
  };
}

/** Valor liquidativo en una fecha, interpolado en logaritmos entre dos cierres. */
export function trajValue(traj: Trajectory, d: Date): number {
  const { dates, vals } = traj;
  if (d <= dates[0]) return vals[0];
  if (d >= dates[dates.length - 1]) return vals[vals.length - 1];
  for (let i = 0; i < dates.length - 1; i++) {
    if (d >= dates[i] && d <= dates[i + 1]) {
      const frac = (d.getTime() - dates[i].getTime()) / (dates[i + 1].getTime() - dates[i].getTime());
      const lv = Math.log(vals[i]) + frac * (Math.log(vals[i + 1]) - Math.log(vals[i]));
      return Math.exp(lv);
    }
  }
  return vals[vals.length - 1];
}

export interface BacktestParams {
  initialAmount: number;
  startDateStr: string;
  freq: 'none' | 'monthly' | 'quarterly';
  freqAmount: number;
  lumpDateStr: string;
  lumpAmount: number;
}

export interface BacktestResult {
  dates: string[];
  capitalSeries: number[];
  valueSeriesByProfile: Record<number, number[]>;
  totalCapital: number;
  finalValues: Record<number, number>;
}

/**
 * Compra participaciones en cada aportacion y las valora dia a dia.
 *
 * `indices` son las curvas a simular: los perfiles activos y, si procede, el
 * 999 reservado al benchmark. `trajectories` tiene que traer una entrada por
 * cada uno.
 */
export function simulateBacktest(
  params: BacktestParams,
  indices: number[],
  trajectories: Record<number, Trajectory>
): BacktestResult | null {
  const { initialAmount, startDateStr, freq, freqAmount, lumpDateStr, lumpAmount } = params;

  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  const today = new Date(TODAY);
  if (start > today) return null;

  const events: { d: Date; amount: number }[] = [{ d: start, amount: initialAmount }];
  if (freq !== 'none' && freqAmount > 0) {
    let d = new Date(start);
    while (true) {
      d =
        freq === 'monthly'
          ? new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())
          : new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
      if (d > today) break;
      events.push({ d: new Date(d), amount: freqAmount });
    }
  }
  if (lumpDateStr && lumpAmount > 0) {
    const ld = new Date(lumpDateStr);
    if (ld >= start && ld <= today) events.push({ d: ld, amount: lumpAmount });
  }
  events.sort((a, b) => a.d.getTime() - b.d.getTime());

  const resDates: string[] = [];
  const capitalSeries: number[] = [];
  let currentCapital = 0;

  const valueSeriesByProfile: Record<number, number[]> = {};
  const finalValues: Record<number, number> = {};
  const unitsByProfile: Record<number, number> = {};
  indices.forEach((pIdx) => {
    unitsByProfile[pIdx] = 0;
    valueSeriesByProfile[pIdx] = [];
  });

  const trajRef = trajectories[indices[0]];
  if (!trajRef || trajRef.dates.length === 0) return null;

  const datePoints = trajRef.dates.filter((d) => d >= start && d <= today);
  if (!datePoints.find((d) => d.getTime() === today.getTime())) datePoints.push(today);

  let eventIdx = 0;
  for (let i = 0; i < datePoints.length; i++) {
    const d = datePoints[i];
    while (eventIdx < events.length && events[eventIdx].d <= d) {
      const ev = events[eventIdx];
      currentCapital += ev.amount;
      indices.forEach((pIdx) => {
        const vl = trajValue(trajectories[pIdx], ev.d);
        unitsByProfile[pIdx] += ev.amount / vl;
      });
      eventIdx++;
    }
    resDates.push(d.toISOString().slice(0, 10));
    capitalSeries.push(currentCapital);

    indices.forEach((pIdx) => {
      const vl = trajValue(trajectories[pIdx], d);
      valueSeriesByProfile[pIdx].push(unitsByProfile[pIdx] * vl);
    });
  }

  indices.forEach((pIdx) => {
    finalValues[pIdx] = valueSeriesByProfile[pIdx][valueSeriesByProfile[pIdx].length - 1];
  });

  return { dates: resDates, capitalSeries, valueSeriesByProfile, totalCapital: currentCapital, finalValues };
}

export interface BacktestMetrics {
  finalValue: number;
  totalCapital: number;
  gain: number;
  gainPct: number;
  annualizedPct: number;
}

/** Cifras de un perfil: patrimonio final, plusvalia y TIR aproximada. */
export function backtestMetrics(
  sim: BacktestResult | null,
  pIdx: number,
  startDateStr: string
): BacktestMetrics {
  const finalValue = sim ? sim.finalValues[pIdx] ?? 0 : 0;
  const totalCapital = sim ? sim.totalCapital : 0;
  const gain = finalValue - totalCapital;
  const gainPct = totalCapital > 0 ? (gain / totalCapital) * 100 : 0;

  let annualizedPct = 0;
  if (totalCapital > 0 && startDateStr) {
    const startY = new Date(startDateStr).getFullYear();
    const endY = new Date(TODAY).getFullYear();
    const years = Math.max(
      1,
      endY - startY + (new Date(TODAY).getMonth() - new Date(startDateStr).getMonth()) / 12
    );
    annualizedPct = (Math.pow(finalValue / totalCapital, 1 / years) - 1) * 100;
  }

  return { finalValue, totalCapital, gain, gainPct, annualizedPct };
}
