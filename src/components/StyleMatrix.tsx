import React from 'react';

export interface StyleMatrixProps {
  data: {
    largeValue: number;
    largeCore: number;
    largeGrowth: number;
    midValue: number;
    midCore: number;
    midGrowth: number;
    smallValue: number;
    smallCore: number;
    smallGrowth: number;
  };
}

export const StyleMatrix: React.FC<StyleMatrixProps> = ({ data }) => {
  // Find max value to normalize the background colors
  const allValues = [
    data.largeValue, data.largeCore, data.largeGrowth,
    data.midValue, data.midCore, data.midGrowth,
    data.smallValue, data.smallCore, data.smallGrowth
  ];
  const maxVal = Math.max(...allValues, 1);

  const renderCell = (val: number, label: string) => {
    // Red tone scale based on percentage relative to max
    // maxVal gets a strong red, lower values get lighter reds.
    // 0 gets almost white
    const intensity = val === 0 ? 0 : Math.max(0.1, val / maxVal);
    
    // We can use a combination of rgba to get red tones
    // or use Tailwind classes with opacity. We'll use inline styles for dynamic opacity
    const bgOpacity = intensity;
    const isDarkText = intensity < 0.5;

    return (
      <div 
        className="flex flex-col items-center justify-center p-2 sm:p-4 border border-white aspect-square transition-all duration-300"
        style={{ 
          backgroundColor: `rgba(220, 38, 38, ${bgOpacity})`, // red-600
          color: isDarkText ? '#18181b' : '#ffffff' // zinc-900 or white
        }}
        title={label}
      >
        <span className="font-mono text-sm sm:text-base font-bold tabular-nums">
          {val.toFixed(2).replace('.', ',')}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto p-4 bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 rounded-lg">
      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-6 w-full text-left">Desglose estilos renta variable</h3>
      
      <div className="flex w-full">
        <div className="flex flex-col justify-around pr-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 w-12 text-center" style={{ height: 'calc(100% - 24px)', marginTop: '24px' }}>
          <div className="flex items-center justify-end h-full"><span>Large</span></div>
          <div className="flex items-center justify-end h-full"><span>Mid</span></div>
          <div className="flex items-center justify-end h-full"><span>Small</span></div>
        </div>
        
        <div className="flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-0 mb-2">
            <div className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Value</div>
            <div className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Core</div>
            <div className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Growth</div>
          </div>
          
          <div className="grid grid-cols-3 gap-0 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-50 rounded">
            {renderCell(data.largeValue, 'Large Value')}
            {renderCell(data.largeCore, 'Large Core')}
            {renderCell(data.largeGrowth, 'Large Growth')}
            
            {renderCell(data.midValue, 'Mid Value')}
            {renderCell(data.midCore, 'Mid Core')}
            {renderCell(data.midGrowth, 'Mid Growth')}
            
            {renderCell(data.smallValue, 'Small Value')}
            {renderCell(data.smallCore, 'Small Core')}
            {renderCell(data.smallGrowth, 'Small Growth')}
          </div>
        </div>
      </div>
    </div>
  );
};
