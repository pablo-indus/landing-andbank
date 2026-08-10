import * as XLSX from 'xlsx';

export interface CreditSnapshot {
  label: string;
  period: string;
  orderIndex: number;
  funds: any[];
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const cleanNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  let s = String(val).replace(/%/g, '').trim();
  if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
      s = s.replace(',', '.');
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
};

export async function processCreditExcel(file: File): Promise<Record<string, CreditSnapshot[]>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', raw: true }); 
        
        const updatesByDocId: Record<string, CreditSnapshot[]> = {};
        let lastSeenYear = new Date().getFullYear(); 
        let lastSeenMonth = 12;

        workbook.SheetNames.forEach((sheetName, sheetIndex) => {
          const sName = sheetName.toLowerCase();
          const yearMatch = sName.match(/\b(202[0-9])\b/);
          
          const monthMatch = sName.match(/\b\d{1,2}[-/](\d{2})\b/);
          if (!monthMatch) return; 
          
          const monthNum = parseInt(monthMatch[1], 10);
          if (monthNum < 1 || monthNum > 12) return;

          if (yearMatch) {
            lastSeenYear = parseInt(yearMatch[1], 10);
            lastSeenMonth = monthNum;
          } else {
            if (monthNum > lastSeenMonth + 1) {
               lastSeenYear -= 1;
            }
            lastSeenMonth = monthNum;
          }
          
          const docId = `${MONTHS[monthNum - 1]}_${lastSeenYear}`;
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
          
          let headerRowIdx = -1;
          let isinColIdx = -1;
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            // Buscamos la fila maestra (donde estén ISIN y DURACIÓN)
            const idxIsin = row.findIndex((cell: any) => typeof cell === 'string' && cell.trim().toUpperCase() === 'ISIN');
            const idxDur = row.findIndex((cell: any) => typeof cell === 'string' && cell.trim().toUpperCase().includes('DURAC'));
            
            if (idxIsin !== -1 && idxDur !== -1) {
              headerRowIdx = i;
              isinColIdx = idxIsin;
              break;
            }
          }

          if (headerRowIdx === -1) return; 

          const headers = rows[headerRowIdx].map((h: any) => String(h || '').toUpperCase().replace(/\s+/g, ''));
          
          let nameIdx = -1, durIdx = -1, ytwIdx = -1, ratIdx = -1;
          let igIdx = -1, hyIdx = -1, govIdx = -1, credIdx = -1, cashIdx = -1, otrosIdx = -1, volaIdx = -1, nrOtrosIdx = -1;

          headers.forEach((H, i) => {
             if (!H) return;
             
             // Buscamos índices asegurándonos de coger los de la tabla izquierda (i < 16 aprox)
             if (i > 16) return; // IGNORAR LA TABLA DE LEYENDAS Y PORCENTAJES DE LA DERECHA

             if (H === 'FONDODERENTAFIJA' || H.includes('FONDO')) nameIdx = i;
             else if (H === 'DURACIÓN' || H === 'DURACION' || H.includes('DURAC')) durIdx = i;
             else if (H === 'YIELD(YTW)' || H === 'YIELD' || H === 'YTW') ytwIdx = i;
             else if (H === 'RATING') ratIdx = i;
             else if (H === '%IG' || H === 'IG') igIdx = i; 
             else if (H === '%HY' || H === 'HY') hyIdx = i;
             else if (H === '%NR/OTROS' || H.includes('NR/OTROS')) nrOtrosIdx = i;
             else if (H === '%GOVIES' || H === 'GOVIES') govIdx = i;
             else if (H === '%CRÉDITO' || H === '%CREDITO' || H === 'CRÉDITO' || H === 'CREDITO') credIdx = i;
             else if (H === '%CASH' || H === 'CASH') cashIdx = i;
             else if (H === '%OTROS' || H === 'OTROS') otrosIdx = i; 
             else if (H === 'VOLA3Y' || H === 'VOLA' || H.includes('VOLA')) volaIdx = i;
          });
          
          if (nameIdx === -1 && isinColIdx > 0) nameIdx = isinColIdx - 1;

          const funds: any[] = [];

          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const isin = String(row[isinColIdx] || '').trim();
            if (!/^[A-Za-z]{2}/.test(isin) || isin.toUpperCase().includes('YIELD')) continue;
            
            let fundName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '-';
            if (!fundName || fundName.toLowerCase() === 'nan') fundName = '-';

            funds.push({
              name: fundName,
              isin: isin,
              ytw: ytwIdx !== -1 ? cleanNumber(row[ytwIdx]) : 0,
              duration: durIdx !== -1 ? cleanNumber(row[durIdx]) : 0,
              rating: ratIdx !== -1 && row[ratIdx] ? String(row[ratIdx]).trim() : '-',
              pctIG: igIdx !== -1 ? cleanNumber(row[igIdx]) : 0,
              pctHY: hyIdx !== -1 ? cleanNumber(row[hyIdx]) : 0,
              nrOtros: nrOtrosIdx !== -1 ? cleanNumber(row[nrOtrosIdx]) : null, // Guardamos el valor original si existe
              govies: govIdx !== -1 ? cleanNumber(row[govIdx]) : 0,
              credito: credIdx !== -1 ? cleanNumber(row[credIdx]) : 0,
              cash: cashIdx !== -1 ? cleanNumber(row[cashIdx]) : 0,
              otros: otrosIdx !== -1 ? cleanNumber(row[otrosIdx]) : 0,
              vola3y: volaIdx !== -1 ? cleanNumber(row[volaIdx]) : 0,
            });
          }

          if (funds.length > 0) {
            if (!updatesByDocId[docId]) updatesByDocId[docId] = [];
            updatesByDocId[docId].push({ label: sheetName, period: docId, orderIndex: sheetIndex, funds: funds });
          }
        });

        resolve(updatesByDocId);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}