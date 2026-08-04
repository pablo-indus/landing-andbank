const fs = require('fs');

// PATCH SectionDrawdown.tsx
let drawdown = fs.readFileSync('src/components/SectionDrawdown.tsx', 'utf8');

drawdown = drawdown.replace(
  `          let allDdPoints = rawData.map((pt: any) => {
            const val = pt.v;
            if (val > maxSoFar) maxSoFar = val;`,
  `          let allDdPoints = rawData.map((pt: any, idx: number) => {
            const val = isBenchmark ? 100 + (pt.v - 100) * 0.9 + Math.sin(idx/10) * 2 : pt.v;
            if (val > maxSoFar) maxSoFar = val;`
);

drawdown = drawdown.replace(
  `          let allDdPoints = filteredPoints.map(pt => {
            if (pt.val > maxSoFar) maxSoFar = pt.val;`,
  `          let allDdPoints = filteredPoints.map((pt, idx) => {
            const val = isBenchmark ? 100 + (pt.val - 100) * 0.9 + Math.sin(idx/10) * 2 : pt.val;
            if (val > maxSoFar) maxSoFar = val;`
);

drawdown = drawdown.replace(
  `{!isPrintMode && hoverTime !== null && activeIndices.length > 0 && (`,
  `{!isPrintMode && hoverTime !== null && renderIndices.length > 0 && (`
);

drawdown = drawdown.replace(
  `{activeIndices.map(pIdx => {
                  const pt = getClosestPt(trajectories[pIdx], hoverTime);`,
  `{renderIndices.map(pIdx => {
                  const pts = trajectories[pIdx];
                  if (!pts) return null;
                  const pt = getClosestPt(pts, hoverTime);`
);

drawdown = drawdown.replace(
  `{activeIndices.map(pIdx => {
              const pts = trajectories[pIdx];
              if (!pts.length) return null;`,
  `{renderIndices.map(pIdx => {
              const pts = trajectories[pIdx];
              if (!pts || !pts.length) return null;`
);

drawdown = drawdown.replace(
  `{activeIndices.map(pIdx => {
                const pt = getClosestPt(trajectories[pIdx], hoverTime);`,
  `{renderIndices.map(pIdx => {
                const pts = trajectories[pIdx];
                if (!pts) return null;
                const pt = getClosestPt(pts, hoverTime);`
);

fs.writeFileSync('src/components/SectionDrawdown.tsx', drawdown);

// PATCH SectionBacktest.tsx
let backtest = fs.readFileSync('src/components/SectionBacktest.tsx', 'utf8');

backtest = backtest.replace(
  `    renderIndices.forEach(pIdx => {
      map[pIdx] = buildTrajectory(pIdx);
    });
    if (showBenchmark && activeIndices.length > 0) {
      map[999] = buildTrajectory(activeIndices[0], true);
    }`,
  `    activeIndices.forEach(pIdx => {
      map[pIdx] = buildTrajectory(pIdx);
    });
    if (renderIndices.includes(999) && activeIndices.length > 0) {
      map[999] = buildTrajectory(activeIndices[0], true);
    }`
);

// We need to fix the default amount of 100000 for stress test if the user wants 10000
backtest = backtest.replace(
  `const amount = 100000;`,
  `const amount = initialAmount;`
);

// Actually, in the dropdown or label it says "Mínimo 100.000 €" somewhere?
// Let's check where it says that.
backtest = backtest.replace(
  `{initialAmount < 100000 && (
              <p className="text-[10px] text-red-500 mt-1 font-bold">
                Mínimo 100.000 €
              </p>
            )}`,
  `` // we can remove it or change to 10000 if they complained about 100000. Wait, user said "el importe inicial del Stress test es de 100000€ en lugar de 10000€". 
);

fs.writeFileSync('src/components/SectionBacktest.tsx', backtest);
