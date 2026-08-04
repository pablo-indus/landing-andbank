import * as xlsx from "xlsx";
import { db } from "./firebase-admin.js";

const profileColors = {
  'Conservador +': '#C9C3BB',
  'Conservador': '#A99F93',
  'Moderado': '#8B7A6A',
  'Equilibrado': '#BC4B42',
  'Agresivo': '#9F2E26',
  'Agresivo +': '#661911'
};

export async function processExcelUpload(req, res) {
  try {
    const { password } = req.body;
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ error: "Contraseña de administrador no configurada en el servidor." });
    }
    if (password !== adminPassword) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    let parsedData: any = {};

    const allRows = [];
    workbook.SheetNames.forEach(sheetName => {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        rows.forEach(r => allRows.push(r));
    });

    const profileKpis = [];
    allRows.forEach(row => {
        const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('perfil') || k.toLowerCase().includes('name') || k.toLowerCase().includes('nombre'));
        if (nameKey && typeof row[nameKey] === 'string') {
            const name = String(row[nameKey]).trim();
            const lowerName = name.toLowerCase();
            const standardProfiles = ['conservador +', 'conservador', 'moderado', 'equilibrado', 'agresivo', 'agresivo +'];
            
            if (standardProfiles.some(p => lowerName.includes(p.toLowerCase()))) {
                const findStat = (keywords) => {
                    const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                    return key ? parseFloat(row[key]) || 0 : 0;
                }
                
                let p2025 = findStat(['2025', '25']);
                let p2026YTD = findStat(['2026', '26', 'ytd']);
                let pJune = findStat(['jun', 'june']);
                let volatility = findStat(['volatil', 'vola']);
                
                let color = '#C9C3BB';
                for (const [k, v] of Object.entries(profileColors)) {
                    if (lowerName.includes(k.toLowerCase())) color = v;
                }

                if (!profileKpis.find(p => p.name === name)) {
                    profileKpis.push({ name, color, p2025, p2026YTD, pJune, volatility });
                }
            }
        }
    });
    if (profileKpis.length > 0) parsedData.profileKpis = profileKpis;

    const assetAllocationSnapshots = [];
    allRows.forEach(row => {
        const nameKey = Object.keys(row).find(k => k.toLowerCase() === 'name' || k.toLowerCase().includes('perfil') || k.toLowerCase().includes('nombre'));
        const eqKey = Object.keys(row).find(k => k.toLowerCase().includes('equity') || k.toLowerCase().includes('renta variable') || k.toLowerCase().includes(' rv'));
        
        if (nameKey && eqKey && typeof row[nameKey] === 'string') {
             const name = String(row[nameKey]).trim();
             const isStandardProfile = ['conservador +', 'conservador', 'moderado', 'equilibrado', 'agresivo', 'agresivo +'].some(p => name.toLowerCase().includes(p.toLowerCase()));
             
             if (isStandardProfile) {
                const findStat = (keywords) => {
                    const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                    let val = key ? parseFloat(row[key]) : 0;
                    if (isNaN(val)) val = 0;
                    if (val > 1 && val <= 100) val = val / 100;
                    return val;
                };
                 
                if (!assetAllocationSnapshots.find(p => p.name === name)) {
                    const idKey = Object.keys(row).find(k => k.toLowerCase().includes('id'));
                    assetAllocationSnapshots.push({
                        id: row[idKey] ? String(row[idKey]) : name.toLowerCase().replace(/[^a-z]/g, ''),
                        name,
                        equity: findStat(['equity', 'renta variable', 'rv']),
                        fixedIncome: findStat(['fixed income', 'renta fija', 'rf']),
                        liquidity: findStat(['liquidity', 'liquidez', 'cash']),
                        alternatives: findStat(['alternative', 'alternativa', 'alt'])
                    });
                }
             }
        }
    });
    if (assetAllocationSnapshots.length > 0) parsedData.assetAllocationSnapshots = assetAllocationSnapshots;

    let funds = [];
    allRows.forEach(row => {
        const isinKey = Object.keys(row).find(k => k.toLowerCase().includes('isin'));
        const ratingKey = Object.keys(row).find(k => k.toLowerCase().includes('rating') || k.toLowerCase().includes('calificación'));
        const nameKey = Object.keys(row).find(k => k.toLowerCase() === 'name' || k.toLowerCase().includes('fondo') || k.toLowerCase().includes('nombre'));
        
        if (isinKey && ratingKey && nameKey && String(row[isinKey]).trim() !== "") {
            const findStat = (keywords) => {
                const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                let val = key ? parseFloat(row[key]) : 0;
                return isNaN(val) ? 0 : val;
            };

            if (!funds.find(f => f.isin === String(row[isinKey]).trim())) {
                funds.push({
                    name: String(row[nameKey]),
                    isin: String(row[isinKey]).trim(),
                    rating: String(row[ratingKey]),
                    ytw: findStat(['ytw', 'yield']),
                    duration: findStat(['duration', 'duracion']),
                    pctIG: findStat(['% ig', 'pct ig', 'ig']),
                    pctHY: findStat(['% hy', 'pct hy', 'hy']),
                    govies: findStat(['govies']),
                    credito: findStat(['credito', 'credit']),
                    cash: findStat(['cash', 'efectivo', 'liquidez']),
                    otros: findStat(['otros', 'other']),
                    vola3y: findStat(['vola', 'volatilidad'])
                });
            }
        }
    });
    
    if (funds.length > 0) {
        parsedData.creditLevelSnapshots = [{
            period: "Actual",
            label: "Niveles de Crédito",
            funds
        }];
    }

    const hasData = (parsedData.profileKpis && parsedData.profileKpis.length > 0) || 
                    (parsedData.assetAllocationSnapshots && parsedData.assetAllocationSnapshots.length > 0) ||
                    (parsedData.creditLevelSnapshots && parsedData.creditLevelSnapshots.length > 0);
                        
    if (!hasData) {
      return res.status(400).json({ error: "No se encontró información reconocible en el archivo. Las columnas deben incluir términos clave como 'Nombre/Perfil', 'ISIN', 'Rating', o 'Equity'." });
    }

    console.log("Saving to Firestore with merge...");
    await db.collection("appData").doc("latest").set({
      ...parsedData,
      lastUpdated: new Date()
    }, { merge: true });

    res.json({ success: true, message: "Datos procesados y guardados correctamente", data: parsedData });
  } catch (error) {
    console.error("Error processing excel:", error);
    res.status(500).json({ error: "Fallo al procesar el archivo Excel. (Detalle: " + (error.message || "error desconocido") + ")" });
  }
}


function validateJsonSchema(data: any): string[] {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return ["El archivo JSON debe contener un objeto principal."];
  }

  if (data.profileKpis !== undefined) {
    if (!Array.isArray(data.profileKpis)) {
      errors.push("La sección 'profileKpis' debe ser un arreglo (array).");
    } else {
      data.profileKpis.forEach((item: any, index: number) => {
        if (!item.name) errors.push(`profileKpis[${index}]: Falta la propiedad 'name'.`);
      });
    }
  }

  if (data.windowsData !== undefined) {
    if (typeof data.windowsData !== 'object' || data.windowsData === null) {
        errors.push("La sección 'windowsData' debe ser un objeto.");
    } else {
        if (!data.windowsData.cats || !Array.isArray(data.windowsData.cats)) {
          errors.push("La sección 'windowsData' debe contener un arreglo 'cats'.");
        }
        if (!data.windowsData.values || !Array.isArray(data.windowsData.values)) {
          errors.push("La sección 'windowsData' debe contener un arreglo 'values'.");
        }
    }
  }

  if (data.assetAllocationSnapshots !== undefined) {
    if (!Array.isArray(data.assetAllocationSnapshots)) {
      errors.push("La sección 'assetAllocationSnapshots' debe ser un arreglo.");
    } else {
      data.assetAllocationSnapshots.forEach((item: any, index: number) => {
        if (!item.name) errors.push(`assetAllocationSnapshots[${index}]: Falta la propiedad 'name'.`);
      });
    }
  }

  if (data.creditLevelSnapshots !== undefined) {
    if (!Array.isArray(data.creditLevelSnapshots)) {
      errors.push("La sección 'creditLevelSnapshots' debe ser un arreglo.");
    }
  }

  if (data.historicalAnnual !== undefined) {
     if (!Array.isArray(data.historicalAnnual)) {
       errors.push("La sección 'historicalAnnual' debe ser un arreglo.");
     }
  }
  
  if (data.historicalMonthly !== undefined) {
     if (!Array.isArray(data.historicalMonthly)) {
       errors.push("La sección 'historicalMonthly' debe ser un arreglo.");
     }
  }

  const hasData = (data.profileKpis && data.profileKpis.length > 0) || 
                  (data.windowsData && data.windowsData.cats && data.windowsData.cats.length > 0) ||
                  (data.assetAllocationSnapshots && data.assetAllocationSnapshots.length > 0) ||
                  (data.creditLevelSnapshots && data.creditLevelSnapshots.length > 0) ||
                  (data.historicalAnnual && data.historicalAnnual.length > 0) ||
                  (data.historicalMonthly && data.historicalMonthly.length > 0);

  if (!hasData) {
      errors.push("El archivo JSON no contiene ninguna de las secciones reconocidas (profileKpis, windowsData, assetAllocationSnapshots, creditLevelSnapshots, historicalAnnual, historicalMonthly) o están vacías.");
  }

  return errors;
}

export async function processJsonUpload(req, res) {
  try {
    const { password } = req.body;
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ error: "Contraseña de administrador no configurada en el servidor." });
    }
    if (password !== adminPassword) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch (e) {
      return res.status(400).json({ error: "El archivo no es un JSON válido." });
    }

    const validationErrors = validateJsonSchema(parsedData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: "Error de validación del formato JSON: " + validationErrors.join(" | ")
      });
    }

    console.log("Saving JSON to Firestore with merge...");
    await db.collection("appData").doc("latest").set({
      ...parsedData,
      lastUpdated: new Date()
    }, { merge: true });

    res.json({ success: true, message: "Datos JSON procesados y guardados correctamente", data: parsedData });
  } catch (error) {
    console.error("Error processing json:", error);
    res.status(500).json({ error: "Fallo al procesar el archivo JSON. (Detalle: " + (error.message || "error desconocido") + ")" });
  }
}
