import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
}

interface ScrollableTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  baseClass?: string;
  activeClass?: string;
  inactiveClass?: string;
}

export const ScrollableTabs: React.FC<ScrollableTabsProps> = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  baseClass = "px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap",
  activeClass = "bg-red-700 text-white shadow-xs",
  inactiveClass = "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/60 border border-zinc-200 dark:border-zinc-700"
}) => {
  const navRef = useRef<HTMLElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    
    let observer: ResizeObserver | null = null;
    if (navRef.current) {
        observer = new ResizeObserver(() => {
            checkScroll();
        });
        observer.observe(navRef.current);
    }
    
    window.addEventListener('resize', checkScroll);
    // Also re-check after fonts load
    document.fonts?.ready.then(checkScroll);
    
    return () => {
      window.removeEventListener('resize', checkScroll);
      if (observer) observer.disconnect();
    };
  }, [tabs]);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navRef.current) {
      const scrollAmount = 200;
      navRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 350);
    }
  };

  return (
    <div className="relative group w-full max-w-full overflow-hidden flex items-center">
      {showLeftArrow && (
        <button 
          onClick={() => scrollNav('left')}
          className="absolute left-0 z-10 p-1 bg-gradient-to-r from-white via-white to-transparent pr-4 h-full flex items-center cursor-pointer text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      
      <nav 
        ref={navRef}
        onScroll={checkScroll}
        className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar w-full scroll-smooth"
        style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
      >
        {tabs.map((p) => (
          <button
            key={p.id}
            onClick={() => onTabChange(p.id)}
            className={`${baseClass} ${activeTab === p.id ? activeClass : inactiveClass}`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {showRightArrow && (
        <button 
          onClick={() => scrollNav('right')}
          className="absolute right-0 z-10 p-1 bg-gradient-to-l from-white via-white to-transparent pl-4 h-full flex items-center cursor-pointer text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
};
