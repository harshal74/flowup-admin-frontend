/**
 * Admin Table Management Page
 *
 * Reuses the exact same buildTableList logic as the Waiter TablesPage.
 * Uses admin-authenticated API endpoints (/orders, /waiter-requests, /settings).
 * Dynamic table count comes from restaurant settings (totalTables).
 * Real-time updates via existing Socket.IO events.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Table2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import socket from '../lib/socket';
import type { Order } from '../types';
import { useRestaurant } from '../context/RestaurantContext';

// ── Types ─────────────────────────────────────────────────────────

type TableStatus =
  | 'Available'
  | 'Occupied'
  | 'Bill Requested'
  | 'Waiter Requested';

interface TableInfo {
  number: number;
  status: TableStatus;
}

interface WaiterReq {
  _id: string;
  tableNumber: number;
  status: string;
}

// ── Status styles (dark-theme compatible — matches waiter sidebar card) ──

const STATUS_STYLE: Record<TableStatus, { bg: string; text: string; border: string; label: string }> = {
  'Available':       { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/40',  label: 'Available'       },
  'Occupied':        { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/40',  label: 'Occupied'        },
  'Bill Requested':  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/40', label: 'Bill Requested'  },
  'Waiter Requested':{ bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/40',    label: 'Waiter Called'   },
};

const ACTIVE_ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'];

// ── Derive table state from live data — identical algorithm to waiter ──

function buildTableList(
  totalTables: number,
  orders: Order[],
  waiterReqs: WaiterReq[],
): TableInfo[] {
  const tableMap = new Map<number, TableStatus>();
  for (let i = 1; i <= totalTables; i++) {
    tableMap.set(i, 'Available');
  }

  orders.forEach(o => {
    if (!o.tableNumber) return;
    const t = o.tableNumber;

    if (ACTIVE_ORDER_STATUSES.includes(o.status)) {
      if (tableMap.get(t) === 'Available') {
        tableMap.set(t, 'Occupied');
      }
    }
    if (
      (o.status === 'READY' || o.status === 'COMPLETED') &&
      o.paymentStatus === 'PENDING'
    ) {
      tableMap.set(t, 'Bill Requested');
    }
  });

  waiterReqs.forEach(r => {
    if (!r.tableNumber) return;
    tableMap.set(r.tableNumber, 'Waiter Requested');
  });

  return Array.from(tableMap.entries())
    .map(([number, status]) => ({ number, status }))
    .sort((a, b) => a.number - b.number);
}

// ── Component ─────────────────────────────────────────────────────

export default function TablesPage() {
  const { restaurant } = useRestaurant();
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [waiterReqs, setWaiterReqs] = useState<WaiterReq[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Prefer live setting from context; fall back to 10 if still loading
  const totalTables = restaurant?.totalTables ?? 10;

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else              setLoading(true);
    try {
      const [oRes, wRes] = await Promise.all([
        API.get('/orders'),
        API.get('/waiter-requests'),
      ]);
      setOrders(oRes.data.data || []);
      setWaiterReqs(wRes.data.data || []);
    } catch {
      toast.error('Failed to load table data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Socket listeners — same events waiter TablesPage uses ──────
  useEffect(() => {
    const onOrderUpdate = (p: { orderId: string; status: string }) =>
      setOrders(prev => prev.map(o =>
        o._id === p.orderId ? { ...o, status: p.status as any } : o
      ));

    const onNewOrder = (order: Order) =>
      setOrders(p => p.some(o => o._id === order._id) ? p : [order, ...p]);

    const onWaiter = (req: any) => {
      if (!req.tableNumber) return;
      const item: WaiterReq = {
        _id: String(req._id),
        tableNumber: req.tableNumber,
        status: req.status || 'PENDING',
      };
      setWaiterReqs(p => p.some(r => r._id === item._id) ? p : [item, ...p]);
    };

    const onWaiterUpdate = (p: { _id: string; status: string }) => {
      if (p.status === 'COMPLETED') {
        setWaiterReqs(prev => prev.filter(r => r._id !== p._id));
      }
    };

    socket.on('new_order',               onNewOrder);
    socket.on('order_status_updated',    onOrderUpdate);
    socket.on('waiter_requested',        onWaiter);
    socket.on('waiter_request_updated',  onWaiterUpdate);

    return () => {
      socket.off('new_order',              onNewOrder);
      socket.off('order_status_updated',   onOrderUpdate);
      socket.off('waiter_requested',       onWaiter);
      socket.off('waiter_request_updated', onWaiterUpdate);
    };
  }, []);

  const tables   = buildTableList(totalTables, orders, waiterReqs);
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

        <button
          onClick={() => fetchAll({ silent: true })}
          disabled={refreshing || loading}
          className="btn btn-secondary flex items-center gap-2 self-start sm:self-auto"
          title="Refresh table status"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS_STYLE) as [TableStatus, typeof STATUS_STYLE[TableStatus]][]).map(
          ([status, style]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                          border ${style.bg} ${style.text} ${style.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.text.replace('text-', 'bg-')}`} />
              {style.label}
            </span>
          )
        )}
      </div>

      {/* Table grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(totalTables || 12)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="card p-12 text-center">
          <Table2 className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-3" />
          <p className="text-secondary-500 dark:text-secondary-400">
            No tables configured. Set the table count in Settings.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {tables.map(table => {
            const style = STATUS_STYLE[table.status];
            return (
              <div
                key={table.number}
                className={`card p-4 flex flex-col items-center justify-center gap-2
                            aspect-square ${style.bg} border ${style.border}
                            transition-all hover:scale-105`}
              >
                <Table2 className={`w-5 h-5 ${style.text} opacity-60`} />
                <p className="text-2xl font-black text-secondary-900 dark:text-white leading-none">
                  {table.number}
                </p>
                <p className={`text-[10px] font-semibold text-center ${style.text} leading-tight`}>
                  {style.label}
                </p>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
