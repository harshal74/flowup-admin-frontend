/**
 * Admin — Table QR Codes Page
 *
 * Generates one QR code per restaurant table that links to the customer ordering URL.
 * Uses restaurant settings (totalTables, restaurantName) from RestaurantContext.
 * QR codes are generated client-side — no backend API needed.
 *
 * Features:
 *  - Individual PNG download (full card with restaurant name, table number, QR, "SCAN TO ORDER")
 *  - Download All as ZIP
 *  - Print All (CSS @media print hides chrome)
 *  - Search/filter by table number
 *  - Refresh button
 */

import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download, Printer, RefreshCw, Search, QrCode, Loader2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRestaurant } from '../context/RestaurantContext';

// ── Customer URL builder ──────────────────────────────────────────
const CUSTOMER_BASE =
  (import.meta.env.VITE_CUSTOMER_URL as string) || 'http://localhost:5174';

function buildTableUrl(tableNumber: number): string {
  // Customer HomePage reads: ?table=N or ?tableNumber=N
  return `${CUSTOMER_BASE}?table=${tableNumber}`;
}

// ── Canvas-based card image generation ────────────────────────────
// Draws a full printable QR card onto an offscreen canvas and returns
// a PNG data URL. Used for individual download + ZIP generation.
async function generateCardImage(
  restaurantName: string,
  tableNumber: number,
  qrUrl: string,
): Promise<Blob> {
  const W = 600;
  const H = 780;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.roundRect(0, 0, W, H, 24);
  ctx.stroke();

  // Restaurant name
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(restaurantName.toUpperCase(), W / 2, 60);

  // Table number
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.fillText(`TABLE ${tableNumber}`, W / 2, 115);

  // QR code — render via temporary SVG→Image
  const qrSize = 360;
  const qrX = (W - qrSize) / 2;
  const qrY = 150;

  // Create a temporary QR SVG string
  const svgNS = 'http://www.w3.org/2000/svg';
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  document.body.appendChild(tempDiv);

  // Use the QRCodeSVG render trick: create an inline SVG
  const { createRoot } = await import('react-dom/client');
  const { createElement } = await import('react');

  await new Promise<void>((resolve) => {
    const root = createRoot(tempDiv);
    root.render(
      createElement(QRCodeSVG, {
        value: qrUrl,
        size: qrSize,
        level: 'M',
        includeMargin: true,
      })
    );
    // Wait for render
    setTimeout(() => {
      const svgEl = tempDiv.querySelector('svg');
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

          // "SCAN TO ORDER" text
          ctx.fillStyle = '#374151';
          ctx.font = 'bold 22px Inter, system-ui, sans-serif';
          ctx.fillText('SCAN TO ORDER', W / 2, qrY + qrSize + 50);

          // Small URL hint
          ctx.fillStyle = '#9ca3af';
          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.fillText('Powered by FlowUp', W / 2, H - 30);

          resolve();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      } else {
        resolve();
      }
    }, 50);
  });

  document.body.removeChild(tempDiv);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
  });
}

// ── Filename helper ───────────────────────────────────────────────
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ── Component ─────────────────────────────────────────────────────
export default function QRCodesPage() {
  const { restaurant, refreshRestaurant } = useRestaurant();
  const [search,       setSearch]       = useState('');
  const [downloading,  setDownloading]  = useState(false);
  const [singleDL,     setSingleDL]     = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const totalTables    = restaurant?.totalTables ?? 0;
  const restaurantName = restaurant?.restaurantName || 'Restaurant';

  // Generate table list
  const allTables = Array.from({ length: totalTables }, (_, i) => i + 1);
  const tables    = search.trim()
    ? allTables.filter(t => String(t).includes(search.trim()))
    : allTables;

  // ── Individual download ───────────────────────────────────────
  const handleDownloadOne = async (tableNum: number) => {
    setSingleDL(tableNum);
    try {
      const blob = await generateCardImage(restaurantName, tableNum, buildTableUrl(tableNum));
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${sanitizeName(restaurantName)}-Table-${tableNum}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Table ${tableNum} QR downloaded`);
    } catch {
      toast.error('Failed to generate QR image');
    } finally {
      setSingleDL(null);
    }
  };

  // ── Download All as ZIP ───────────────────────────────────────
  const handleDownloadAll = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const [JSZip, { saveAs }] = await Promise.all([
        import('jszip').then(m => m.default || m),
        import('file-saver'),
      ]);
      const zip = new JSZip();

      for (let i = 1; i <= totalTables; i++) {
        toast.loading(`Generating Table ${i}/${totalTables}…`, { id: 'zip-progress' });
        const blob = await generateCardImage(restaurantName, i, buildTableUrl(i));
        zip.file(`${sanitizeName(restaurantName)}-Table-${i}.png`, blob);
      }

      toast.loading('Creating ZIP…', { id: 'zip-progress' });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${sanitizeName(restaurantName)}-QR-Codes.zip`);
      toast.success(`${totalTables} QR codes downloaded!`, { id: 'zip-progress' });
    } catch (err) {
      toast.error('Failed to create ZIP', { id: 'zip-progress' });
    } finally {
      setDownloading(false);
    }
  };

  // ── Print ─────────────────────────────────────────────────────
  const handlePrint = () => {
    // Open a clean print window with only QR cards — bypasses layout overflow constraints
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Please allow popups to print QR codes');
      return;
    }

    // Build QR SVG strings from the current page
    const qrGrid = document.getElementById('qr-print-area');
    if (!qrGrid) return;

    const cards = qrGrid.querySelectorAll('[data-qr-card]');
    let cardsHtml = '';
    cards.forEach(card => {
      cardsHtml += `<div class="qr-card">${card.innerHTML}</div>`;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${restaurantName} — Table QR Codes</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Inter, system-ui, sans-serif; background: white; color: #111; padding: 20px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .qr-card {
            border: 1px solid #ddd;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .qr-card p { margin: 0; }
          .qr-card svg { margin: 12px auto; display: block; }
          button { display: none !important; }
          @media print {
            body { padding: 0; }
            .grid { gap: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="grid">${cardsHtml}</div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── Refresh ───────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    await refreshRestaurant();
    toast.success('Table configuration refreshed');
  }, [refreshRestaurant]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header — hidden when printing */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Table QR Codes</h1>
            <p className="text-secondary-500 dark:text-secondary-400 text-sm mt-0.5">
              {restaurantName} · {totalTables} tables configured
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRefresh} className="btn btn-secondary text-sm py-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={handlePrint} className="btn btn-secondary text-sm py-2">
              <Printer className="w-4 h-4" /> Print All
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={downloading || totalTables === 0}
              className="btn btn-primary text-sm py-2"
            >
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
                : <><Download className="w-4 h-4" /> Download All</>
              }
            </button>
          </div>
        </div>

        {/* Search */}
        {totalTables > 6 && (
          <div className="relative max-w-xs mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value.replace(/\D/g, ''))}
              placeholder="Search table number…"
              className="input pl-10 py-2 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {totalTables === 0 ? (
        <div className="card p-12 text-center print:hidden">
          <QrCode className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-3" />
          <p className="text-secondary-500 dark:text-secondary-400">
            No tables configured. Set the table count in Settings.
          </p>
        </div>
      ) : (
        /* QR card grid */
        <div
          ref={printRef}
          id="qr-print-area"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6
                     print:grid-cols-2 print:gap-4"
        >
          {tables.map(tableNum => (
            <div
              key={tableNum}
              data-qr-card
              className="card p-6 flex flex-col items-center gap-4
                         print:break-inside-avoid print:shadow-none print:border print:border-gray-300"
            >
              <p className="text-sm font-bold text-secondary-700 dark:text-secondary-300 uppercase tracking-wide">
                {restaurantName}
              </p>
              <p className="text-2xl font-black text-primary-600 dark:text-primary-400">
                TABLE {tableNum}
              </p>

              <div className="p-3 bg-white rounded-xl border border-secondary-200 dark:border-secondary-700">
                <QRCodeSVG
                  value={buildTableUrl(tableNum)}
                  size={180}
                  level="M"
                  includeMargin
                />
              </div>

              <p className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">
                Scan to Order
              </p>

              {/* Download button — hidden when printing */}
              <button
                onClick={() => handleDownloadOne(tableNum)}
                disabled={singleDL === tableNum}
                className="btn btn-secondary text-xs py-1.5 px-3 print:hidden"
              >
                {singleDL === tableNum
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Download className="w-3 h-3" />
                }
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Print handled by separate window — no @media print CSS needed here */}
    </div>
  );
}
