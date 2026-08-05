import * as XLSX from 'xlsx';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

/**
 * Helper function to strip empty rows/columns and reduce token usage
 * before sending data to Gemini.
 */
function extractCleanJsonFromSheet(sheet: XLSX.WorkSheet) {
  const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: null });
  // Filter out completely empty rows
  return rawJson.filter((row: any) => 
    Object.values(row).some(val => val !== null && val !== '')
  );
}

export async function processAndUploadExcel(file: File) {
  // 1. Read the Excel file in the browser
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // 2. Extract and pre-clean data from specific sheets
  let rawText = '';
  const targetSheets = [
    'Niveles_Master', 
    'Cambios_Master', 
    'AA_Modelos_Master', 
    'Contribuidores_Master'
  ];
  
  targetSheets.forEach(sheetName => {
    if (workbook.Sheets[sheetName]) {
      const cleanData = extractCleanJsonFromSheet(workbook.Sheets[sheetName]);
      rawText += `\n--- SHEET: ${sheetName} ---\n`;
      rawText += JSON.stringify(cleanData);
    }
  });

  // 3. Call Gemini with an Ultra-Strict Structured JSON Schema
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a financial data architect. Analyze this raw Excel export for investment funds. Clean, map, and standardize the data into the requested JSON schema exactly. Fix any typos in column names (e.g., 'RATING' vs 'Rating '). Ensure all percentages are numbers (e.g., 5.4, not "5.4%").\n\nRaw Data:\n${rawText}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          periodLabel: { 
            type: Type.STRING, 
            description: 'The main period of this report, e.g., Julio 2026' 
          },
          // NIVELES MASTER[cite: 1]
          creditLevelSnapshots: {
            type: Type.ARRAY,
            description: 'Data extracted from the Niveles_Master sheet',
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                period: { type: Type.STRING, description: 'Lowercase formatted, e.g., julio_2026' },
                funds: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      isin: { type: Type.STRING },
                      rating: { type: Type.STRING, description: 'e.g., BB+, BBB-' },
                      ytw: { type: Type.NUMBER, description: 'Yield to worst as a number' },
                      duration: { type: Type.NUMBER },
                      pctIG: { type: Type.NUMBER, description: 'Investment Grade %' },
                      pctHY: { type: Type.NUMBER, description: 'High Yield %' }
                    },
                    required: ['name', 'isin', 'ytw', 'duration']
                  }
                }
              },
              required: ['label', 'period', 'funds']
            }
          },
          // CAMBIOS MASTER[cite: 1]
          historicalChanges: {
            type: Type.ARRAY,
            description: 'Data extracted from the Cambios_Master sheet',
            items: {
              type: Type.OBJECT,
              properties: {
                period: { type: Type.STRING },
                batches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      rationale: { type: Type.STRING },
                      entries: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            type: { type: Type.STRING, description: 'e.g., compra, aumenta' },
                            tag: { type: Type.STRING },
                            instrument: { type: Type.STRING },
                            meta: { type: Type.STRING }
                          },
                          required: ['type', 'instrument']
                        }
                      },
                      exits: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            type: { type: Type.STRING, description: 'e.g., venta, disminuye' },
                            tag: { type: Type.STRING },
                            instrument: { type: Type.STRING },
                            meta: { type: Type.STRING }
                          },
                          required: ['type', 'instrument']
                        }
                      }
                    }
                  }
                }
              },
              required: ['period', 'batches']
            }
          },
          // ASSET ALLOCATION MASTER[cite: 1]
          assetAllocation: {
            type: Type.ARRAY,
            description: 'Data extracted from the AA_Modelos_Master sheet',
            items: {
              type: Type.OBJECT,
              properties: {
                profile: { type: Type.STRING, description: 'e.g., Conservador, Moderado, Agresivo' },
                allocations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      assetClass: { type: Type.STRING },
                      weight: { type: Type.NUMBER, description: 'Weight as a number representing percentage' }
                    },
                    required: ['assetClass', 'weight']
                  }
                }
              },
              required: ['profile', 'allocations']
            }
          },
          // CONTRIBUIDORES MASTER[cite: 1]
          monthlyAttributions: {
            type: Type.ARRAY,
            description: 'Data extracted from the Contribuidores_Master sheet',
            items: {
              type: Type.OBJECT,
              properties: {
                period: { type: Type.STRING },
                profile: { type: Type.STRING },
                contributors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      instrument: { type: Type.STRING },
                      contribution: { type: Type.NUMBER }
                    }
                  }
                },
                detractors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      instrument: { type: Type.STRING },
                      contribution: { type: Type.NUMBER }
                    }
                  }
                }
              },
              required: ['period', 'profile', 'contributors', 'detractors']
            }
          }
        },
        required: [
          'periodLabel', 
          'creditLevelSnapshots', 
          'historicalChanges', 
          'assetAllocation', 
          'monthlyAttributions'
        ]
      }
    }
  });

  if (!response.text) throw new Error('AI processing returned an empty result.');
  
  // 4. Parse the clean JSON
  const standardizedData = JSON.parse(response.text);

  // 5. Write to Cloud Firestore using a normalized Document ID
  const docId = standardizedData.periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  await setDoc(doc(db, 'monthly_reports', docId), {
    ...standardizedData,
    updatedAt: new Date().toISOString()
  });

  return docId;
}