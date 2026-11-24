import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User, MapPin, Check, Clock, ChefHat, Package,
  Truck, XCircle, Receipt, AlertCircle, CalendarCheck,
} from "lucide-react";
import toast from "react-hot-toast";

import BillingFilter    from "../components/billing/BillingFilter";
import BillingTable     from "../components/billing/BillingTable";
import BillingSummary   from "../components/billing/BillingSummary";
import BillReceiptModal from "../components/billing/BillReceiptModal";

import {
  getUnpaidOrders,
  generateBill,
  confirmPayment,
  cancelBill,
  splitBill,
  confirmSplitPayment,
} from "../services/billingService";
import type { SplitRequest, PayMethod, SplitType, BillSplit } from "../components/billing/SplitBill";

import type { Order, OrderStatus } from "../types";

interface GeneratedBill {
  sgst?: number;
  cgst?: number;
  splitType?: SplitType;
  splits?: BillSplit[];
  paidAmount?: number;
  remainingAmount?: number;
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
  items: { menuItemId?: string; name: string; quantity: number; price: number; total: number }[];
  customerName?: string;
  customerMobile?: string;
}

interface RemainingOrder {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  subtotalAmount?: number;
  tableNumber: number;
  customerName: string;
  items?: { name: string; quantity: number; price: number; subtotal: number }[];
  createdAt: string;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  PENDING:          { label: "Pending",         color: "text-amber-700 dark:text-amber-400",   bgColor: "bg-amber-50 dark:bg-amber-900/20",   icon: Clock    },
  ACCEPTED:         { label: "Accepted",         color: "text-blue-700 dark:text-blue-400",     bgColor: "bg-blue-50 dark:bg-blue-900/20",     icon: Check    },
  PREPARING:        { label: "Preparing",        color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-900/20", icon: ChefHat  },
  READY:            { label: "Ready",            color: "text-teal-700 dark:text-teal-400",     bgColor: "bg-teal-50 dark:bg-teal-900/20",     icon: Package  },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-indigo-700 dark:text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-900/20", icon: Truck    },
  COMPLETED:        { label: "Completed",        color: "text-green-700 dark:text-green-400",   bgColor: "bg-green-50 dark:bg-green-900/20",   icon: Check    },
  REJECTED:         { label: "Rejected",         color: "text-red-700 dark:text-red-400",       bgColor: "bg-red-50 dark:bg-red-900/20",       icon: XCircle  },
  CANCELLED:        { label: "Cancelled",        color: "text-secondary-600 dark:text-secondary-400", bgColor: "bg-secondary-100 dark:bg-secondary-700/40", icon: X },
};

export default function BillingPage() {
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [activeBill,     setActiveBill]     = useState<GeneratedBill | null>(null);
  // Payment settings returned by the generateBill API — UPI ID comes from DB, not env
  const [upiId,          setUpiId]          = useState("");
  const [restaurantName, setRestaurantName] = useState("FlowUp Restaurant");
  // GST settings from the bill API response (authoritative — computed by backend)
  const [gstSettings,    setGstSettings]    = useState<{ gstEnabled: boolean; sgstRate: number; cgstRate: number }>({ gstEnabled: false, sgstRate: 0, cgstRate: 0 });
  const [selectedOrder,  setSelectedOrder]  = useState<Order | null>(null);
  const [showDrawer,     setShowDrawer]     = useState(false);
  const [remainingOrders, setRemainingOrders] = useState<RemainingOrder[]>([]);

  // Reservation auto-completed after dine-in billing
  interface ReservationCompletedInfo {
    reservationId: string;
    tableNumber: number;
    guestName: string;
    numberOfPeople: number;
  }
  const [reservationCompletedInfo, setReservationCompletedInfo] = useState<ReservationCompletedInfo | null>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [tableSearch,    setTableSearch]    = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [discount,       setDiscount]       = useState(0);
  const [paymentMethod,  setPaymentMethod]  = useState("Cash");

  // BUG M  FIX: wrap in useCallback so the debounce effect always has a fresh reference
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getUnpaidOrders(customerSearch, tableSearch);
      setOrders(response.orders || []);
    } catch {
      toast.error("Failed to fetch unpaid orders.");
    } finally {
      setLoading(false);
    }
  }, [customerSearch, tableSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    const t = setTimeout(() => fetchOrders(), 400);
    return () => clearTimeout(t);
  }, [customerSearch, tableSearch, fetchOrders]);

  const handleSelectOrder = (id: string) =>
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSelectAll = () =>
    setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map(o => o._id));

  const selected = useMemo(() => orders.filter(o => selectedOrders.includes(o._id)), [orders, selectedOrders]);
  const subtotal  = useMemo(() => selected.reduce((s, o) => s + o.totalAmount, 0), [selected]);
  // GST is calculated by the backend on bill generation.
  // This frontend preview is shown before the bill is generated — use 0 until the backend confirms.
  // After bill generation, the receipt modal uses the bill's actual sgst/cgst values.
  const gst = 0; // preview only; real value comes from backend bill response

  const handleGenerateBill = async () => {
    if (selectedOrders.length === 0) { toast.error("Please select at least one order."); return; }
    try {
      setBillingLoading(true);
      const response = await generateBill({ orderIds: selectedOrders, discount, paymentMethod });
      // Merge customer info into the bill object for the modal
      setActiveBill({
        ...response.bill,
        customerName:   response.customer?.name   || "",
        customerMobile: response.customer?.mobile || "",
      });
      // UPI ID and restaurant name come from the DB via the API response
      setUpiId(response.paymentSettings?.upiId || "");
      setRestaurantName(response.paymentSettings?.restaurantName || "FlowUp Restaurant");
      setGstSettings({
        gstEnabled: response.paymentSettings?.gstEnabled ?? false,
        sgstRate:   response.paymentSettings?.sgstRate   ?? 0,
        cgstRate:   response.paymentSettings?.cgstRate   ?? 0,
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to generate bill.");
    } finally {
      setBillingLoading(false);
    }
  };

  /** Shared by single-payment confirm and the last split payment. */
  const afterBillPaid = (response: any) => {
    setActiveBill(null); setSelectedOrders([]); setDiscount(0);
    fetchOrders();
    // If there are still unpaid orders at the same table, show the popup
    const remaining: RemainingOrder[] = response.remainingOrders || [];
    if (remaining.length > 0) {
      setRemainingOrders(remaining);
    }
    // If an ARRIVED reservation was auto-completed after all orders paid, show notification
    if (response.reservationCompleted) {
      setReservationCompletedInfo(response.reservationCompleted);
    }
  };

  const handleConfirmPayment = async () => {
    if (!activeBill) return;
    try {
      const response = await confirmPayment(activeBill._id);
      toast.success("Payment confirmed! Bill closed.");
      afterBillPaid(response);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to confirm payment.");
    }
  };

  // Keep customer info (not part of the bill document) when the bill is refreshed
  const mergeBill = (bill: GeneratedBill) =>
    setActiveBill(prev => prev ? { ...bill, customerName: prev.customerName, customerMobile: prev.customerMobile } : bill);

  const handleSplitBill = async (req: SplitRequest) => {
    if (!activeBill) return;
    try {
      const response = await splitBill(activeBill._id, req);
      mergeBill(response.bill);
      toast.success(req.splitType === "NONE" ? "Split removed." : "Bill split. Collect each person's payment.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to split bill.");
      throw error; // keep the editor open
    }
  };

  const handleConfirmSplit = async (splitId: string, method: PayMethod) => {
    if (!activeBill) return;
    try {
      const response = await confirmSplitPayment(activeBill._id, splitId, method);
      if (response.billPaid) {
        toast.success("Everyone has paid. Bill closed.");
        afterBillPaid(response);
      } else {
        mergeBill(response.bill);
        toast.success(response.message || "Split paid.");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to confirm split payment.");
    }
  };

  const handleCancelBill = async () => {
    if (!activeBill) return;
    try {
      await cancelBill(activeBill._id);
      toast("Bill cancelled. Orders returned to unpaid list.");
      setActiveBill(null); fetchOrders();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to cancel bill.");
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowDrawer(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Billing</h1>
        <p className="text-secondary-500 dark:text-secondary-400">Generate bills for completed unpaid orders</p>
      </div>

      <BillingFilter
        customer={customerSearch} table={tableSearch}
        onCustomerChange={setCustomerSearch} onTableChange={setTableSearch}
        onRefresh={fetchOrders}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <BillingTable
            orders={orders} selectedOrders={selectedOrders}
            onSelectOrder={handleSelectOrder} onSelectAll={handleSelectAll}
            onViewOrder={handleViewOrder} loading={loading}
          />
        </div>
        <BillingSummary
          selectedCount={selectedOrders.length} subtotal={subtotal} gst={gst}
          discount={discount} paymentMethod={paymentMethod} loading={billingLoading}
          onDiscountChange={setDiscount} onPaymentMethodChange={setPaymentMethod}
          onGenerateBill={handleGenerateBill}
        />
      </div>

      {/* Bill receipt / payment modal — upiId and restaurantName come from DB via API */}
      {activeBill && (
        <BillReceiptModal
          bill={activeBill}
          upiId={upiId}
          restaurantName={restaurantName}
          gstSettings={gstSettings}
          onConfirm={handleConfirmPayment}
          onCancel={handleCancelBill}
          onSplit={handleSplitBill}
          onConfirmSplit={handleConfirmSplit}
        />
      )}

      {/* ── Remaining unpaid orders popup ────────────────────── */}
      <AnimatePresence>
        {remainingOrders.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setRemainingOrders([])}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-secondary-800
                              rounded-2xl shadow-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-secondary-200 dark:border-secondary-700">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30
                                    flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-secondary-900 dark:text-white text-sm">
                        Table {remainingOrders[0].tableNumber} — Unpaid Orders Remaining
                      </h3>
                      <p className="text-xs text-secondary-500">
                        {remainingOrders.length} order{remainingOrders.length !== 1 ? "s" : ""} still unpaid at this table
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRemainingOrders([])}
                    className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-secondary-500" />
                  </button>
                </div>

                {/* Orders list — scrollable, with full item details */}
                <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
                  {remainingOrders.map((order) => (
                    <div key={order._id}
                      className="rounded-xl border border-secondary-200 dark:border-secondary-700
                                 bg-secondary-50 dark:bg-secondary-700/50 overflow-hidden">
                      {/* Order header */}
                      <div className="flex items-center justify-between px-3 py-2.5
                                      bg-secondary-100/60 dark:bg-secondary-700/80
                                      border-b border-secondary-200 dark:border-secondary-700">
                        <div>
                          <p className="text-sm font-bold text-secondary-900 dark:text-white">
                            #{order.orderNumber}
                          </p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400">
                            {order.customerName}
                          </p>
                        </div>
                        <span className="font-bold text-sm text-green-600 dark:text-green-400">
                          ₹{order.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="px-3 py-2 space-y-1">
                        {order.items && order.items.length > 0 ? (
                          <>
                            {order.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-secondary-700 dark:text-secondary-300 flex-1 min-w-0 pr-2 truncate">
                                  <span className="font-semibold text-secondary-900 dark:text-white">{item.quantity}×</span>{' '}{item.name}
                                </span>
                                <span className="font-medium text-secondary-900 dark:text-white shrink-0">
                                  ₹{item.subtotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between text-xs pt-1.5
                                            border-t border-secondary-200 dark:border-secondary-700 mt-1">
                              <span className="text-secondary-500 dark:text-secondary-400 font-medium">Order Total</span>
                              <span className="font-bold text-secondary-900 dark:text-white">
                                ₹{order.totalAmount.toFixed(2)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-secondary-400 italic py-1">Order details unavailable</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 flex gap-3">
                  <button
                    onClick={() => setRemainingOrders([])}
                    className="btn btn-secondary flex-1 text-sm py-2.5"
                  >
                    Continue Later
                  </button>
                  <button
                    onClick={() => {
                      // Pre-select all remaining orders for billing
                      setSelectedOrders(remainingOrders.map(o => o._id));
                      setRemainingOrders([]);
                    }}
                    className="btn btn-primary flex-1 text-sm py-2.5"
                  >
                    <Receipt className="w-4 h-4" />
                    Create Bill
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Reservation Completed popup ──────────────────────── */}
      <AnimatePresence>
        {reservationCompletedInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setReservationCompletedInfo(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm bg-white dark:bg-secondary-800
                              rounded-2xl shadow-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
                <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30
                                  flex items-center justify-center">
                    <CalendarCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary-900 dark:text-white text-base mb-1">
                      Reservation Completed
                    </h3>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                      <strong className="text-secondary-900 dark:text-white">
                        {reservationCompletedInfo.guestName}
                      </strong>
                      {`'s reservation for Table ${reservationCompletedInfo.tableNumber}`}
                      {reservationCompletedInfo.numberOfPeople > 0 &&
                        ` (${reservationCompletedInfo.numberOfPeople} ${reservationCompletedInfo.numberOfPeople === 1 ? "person" : "people"})`
                      }
                      {" "}has been completed successfully after dine-in billing.
                    </p>
                  </div>
                  <button
                    onClick={() => setReservationCompletedInfo(null)}
                    className="btn btn-primary w-full mt-1"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Order detail drawer (same as OrdersPage) ─────────── */}
      <AnimatePresence>
        {showDrawer && selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDrawer(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md
                         bg-white dark:bg-secondary-800 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b
                              border-secondary-200 dark:border-secondary-700 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-secondary-900 dark:text-white">
                    Order #{selectedOrder.orderNumber}
                  </h2>
                  <p className="text-xs text-secondary-400 mt-0.5">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setShowDrawer(false)}
                  className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors">
                  <X className="w-5 h-5 text-secondary-500" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Status badge */}
                <div>
                  {(() => {
                    const cfg = statusConfig[selectedOrder.status];
                    const Icon = cfg.icon;
                    return (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${cfg.bgColor}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Customer */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-3 text-sm">Customer</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-secondary-400 shrink-0" />
                      <span className="font-medium text-secondary-900 dark:text-white">
                        {selectedOrder.customerId?.name || "Guest"}
                      </span>
                    </div>
                    {selectedOrder.customerId?.mobile && (
                      <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-300">
                        <span className="text-base shrink-0">📞</span>
                        <span>{selectedOrder.customerId.mobile}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order details */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-3 text-sm">Order Details</h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-secondary-500">Type</span>
                      <span className={`font-medium px-2 py-0.5 rounded-lg text-xs ${
                        selectedOrder.orderType === "DINE_IN"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : selectedOrder.orderType === "TAKE_AWAY"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}>
                        {selectedOrder.orderType === "DINE_IN" ? "Dine In" : selectedOrder.orderType === "TAKE_AWAY" ? "Take Away" : "Delivery"}
                      </span>
                    </div>
                    {selectedOrder.tableNumber && (
                      <div className="flex justify-between">
                        <span className="text-secondary-500">Table</span>
                        <span className="font-medium text-secondary-900 dark:text-white">
                          Table {selectedOrder.tableNumber}
                        </span>
                      </div>
                    )}
                    {selectedOrder.orderType === "DELIVERY" && selectedOrder.address && (
                      <div className="flex flex-col gap-1">
                        <span className="text-secondary-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Delivery Address
                        </span>
                        <span className="font-medium text-secondary-900 dark:text-white
                                         bg-secondary-50 dark:bg-secondary-700/50 rounded-lg px-3 py-2 text-xs">
                          {selectedOrder.address}
                        </span>
                      </div>
                    )}
                    {selectedOrder.note && (
                      <div className="flex flex-col gap-1">
                        <span className="text-secondary-500">Note</span>
                        <span className="text-secondary-700 dark:text-secondary-300
                                         bg-secondary-50 dark:bg-secondary-700/50 rounded-lg px-3 py-2 text-xs italic">
                          "{selectedOrder.note}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-3 text-sm">
                    Items
                    <span className="ml-1 text-secondary-400 font-normal">
                      ({selectedOrder.totalItems} item{selectedOrder.totalItems !== 1 ? "s" : ""})
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-3 pb-2
                                                  border-b border-secondary-100 dark:border-secondary-700
                                                  last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-900 dark:text-white">
                            <span className="text-primary-500 font-bold">{item.quantity}×</span> {item.name}
                          </p>
                          <p className="text-xs text-secondary-400">₹{item.price.toFixed(2)} each</p>
                          {item.itemNote && (
                            <p className="text-xs text-secondary-500 italic mt-0.5">"{item.itemNote}"</p>
                          )}
                        </div>
                        <span className="font-semibold text-sm text-secondary-900 dark:text-white shrink-0">
                          ₹{item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bill summary */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-3 text-sm">Bill Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                      <span>Subtotal</span><span>₹{selectedOrder.subtotalAmount.toFixed(2)}</span>
                    </div>
                    {(selectedOrder.deliveryCharge ?? 0) > 0 && (
                      <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                        <span>Delivery Charge</span><span>₹{(selectedOrder.deliveryCharge ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t
                                    border-secondary-200 dark:border-secondary-700
                                    text-secondary-900 dark:text-white">
                      <span>Total</span><span>₹{selectedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-secondary-500 text-xs">
                      <span>Payment</span>
                      <span className={`font-medium px-2 py-0.5 rounded-full ${
                        selectedOrder.paymentStatus === "PAID"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}>
                        {selectedOrder.paymentStatus || "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-secondary-400">
                  <p>📅 Placed: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                  {selectedOrder.acceptedAt  && <p>✅ Accepted: {new Date(selectedOrder.acceptedAt).toLocaleString()}</p>}
                  {selectedOrder.completedAt && <p>🏁 Completed: {new Date(selectedOrder.completedAt).toLocaleString()}</p>}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
