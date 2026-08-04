import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as baseData from '../data/portfolioData';

type AppData = typeof baseData;

const DataContext = createContext<{ data: AppData; loading: boolean }>({ data: baseData as AppData, loading: true });

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(baseData as AppData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docRef = doc(db, 'appData', 'latest');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          setData(prev => ({
            ...prev,
            PROFILE_KPIS: remoteData.profileKpis || prev.PROFILE_KPIS,
            WINDOWS_DATA: remoteData.windowsData || prev.WINDOWS_DATA,
            HISTORICAL_ANNUAL: remoteData.historicalAnnual || prev.HISTORICAL_ANNUAL,
            HISTORICAL_MONTHLY: remoteData.historicalMonthly || prev.HISTORICAL_MONTHLY,
            HISTORICAL_CHANGES: remoteData.historicalChanges || prev.HISTORICAL_CHANGES,
            MONTHLY_ATTRIBUTIONS: remoteData.monthlyAttributions || prev.MONTHLY_ATTRIBUTIONS,
            COMPOSITION_SNAPSHOTS: remoteData.compositionSnapshots || prev.COMPOSITION_SNAPSHOTS,
            ASSET_ALLOCATION_SNAPSHOTS: remoteData.assetAllocationSnapshots || prev.ASSET_ALLOCATION_SNAPSHOTS,
            CREDIT_LEVEL_SNAPSHOTS: remoteData.creditLevelSnapshots || prev.CREDIT_LEVEL_SNAPSHOTS,
          }));
        }
      } catch (err) {
        console.error("Error loading remote data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <DataContext.Provider value={{ data, loading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
