export type ProfileName = 
  | 'Conservador +'
  | 'Conservador'
  | 'Moderado'
  | 'Equilibrado'
  | 'Agresivo'
  | 'Agresivo +';

export interface ProfileKPI {
  name: ProfileName;
  color: string;
  p2025: number;
  p2026YTD: number;
  pJune: number;
  volatility: number;
}

export interface WindowData {
  cats: string[];
  values: (number | null)[][]; // [windowIndex][profileIndex]
}

export interface Movement {
  type: 'venta' | 'compra' | 'reduccion' | 'incremento';
  tag: string;
  instrument: string;
  meta: string;
}

export interface ChangeBatch {
  exits: Movement[];
  entries: Movement[];
  rationale: string;
}

export interface HistoricalChangeBlock {
  period: string;
  batches: ChangeBatch[];
}

export interface ContributorItem {
  f: string; // Fund name
  r: number; // Return %
  c: number; // Contribution %
}

export interface MonthlyAttribution {
  month: string;
  label: string;
  data: {
    contrib: ContributorItem[];
    detract: ContributorItem[];
  }[]; // Index corresponding to profileIndex (0..5)
}

export interface CompositionFundItem {
  name: string;
  isin: string;
  values: (number | null)[]; // 6 profile weights
}

export interface CompositionCategory {
  cat: string;
  totals: number[]; // 6 profile total weights
  items: CompositionFundItem[];
}

export interface CompositionSnapshot {
  period: string;
  label: string;
  categories: CompositionCategory[];
}

export interface AssetAllocationRow {
  label: string;
  isPct: boolean | null; // null for header row, true for %, false for number/string
  values: (number | string | null)[];
}

export interface AssetAllocationSnapshot {
  period: string;
  label: string;
  rows: AssetAllocationRow[];
}

/**
 * Matriz de correlaciones de un perfil.
 *
 * `matrix` es cuadrada y simetrica, con unos en la diagonal, aunque el archivo
 * de origen solo traiga el triangulo inferior y la seccion solo pinte ese.
 */
export interface CorrelationMatrix {
  labels: string[];
  matrix: number[][];
}

/**
 * Una fecha del Style Box: por perfil, [tamaño, estilo].
 *
 * El par va en ese orden porque es el que traia el archivo estatico y el que
 * espera `SectionStyleBox`: el primero es el eje Y (Small/Mid/Large) y el
 * segundo el eje X (Value/Core/Growth).
 */
export interface StyleBoxSnapshot {
  /** Fecha de la foto, "dd/mm/yyyy", tal y como se enseña en las pestañas. */
  date: string;
  /** "yyyy-mm-dd" para ordenar y para no repetir fecha entre subidas. */
  period: string;
  scores: Record<string, [number, number]>;
}

export interface CreditFundItem {
  name: string;
  isin: string;
  rating: string;
  ytw: number; // Yield to Worst %
  duration: number; // Years
  pctIG: number; // % Investment Grade
  pctHY: number; // % High Yield
  govies?: number | null;
  credito?: number | null;
  cash?: number | null;
  otros?: number | null;
  vola3y?: number | null;
}

export interface CreditLevelSnapshot {
  period: string;
  label: string;
  funds: CreditFundItem[];
}

export interface BacktestParams {
  profileIndex: number;
  initialAmount: number;
  startDate: string;
  frequency: 'none' | 'monthly' | 'quarterly';
  frequencyAmount: number;
  lumpSumDate?: string;
  lumpSumAmount?: number;
}

export interface BacktestResult {
  totalCapital: number;
  finalValue: number;
  gain: number;
  gainPct: number;
  annualizedPct: number | null;
  dates: string[];
  valueSeries: number[];
  capitalSeries: number[];
  isApproximate: boolean;
}
