import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing } from 'lucide-react';
import { useNotification, type WaiterRequest } from '../../context/NotificationContext';

const TOAST_VISIBLE_MS = 6000;

// ── Single toast ──────────────────────────────────────────────────
function SingleToast({ req, onHide }: { req: WaiterRequest; onHide: () => void }) {
  const [progress, setProgress] = useState(100);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide; // always latest

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / TOAST_VISIBLE_MS) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(tick);
    }, 50);
    const t = setTimeout(() => onHideRef.current(), TOAST_VISIBLE_MS);
    return () => { clearInterval(tick); clearTimeout(t); };
  }, []); // runs once on mount

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,   scale: 1   }}
      exit={{    opacity: 0, x: 100, scale: 0.9  }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="relative w-80 overflow-hidden bg-white dark:bg-secondary-800
                 border-l-4 border-orange-500 rounded-2xl
                 shadow-2xl shadow-orange-200/60 dark:shadow-none"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-100 dark:bg-orange-900/30
                        flex items-center justify-center mt-0.5">
          <BellRing className="w-5 h-5 text-orange-500 animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-secondary-900 dark:text-white">
            🔔 Table {req.tableNumber} — Needs assistance
          </p>
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
            {req.customerName ? `Customer: ${req.customerName}` : 'A customer is calling for a waiter'}
          </p>
          <p className="text-xs text-secondary-400 dark:text-secondary-500 mt-1">
            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-[10px] text-orange-400 mt-1 font-medium">Check 🔔 notification bell</p>
        </div>
      </div>
      {/* Drain bar */}
      <div className="h-1 bg-orange-100 dark:bg-orange-900/30">
        <div className="h-full bg-orange-500" style={{ width: `${progress}%`, transition: 'none' }} />
      </div>
    </motion.div>
  );
}

// ── Toast manager ─────────────────────────────────────────────────
export function WaiterRequestToast() {
  const { waiterRequests } = useNotification();

  // Timestamp when this component mounted — ignore DB-loaded items older than mount
  const mountedAt    = useRef(Date.now());
  // IDs already shown as a toast — never show again
  const shownIds     = useRef<Set<string>>(new Set());
  // Currently visible toasts (local state, independent of dropdown)
  const [toasts, setToasts] = useState<WaiterRequest[]>([]);

  useEffect(() => {
    // Only show a toast for items that:
    // 1. Are genuinely new (not already shown)
    // 2. Arrived AFTER this component mounted (not old DB records)
    const brand_new = waiterRequests.filter(r => {
      if (shownIds.current.has(r._id)) return false;
      const arrivedAt = new Date(r.createdAt).getTime();
      // Allow 5s grace window so items arriving right on mount are still shown
      return arrivedAt >= mountedAt.current - 5000;
    });

    if (brand_new.length === 0) return;
    brand_new.forEach(r => shownIds.current.add(r._id));
    setToasts(prev => [...brand_new, ...prev]);
  }, [waiterRequests]);

  const hide = (id: string) => setToasts(prev => prev.filter(r => r._id !== id));

  return (
    <div className="fixed top-20 right-4 z-40 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map(req => (
          <div key={req._id} className="pointer-events-auto">
            <SingleToast req={req} onHide={() => hide(req._id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
