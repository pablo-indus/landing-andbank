/*
  Genera el PowerPoint fuera del navegador y lo cuenta por dentro.

  Es la unica forma de comprobar la maqueta sin dar clics: `buildPresentation`
  escribe el archivo con pptxgenjs, que en Node guarda en disco. Se ejecuta
  empaquetando antes con esbuild, porque el modulo importa rutas sin extension
  (ver seccion 7 del plan).

    npx esbuild scripts/check-ppt.mts --bundle --platform=node --format=esm \
      --outfile=scripts/.check-ppt.mjs && node scripts/.check-ppt.mjs
*/
import { buildPresentation } from '../src/utils/pptExport';
import {
  WINDOWS_DATA,
  COMPOSITION_SNAPSHOTS,
  ASSET_ALLOCATION_SNAPSHOTS,
  HISTORICAL_VL,
  MONTHLY_ATTRIBUTIONS,
} from '../src/data/portfolioData';
import { BENCHMARK_SERIES } from '../src/data/vlSeries';

const profilesArg = (process.argv[2] ?? '0,1,2,3,4,5').split(',').map(Number);
const withBenchmark = process.argv[3] === 'bench';

await buildPresentation({
  profiles: profilesArg,
  withBenchmark,
  coverDateLabel: 'Julio 2026',
  windows: WINDOWS_DATA as any,
  attribution: (MONTHLY_ATTRIBUTIONS as any)?.[0] ?? null,
  composition: COMPOSITION_SNAPSHOTS[0] as any,
  assetAllocation: ASSET_ALLOCATION_SNAPSHOTS[0] as any,
  vlSeries: HISTORICAL_VL as any,
  benchmarkNames: BENCHMARK_SERIES,
  logo: null,
});

console.log('escrito');
