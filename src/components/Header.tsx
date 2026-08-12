import React, { useState } from 'react';
import { FileText, ChevronLeft, ChevronRight, Moon, Sun, Settings } from 'lucide-react';
import { AdminModal } from './AdminModal';
import { useRef, useEffect } from 'react';
import { PdfExportModal, type ExportOptions } from './PdfExportModal';
import { useMonthlyReports } from '../hooks/useMonthlyReports';
import { BENCHMARK_SERIES } from '../data/vlSeries';
import { trackEvent } from '../services/usage';

interface HeaderProps {
  activeSection: string;
}

/**
 * El logo, en data: URI, para poder incrustarlo en el PowerPoint.
 *
 * pptxgenjs necesita los bytes de la imagen; una ruta del servidor le llega al
 * archivo como un enlace roto en cuanto la presentacion sale del navegador.
 */
async function loadLogoDataUri(): Promise<string | null> {
  try {
    const res = await fetch('/logo.jpg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/*
  Cabecera corporativa en dos bandas: identidad y acciones arriba, navegacion
  debajo.

  Antes iba todo en una sola fila de 64 px, asi que las once secciones se
  repartian el hueco que sobraba entre el logo y los botones: por debajo de
  unos 1.100 px de ancho la navegacion se quedaba en una pestaña y una flecha.
  Con banda propia, las pestañas disponen de todo el ancho.

  Si cambia el alto total (64 + 44 = 108 px), hay que mover con el la clase
  `scroll-mt-28` de las secciones y el `rootMargin` del observador de `App.tsx`,
  o los enlaces del menu dejan el titulo tapado bajo la cabecera.
*/
export const Header: React.FC<HeaderProps> = ({ activeSection }) => {
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Los mismos datos que pinta la pantalla: el PowerPoint no vuelve a leer nada
  // de la base, para que no pueda salir con un cierre distinto al de la web.
  const { lastUpdated, windows, attributions, composition, assetAllocation, vlSeries } = useMonthlyReports();
  const coverDate = (lastUpdated ?? new Date()).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const coverDateLabel = coverDate.charAt(0).toUpperCase() + coverDate.slice(1);

  // La clase `dark` ya la ha puesto el script de `index.html` antes del primer
  // pintado, asi que aqui solo hay que leerla. Decidirlo otra vez seria repetir
  // la regla en dos sitios y arriesgarse a que dejen de coincidir.
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
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
    { id: 'contribuidores', label: 'Contribuidores' },
    { id: 'composicion', label: 'Composición' },
    { id: 'aa-global', label: 'Asset Allocation' },
    { id: 'credito', label: 'Crédito' },
    { id: 'correlacion', label: 'Correlación' },
    { id: 'stylebox', label: 'Style Box' },
  ];

  const iconButton =
    'cursor-pointer flex items-center justify-center w-9 h-9 rounded-sm border border-zinc-200 ' +
    'dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white ' +
    'hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0';

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
      {/* Banda 1: identidad y acciones */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/*
            El logo es public/logo.jpg. Antes apuntaba a un logo.png que era
            este mismo JPG guardado como texto: el navegador no podia
            decodificarlo y caia en una imagen de Wikipedia, que es de un
            tercero y ademas no carga sin internet.

            Un JPG no tiene transparencia, asi que en oscuro se cambia por
            `logo-knockout.png`, la misma marca en blanco y con fondo
            transparente, generada desde este archivo. Antes se resolvia con una
            placa blanca detras, que sobre una barra oscura parecia una pegatina.
            Los dos llevan `alt`: el que sobra va con `display:none` y no lo
            anuncia ningun lector de pantalla.
          */}
          <img src="/logo.jpg" alt="Andbank" className="h-7 object-contain shrink-0 dark:hidden" />
          <img
            src="/logo-knockout.png"
            alt="Andbank"
            className="h-7 object-contain shrink-0 hidden dark:block"
          />

          <div className="hidden sm:block border-l border-zinc-200 dark:border-zinc-800 pl-4 min-w-0">
            <p className="text-[11px] font-semibold text-ink dark:text-zinc-100 truncate">
              Mandatos Portfolio Funds (&lt;1MM €)
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate mt-0.5">
              Wealth Management SGIIC · Carteras modelo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleDarkMode}
            className={iconButton}
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => setAdminModalOpen(true)}
            className={iconButton}
            title="Panel de administración"
            aria-label="Panel de administración"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => setPdfModalOpen(true)}
            className="cursor-pointer flex items-center gap-2 h-9 px-3.5 bg-brand text-white rounded-sm text-[11px] font-bold uppercase tracking-wider hover:bg-brand-dark transition-colors shrink-0"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">Generar </span>PDF
          </button>
        </div>
      </div>

      {/* Banda 2: navegacion. Pestañas subrayadas, no pastillas. */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden">
            {showLeftArrow && (
              <button
                onClick={() => scrollNav('left')}
                className="absolute left-0 z-10 h-full pr-6 flex items-center cursor-pointer text-zinc-400 hover:text-ink dark:hover:text-white transition-colors bg-gradient-to-r from-zinc-50 dark:from-zinc-900 via-zinc-50 dark:via-zinc-900 to-transparent"
                aria-label="Desplazar la navegación a la izquierda"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            <nav
              ref={navRef}
              onScroll={checkScroll}
              className="flex items-stretch gap-1 overflow-x-auto no-scrollbar w-full scroll-smooth"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      setTimeout(() => {
                        const el = document.getElementById(item.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 0);
                    }}
                    className={`relative shrink-0 h-11 px-3.5 flex items-center text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                      isActive
                        ? 'text-ink dark:text-white'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-100'
                    }`}
                  >
                    {item.label}
                    {isActive && <span className="absolute inset-x-2 bottom-0 h-[3px] bg-brand" />}
                  </a>
                );
              })}
            </nav>

            {showRightArrow && (
              <button
                onClick={() => scrollNav('right')}
                className="absolute right-0 z-10 h-full pl-6 flex items-center cursor-pointer text-zinc-400 hover:text-ink dark:hover:text-white transition-colors bg-gradient-to-l from-zinc-50 dark:from-zinc-900 via-zinc-50 dark:via-zinc-900 to-transparent"
                aria-label="Desplazar la navegación a la derecha"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {pdfModalOpen && (
        <PdfExportModal
          onClose={() => setPdfModalOpen(false)}
          onPrint={(options) => {
            setPdfModalOpen(false);
            trackEvent('pdf');
            window.dispatchEvent(new CustomEvent('generate-pdf', { detail: options }));
          }}
          onPowerPoint={async (options) => {
            /*
              pptxgenjs pesa bastante y solo hace falta cuando alguien pulsa el
              boton, asi que se carga en ese momento: si fuera un import normal
              se lo tragaria toda la gente que solo entra a mirar la web.
            */
            const [{ buildPresentation }, logo] = await Promise.all([
              import('../utils/pptExport'),
              loadLogoDataUri(),
            ]);
            trackEvent('pptx');
            await buildPresentation({
              ...options,
              coverDateLabel,
              windows,
              attribution: attributions[0] ?? null,
              composition: composition[0],
              assetAllocation: assetAllocation[0],
              vlSeries: vlSeries as any,
              benchmarkNames: BENCHMARK_SERIES,
              logo,
            });
            setPdfModalOpen(false);
          }}
        />
      )}
      {adminModalOpen && <AdminModal onClose={() => setAdminModalOpen(false)} />}
    </header>
  );
};
