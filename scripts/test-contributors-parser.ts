/**
 * Prueba del parser de contribuidores contra el archivo real.
 * Uso: node scripts/test-contributors-parser.ts "<ruta xlsx>"
 */
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { processContributorsExcel } from '../src/utils/contributorsProcessor.ts';

const path = process.argv[2];
const file = new File([readFileSync(path)], basename(path));

const { blocks, warning } = await processContributorsExcel(file as any);
if (warning) console.log('AVISO:', warning, '\n');

const PROFILES = ['Conservador +', 'Conservador', 'Moderado', 'Equilibrado', 'Agresivo', 'Agresivo +'];

for (const [period, block] of Object.entries(blocks)) {
  console.log(`periodo: ${period}   etiqueta: ${block.label}`);
  console.log('');
  console.log('perfil           MES contrib/detract    YTD contrib/detract');
  block.data.forEach((p, i) => {
    const y = block.ytd?.[i];
    const mes = `${p.contrib.length}/${p.detract.length}`;
    const ytd = y ? `${y.contrib.length}/${y.detract.length}` : '-';
    console.log('  ' + PROFILES[i].padEnd(15) + mes.padEnd(22) + ytd);
  });

  console.log('\n  --- Moderado, mes, contribuidores ---');
  block.data[2].contrib.forEach((c) =>
    console.log(`    ${c.f.padEnd(42).slice(0, 42)} retorno ${String(c.r).padStart(7)}%  contrib ${String(c.c).padStart(6)}%`)
  );
  console.log('  --- Moderado, mes, detractores ---');
  block.data[2].detract.forEach((c) =>
    console.log(`    ${c.f.padEnd(42).slice(0, 42)} retorno ${String(c.r).padStart(7)}%  contrib ${String(c.c).padStart(6)}%`)
  );

  // Un contribuidor debe aportar en positivo y un detractor en negativo.
  const bad: string[] = [];
  block.data.forEach((p, i) => {
    p.contrib.forEach((c) => { if (c.c < 0) bad.push(`${PROFILES[i]}: contribuidor negativo ${c.f} (${c.c}%)`); });
    p.detract.forEach((c) => { if (c.c > 0) bad.push(`${PROFILES[i]}: detractor positivo ${c.f} (${c.c}%)`); });
  });
  console.log('\n  coherencia de signos:', bad.length === 0 ? 'OK' : `${bad.length} incoherencias`);
  bad.slice(0, 5).forEach((b) => console.log('    ' + b));
}
