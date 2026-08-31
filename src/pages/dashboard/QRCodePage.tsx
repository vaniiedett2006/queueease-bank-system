import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useLanguage } from '../../lib/LanguageContext';
import { Download, Printer } from 'lucide-react';

export function QRCodePage() {
  const { t } = useLanguage();
  const regularCanvasRef = useRef<HTMLCanvasElement>(null);
  const priorityCanvasRef = useRef<HTMLCanvasElement>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    const url = window.location.origin;
    setBaseUrl(url);
    const regularUrl = `${url}/customer/regular`;
    const priorityUrl = `${url}/customer/priority`;

    if (regularCanvasRef.current) {
      QRCode.toCanvas(regularCanvasRef.current, regularUrl, {
        width: 250,
        margin: 2,
        color: { dark: '#03045E', light: '#FFFFFF' },
      });
    }
    if (priorityCanvasRef.current) {
      QRCode.toCanvas(priorityCanvasRef.current, priorityUrl, {
        width: 250,
        margin: 2,
        color: { dark: '#047857', light: '#FFFFFF' },
      });
    }
  }, []);

  function downloadQR(canvas: HTMLCanvasElement | null, filename: string) {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function printQR(title: string, canvas: HTMLCanvasElement | null, url: string) {
    if (!canvas) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dataUrl = canvas.toDataURL('image/png');
    printWindow.document.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; text-align: center; padding: 40px; }
        h1 { color: #03045E; font-size: 24px; margin-bottom: 8px; }
        p { color: #666; font-size: 14px; margin-bottom: 20px; }
        img { width: 300px; height: 300px; }
        .url { margin-top: 16px; font-size: 12px; color: #999; }
      </style>
      </head><body>
        <h1>QueueEase</h1>
        <p>${title}</p>
        <img src="${dataUrl}" />
        <p class="url">${url}</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  const qrCards = [
    {
      title: t('qr.regular'),
      desc: t('qr.regular_desc'),
      canvasRef: regularCanvasRef,
      url: `${baseUrl}/customer/regular`,
      filename: 'queueease-regular-qr.png',
      color: 'bg-blue-500',
    },
    {
      title: t('qr.priority'),
      desc: t('qr.priority_desc'),
      canvasRef: priorityCanvasRef,
      url: `${baseUrl}/customer/priority`,
      filename: 'queueease-priority-qr.png',
      color: 'bg-accent-500',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-700">{t('qr.title')}</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {qrCards.map((qr, i) => (
          <div key={i} className="card p-8 text-center">
            <div className={`w-12 h-12 rounded-xl ${qr.color} flex items-center justify-center mx-auto mb-4 overflow-hidden`}>
              <img src="/queueease-logo.png" alt="QueueEase" className="h-10 w-10 object-contain" />
            </div>
            <h3 className="text-lg font-bold text-navy-700 mb-1">{qr.title}</h3>
            <p className="text-sm text-gray-500 mb-6">{qr.desc}</p>

            <div className="inline-block p-4 bg-white border-2 border-gray-100 rounded-xl shadow-sm mb-4">
              <canvas ref={qr.canvasRef} />
            </div>

            <p className="text-xs text-gray-400 mb-4 break-all">{qr.url}</p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => downloadQR(qr.canvasRef.current, qr.filename)}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('qr.download')}
              </button>
              <button
                onClick={() => printQR(qr.title, qr.canvasRef.current, qr.url)}
                className="btn-primary flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                {t('qr.print')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
