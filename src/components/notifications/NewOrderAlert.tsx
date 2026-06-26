import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShoppingBag, MapPin, Clock } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import type { OrderItem } from "../../types";

export function NewOrderAlert() {
  const {
  pendingOrders,
  isRinging,
  acceptOrder,
  rejectOrder,
} = useNotification();
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] =
  useState(false);

  if (pendingOrders.length === 0 && !isRinging) return null;
  const currentOrder = pendingOrders[0];

  const handleReject = async () => {
    if (rejectingOrderId && rejectReason) {
      await rejectOrder(rejectingOrderId, rejectReason);
      setRejectingOrderId(null);
      setRejectReason('');
    }
  };

  return (
    <AnimatePresence>
      {(pendingOrders.length > 0 || isRinging) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="w-full max-w-lg relative">
            <div className="absolute inset-0 -m-4">
              <div className="absolute inset-0 rounded-3xl bg-warning-500/20 animate-ping" />
              <div className="absolute inset-0 rounded-3xl bg-warning-500/10 animate-pulse" />
            </div>

            <div className="relative card p-6 animate-pulse-border border-2 border-warning-500 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-warning-500 flex items-center justify-center animate-bounce">
                    <ShoppingBag className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-secondary-900 dark:text-white">NEW ORDER RECEIVED!</h2>
                    <p className="text-sm text-secondary-500">{pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} pending</p>
                  </div>
                </div>
                {currentOrder && <span className="badge badge-pending">{currentOrder.status}</span>}
              </div>

              {currentOrder && (
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-700/50">
                      <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-1">Order Number</p>
                      <p className="font-bold text-lg text-primary-600">#{currentOrder.orderNumber}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-700/50">
                      <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-1">Total Amount</p>
                      <p className="font-bold text-lg text-success-600">₹{(currentOrder.totalAmount || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-700/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <span className="font-bold text-primary-600">{currentOrder.customerId?.name?.charAt(0) || 'G'}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-secondary-900 dark:text-white">{currentOrder.customerId?.name || 'Guest Customer'}</p>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400">{currentOrder.customerId?.mobile || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-100 dark:bg-secondary-700">
                      <Clock className="w-4 h-4 text-secondary-500" />
                      <span className="text-sm text-secondary-700 dark:text-secondary-300">{new Date(currentOrder.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                      <ShoppingBag className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium text-primary-700 dark:text-primary-300">{currentOrder.orderType}</span>
                    </div>
                    {currentOrder.tableNumber && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success-100 dark:bg-success-900/30">
                        <MapPin className="w-4 h-4 text-success-500" />
                        <span className="text-sm font-medium text-success-700 dark:text-success-300">Table {currentOrder.tableNumber}</span>
                      </div>
                    )}
                  </div>

                  {currentOrder.orderType === 'DELIVERY' && currentOrder.address && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                      <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{currentOrder.address}</span>
                    </div>
                  )}

                  {currentOrder.items && currentOrder.items.length > 0 && (
                    <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-700/50">
                      <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-2">Items</p>
                      <div className="space-y-1">
  {(currentOrder.items || [])
    .slice(0, 3)
    .map((item: OrderItem, idx: number) => (
      <div
        key={idx}
        className="flex justify-between text-sm"
      >
        <span className="text-secondary-700 dark:text-secondary-300">
          {item.quantity}x {item.name}
        </span>

        <span className="font-medium text-secondary-900 dark:text-white">
          ₹{(item.subtotal || 0).toFixed(2)}
        </span>
      </div>
    ))}

  {(currentOrder.items?.length || 0) > 3 && (
    <p className="text-xs text-secondary-500">
      +{currentOrder.items.length - 3} more items
    </p>
  )}
</div>
                    </div>
                  )}
                </div>
              )}

              {currentOrder && !rejectingOrderId && (
                <div className="flex gap-3">
  <button
    onClick={async () => {
      setProcessing(true);

      await acceptOrder(
        currentOrder._id
      );

      setProcessing(false);
    }}
    disabled={processing}
    className="btn btn-success flex-1 py-3"
  >
    <Check className="w-5 h-5" />

    {processing
      ? "Accepting..."
      : "Accept Order"}
  </button>

  <button
    onClick={() =>
      setRejectingOrderId(
        currentOrder._id
      )
    }
    disabled={processing}
    className="btn btn-danger flex-1 py-3"
  >
    <X className="w-5 h-5" />

    Reject Order
  </button>
</div>
              )}

              {rejectingOrderId && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Rejection Reason</label>
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="input min-h-[100px]" placeholder="e.g., Out of stock, Kitchen closed..." autoFocus />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setRejectingOrderId(null); setRejectReason(''); }} className="btn btn-secondary flex-1">Cancel</button>
                    <button onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-danger flex-1">Confirm Rejection</button>
                  </div>
                </div>
              )}

              {pendingOrders.length > 1 && (
                <div className="mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-700">
                  <p className="text-sm text-center text-secondary-500 dark:text-secondary-400">+ {pendingOrders.length - 1} more order{pendingOrders.length > 2 ? 's' : ''} in queue</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
