/**
 * Nombres de las series del Excel VL de Morningstar ("VL - Carteras y Benchmarks").
 *
 * Los indices siguen el orden de PROFILES en portfolioData.ts, que es tambien el
 * orden de las claves de vlData.ts: "0".."5" son las carteras y "b0".."b5" sus
 * benchmarks.
 *
 * Estas listas estaban repetidas en scripts/generate-vldata.mjs, en
 * utils/performanceProcessor.ts y en SectionRendimiento.tsx. Tres copias de la
 * misma correspondencia perfil -> benchmark son tres sitios donde se puede
 * desalinear sin que nada falle: el grafico diria "BMK Agresivo" mientras pinta
 * la serie de otro indice.
 */

/** Serie de cada cartera, en el orden de PROFILES. */
export const PORTFOLIO_SERIES = [
  'Gestionada Conservadora +',
  'Gestionada Conservadora',
  'Gestionada Moderada',
  'Gestionada Equilibrada',
  'Gestionada Agresiva',
  'Gestionada Agresiva +',
];

/** Benchmark asignado a cada cartera, en el mismo orden. */
export const BENCHMARK_SERIES = [
  'EAA Fund EUR Diversified Bond - Short Term',
  'EAA Fund EUR Cautious Allocation - Global',
  'EAA Fund EUR Moderate Allocation - Global',
  'EAA Fund EUR Flexible Allocation - Global',
  'EAA Fund EUR Aggressive Allocation - Global',
  'MSCI World NR EUR',
];
