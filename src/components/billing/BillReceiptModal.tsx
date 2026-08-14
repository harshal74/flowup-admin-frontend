import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, XCircle, Receipt, Loader2, MessageCircle } from "lucide-react";

interface BillData {
  _id: string;
  invoiceNumber: string;
  tableNumber: number | null;
  subtotal: number;
  gst: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  items: { name: string; quantity: number; price: number; total: number }[];
  customerName?: string;
  customerMobile?: string;
}

interface Props {
  bill: BillData;
  /** UPI ID from restaurant settings (DB) — do NOT read from env */
  upiId: string;
  /** Restaurant name from DB settings */
  restaurantName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
}

// UPI deep-link: upi://pay?pa=<id>&pn=<name>&am=<amount>&cu=INR
function buildUpiUrl(upiId: string, amount: number, name: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: amount.toFixed(2),
    cu: "INR",
    tn: "Restaurant Bill Payment",
  });
  return `upi://pay?${params.toString()}`;
}

/** Build a WhatsApp-friendly bill summary message */
function buildWhatsAppMessage(bill: BillData, restaurantName: string): string {
  const date = new Date(bill.createdAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const itemLines = bill.items
    .map(i => `  • ${i.quantity}× ${i.name} — ₹${i.total.toFixed(2)}`)
    .join("\n");

  const tableInfo = bill.tableNumber ? `Table: ${bill.tableNumber}\n` : "";

  return (
    `🧾 *Bill from ${restaurantName}*\n` +
    `Invoice: ${bill.invoiceNumber}\n` +
    `Date: ${date}\n` +
    `${tableInfo}` +
    `\n*Items:*\n${itemLines}\n\n` +
    `Subtotal: ₹${bill.subtotal.toFixed(2)}\n` +
    `GST (5%): ₹${bill.gst.toFixed(2)}\n` +
    (bill.discount > 0 ? `Discount: −₹${bill.discount.toFixed(2)}\n` : "") +
    `*Total: ₹${bill.grandTotal.toFixed(2)}*\n\n` +
    `Payment: ${bill.paymentMethod}\n\n` +
    `Thank you for dining with us! 🙏`
  );
}

export default function BillReceiptModal({ bill, upiId, restaurantName, onConfirm, onCancel }: Props) {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [cancelLoading,  setCancelLoading]  = useState(false);

  const isUPI = bill.paymentMethod === "UPI";
  const upiUrl = buildUpiUrl(upiId, bill.grandTotal, restaurantName);

  const handleConfirm = async () => {
    setConfirmLoading(true);
    try { await onConfirm(); } finally { setConfirmLoading(false); }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try { await onCancel(); } finally { setCancelLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1,   opacity: 1, y: 0  }}
          exit={{    scale: 0.9, opacity: 0, y: 20  }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="bg-white dark:bg-secondary-800 rounded-3xl shadow-2xl w-full max-w-md
                     max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b
                          border-secondary-200 dark:border-secondary-700">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-bold text-secondary-900 dark:text-white">
                Bill Preview
              </h2>
            </div>
            <span className="text-xs text-secondary-400 font-mono">{bill.invoiceNumber}</span>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* UPI QR code */}
            {isUPI && upiId && (
              <div className="flex flex-col items-center gap-3 p-4
                              rounded-2xl bg-orange-50 dark:bg-orange-900/20
                              border border-orange-200 dark:border-orange-700">
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                  Scan to Pay via UPI
                </p>
                <div className="p-3 bg-white rounded-xl shadow-md">
                  <QRCodeSVG value={upiUrl} size={180} level="M" />
                </div>
                <p className="text-xs text-secondary-500 font-mono">{upiId}</p>
                <p className="text-2xl font-bold text-green-600">₹{bill.grandTotal.toFixed(2)}</p>
              </div>
            )}

            {isUPI && !upiId && (
              <div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-900/20 text-warning-700 text-sm text-center">
                UPI ID not configured. Set it in restaurant Settings → UPI ID.
              </div>
            )}

            {/* Bill breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                <span>Table</span>
                <span>#{bill.tableNumber ?? "—"}</span>
              </div>
              <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                <span>Subtotal</span>
                <span>₹{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                <span>GST (5%)</span>
                <span>₹{bill.gst.toFixed(2)}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−₹{bill.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 mt-1
                              border-t border-secondary-200 dark:border-secondary-700
                              text-secondary-900 dark:text-white">
                <span>Grand Total</span>
                <span>₹{bill.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-secondary-500 dark:text-secondary-400">
                <span>Payment Method</span>
                <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                  isUPI
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                    : "bg-secondary-100 text-secondary-600 dark:bg-secondary-700"
                }`}>
                  {bill.paymentMethod}
                </span>
              </div>
            </div>

            {/* Item list */}
            {bill.items.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Items</p>
                {bill.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm text-secondary-700 dark:text-secondary-300">
                    <span>{item.quantity}× {item.name}</span>
                    <span>₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Instruction for UPI */}
            {isUPI && (
              <p className="text-xs text-secondary-400 text-center">
                Ask the customer to scan the QR code and complete payment, then click <strong>Payment Received</strong>.
              </p>
            )}

            {/* WhatsApp bill share */}
            {bill.customerMobile && (
              <a
                href={`https://wa.me/${
                  bill.customerMobile.replace(/\D/g, "").replace(/^0/, "91")
                }?text=${encodeURIComponent(buildWhatsAppMessage(bill, restaurantName))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                           bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700
                           text-green-700 dark:text-green-300 text-sm font-medium
                           hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Send Bill on WhatsApp
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={handleCancel}
              disabled={cancelLoading || confirmLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-secondary-100 dark:bg-secondary-700
                         text-secondary-700 dark:text-secondary-200
                         hover:bg-secondary-200 dark:hover:bg-secondary-600
                         font-medium transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirmLoading || cancelLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-green-500 hover:bg-green-600
                         text-white font-semibold transition-colors disabled:opacity-50"
            >
              {confirmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isUPI ? "Payment Received" : "Confirm & Close"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
