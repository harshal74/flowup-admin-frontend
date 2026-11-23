/**
 * Admin Table Management Page — V2 with full Reservation support
 *
 * Reservation lifecycle: RESERVED → ARRIVED → COMPLETED
 *                        RESERVED → CANCELLED
 *                        RESERVED → NO_SHOW
 *
 * All mutation calls use /admin/table-reservations (admin JWT).
 * Admin always has canMutate = true.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table2, RefreshCw, X, Loader2, Users, User,
  CalendarCheck, Pencil, Trash2, Phone, Clock,
  CheckCircle, UserCheck, UserX, ShoppingCart, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../lib/api';
import socket from '../lib/socket';
import type { Order } from '../types';
import { useRestaurant } from '../context/RestaurantContext';

// ── Types ──────────────────────────────────────────────────────────

export type ReservationStatus =
  | 'RESERVED' | 'ACTIVE'   // ACTIVE = legacy V1
  | 'ARRIVED'  | 'COMPLETED'
  | 'CANCELLED'| 'NO_SHOW';

export interface TableReservation {
  _id: string;
  restaurantId: string;
  tableNumber: number;
  guestName: string;
  mobileNumber: string | null;
  numberOfPeople: number;
  reservationStart: string | null;
  reservationEnd: string | null;
  notes: string;
  reservedById: string;
  reservedByName: string;
  reservedByRole: 'ADMIN' | 'ASSISTANT';
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

type TableStatus =
  | 'Available' | 'Occupied' | 'Bill Requested'
  | 'Waiter Requested' | 'Reserved' | 'Dirty' | 'Cleaning';

interface StaffRef { staffId: string | null; name: string; role: string }

interface TableClean {
  _id: string;
  tableNumber: number;
  status: 'DIRTY' | 'CLEANING' | 'CLEAN';
  active: boolean;
  dirtyAt: string | null;
  cleaningBy: StaffRef | null;
  cleaningStartedAt: string | null;
  cleanedBy: StaffRef | null;
  cleanedAt: string | null;
}

interface TableInfo {
  number: number;
  status: TableStatus;
  reservations: TableReservation[];   // all active/arrived reservations for this table
  clean?: TableClean;
}

interface WaiterReq { _id: string; tableNumber: number; status: string; }

// ── Status styles ──────────────────────────────────────────────────

const TABLE_STATUS_STYLE: Record<TableStatus, { bg: string; text: string; border: string; label: string }> = {
  'Available':        { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/40',  label: 'Available'      },
  'Occupied':         { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/40',  label: 'Occupied'       },
  'Bill Requested':   { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/40', label: 'Bill Requested' },
  'Waiter Requested': { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/40',    label: 'Waiter Called'  },
  'Reserved':         { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/40',   label: 'Reserved'       },
  'Dirty':            { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/40', label: 'Dirty'          },
  'Cleaning':         { bg: 'bg-cyan-500/10',   text: 'text-cyan-500',   border: 'border-cyan-500/40',   label: 'Cleaning'       },
};

const RES_STATUS_STYLE: Record<ReservationStatus, { badge: string; label: string }> = {
  RESERVED:   { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40',     label: 'Reserved'   },
  ACTIVE:     { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40',     label: 'Reserved'   },
  ARRIVED:    { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40', label: 'Arrived'  },
  COMPLETED:  { badge: 'bg-green-500/20 text-green-400 border-green-500/40',  label: 'Completed'  },
  CANCELLED:  { badge: 'bg-red-500/20 text-red-400 border-red-500/40',        label: 'Cancelled'  },
  NO_SHOW:    { badge: 'bg-gray-500/20 text-gray-400 border-gray-500/40',     label: 'No Show'    },
};

const ACTIVE_ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
const ACTIVE_RES_STATUSES: ReservationStatus[] = ['RESERVED', 'ACTIVE', 'ARRIVED'];

// ── IST helpers ────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toISTDateString(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

function toISTTimeString(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeSlot(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const fmt = (d: Date) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    const h = ist.getUTCHours();
    const m = String(ist.getUTCMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

function formatDateIST(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function todayISTString(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function tomorrowISTString(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS + 86400000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

// ── Table list builder ─────────────────────────────────────────────

function buildTableList(
  totalTables: number,
  orders: Order[],
  waiterReqs: WaiterReq[],
  reservations: TableReservation[],
  cleans: TableClean[],
): TableInfo[] {
  const tableMap = new Map<number, TableStatus>();
  for (let i = 1; i <= totalTables; i++) tableMap.set(i, 'Available');

  orders.forEach(o => {
    if (!o.tableNumber) return;
    if (o.orderType === 'DELIVERY' || o.orderType === 'TAKE_AWAY') return;
    if (o.paymentStatus === 'PAID') return;
    const t = o.tableNumber;
    if (ACTIVE_ORDER_STATUSES.includes(o.status)) {
      if (tableMap.get(t) === 'Available' || tableMap.get(t) === 'Reserved') tableMap.set(t, 'Occupied');
    }
    if (o.status === 'COMPLETED' && o.paymentStatus === 'PENDING' && !o.billId && isToday(o.createdAt)) {
      if (tableMap.get(t) === 'Available' || tableMap.get(t) === 'Reserved') tableMap.set(t, 'Occupied');
    }
    if (o.status === 'COMPLETED' && isToday(o.createdAt) &&
      ((o.billId && o.paymentStatus === 'PENDING') || o.paymentStatus === 'FAILED')) {
      if (tableMap.get(t) !== 'Occupied') tableMap.set(t, 'Bill Requested');
    }
  });

  // Dirty / Cleaning outrank Available and Reserved, but never hide an active order.
  const cleanMap = new Map<number, TableClean>();
  cleans.forEach(c => {
    if (!c.active) return;
    cleanMap.set(c.tableNumber, c);
    if (tableMap.get(c.tableNumber) === 'Available') tableMap.set(c.tableNumber, c.status === 'CLEANING' ? 'Cleaning' : 'Dirty');
  });

  waiterReqs.forEach(r => {
    if (r.tableNumber) tableMap.set(r.tableNumber, 'Waiter Requested');
  });

  // Group active reservations by table
  const resMap = new Map<number, TableReservation[]>();
  reservations.forEach(r => {
    if (!ACTIVE_RES_STATUSES.includes(r.status)) return;
    const arr = resMap.get(r.tableNumber) || [];
    arr.push(r);
    resMap.set(r.tableNumber, arr);
  });

  resMap.forEach((_, tableNum) => {
    if (tableMap.get(tableNum) === 'Available') tableMap.set(tableNum, 'Reserved');
  });

  return Array.from(tableMap.entries())
    .map(([number, status]) => ({
      number,
      status,
      reservations: resMap.get(number) || [],
      clean: cleanMap.get(number),
    }))
    .sort((a, b) => a.number - b.number);
}

// ── Reserve / Edit Modal ───────────────────────────────────────────

interface ReserveModalProps {
  tableNumber: number;
  existing?: TableReservation;
  onClose: () => void;
  onSaved: (r: TableReservation) => void;
}

function ReserveModal({ tableNumber, existing, onClose, onSaved }: ReserveModalProps) {
  const isEdit = !!existing;

  const initDate = existing?.reservationStart
    ? toISTDateString(new Date(existing.reservationStart))
    : tomorrowISTString();
  const initStart = existing?.reservationStart
    ? toISTTimeString(new Date(existing.reservationStart))
    : '19:00';
  const initEnd = existing?.reservationEnd
    ? toISTTimeString(new Date(existing.reservationEnd))
    : '20:30';

  const [guestName,      setGuestName]      = useState(existing?.guestName ?? '');
  const [mobileNumber,   setMobileNumber]   = useState(existing?.mobileNumber ?? '');
  const [numberOfPeople, setNumberOfPeople] = useState(existing?.numberOfPeople?.toString() ?? '');
  const [resDate,        setResDate]        = useState(initDate);
  const [startTime,      setStartTime]      = useState(initStart);
  const [endTime,        setEndTime]        = useState(initEnd);
  const [notes,          setNotes]          = useState(existing?.notes ?? '');
  const [saving,         setSaving]         = useState(false);

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-secondary-700/50 border border-secondary-600 text-secondary-900 dark:text-white text-sm focus:outline-none focus:border-primary-500 placeholder-secondary-400 dark:placeholder-secondary-500 dark:bg-secondary-700';
  const labelCls = 'label';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) { toast.error('Guest name is required.'); return; }
    const n = Number(numberOfPeople);
    if (!Number.isInteger(n) || n < 1) { toast.error('Number of people must be at least 1.'); return; }
    if (n > 100) { toast.error('Number of people cannot exceed 100.'); return; }
    if (!resDate) { toast.error('Reservation date is required.'); return; }
    if (!startTime) { toast.error('Start time is required.'); return; }
    if (!endTime) { toast.error('End time is required.'); return; }
    if (endTime <= startTime) { toast.error('End time must be after start time.'); return; }

    setSaving(true);
    try {
      const payload = {
        tableNumber,
        guestName: name,
        mobileNumber: mobileNumber.trim() || undefined,
        numberOfPeople: n,
        reservationDate: resDate,
        startTime,
        endTime,
        notes: notes.trim(),
      };

      const res = isEdit
        ? await API.patch(`/admin/table-reservations/${existing!._id}`, payload)
        : await API.post('/admin/table-reservations', payload);

      toast.success(isEdit ? 'Reservation updated.' : `Table ${tableNumber} reserved.`);
      onSaved(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save reservation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-secondary-800 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-secondary-900 dark:text-white">
              {isEdit ? 'Edit Reservation' : `Reserve Table ${tableNumber}`}
            </h2>
            <p className="text-xs text-secondary-500 mt-0.5">Table {tableNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <X className="w-4 h-4 text-secondary-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest Name */}
          <div>
            <label className={labelCls}>Guest Name <span className="text-danger-500">*</span></label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                placeholder="Rahul Patil" maxLength={120} className={`${inputCls} pl-9`} autoFocus required />
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label className={labelCls}>Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)}
                placeholder="9876543210" maxLength={15} className={`${inputCls} pl-9`} />
            </div>
            <p className="text-xs text-secondary-400 mt-0.5">10-digit Indian mobile number (optional)</p>
          </div>

          {/* Number of People */}
          <div>
            <label className={labelCls}>Number of People <span className="text-danger-500">*</span></label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input type="number" min={1} max={100} value={numberOfPeople}
                onChange={e => setNumberOfPeople(e.target.value)} placeholder="4"
                className={`${inputCls} pl-9`} required />
            </div>
            <p className="text-xs text-secondary-400 mt-0.5">Informational only — no capacity restriction</p>
          </div>

          {/* Date + Times row */}
          <div>
            <label className={labelCls}>Reservation Date <span className="text-danger-500">*</span></label>
            <input type="date" value={resDate} min={todayISTString()}
              onChange={e => setResDate(e.target.value)} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Time <span className="text-danger-500">*</span></label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className={`${inputCls} pl-9`} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>End Time <span className="text-danger-500">*</span></label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className={`${inputCls} pl-9`} required />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Birthday dinner, window preference…" maxLength={500} rows={2}
              className={`${inputCls} resize-none`} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1" disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : isEdit ? 'Update' : 'Reserve Table'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Reservation Card (inside table tile) ──────────────────────────

interface ResCardProps {
  reservation: TableReservation;
  canMutate: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onArrive: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  acting: string | null;
}

function ReservationCard({ reservation: r, canMutate, onEdit, onCancel, onArrive, onComplete, onNoShow, acting }: ResCardProps) {
  const ss = RES_STATUS_STYLE[r.status] ?? RES_STATUS_STYLE['RESERVED'];
  const isActive = r.status === 'RESERVED' || r.status === 'ACTIVE';
  const isArrived = r.status === 'ARRIVED';
  const busy = acting === r._id;

  return (
    <div className="mt-2 pt-2 border-t border-secondary-200/60 dark:border-secondary-700/60 space-y-1.5 text-left w-full">
      {/* Status badge */}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ss.badge}`}>
        {ss.label}
      </span>

      {/* Guest info */}
      <p className="text-[11px] font-semibold text-secondary-900 dark:text-white truncate">{r.guestName}</p>
      <p className="text-[10px] text-secondary-500 flex items-center gap-1">
        <Users className="w-3 h-3 shrink-0" />
        {r.numberOfPeople} {r.numberOfPeople === 1 ? 'person' : 'people'}
      </p>
      {r.mobileNumber && (
        <p className="text-[10px] text-secondary-500 flex items-center gap-1">
          <Phone className="w-3 h-3 shrink-0" />
          {r.mobileNumber}
        </p>
      )}

      {/* Time */}
      {r.reservationStart && (
        <>
          <p className="text-[10px] text-secondary-400">📅 {formatDateIST(r.reservationStart)}</p>
          <p className="text-[10px] text-secondary-400">🕐 {formatTimeSlot(r.reservationStart, r.reservationEnd)}</p>
        </>
      )}
      {!r.reservationStart && (
        <p className="text-[10px] text-secondary-400">
          {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {r.notes && (
        <p className="text-[10px] text-secondary-400 italic truncate">"{r.notes}"</p>
      )}

      <p className="text-[10px] text-secondary-500 truncate">By: {r.reservedByName}</p>

      {/* Action buttons */}
      {canMutate && (
        <div className="space-y-1 pt-1">
          {isActive && (
            <button onClick={onArrive} disabled={busy}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                         bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-[10px] font-medium transition-colors disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              Mark Arrived
            </button>
          )}
          {isArrived && (
            <button onClick={onComplete} disabled={busy}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                         bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px] font-medium transition-colors disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Mark Completed
            </button>
          )}
          {(isActive || isArrived) && (
            <div className="flex gap-1">
              {isActive && (
                <button onClick={onEdit} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                             bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px] font-medium transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
              {isActive && (
                <button onClick={onNoShow} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                             bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 text-[10px] font-medium transition-colors">
                  <UserX className="w-3 h-3" /> No Show
                </button>
              )}
              <button onClick={onCancel} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                           bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 text-[10px] font-medium transition-colors">
                <Trash2 className="w-3 h-3" /> Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function TablesPage() {
  const { restaurant } = useRestaurant();
  const navigate = useNavigate();
  const [cleans,       setCleans]       = useState<TableClean[]>([]);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [waiterReqs,   setWaiterReqs]   = useState<WaiterReq[]>([]);
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [acting,       setActing]       = useState<string | null>(null);

  const [reserveModal, setReserveModal] = useState<{ tableNumber: number; existing?: TableReservation } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TableReservation | null>(null);
  const [cancelling,   setCancelling]   = useState(false);

  const totalTables = restaurant?.totalTables ?? 10;
  const canMutate   = true; // admin always

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [oRes, wRes, rRes, cRes] = await Promise.all([
        API.get('/orders'),
        API.get('/waiter-requests'),
        API.get('/admin/table-reservations?status=ACTIVE'),
        API.get('/admin/table-cleaning'),
      ]);
      setCleans(cRes.data.data || []);
      setOrders(oRes.data.data || []);
      setWaiterReqs(wRes.data.data || []);
      setReservations(rRes.data.data || []);
    } catch {
      toast.error('Failed to load table data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Socket ──────────────────────────────────────────────────────
  useEffect(() => {
    const onOrderUpdate = (p: { orderId: string; status: string; paymentStatus?: string; billId?: string }) =>
      setOrders(prev => prev.map(o => o._id === p.orderId
        ? { ...o, status: p.status as any, ...(p.paymentStatus ? { paymentStatus: p.paymentStatus } : {}), ...(p.billId !== undefined ? { billId: p.billId } : {}) }
        : o));
    const onNewOrder = (order: Order) =>
      setOrders(p => p.some(o => o._id === order._id) ? p : [order, ...p]);
    const onWaiter = (req: any) => {
      if (!req.tableNumber) return;
      setWaiterReqs(p => p.some(r => r._id === req._id) ? p : [{ _id: String(req._id), tableNumber: req.tableNumber, status: req.status || 'PENDING' }, ...p]);
    };
    const onWaiterUpdate = (p: { _id: string; status: string }) => {
      if (p.status === 'COMPLETED') setWaiterReqs(prev => prev.filter(r => r._id !== p._id));
    };
    const onResCreated = (r: TableReservation) =>
      setReservations(prev => prev.some(x => x._id === r._id) ? prev : [r, ...prev]);
    const onResUpdated = (r: TableReservation) =>
      setReservations(prev => prev.map(x => x._id === r._id ? { ...x, ...r } : x));
    const onResCancelled = (p: { _id: string }) =>
      setReservations(prev => prev.filter(x => x._id !== p._id));

    const onClean = (c: TableClean) =>
      setCleans(prev => c.active
        ? (prev.some(x => x._id === c._id) ? prev.map(x => x._id === c._id ? c : x) : [...prev, c])
        : prev.filter(x => x._id !== c._id));

    socket.on('table_clean_updated',         onClean);
    socket.on('new_order',                   onNewOrder);
    socket.on('order_status_updated',        onOrderUpdate);
    socket.on('waiter_requested',            onWaiter);
    socket.on('waiter_request_updated',      onWaiterUpdate);
    socket.on('table_reservation_created',   onResCreated);
    socket.on('table_reservation_updated',   onResUpdated);
    socket.on('table_reservation_cancelled', onResCancelled);

    return () => {
      socket.off('table_clean_updated',         onClean);
      socket.off('new_order',                   onNewOrder);
      socket.off('order_status_updated',        onOrderUpdate);
      socket.off('waiter_requested',            onWaiter);
      socket.off('waiter_request_updated',      onWaiterUpdate);
      socket.off('table_reservation_created',   onResCreated);
      socket.off('table_reservation_updated',   onResUpdated);
      socket.off('table_reservation_cancelled', onResCancelled);
    };
  }, []);

  const doClean = async (c: TableClean, action: 'start' | 'complete') => {
    setActing(c._id);
    try {
      const res = await API.patch(`/admin/table-cleaning/${c._id}/${action}`);
      const u: TableClean = res.data.data;
      setCleans(prev => u.active ? prev.map(x => x._id === u._id ? u : x) : prev.filter(x => x._id !== u._id));
      toast.success(action === 'start' ? `Cleaning Table ${c.tableNumber}.` : `Table ${c.tableNumber} is clean.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed.');
      fetchAll({ silent: true });
    } finally { setActing(null); }
  };

  // ── Status transition helpers ───────────────────────────────────
  const doTransition = async (id: string, endpoint: string, successMsg: string) => {
    setActing(id);
    try {
      const res = await API.patch(`/admin/table-reservations/${id}/${endpoint}`);
      setReservations(prev => prev.map(x => x._id === id ? { ...x, ...res.data.data } : x));
      toast.success(successMsg);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  const handleReservationSaved = (r: TableReservation) => {
    if (reserveModal?.existing) {
      setReservations(prev => prev.map(x => x._id === r._id ? r : x));
    } else {
      // Guard against duplicate: socket event may have already added this reservation
      setReservations(prev => prev.some(x => x._id === r._id) ? prev.map(x => x._id === r._id ? r : x) : [r, ...prev]);
    }
    setReserveModal(null);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await API.delete(`/admin/table-reservations/${cancelTarget._id}`);
      setReservations(prev => prev.map(x => x._id === cancelTarget._id ? { ...x, status: 'CANCELLED' as ReservationStatus } : x));
      toast.success(`Reservation for Table ${cancelTarget.tableNumber} cancelled.`);
      setCancelTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel reservation.');
    } finally {
      setCancelling(false);
    }
  };

  const tables   = buildTableList(totalTables, orders, waiterReqs, reservations, cleans);
  const occupied = tables.filter(t => t.status !== 'Available').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Table Management</h1>
          <p className="text-secondary-500 dark:text-secondary-400 text-sm mt-0.5">
            {totalTables} total · {occupied} occupied · {totalTables - occupied} available
          </p>
        </div>
        <button onClick={() => fetchAll({ silent: true })} disabled={refreshing || loading}
          className="btn btn-secondary flex items-center gap-2 self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(TABLE_STATUS_STYLE) as [TableStatus, typeof TABLE_STATUS_STYLE[TableStatus]][]).map(([s, st]) => (
          <span key={s} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.text} ${st.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.text.replace('text-', 'bg-')}`} />
            {st.label}
          </span>
        ))}
      </div>

      {/* Table grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(totalTables || 12)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="card p-12 text-center">
          <Table2 className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-3" />
          <p className="text-secondary-500 dark:text-secondary-400">No tables configured.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {tables.map(table => {
            const style = TABLE_STATUS_STYLE[table.status];
            const isAvailable = table.status === 'Available';
            const activeRes = table.reservations.filter(r => r.status === 'RESERVED' || r.status === 'ACTIVE' || r.status === 'ARRIVED');

            return (
              <div key={table.number}
                className={`card p-3 flex flex-col items-center gap-1 ${style.bg} border ${style.border} transition-all`}>
                <Table2 className={`w-4 h-4 ${style.text} opacity-60`} />
                <p className="text-xl font-black text-secondary-900 dark:text-white leading-none">{table.number}</p>
                <p className={`text-[10px] font-semibold text-center ${style.text} leading-tight`}>{style.label}</p>

                {(isAvailable || (table.status === 'Reserved' && table.reservations.some(r => r.status === 'ARRIVED'))) && (
                  <button onClick={() => navigate(`/tables/${table.number}/order`)}
                    className="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                               bg-green-500/20 hover:bg-green-500/30 text-green-500 text-[10px] font-medium transition-colors">
                    <ShoppingCart className="w-3 h-3" /> Take Order
                  </button>
                )}

                {table.clean && table.clean.status === 'DIRTY' && (
                  <div className="w-full space-y-1">
                    <p className="text-[10px] text-secondary-500 text-center">
                      Dirty since {table.clean.dirtyAt ? new Date(table.clean.dirtyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                    <button onClick={() => doClean(table.clean!, 'start')} disabled={acting === table.clean._id}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                                 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 text-[10px] font-medium transition-colors disabled:opacity-50">
                      {acting === table.clean._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Start Cleaning
                    </button>
                  </div>
                )}

                {table.clean && table.clean.status === 'CLEANING' && (
                  <div className="w-full space-y-1">
                    <p className="text-[10px] text-secondary-500 text-center truncate">
                      By {table.clean.cleaningBy?.name || 'staff'}
                      {table.clean.cleaningStartedAt ? ` · ${new Date(table.clean.cleaningStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                    <button onClick={() => doClean(table.clean!, 'complete')} disabled={acting === table.clean._id}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                                 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-500 text-[10px] font-medium transition-colors disabled:opacity-50">
                      {acting === table.clean._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Mark Clean
                    </button>
                  </div>
                )}

                {/* Reserve button on available tables */}
                {isAvailable && canMutate && (
                  <button onClick={() => setReserveModal({ tableNumber: table.number })}
                    className="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                               bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px] font-medium transition-colors">
                    <CalendarCheck className="w-3 h-3" /> Reserve
                  </button>
                )}

                {/* Reservation cards */}
                {activeRes.map(res => (
                  <ReservationCard
                    key={res._id}
                    reservation={res}
                    canMutate={canMutate}
                    acting={acting}
                    onEdit={() => setReserveModal({ tableNumber: table.number, existing: res })}
                    onCancel={() => setCancelTarget(res)}
                    onArrive={() => doTransition(res._id, 'arrive', 'Guest marked as arrived.')}
                    onComplete={() => doTransition(res._id, 'complete', 'Reservation completed.')}
                    onNoShow={() => doTransition(res._id, 'no-show', 'Marked as no-show.')}
                  />
                ))}
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Reserve/Edit modal */}
      <AnimatePresence>
        {reserveModal && (
          <ReserveModal
            tableNumber={reserveModal.tableNumber}
            existing={reserveModal.existing}
            onClose={() => setReserveModal(null)}
            onSaved={handleReservationSaved}
          />
        )}
      </AnimatePresence>

      {/* Cancel confirmation */}
      <AnimatePresence>
        {cancelTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !cancelling && setCancelTarget(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6 shadow-2xl">
              <h3 className="font-bold text-secondary-900 dark:text-white mb-2">Cancel Reservation</h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Cancel reservation for <strong>{cancelTarget.guestName}</strong> at Table {cancelTarget.tableNumber}
                {cancelTarget.reservationStart ? ` on ${formatDateIST(cancelTarget.reservationStart)} at ${formatTimeSlot(cancelTarget.reservationStart, cancelTarget.reservationEnd)}` : ''}?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setCancelTarget(null)} className="btn btn-secondary flex-1" disabled={cancelling}>Keep</button>
                <button onClick={handleCancelConfirm} disabled={cancelling} className="btn btn-danger flex-1">
                  {cancelling ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</> : 'Cancel Reservation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
