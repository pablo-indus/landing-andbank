const fs = require('fs');

// Patch SectionBacktest.tsx
let backtest = fs.readFileSync('src/components/SectionBacktest.tsx', 'utf8');

// 1. Remove benchmark from renderIndices
backtest = backtest.replace(
  `const renderIndices = (showBenchmark || isStressTest) && activeIndices.length > 0 ? [activeIndices[0], 999] : activeIndices;`,
  `const renderIndices = activeIndices;`
);

// 2. Remove benchmark toggle
backtest = backtest.replace(
  `            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                checked={showBenchmark} 
                onChange={(e) => setShowBenchmark(e.target.checked)}
              />
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Comparar con Benchmark</span>
            </label>`,
  ``
);

// 3. Fix 10.000€ iniciales text
backtest = backtest.replace(
  `Simula el comportamiento de la cartera en caídas históricas extremas (10.000€ iniciales).`,
  `Simula el comportamiento de la cartera en caídas históricas extremas ({initialAmount.toLocaleString('es-ES')}€ iniciales).`
);

// 4. Clean up map[999] logic in trajectories
backtest = backtest.replace(
  `    if (renderIndices.includes(999) && activeIndices.length > 0) {
      map[999] = buildTrajectory(activeIndices[0], true);
    }`,
  ``
);

fs.writeFileSync('src/components/SectionBacktest.tsx', backtest);

// Patch SectionDrawdown.tsx
let drawdown = fs.readFileSync('src/components/SectionDrawdown.tsx', 'utf8');

// 1. Remove benchmark from renderIndices
drawdown = drawdown.replace(
  `const renderIndices = showBenchmark && activeIndices.length > 0 ? [activeIndices[0], 999] : activeIndices;`,
  `const renderIndices = activeIndices;`
);

// 2. Remove benchmark toggle
drawdown = drawdown.replace(
  `            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                checked={showBenchmark} 
                onChange={(e) => setShowBenchmark(e.target.checked)}
              />
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Comparar con Benchmark</span>
            </label>`,
  ``
);

// 3. Clean up res[999]
drawdown = drawdown.replace(
  `    if (showBenchmark && activeIndices.length > 0) {
       res[999] = makePoints(activeIndices[0], true);
    }`,
  ``
);

fs.writeFileSync('src/components/SectionDrawdown.tsx', drawdown);
