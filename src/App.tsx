import React, { useState, useEffect } from 'react';
import { useMonthlyReports } from './hooks/useMonthlyReports';

import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { KpiStrip } from './components/KpiStrip';
import { SectionPerfilador } from './components/SectionPerfilador';
import { SectionRendimiento } from './components/SectionRendimiento';
import { SectionCambios } from './components/SectionCambios';
import { SectionBacktest } from './components/SectionBacktest';
import { SectionDrawdown } from './components/SectionDrawdown';
import { SectionCorrelacion } from './components/SectionCorrelacion';
import { SectionContribuidores } from './components/SectionContribuidores';
import { SectionComposicion } from './components/SectionComposicion';
import { SectionAssetAllocation } from './components/SectionAssetAllocation';
import { SectionCredito } from './components/SectionCredito';
import { SectionStyleBox } from './components/SectionStyleBox';
import { Footer } from './components/Footer';
import { PrintReportLayout } from './components/PrintReportLayout';

export default function App() {
  // Fuente unica de datos: una sola suscripcion compartida por toda la app.
  const { loading: loadingDb, error: dbError, lastUpdated, reports } = useMonthlyReports();

  const [isPrinting, setIsPrinting] = useState(false);
  const [printProfiles, setPrintProfiles] = useState<number[]>([]);

  useEffect(() => {
    const handleGeneratePdf = (e: any) => {
      setPrintProfiles(e.detail);
      setIsPrinting(true);
      const hadDark = document.documentElement.classList.contains('dark');
      if (hadDark) document.documentElement.classList.remove('dark');
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
        if (hadDark) document.documentElement.classList.add('dark');
      }, 500);
    };
    window.addEventListener('generate-pdf', handleGeneratePdf);

    return () => {
      window.removeEventListener('generate-pdf', handleGeneratePdf);
    };
  }, []);

  const [activeSection, setActiveSection] = useState<string>('perfilador');

  useEffect(() => {
    const sectionIds = [
      'perfilador',
      'rendimiento',
      'cambios',
      'simulador',
      'drawdown',
      'correlacion',
      'contribuidores',
      'composicion',
      'aa-global',
      'credito',
      'stylebox',
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection('perfilador');
      }
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 3. Loading Screen (Prevents rendering the app before data arrives)
  if (loadingDb) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-zinc-500 font-bold uppercase tracking-widest animate-pulse">
          Cargando base de datos...
        </div>
      </div>
    );
  }

  // 4. Main App Render
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-50 font-sans antialiased selection:bg-slate-800 selection:text-white">
      {isPrinting ? (
        <PrintReportLayout profiles={printProfiles} />
      ) : (
        <>
          {/* Top Bar */}
          <Header activeSection={activeSection} />

          {/* Hero Section */}
          <Hero />

          {/* KPI Overview Strip */}
          <KpiStrip />

          {/* Main Content Sections */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            
            {/*
              Aviso no bloqueante. Antes, si la base de datos estaba vacia no se
              renderizaba ninguna seccion, aunque la mayoria no dependen de ella.
              Ahora se avisa del problema pero la pagina sigue siendo utilizable.
            */}
            {(dbError || (!loadingDb && reports.length === 0)) && (
              <div className="mt-8 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  {dbError ? 'Sin conexion con la base de datos' : 'Base de datos vacia'}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  Se muestran los ultimos datos disponibles. Sube un informe desde el panel de administracion para actualizarlos.
                </p>
              </div>
            )}

            <SectionPerfilador />
            <SectionRendimiento />
            <SectionCambios />
            <SectionBacktest />
            <SectionDrawdown />
            <SectionCorrelacion />
            <SectionContribuidores />
            <SectionComposicion />
            <SectionAssetAllocation />
            <SectionCredito />
            <SectionStyleBox />

            {/* Permite al equipo comprobar de un vistazo si la ultima subida se aplico. */}
            {lastUpdated && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right pt-4">
                Ultima actualizacion de datos:{' '}
                {lastUpdated.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}

          </main>

          {/* Corporate Footer at the bottom */}
          <Footer />
        </>
      )}
    </div>
  );
}