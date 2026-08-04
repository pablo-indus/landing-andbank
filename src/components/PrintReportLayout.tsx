import React, { useEffect } from 'react';
import { PROFILES } from '../data/portfolioData';
import { SectionBacktest } from './SectionBacktest';
import { SectionDrawdown } from './SectionDrawdown';
import { SectionComposicion } from './SectionComposicion';
import { SectionAssetAllocation } from './SectionAssetAllocation';
import { SectionRendimiento } from './SectionRendimiento';
import { SectionContribuidores } from './SectionContribuidores';
import { globalSettings } from '../store';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

interface PrintReportLayoutProps {
  profiles: number[];
  isEmailing?: boolean;
  emailData?: { emails: string[], subject?: string, text?: string } | null;
  onEmailDone?: () => void;
}

export const PrintReportLayout: React.FC<PrintReportLayoutProps> = ({ profiles, isEmailing, emailData, onEmailDone }) => {
  const [emailStatus, setEmailStatus] = React.useState<'generating' | 'sending' | 'success' | 'error' | 'idle'>('idle');
  
  useEffect(() => {
    if (isEmailing && emailData && emailStatus === 'idle') {
      const sendEmail = async () => {
        try {
          setEmailStatus('generating');
          // Wait a bit for charts to render
          await new Promise(r => setTimeout(r, 1000));
          
          const reportEl = document.getElementById('report-container');
          if (!reportEl) throw new Error('Report container not found');

          const canvas = await html2canvas(reportEl, { scale: 1.5, useCORS: true });
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          let heightLeft = pdfHeight;
          let position = 0;
          
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
          
          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
          }
          
          const pdfBlob = pdf.output('blob');
          
          setEmailStatus('sending');
          
          const formData = new FormData();
          formData.append('pdf', pdfBlob, 'Reporte_Inversion.pdf');
          formData.append('emails', JSON.stringify(emailData.emails));
          if (emailData.subject) formData.append('subject', emailData.subject);
          if (emailData.text) formData.append('text', emailData.text);
          
          const res = await fetch('/api/send-report', {
            method: 'POST',
            body: formData
          });
          
          if (!res.ok) throw new Error('API Error');
          
          setEmailStatus('success');
          setTimeout(() => {
            if (onEmailDone) onEmailDone();
          }, 3000);
          
        } catch (err) {
          console.error(err);
          setEmailStatus('error');
          setTimeout(() => {
            if (onEmailDone) onEmailDone();
          }, 3000);
        }
      };
      
      sendEmail();
    }
  }, [isEmailing, emailData, emailStatus, onEmailDone]);

  useEffect(() => {
    const defaultTitle = document.title;
    const profileNames = profiles.map(p => PROFILES[p]).join('_').replace(/[^a-zA-Z0-9_]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    document.title = `Mandatos_${profileNames}_${dateStr}`;
    return () => {
      document.title = defaultTitle;
    };
  }, [profiles]);

  return (
    <>
      {isEmailing && (
        <div className="fixed inset-0 z-[200] bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 p-8 rounded-2xl shadow-2xl max-w-sm w-full flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            {emailStatus === 'generating' && (
              <>
                <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h3 className="text-lg font-bold">Generando PDF...</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Renderizando gráficos y datos</p>
              </>
            )}
            {emailStatus === 'sending' && (
              <>
                <Mail className="w-12 h-12 text-blue-600 animate-pulse mb-4" />
                <h3 className="text-lg font-bold">Enviando Email...</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Conectando con el servidor</p>
              </>
            )}
            {emailStatus === 'success' && (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-4" />
                <h3 className="text-lg font-bold text-emerald-700">¡Enviado con éxito!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">El reporte ha sido enviado a los clientes</p>
              </>
            )}
            {emailStatus === 'error' && (
              <>
                <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
                <h3 className="text-lg font-bold text-red-700">Error al enviar</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">No se pudo enviar el email. Inténtelo más tarde.</p>
              </>
            )}
          </div>
        </div>
      )}
      <div id="report-container" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 print:block" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        
        {/* Cover Page */}
        <div className="print:h-screen print:w-full print:flex print:flex-col print:break-after-page bg-white dark:bg-zinc-900 font-sans" style={{ pageBreakAfter: "always", breakAfter: "page" }}>
          {/* Top white section */}
          <div className="flex-1 bg-white dark:bg-zinc-900 p-12 flex items-start justify-end">
            <img src="/logo.png" alt="Andbank" className="h-20 lg:h-24 object-contain mt-4 mr-4" onError={(e) => { (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Andbank_logo.png/320px-Andbank_logo.png'; }} />
          </div>
          
          {/* Red separator */}
          <div className="h-8 bg-[#E32119] w-full"></div>
          
          {/* Bottom gray section */}
          <div className="h-[40%] bg-[#BDBDBD] p-12 flex flex-col justify-start items-end text-right pt-16 pr-16">
             <h1 className="text-4xl font-bold text-[#333333] tracking-tight mb-8">
               Consulta Histórica
             </h1>
             <p className="text-xl font-bold text-[#333333] mb-8">
               Julio 2026
             </p>
             <div className="text-lg font-bold text-[#444444] flex flex-col items-end gap-1 mt-auto pb-4">
               {profiles.map(p => (
                 <span key={p}>{PROFILES[p]}</span>
               ))}
             </div>
          </div>
        </div>
        {/* Content Pages */}
        <div className="print:p-4 print:max-w-none max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-between border-b-2 border-[#7A1611] pb-2 mb-4">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight uppercase">Resumen de Inversión</h1>
            </div>
            <img src="/logo.png" alt="Andbank" className="h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Andbank_logo.png/320px-Andbank_logo.png'; }} />
          </div>

                    <div className="space-y-4">

            {/* Rendimiento */}
            <div className="pt-2 " >
              <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1 break-after-avoid">1. Resumen de Rendimiento</h2>
              <div className="w-full">
                <SectionRendimiento forcedActiveIndices={profiles} isPrintMode={true} />
              </div>
            </div>

            {/* Contribuidores */}
            <div className="pt-4 " >
              <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1 break-after-avoid">2. Análisis de Contribuidores</h2>
              <div className="w-full">
                <SectionContribuidores forcedActiveIndices={profiles} isPrintMode={true} />
              </div>
            </div>
            
            {/* Backtest */}
            <div className="pt-4 " >
              <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1 break-after-avoid">3. Simulación de Backtest</h2>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">Simulación basada en los parámetros actuales. Capital inicial: {globalSettings.backtest.initialAmount.toLocaleString('es-ES')} €</p>
              <div className="w-full">
                <SectionBacktest forcedProfileIndices={profiles} isPrintMode={true} />
              </div>
            </div>
            
            {/* Drawdown */}
            <div className="pt-4 " >
              <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1 break-after-avoid">4. Análisis de Drawdown y Estrés</h2>
              <div className="w-full">
                <SectionDrawdown forcedActiveIndices={profiles} isPrintMode={true} />
              </div>
            </div>

            {/* Composición */}
            <div className="w-full mt-8 pt-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1 break-after-avoid">5. Desglose de Fondos Subyacentes</h2>
              <SectionComposicion forcedActiveIndices={profiles} isPrintMode={true} />
            </div>

            {/* Asset Allocation */}
            <div className="pt-8 w-full">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1 break-after-avoid">6. Asset Allocation y Distribución Estratégica</h2>
                <div className="w-full">
                  <SectionAssetAllocation forcedActiveIndices={profiles} isPrintMode={true} />
                </div>
              </div>
              
              <div className="mt-12 pt-8 pb-4 text-[9px] text-zinc-400 text-center border-t border-zinc-100">
                Documento generado a modo ilustrativo. Las rentabilidades pasadas no garantizan rentabilidades futuras.
              </div>
            </div>

          </div>
        </div>
    </div>
    </>
  );
};
