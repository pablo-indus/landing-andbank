import { vlData } from './src/data/vlData';
import { PROFILE_KPIS, PROFILES } from './src/data/portfolioData';

PROFILES.forEach((pName, pIdx) => {
  const pts = vlData[pIdx];
  let maxSoFar = 0;
  let currentDd = 0;
  
  if (pts && pts.length > 0) {
    for (const pt of pts) {
      if (pt.v > maxSoFar) maxSoFar = pt.v;
      const dd = maxSoFar === 0 ? 0 : (pt.v / maxSoFar - 1) * 100;
      currentDd = dd;
    }
  }

  const vol = PROFILE_KPIS[pIdx].volatility;

  console.log(`Profile: ${pName}`);
  console.log(`Current Drawdown: ${currentDd.toFixed(2)}%`);
  console.log(`Volatility: ${vol.toFixed(2)}%`);
  console.log("----------------------");
});
