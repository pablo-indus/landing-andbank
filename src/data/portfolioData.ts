import { generatedData } from './generatedData';
import { vlData } from './vlData';
import {
  ProfileKPI,
  WindowData,
  HistoricalChangeBlock,
  MonthlyAttribution,
  CompositionSnapshot,
  AssetAllocationSnapshot,
  CreditLevelSnapshot,
} from '../types';

export const PROFILES = [
  'Conservador +',
  'Conservador',
  'Moderado',
  'Equilibrado',
  'Agresivo',
  'Agresivo +',
] as const;

export const PROFILE_COLORS = [
  '#C9C3BB', // Conservador + (Light taupe)
  '#A59D93', // Conservador (Medium taupe)
  '#928B81', // Moderado (Dark taupe)
  '#B5443A', // Equilibrado (Terracotta red)
  '#D52B1E', // Agresivo (Primary Andbank red)
  '#7A1611', // Agresivo + (Dark burgundy)
];

export const PROFILE_KPIS: ProfileKPI[] = [
  {
    name: 'Conservador +',
    color: PROFILE_COLORS[0],
    p2025: 2.8,
    p2026YTD: 1.5,
    pJune: 0.5,
    volatility: 1.7,
  },
  {
    name: 'Conservador',
    color: PROFILE_COLORS[1],
    p2025: 4.2,
    p2026YTD: 2.3,
    pJune: 0.7,
    volatility: 2.3,
  },
  {
    name: 'Moderado',
    color: PROFILE_COLORS[2],
    p2025: 6.7,
    p2026YTD: 4.5,
    pJune: 0.8,
    volatility: 4.7,
  },
  {
    name: 'Equilibrado',
    color: PROFILE_COLORS[3],
    p2025: 9.4,
    p2026YTD: 5.8,
    pJune: 0.7,
    volatility: 6.3,
  },
  {
    name: 'Agresivo',
    color: PROFILE_COLORS[4],
    p2025: 11.9,
    p2026YTD: 7.8,
    pJune: 0.5,
    volatility: 7.2,
  },
  {
    name: 'Agresivo +',
    color: PROFILE_COLORS[5],
    p2025: 15.1,
    p2026YTD: 10.7,
    pJune: 1.4,
    volatility: 9.7,
  },
];

export const WINDOWS_DATA: WindowData = {
  cats: ['1 año', '2 años', '3 años', '4 años', '5 años', 'Desde 2009'],
  values: [
    [3.67, 5.59, 9.85, 13.42, 18.10, 20.94], // 1 año
    [4.07, 5.32, 7.46, 9.58, 12.13, 13.59],  // 2 años
    [4.71, 5.72, 7.49, 9.22, 11.34, 12.82],  // 3 años
    [3.95, 4.98, 6.75, 8.29, 10.09, 11.63],  // 4 años
    [2.25, 2.75, 4.30, 5.07, 6.06, 6.77],  // 5 años
    [null, 2.47, 3.77, 5.31, 6.04, null],  // Desde 2009
  ],
};

const cleanName = (n: string): string => {
    if (!n) return n;
    let cleaned = n.trim()
      .replace(/\s+FI$/i, '')
      .replace(/\s+F\.I\.$/i, '')
      .replace(/\s+I$/i, '')
      .replace(/\s+EUR\s+Acc$/i, '');
      
    // Specific typo/name merges
    if (cleaned.match(/MERCHBANC FCP - Merchfondo/i)) {
      cleaned = 'MERCHFONDO';
    }
    
    return cleaned.trim();
};

const cleanCompositionSnapshots = (snapshots: any[]) => {
    const cleaned = snapshots.map(snap => {
        const cleanedCategories = snap.categories.map((catGroup: any) => {
            const mergedItems = new Map();
            catGroup.items.forEach((item: any) => {
                const cName = cleanName(item.name);
                if (!mergedItems.has(cName)) {
                    mergedItems.set(cName, { ...item, name: cName, values: [...item.values] });
                } else {
                    const existing = mergedItems.get(cName);
                    for (let i = 0; i < existing.values.length; i++) {
                        if (item.values[i] !== null && item.values[i] !== undefined && item.values[i] !== 0) {
                            existing.values[i] = (existing.values[i] || 0) + item.values[i];
                        }
                    }
                    if (item.isin && !existing.isin) {
                        existing.isin = item.isin;
                    }
                }
            });
            return {
                ...catGroup,
                items: Array.from(mergedItems.values())
            };
        });
        return {
            ...snap,
            categories: cleanedCategories
        };
    });
    
    // Backfill from oldest (last) to newest (first)
    for (let i = cleaned.length - 2; i >= 0; i--) {
        const currentSnap = cleaned[i];
        const olderSnap = cleaned[i + 1];
        
        for (let p = 0; p < 6; p++) {
            let currentTotal = 0;
            currentSnap.categories.forEach((cat: any) => {
                if (cat.totals[p]) currentTotal += cat.totals[p];
            });
            
            if (currentTotal === 0 || currentTotal === null) {
                // Profile is missing, backfill from olderSnap
                olderSnap.categories.forEach((olderCat: any) => {
                    if (olderCat.totals[p] > 0) {
                        let currentCat = currentSnap.categories.find((c: any) => c.cat === olderCat.cat);
                        if (!currentCat) {
                            currentCat = { cat: olderCat.cat, totals: [0,0,0,0,0,0], items: [] };
                            currentSnap.categories.push(currentCat);
                        }
                        
                        currentCat.totals[p] = olderCat.totals[p];
                        
                        olderCat.items.forEach((olderItem: any) => {
                            if (olderItem.values[p] && olderItem.values[p] > 0) {
                                let currentItem = currentCat.items.find((it: any) => it.name === olderItem.name);
                                if (!currentItem) {
                                    currentItem = { name: olderItem.name, isin: olderItem.isin, values: [null,null,null,null,null,null] };
                                    currentCat.items.push(currentItem);
                                }
                                currentItem.values[p] = olderItem.values[p];
                            }
                        });
                    }
                });
            }
        }
    }
    return cleaned;
};

const cleanAttributions = (attrs: any[]) => {
    return attrs.map(attr => {
        const newData = attr.data.map((profileData: any) => {
            if (!profileData) return profileData;
            return {
                contrib: profileData.contrib.map((i: any) => ({ ...i, f: cleanName(i.f) })),
                detract: profileData.detract.map((i: any) => ({ ...i, f: cleanName(i.f) }))
            };
        });
        return { ...attr, data: newData };
    });
};

const cleanChanges = (changes: any[]) => {
  return changes.map(change => {
    const mergedBatches = [];
    
    change.batches.forEach(b => {
      let existingBatch = mergedBatches.find(mb => mb.rationale === b.rationale);
      if (!existingBatch) {
        existingBatch = { rationale: b.rationale, entries: [], exits: [] };
        mergedBatches.push(existingBatch);
      }

      const mergeMovements = (list, item) => {
        // Group by type, tag, meta. If they match, combine the instruments.
        let existing = list.find(e => e.type === item.type && e.tag === item.tag && e.meta === item.meta);
        if (existing) {
          if (!existing.instrument.includes(item.instrument)) {
            existing.instrument += ' / ' + item.instrument;
          }
        } else {
          list.push({ ...item });
        }
      };

      // wait, what if meta is different but instrument is the same?
      // "en algún momento del histórico, cambia como se presentan los datos de a que clase de perfil de riesgo afectan los cambios y se repite la modificación para todos aquellos fondos a los que afecta, en lugar de representar el cambio una única vez y nombrar todos los fondos afectados"
      // Actually, if we group by (rationale, type, tag) and merge instruments AND merge metas, that might be what they mean!

      const mergeMovementsByInstrument = (list, item) => {
        let existing = list.find(e => e.type === item.type && e.tag === item.tag && e.instrument === item.instrument);
        if (existing) {
          if (item.meta && !existing.meta.includes(item.meta)) {
            existing.meta = existing.meta ? existing.meta + ' ' + item.meta : item.meta;
          }
        } else {
          list.push({ ...item });
        }
      };

      // First pass: merge identical instruments but different metas
      const tempEntries = [];
      const tempExits = [];
      b.entries.forEach(e => mergeMovementsByInstrument(tempEntries, e));
      b.exits.forEach(e => mergeMovementsByInstrument(tempExits, e));

      // Second pass: merge identical (type, tag, meta) but different instruments
      tempEntries.forEach(e => mergeMovements(existingBatch.entries, e));
      tempExits.forEach(e => mergeMovements(existingBatch.exits, e));
    });

    return {
      ...change,
      batches: mergedBatches
    };
  });
};

export const HISTORICAL_CHANGES: HistoricalChangeBlock[] = cleanChanges(generatedData.historicalChanges).reverse() as HistoricalChangeBlock[];

export const MONTHLY_ATTRIBUTIONS: MonthlyAttribution[] = cleanAttributions(generatedData.monthlyAttributions) as MonthlyAttribution[];

export const COMPOSITION_SNAPSHOTS: CompositionSnapshot[] = cleanCompositionSnapshots(generatedData.compositionSnapshots) as CompositionSnapshot[];

export const ASSET_ALLOCATION_SNAPSHOTS: AssetAllocationSnapshot[] = [
  {
    period: 'julio_2026',
    label: 'Actual (Julio 2026)',
    rows: [
      { label: 'Distribución de activos', isPct: null, values: [] },
      { label: 'Monetario', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'Renta Fija', isPct: true, values: [100.0, 89.0, 59.1, 39.4, 16.8, null] },
      { label: 'Renta Variable', isPct: true, values: [null, 9.0, 37.9, 57.1, 81.2, 100.0] },
      { label: 'Alternativos', isPct: true, values: [null, 2.0, 3.0, 3.5, 2.0, null] },
      { label: 'Renta Variable · geografía', isPct: null, values: [] },
      { label: 'RV Europa', isPct: true, values: [null, 16.7, 10.6, 9.1, 8.7, 8.8] },
      { label: 'RV US', isPct: true, values: [null, 13.9, 14.8, 22.7, 25.0, 24.0] },
      { label: 'RV Global', isPct: true, values: [null, 52.8, 52.8, 48.3, 45.5, 44.4] },
      { label: 'RV Temática', isPct: true, values: [null, 5.6, 13.9, 12.9, 14.7, 14.3] },
      { label: 'RV EM', isPct: true, values: [null, 11.1, 7.9, 7.0, 6.2, 8.5] },
      { label: 'RV Japón', isPct: true, values: [null, 0.0, 0.0, 0.0, 0.0, 0.0] },
      { label: 'Divisas', isPct: null, values: [] },
      { label: 'EUR', isPct: true, values: [93.7, 93.1, 83.8, 78.9, 69.4, 63.7] },
      { label: 'USD', isPct: true, values: [6.3, 6.9, 16.2, 21.1, 30.6, 36.3] },
      { label: 'USD - directo', isPct: true, values: [6.0, 5.0, 3.3, null, null, null] },
      { label: 'USD - indirecto', isPct: true, values: [0.3, 1.9, 13.0, 21.1, 30.6, 36.3] },
      { label: 'GBP', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'JPY', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'Renta fija · métricas', isPct: null, values: [] },
      { label: 'Duración cartera', isPct: false, values: [3.3, 3.3, 3.7, 4.2, 4.6, null] },
      { label: 'Rating medio', isPct: false, values: ['BBB+', 'BBB+', 'BBB+', 'BBB', 'BBB', null] },
      { label: 'TIR', isPct: true, values: [4.3, 4.3, 4.5, 4.7, 5.0, null] },
      { label: 'Sostenibilidad', isPct: null, values: [] },
      { label: 'Rating ESG · MSCI', isPct: false, values: ['A', 'A', 'A', 'A', 'A', 'A'] },
    ],
  },
  {
    period: 'marzo_2026',
    label: 'Marzo 2026',
    rows: [
      { label: 'Distribución de activos', isPct: null, values: [] },
      { label: 'Monetario', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'Renta Fija', isPct: true, values: [100.0, 89.0, 60.5, 40.5, 17.5, null] },
      { label: 'Renta Variable', isPct: true, values: [null, 9.0, 36.5, 56.0, 80.5, 100.0] },
      { label: 'Alternativos', isPct: true, values: [null, 2.0, 3.0, 3.5, 2.0, null] },
      { label: 'Renta Variable · geografía', isPct: null, values: [] },
      { label: 'RV Europa', isPct: true, values: [null, 22.2, 11.6, 8.8, 9.3, 9.8] },
      { label: 'RV US', isPct: true, values: [null, 11.1, 12.3, 20.5, 23.6, 23.0] },
      { label: 'RV Global', isPct: true, values: [null, 44.4, 48.6, 45.5, 43.5, 42.0] },
      { label: 'RV Temática', isPct: true, values: [null, 5.6, 13.7, 12.5, 14.3, 13.8] },
      { label: 'RV EM (inc. India)', isPct: true, values: [null, 16.7, 13.8, 12.7, 9.3, 11.4] },
      { label: 'RV Japón', isPct: true, values: [null, 0.0, 0.0, 0.0, 0.0, 0.0] },
      { label: 'Divisas', isPct: null, values: [] },
      { label: 'EUR', isPct: true, values: [94.0, 93.5, 84.5, 79.5, 70.2, 64.5] },
      { label: 'USD', isPct: true, values: [6.0, 6.5, 15.5, 20.5, 29.8, 35.5] },
      { label: 'USD - directo', isPct: true, values: [6.0, 5.0, 3.25, null, null, null] },
      { label: 'USD - indirecto', isPct: true, values: [0.0, 1.5, 12.25, 20.5, 29.8, 35.5] },
      { label: 'GBP', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'JPY', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'Renta fija · métricas', isPct: null, values: [] },
      { label: 'Duración cartera', isPct: false, values: [3.1, 3.2, 3.5, 4.0, 4.4, null] },
      { label: 'Rating medio', isPct: false, values: ['BBB+', 'BBB+', 'BBB+', 'BBB+', 'BBB', null] },
      { label: 'TIR', isPct: true, values: [4.1, 4.15, 4.35, 4.55, 4.85, null] },
      { label: 'Sostenibilidad', isPct: null, values: [] },
      { label: 'Rating ESG · MSCI', isPct: false, values: ['A', 'A', 'A', 'A', 'A', 'A'] },
    ],
  },
  {
    period: 'enero_2026',
    label: 'Enero 2026',
    rows: [
      { label: 'Distribución de activos', isPct: null, values: [] },
      { label: 'Monetario', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'Renta Fija', isPct: true, values: [100.0, 89.0, 61.5, 41.5, 18.0, null] },
      { label: 'Renta Variable', isPct: true, values: [null, 8.25, 34.13, 53.0, 80.0, 98.0] },
      { label: 'Commodities (Oro)', isPct: true, values: [null, 0.75, 1.37, 2.0, 0.0, 2.0] },
      { label: 'Alternativos', isPct: true, values: [null, 2.0, 3.0, 3.5, 2.0, null] },
      { label: 'Renta Variable · geografía', isPct: null, values: [] },
      { label: 'RV Europa', isPct: true, values: [null, 24.2, 12.5, 9.5, 9.4, 10.0] },
      { label: 'RV US', isPct: true, values: [null, 12.1, 9.5, 15.6, 20.6, 21.4] },
      { label: 'RV Global', isPct: true, values: [null, 39.4, 49.2, 47.6, 45.6, 43.4] },
      { label: 'RV Temática', isPct: true, values: [null, 6.1, 14.6, 13.8, 14.8, 14.1] },
      { label: 'RV EM (inc. India)', isPct: true, values: [null, 18.2, 14.2, 13.5, 9.6, 11.1] },
      { label: 'RV Japón', isPct: true, values: [null, 0.0, 0.0, 0.0, 0.0, 0.0] },
      { label: 'Divisas', isPct: null, values: [] },
      { label: 'EUR', isPct: true, values: [94.0, 94.0, 86.0, 81.0, 72.0, 66.0] },
      { label: 'USD', isPct: true, values: [6.0, 6.0, 14.0, 19.0, 28.0, 34.0] },
      { label: 'USD - directo', isPct: true, values: [6.0, 5.0, 3.25, null, null, null] },
      { label: 'USD - indirecto', isPct: true, values: [0.0, 1.0, 10.75, 19.0, 28.0, 34.0] },
      { label: 'GBP', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'JPY', isPct: true, values: [null, null, null, null, null, null] },
      { label: 'Renta fija · métricas', isPct: null, values: [] },
      { label: 'Duración cartera', isPct: false, values: [3.0, 3.0, 3.4, 3.8, 4.2, null] },
      { label: 'Rating medio', isPct: false, values: ['BBB+', 'BBB+', 'A-', 'BBB+', 'BBB', null] },
      { label: 'TIR', isPct: true, values: [3.95, 4.0, 4.2, 4.4, 4.7, null] },
      { label: 'Sostenibilidad', isPct: null, values: [] },
      { label: 'Rating ESG · MSCI', isPct: false, values: ['A', 'A', 'A', 'A', 'A', 'A'] },
    ],
  },
];

const cleanCreditLevels = (snapshots: any[]) => {
    return snapshots.map(snap => ({
        ...snap,
        funds: snap.funds.map((f: any) => ({ ...f, name: cleanName(f.name) }))
    }));
};
export const CREDIT_LEVEL_SNAPSHOTS: CreditLevelSnapshot[] = cleanCreditLevels(generatedData.creditLevelSnapshots) as CreditLevelSnapshot[];

export const HISTORICAL_ANNUAL: Record<number, number[]> = {
  2009: [3.00, 6.00, 10.50, 15.00, 21.00, 27.00],
  2010: [1.60, 3.20, 5.60, 8.00, 11.20, 14.40],
  2011: [-0.40, -0.80, -1.40, -2.00, -2.80, -3.60],
  2012: [2.00, 4.00, 7.00, 10.00, 14.00, 18.00],
  2013: [2.80, 5.60, 9.80, 14.00, 19.60, 25.20],
  2014: [1.20, 2.40, 4.20, 6.00, 8.40, 10.80],
  2015: [0.20, 0.40, 0.70, 1.00, 1.40, 1.80],
  2016: [1.00, 2.00, 3.50, 5.00, 7.00, 9.00],
  2017: [1.80, 3.60, 6.30, 9.00, 12.60, 16.20],
  2018: [-1.00, -2.00, -3.50, -5.00, -7.00, -9.00],
  2019: [3.20, 6.40, 11.20, 16.00, 22.40, 28.80],
  2020: [2.40, 4.80, 8.40, 12.00, 16.80, 21.60],
};

export const HISTORICAL_MONTHLY: Record<number, number[][]> = {
  2021: [
    [0.10, 0.20, 0.35, 0.50, 0.70, 0.90],
    [0.24, 0.48, 0.84, 1.20, 1.68, 2.16],
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
    [0.06, 0.12, 0.21, 0.30, 0.42, 0.54],
    [0.22, 0.44, 0.77, 1.10, 1.54, 1.98],
    [0.16, 0.32, 0.56, 0.80, 1.12, 1.44],
    [0.26, 0.52, 0.91, 1.30, 1.82, 2.34],
    [-0.50, -1.00, -1.75, -2.50, -3.50, -4.50],
    [0.68, 1.36, 2.38, 3.40, 4.76, 6.12],
    [-0.16, -0.32, -0.56, -0.80, -1.12, -1.44],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
  ],
  2022: [
    [-0.60, -1.20, -2.10, -3.00, -4.20, -5.40],
    [-0.30, -0.60, -1.05, -1.50, -2.10, -2.70],
    [0.20, 0.40, 0.70, 1.00, 1.40, 1.80],
    [-1.04, -2.08, -3.64, -5.20, -7.28, -9.36],
    [0.10, 0.20, 0.35, 0.50, 0.70, 0.90],
    [-1.22, -2.44, -4.27, -6.10, -8.54, -10.98],
    [0.84, 1.68, 2.94, 4.20, 5.88, 7.56],
    [-0.60, -1.20, -2.10, -3.00, -4.20, -5.40],
    [-1.30, -2.60, -4.55, -6.50, -9.10, -11.70],
    [0.70, 1.40, 2.45, 3.50, 4.90, 6.30],
    [0.82, 1.64, 2.87, 4.10, 5.74, 7.38],
    [-0.84, -1.68, -2.94, -4.20, -5.88, -7.56],
  ],
  2023: [
    [0.90, 1.80, 3.15, 4.50, 6.30, 8.10],
    [-0.30, -0.60, -1.05, -1.50, -2.10, -2.70],
    [0.44, 0.88, 1.54, 2.20, 3.08, 3.96],
    [0.20, 0.40, 0.70, 1.00, 1.40, 1.80],
    [-0.10, -0.20, -0.35, -0.50, -0.70, -0.90],
    [0.84, 1.68, 2.94, 4.20, 5.88, 7.56],
    [0.42, 0.84, 1.47, 2.10, 2.94, 3.78],
    [-0.30, -0.60, -1.05, -1.50, -2.10, -2.70],
    [-0.70, -1.40, -2.45, -3.50, -4.90, -6.30],
    [-0.30, -0.60, -1.05, -1.50, -2.10, -2.70],
    [1.30, 2.60, 4.55, 6.50, 9.10, 11.70],
    [0.80, 1.60, 2.80, 4.00, 5.60, 7.20],
  ],
  2024: [
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.64, 1.28, 2.24, 3.20, 4.48, 5.76],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
    [-0.50, -1.00, -1.75, -2.50, -3.50, -4.50],
    [0.70, 1.40, 2.45, 3.50, 4.90, 6.30],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
    [-0.10, -0.20, -0.35, -0.50, -0.70, -0.90],
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.20, 0.40, 0.70, 1.00, 1.40, 1.80],
    [-0.10, -0.20, -0.35, -0.50, -0.70, -0.90],
    [0.90, 1.80, 3.15, 4.50, 6.30, 8.10],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
  ],
  2025: [
    [0.40, 0.80, 1.40, 2.00, 2.80, 3.60],
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.24, 0.48, 0.84, 1.20, 1.68, 2.16],
    [-0.20, -0.40, -0.70, -1.00, -1.40, -1.80],
    [0.36, 0.72, 1.26, 1.80, 2.52, 3.24],
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.44, 0.88, 1.54, 2.20, 3.08, 3.96],
    [-0.30, -0.60, -1.05, -1.50, -2.10, -2.70],
    [-0.40, -0.80, -1.40, -2.00, -2.80, -3.60],
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
  ],
  2026: [
    [0.30, 0.60, 1.05, 1.50, 2.10, 2.70],
    [0.42, 0.84, 1.47, 2.10, 2.94, 3.78],
    [0.36, 0.72, 1.26, 1.80, 2.52, 3.24],
    [-0.30, -0.60, -1.05, -1.50, -2.10, -2.70],
    [0.50, 1.00, 1.75, 2.50, 3.50, 4.50],
    [0.28, 0.56, 0.98, 1.40, 1.96, 2.52],
  ],
};

export const HISTORICAL_VL = vlData;
