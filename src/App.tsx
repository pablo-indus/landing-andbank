import React, { useState, useEffect } from 'react';
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProfiles, setPrintProfiles] = useState<number[]>([]);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailData, setEmailData] = useState<{emails: string[], subject?: string, text?: string} | null>(null);

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
    const handleEmailPdf = (e: any) => {
      setPrintProfiles(e.detail.profiles);
      setEmailData({ emails: e.detail.emails, subject: e.detail.subject, text: e.detail.text });
      setIsEmailing(true);
    };
    window.addEventListener('email-pdf', handleEmailPdf);
    return () => {
      window.removeEventListener('generate-pdf', handleGeneratePdf);
      window.removeEventListener('email-pdf', handleEmailPdf);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-50 font-sans antialiased selection:bg-slate-800 selection:text-white">
      {isPrinting || isEmailing ? (
        <PrintReportLayout profiles={printProfiles} isEmailing={isEmailing} emailData={emailData} onEmailDone={() => { setIsEmailing(false); setEmailData(null); }} />
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
      </main>

      {/* Corporate Footer at the bottom */}
      <Footer />
        </>
      )}
    </div>
  );
}
