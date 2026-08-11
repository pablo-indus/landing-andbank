import React, { useState } from 'react';
import { STYLE_BOX_DATA } from '../data/styleBoxData';
import { PROFILES } from '../data/portfolioData';
import { ScrollableTabs } from './ScrollableTabs';

const MiniStyleBox = ({ sizeScore, styleScore, profile }: { key?: React.Key; sizeScore: number; styleScore: number; profile: string }) => {
  const isSmall = sizeScore <= 100;
  const isLarge = sizeScore > 200;
  const isMid = !isSmall && !isLarge;
  const isValue = styleScore <= 100;
  const isGrowth = styleScore > 200;
  const isCore = !isValue && !isGrowth;

  const sizeText = isLarge ? "Large" : isSmall ? "Small" : "Mid";
  const styleText = isValue ? "Value" : isGrowth ? "Growth" : "Core";
  const category = `${sizeText} ${styleText}`;

  const getCellClass = () => {
    return `w-full h-full border border-white bg-zinc-100 dark:bg-zinc-800`;
  };

  // Convert scores (0-300) to percentages (0-100)
  // X: 0 = Left (Value), 300 = Right (Growth)
  // Y: 0 = Bottom (Small), 300 = Top (Large)
  const xPercent = Math.min(Math.max((styleScore / 300) * 100, 0), 100);
  const yPercent = Math.min(Math.max(((300 - sizeScore) / 300) * 100, 0), 100);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider text-center h-8 flex items-center justify-center">{profile}</div>
      <div className="relative mt-1 mb-5 ml-7 mr-1">
        {/* Y Axis Labels */}
        <div className="absolute -left-8 top-0 h-full w-8 flex flex-col"> 
           <div className="flex-1 flex items-center justify-end pr-1 text-[9px] sm:text-[10px] font-medium text-zinc-400">Large</div>
           <div className="flex-1 flex items-center justify-end pr-1 text-[9px] sm:text-[10px] font-medium text-zinc-400">Mid</div>
           <div className="flex-1 flex items-center justify-end pr-1 text-[9px] sm:text-[10px] font-medium text-zinc-400">Small</div>
        </div>
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 grid grid-cols-3 grid-rows-3 gap-[1px] bg-zinc-200 dark:bg-zinc-700 p-[1px] border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
          {/* Grid background */}
          <div className={getCellClass()} title="Large Value" />
          <div className={getCellClass()} title="Large Core" />
          <div className={getCellClass()} title="Large Growth" />
          
          <div className={getCellClass()} title="Mid Value" />
          <div className={getCellClass()} title="Mid Core" />
          <div className={getCellClass()} title="Mid Growth" />
          
          <div className={getCellClass()} title="Small Value" />
          <div className={getCellClass()} title="Small Core" />
          <div className={getCellClass()} title="Small Growth" />
          
          {/* Indicator Dot */}
          <div 
            className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-600 rounded-full border border-white shadow-sm transition-all duration-500 ease-out z-20"
            style={{ 
              left: `calc(${xPercent}% - 6px)`, 
              top: `calc(${yPercent}% - 6px)`,
            }}
          />
        </div>
        {/* X Axis Labels */}
        <div className="absolute -bottom-5 left-0 w-full h-5 flex"> 
           <div className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-zinc-400 -ml-2">Value</div>
           <div className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-zinc-400">Core</div>
           <div className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-zinc-400 ml-1">Growth</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col items-center">
        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{category}</span>
        <span className="text-[9px] font-mono text-zinc-400 mt-0.5" title="Coordenadas para desarrolladores">
          [x: {styleScore.toFixed(0)}, y: {sizeScore.toFixed(0)}]
        </span>
      </div>
    </div>
  );
};

export const SectionStyleBox: React.FC = () => {
  const sortedData = [...STYLE_BOX_DATA].sort((a, b) => {
    const [d1, m1, y1] = a.date.split('/');
    const [d2, m2, y2] = b.date.split('/');
    return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
  });

  const [activeDate, setActiveDate] = useState<string>(sortedData[0].date);

  return (
    <section id="stylebox" className="pt-10 scroll-mt-28 mb-12">
      <div className="flex items-start gap-4 border-b-2 border-zinc-900 pb-3 mb-6">
        <span className="text-xs font-bold text-red-600 tracking-widest uppercase pt-1">
          10
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Style Box Histórico
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Evolución del estilo de inversión (Tamaño vs Estilo) para cada perfil según la fecha seleccionada
          </p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm space-y-6">
        {/* Date Tabs */}
        <div className="border-b border-zinc-100 pb-4">
          <ScrollableTabs 
            tabs={sortedData.map(d => ({ id: d.date, label: d.date }))} 
            activeTab={activeDate} 
            onTabChange={(id) => setActiveDate(id)}
            baseClass="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap"
            activeClass="bg-red-700 text-white shadow-xs"
            inactiveClass="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700/80 hover:text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Style Boxes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 pt-2">
          {PROFILES.filter(p => p !== 'Conservador +').map((profile, idx) => {
            const activeData = STYLE_BOX_DATA.find(d => d.date === activeDate);
            if (!activeData) return null;
            const scores = activeData.scores[profile as keyof typeof activeData.scores];
            if (!scores) return null;
            return (
              <MiniStyleBox 
                key={idx} 
                profile={profile} 
                sizeScore={scores[0]} 
                styleScore={scores[1]} 
              />
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t border-zinc-100">
           <div className="flex items-center gap-4">
             <div className="flex flex-col text-[10px] font-medium text-zinc-500 dark:text-zinc-400 text-right">
               <span className="font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-0.5">Eje Y (Tamaño)</span>
               <span>Large &gt; 200</span>
               <span>Mid 100 - 200</span>
               <span>Small &lt; 100</span>
             </div>
             <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700"></div>
             <div className="flex flex-col text-[10px] font-medium text-zinc-500 dark:text-zinc-400 text-left">
               <span className="font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-0.5">Eje X (Estilo)</span>
               <span>Value &lt; 100</span>
               <span>Core 100 - 200</span>
               <span>Growth &gt; 200</span>
             </div>
           </div>
           
           <div className="hidden sm:block w-px h-10 bg-zinc-200 dark:bg-zinc-700"></div>
           
           <div className="flex items-center gap-3">
             <div className="relative w-8 h-8 grid grid-cols-3 grid-rows-3 gap-[1px] bg-zinc-200 dark:bg-zinc-700 p-[1px] rounded opacity-70">
                <div className="bg-zinc-100 dark:bg-zinc-800"></div><div className="bg-zinc-100 dark:bg-zinc-800"></div><div className="bg-zinc-100 dark:bg-zinc-800"></div>
                <div className="bg-zinc-100 dark:bg-zinc-800"></div><div className="bg-zinc-100 dark:bg-zinc-800"></div><div className="bg-zinc-100 dark:bg-zinc-800"></div>
                <div className="bg-zinc-100 dark:bg-zinc-800"></div><div className="bg-zinc-100 dark:bg-zinc-800"></div><div className="bg-zinc-100 dark:bg-zinc-800"></div>
                <div className="absolute w-2 h-2 bg-red-600 rounded-full left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
             </div>
             <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
               <span className="font-bold text-zinc-700 dark:text-zinc-300 block uppercase tracking-wider">Lectura</span>
               El círculo rojo indica la posición exacta <br/> correspondiente al centroid del mes.
             </div>
           </div>
        </div>
      </div>
    </section>
  );
};
