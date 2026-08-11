import React, { useState } from 'react';
import { FileText, ChevronLeft, ChevronRight, Moon, Sun, Settings } from 'lucide-react';
import { AdminModal } from './AdminModal';
import { useRef, useEffect } from 'react';
import { PdfExportModal } from './PdfExportModal';

interface HeaderProps {
  activeSection: string;
}

export const Header: React.FC<HeaderProps> = ({ activeSection }) => {
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark' || 
                   (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };
  const navRef = useRef<HTMLElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

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
  }, []);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navRef.current) {
      const scrollAmount = 300;
      navRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 350);
    }
  };

  const navItems = [
    { id: 'perfilador', label: 'Perfilador' },
    { id: 'rendimiento', label: 'Rendimiento y Riesgo' },
    { id: 'cambios', label: 'Historial Cambios' },
    { id: 'simulador', label: 'Backtest' },
    { id: 'drawdown', label: 'Drawdown' },
    { id: 'correlacion', label: 'Correlación' },
    { id: 'contribuidores', label: 'Contribuidores' },
    { id: 'composicion', label: 'Composición' },
    { id: 'aa-global', label: 'Asset Allocation' },
    { id: 'credito', label: 'Crédito' },
    { id: 'stylebox', label: 'Style Box' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="flex items-center">
            {/*
              El logo es public/logo.jpg. Antes apuntaba a un logo.png que era
              este mismo JPG guardado como texto: el navegador no podia
              decodificarlo y caia en una imagen de Wikipedia, que es de un
              tercero y ademas no carga sin internet.
            */}
            <img src="/logo.jpg" alt="Andbank" className="h-8 object-contain" />
          </div>
          <div className="hidden sm:block ml-2 border-l border-zinc-200 dark:border-zinc-700 pl-4">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mt-1">
              Mandatos Portfolio Funds (&lt;1MM €)
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center flex-1 min-w-0 mx-2 sm:mx-4 relative overflow-hidden group">
          {showLeftArrow && (
            <button 
              onClick={() => scrollNav('left')}
              className="absolute left-0 z-10 p-1 bg-gradient-to-r from-white dark:from-zinc-900 via-white dark:via-zinc-900 to-transparent pr-4 h-full flex items-center cursor-pointer text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
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
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => {
                    setTimeout(() => {
                      const el = document.getElementById(item.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 0);
                  }}
                  className={`text-[10px] font-bold tracking-wider uppercase px-3 py-2 rounded-full transition-all whitespace-nowrap border ${
                    isActive
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:bg-zinc-800/50'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          
          {showRightArrow && (
            <button 
              onClick={() => scrollNav('right')}
              className="absolute right-0 z-10 p-1 bg-gradient-to-l from-white dark:from-zinc-900 via-white dark:via-zinc-900 to-transparent pl-4 h-full flex items-center cursor-pointer text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
                <button onClick={toggleDarkMode} className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ml-2 shrink-0">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={() => setAdminModalOpen(true)} className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ml-2 shrink-0">
          <Settings size={16} />
        </button>
        <button onClick={() => setPdfModalOpen(true)} className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors ml-2 shrink-0">
          <FileText size={14} /> PDF
        </button>
      </div>
          {pdfModalOpen && <PdfExportModal onClose={() => setPdfModalOpen(false)} onPrint={(profiles) => {
          setPdfModalOpen(false);
          window.dispatchEvent(new CustomEvent('generate-pdf', { detail: profiles }));
        }} />}
      {adminModalOpen && <AdminModal onClose={() => setAdminModalOpen(false)} />}
    </header>
  );
};
