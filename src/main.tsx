import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PROFILE_KPIS, WINDOWS_DATA, HISTORICAL_ANNUAL, HISTORICAL_MONTHLY } from './data/portfolioData';

function AppLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docRef = doc(db, 'appData', 'latest');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          if (remoteData.profileKpis) {
            PROFILE_KPIS.length = 0;
            PROFILE_KPIS.push(...remoteData.profileKpis);
          }
          if (remoteData.windowsData) {
            WINDOWS_DATA.cats = remoteData.windowsData.cats;
            WINDOWS_DATA.values = remoteData.windowsData.values;
          }
          if (remoteData.historicalAnnual) {
            for (const k in remoteData.historicalAnnual) {
              HISTORICAL_ANNUAL[k] = remoteData.historicalAnnual[k];
            }
          }
          if (remoteData.historicalMonthly) {
            for (const k in remoteData.historicalMonthly) {
              HISTORICAL_MONTHLY[k] = remoteData.historicalMonthly[k];
            }
          }
        }
      } catch (err) {
        console.error("Error loading remote data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-zinc-300 dark:border-zinc-700 border-t-red-700 rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cargando Datos...</p>
      </div>
    </div>;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoader />
  </StrictMode>,
);
