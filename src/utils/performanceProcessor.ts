import * as XLSX from 'xlsx';

export interface PerformanceDB {
  [profile: string]: {
    returns: Record<string, number | null>;
    volatilities: Record<string, number | null>;
    benchmark: {
      name: string;
      returns: Record<string, number | null>;
      volatilities: Record<string, number | null>;
    };
  };
}

const MAPPING = [
  { profile: "Conservador +", bmkName: "EAA Fund EUR Diversified Bond - Short Term", portIdx: 0, bmkIdx: 1 },
  { profile: "Conservador", bmkName: "EAA Fund EUR Cautious Allocation - Global", portIdx: 2, bmkIdx: 3 },
  { profile: "Moderado", bmkName: "EAA Fund EUR Moderate Allocation - Global", portIdx: 4, bmkIdx: 5 },
  { profile: "Equilibrado", bmkName: "EAA Fund EUR Flexible Allocation - Global", portIdx: 6, bmkIdx: 7 },
  { profile: "Agresivo", bmkName: "EAA Fund EUR Aggressive Allocation - Global", portIdx: 8, bmkIdx: 9 },
  { profile: "Agresivo +", bmkName: "MSCI World NR EUR", portIdx: 10, bmkIdx: 11 }
];

export async function processPerformanceExcel(file: File): Promise<PerformanceDB> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', raw: true });
        
        const outputDb: PerformanceDB = {};
        
        // Función para extraer una serie de fechas y valores de una hoja
        const extractSeries = (sheetName: string) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any>(sheet, { raw: true });
          const series: { date: Date, val: number }[] = [];
          
          rows.forEach(row => {
            const keys = Object.keys(row);
            const dateKey = keys.find(k => String(k).toLowerCase() === 'date');
            const valKey = keys.find(k => k !== dateKey);
            if (!dateKey || !valKey) return;
            
            let dateObj: Date | null = null;
            if (typeof row[dateKey] === 'number') {
              dateObj = new Date(Math.round((row[dateKey] - 25569) * 86400 * 1000));
            } else if (typeof row[dateKey] === 'string') {
              const parts = row[dateKey].split('/');
              if (parts.length === 3) dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
            
            let valNum = typeof row[valKey] === 'number' ? row[valKey] : parseFloat(String(row[valKey]).replace(/\./g, '').replace(',', '.'));
            
            if (dateObj && !isNaN(valNum)) series.push({ date: dateObj, val: valNum });
          });
          return series.sort((a, b) => a.date.getTime() - b.date.getTime());
        };

        // Extraemos TODAS las fechas para saber cuál es el último día disponible en el Excel
        let allDates: number[] = [];
        MAPPING.forEach(m => {
          const s = extractSeries(workbook.SheetNames[m.portIdx]);
          allDates.push(...s.map(x => x.date.getTime()));
        });
        const lastDate = new Date(Math.max(...allDates));
        
        // Marcos temporales
        const ytdStart = new Date(lastDate.getFullYear() - 1, 11, 31);
        const y2025Start = new Date(2024, 11, 31);
        const y2025End = new Date(Math.min(new Date(2025, 11, 31).getTime(), lastDate.getTime()));
        const date1y = new Date(lastDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        const date2y = new Date(lastDate.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
        const date3y = new Date(lastDate.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
        const date5y = new Date(lastDate.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
        const date2009 = new Date(2009, 0, 1);

        const getClosest = (series: {date: Date, val: number}[], target: Date) => {
          if (!series.length) return null;
          if (target < series[0].date) return series[0].val;
          let closest = series[0].val;
          for (let s of series) {
            if (s.date <= target) closest = s.val;
            else break;
          }
          return closest;
        };

        const calcReturn = (series: {date: Date, val: number}[], start: Date, end: Date, annualize = false) => {
          const vs = getClosest(series, start);
          const ve = getClosest(series, end);
          if (vs === null || ve === null || vs === 0) return null;
          let ret = (ve / vs) - 1;
          if (annualize) {
            const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            if (years > 1) ret = Math.pow(1 + ret, 1 / years) - 1;
          }
          return Number((ret * 100).toFixed(2));
        };

        const calcVol = (series: {date: Date, val: number}[], start: Date, end: Date) => {
          const w = series.filter(s => s.date >= start && s.date <= end);
          if (w.length < 10) return null;
          const rets = [];
          for (let i = 1; i < w.length; i++) {
            if (w[i-1].val !== 0) rets.push((w[i].val / w[i-1].val) - 1);
          }
          if (!rets.length) return null;
          const mean = rets.reduce((a,b) => a+b, 0) / rets.length;
          const variance = rets.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / (rets.length - 1);
          return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
        };

        // Ejecutar los cálculos para cada perfil
        MAPPING.forEach(m => {
          const pSeries = extractSeries(workbook.SheetNames[m.portIdx]);
          const bSeries = extractSeries(workbook.SheetNames[m.bmkIdx]);
          
          outputDb[m.profile] = {
            returns: {
              "YTD": calcReturn(pSeries, ytdStart, lastDate),
              "2025": calcReturn(pSeries, y2025Start, y2025End),
              "1Y": calcReturn(pSeries, date1y, lastDate),
              "2Y": calcReturn(pSeries, date2y, lastDate, true),
              "3Y": calcReturn(pSeries, date3y, lastDate, true),
              "5Y": calcReturn(pSeries, date5y, lastDate, true),
              "2009": calcReturn(pSeries, date2009, lastDate, true)
            },
            volatilities: {
              "1Y": calcVol(pSeries, date1y, lastDate),
              "3Y": calcVol(pSeries, date3y, lastDate),
              "5Y": calcVol(pSeries, date5y, lastDate)
            },
            benchmark: {
              name: m.bmkName,
              returns: {
                "YTD": calcReturn(bSeries, ytdStart, lastDate),
                "1Y": calcReturn(bSeries, date1y, lastDate),
                "3Y": calcReturn(bSeries, date3y, lastDate, true),
                "5Y": calcReturn(bSeries, date5y, lastDate, true)
              },
              volatilities: {
                "1Y": calcVol(bSeries, date1y, lastDate),
                "3Y": calcVol(bSeries, date3y, lastDate),
                "5Y": calcVol(bSeries, date5y, lastDate)
              }
            }
          };
        });
        resolve(outputDb);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}