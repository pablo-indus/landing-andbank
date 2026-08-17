/**
 * Color de cada clase de activo en los informes.
 *
 * Lo comparten el PDF (`printBlocks`) y el PowerPoint (`pptExport`): son el
 * mismo documento en dos formatos, asi que un donut no puede pintar la renta
 * variable de un rojo en uno y de otro en el otro. La pantalla mantiene su
 * paleta, mas clara, porque va sobre fondo blanco o negro segun el tema.
 *
 * Se devuelve sin almohadilla y con almohadilla porque pptxgenjs quiere
 * "E32119" y el navegador "#E32119".
 */
const RULES: { match: string; hex: string }[] = [
  { match: 'monetario', hex: '121212' },
  { match: 'fija', hex: 'D8D4CE' },
  { match: 'variable', hex: 'E32119' },
  { match: 'commodities', hex: 'D4C77E' },
  { match: 'oro', hex: 'D4C77E' },
  { match: 'alternativos', hex: '7A1611' },
];

const FALLBACK = '9CA3AF';

/** Sin almohadilla, como lo quiere pptxgenjs. */
export function allocationColorHex(label: string): string {
  const l = String(label ?? '').toLowerCase();
  return RULES.find((r) => l.includes(r.match))?.hex ?? FALLBACK;
}

/** Con almohadilla, como lo quiere el navegador. */
export const allocationColor = (label: string): string => `#${allocationColorHex(label)}`;
