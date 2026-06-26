import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, X, Eye, Check, Clock, ChefHat, Package,
  Truck, User, Grid3X3, List, XCircle, MapPin, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import socket from '../lib/socket';
import type { Order, OrderStatus } from '../types';

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING', 'ACCEPTED', 'PREPARING', 'READY',
  'OUT_FOR_DELIVERY', 'COMPLETED', 'REJECTED', 'CANCELLED',
];

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }> = {
  PENDING:          { label: 'Pending',          color: 'text-amber-700 dark:text-amber-400',    bgColor: 'bg-amber-50 dark:bg-amber-900/20',    borderColor: 'border-amber-300 dark:border-amber-700',   icon: Clock    },
  ACCEPTED:         { label: 'Accepted',          color: 'text-blue-700 dark:text-blue-400',      bgColor: 'bg-blue-50 dark:bg-blue-900/20',      borderColor: 'border-blue-300 dark:border-blue-700',     icon: Check    },
  PREPARING:        { label: 'Preparing',         color: 'text-purple-700 dark:text-purple-400',  bgColor: 'bg-purple-50 dark:bg-purple-900/20',  borderColor: 'border-purple-300 dark:border-purple-700', icon: ChefHat  },
  READY:            { label: 'Ready',             color: 'text-teal-700 dark:text-teal-400',      bgColor: 'bg-teal-50 dark:bg-teal-900/20',      borderColor: 'border-teal-300 dark:border-teal-700',     icon: Package  },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',  color: 'text-indigo-700 dark:text-indigo-400',  bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',  borderColor: 'border-indigo-300 dark:border-indigo-700', icon: Truck    },
  COMPLETED:        { label: 'Completed',         color: 'text-green-700 dark:text-green-400',    bgColor: 'bg-green-50 dark:bg-green-900/20',    borderColor: 'border-green-300 dark:border-green-700',   icon: Check    },
  REJECTED:         { label: 'Rejected',          color: 'text-red-700 dark:text-red-400',        bgColor: 'bg-red-50 dark:bg-red-900/20',        borderColor: 'border-red-300 dark:border-red-700',       icon: XCircle  },
  CANCELLED:        { label: 'Cancelled',         color: 'text-secondary-600 dark:text-secondary-400', bgColor: 'bg-secondary-100 dark:bg-secondary-700/40', borderColor: 'border-secondary-300 dark:border-secondary-600', icon: X },
};

// Active pipeline columns (live orders that need action)
const ACTIVE_STATUSES: OrderStatus[]   = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
// Closed columns (done/terminal)
const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'REJECTED', 'CANCELLED'];

export function OrdersPage() {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [viewMode, setViewMode]           = useState<'kanban' | 'table'>('kanban');
  const [kanbanGroup, setKanbanGroup]     = useState<'active' | 'all'>('active');
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterStatus, setFilterStatus]   = useState<OrderStatus | ''>('');
  const [filterType, setFilterType]       = useState('');
  const [showFilters, setShowFilters]     = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDrawer, setShowDrawer]       = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // ── Initial REST load + socket listeners ──────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await API.get('/orders');
      setOrders(res.data.data || []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // One-time full fetch on mount
    fetchOrders();

    // ── Socket: new order arrives ──
    const onNewOrder = (order: any) => {
      setOrders((prev) => {
        if (prev.some((o) => o._id === order._id)) return prev;
        return [order, ...prev];
      });
    };

    // ── Socket: order status changed ──
    const onStatusUpdated = (payload: { orderId: string; status: OrderStatus; [key: string]: any }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o._id === payload.orderId
            ? { ...o, status: payload.status, ...(payload.completedAt && { completedAt: payload.completedAt }), ...(payload.rejectionReason !== undefined && { rejectionReason: payload.rejectionReason }) }
            : o
        )
      );
      // Keep the open drawer in sync
      setSelectedOrder((prev) =>
        prev && prev._id === payload.orderId
          ? { ...prev, status: payload.status }
          : prev
      );
    };

    const onConnect    = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on('connect',              onConnect);
    socket.on('disconnect',           onDisconnect);
    socket.on('new_order',            onNewOrder);
    socket.on('order_status_updated', onStatusUpdated);

    // Reflect current connection state immediately
    setIsSocketConnected(socket.connected);

    return () => {
      socket.off('connect',              onConnect);
      socket.off('disconnect',           onDisconnect);
      socket.off('new_order',            onNewOrder);
      socket.off('order_status_updated', onStatusUpdated);
    };
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setStatusUpdating(orderId);
      await API.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order moved to ${statusConfig[newStatus].label}`);
      // Socket event "order_status_updated" will update the list automatically.
      // Update drawer immediately so UX feels instant.
      if (selectedOrder?._id === orderId) setSelectedOrder({ ...selectedOrder, status: newStatus });
    } catch {
      toast.error('Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleRejectOrder = async (orderId: string, reason: string) => {
    try {
      setStatusUpdating(orderId);
      await API.patch(`/orders/${orderId}/reject`, { reason });
      toast.error('Order rejected');
      if (selectedOrder?._id === orderId) setSelectedOrder({ ...selectedOrder, status: 'REJECTED' });
    } catch {
      toast.error('Failed to reject order');
    } finally {
      setStatusUpdating(null);
    }
  };

  const getTimeAgo = (date: string) => {
    const min = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (min < 1)  return 'Just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h  < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = o.orderNumber.toLowerCase().includes(q) || (o.customerId?.name?.toLowerCase() || '').includes(q);
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchType   = !filterType   || o.orderType === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const getByStatus = (status: OrderStatus) => filteredOrders.filter((o) => o.status === status);

  // Columns to show in kanban
  const kanbanColumns: OrderStatus[] = kanbanGroup === 'active'
    ? ACTIVE_STATUSES
    : ORDER_STATUSES;

  // ── Order Card ─────────────────────────────────────────────────
  const OrderCard = ({ order }: { order: Order }) => {
    const cfg       = statusConfig[order.status];
    const isPending = order.status === 'PENDING';
    const isActive  = ACTIVE_STATUSES.includes(order.status);
    const Icon      = cfg.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`card p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border ${
          isPending
            ? 'border-amber-400 dark:border-amber-600 shadow-amber-100 dark:shadow-none'
            : 'border-transparent'
        }`}
        onClick={() => { setSelectedOrder(order); setShowDrawer(true); }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-secondary-900 dark:text-white truncate">#{order.orderNumber}</span>
              {isPending && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />}
            </div>
            <p className="text-xs text-secondary-500 truncate mt-0.5">{order.customerId?.name || 'Guest'}</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg shrink-0 ${cfg.bgColor}`}>
            <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            order.orderType === 'DINE_IN'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>
            {order.orderType === 'DINE_IN' ? 'Dine In' : 'Delivery'}
          </span>
          {order.tableNumber && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              T-{order.tableNumber}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 dark:bg-secondary-700 text-secondary-500">
            {getTimeAgo(order.createdAt)}
          </span>
        </div>

        {/* Items preview */}
        {order.items && order.items.length > 0 && (
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-2 truncate">
            {order.items.slice(0, 2).map((item, i) => `${item.quantity}× ${item.name}`).join(', ')}
            {order.items.length > 2 && ` +${order.items.length - 2} more`}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-secondary-100 dark:border-secondary-700">
          <span className="font-bold text-secondary-900 dark:text-white">₹{order.totalAmount.toFixed(2)}</span>
          {isPending && (
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleStatusUpdate(order._id, 'ACCEPTED')}
                disabled={statusUpdating === order._id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Accept
              </button>
              <button
                onClick={() => { const r = prompt('Rejection reason:'); if (r) handleRejectOrder(order._id, r); }}
                disabled={statusUpdating === order._id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
          {isActive && !isPending && (
            <span className="text-xs text-secondary-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> tap to manage
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // ── Loading skeleton ───────────────────────────────────────────
  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="skeleton h-10 w-64" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="min-w-[240px] space-y-3">
            <div className="skeleton h-10 w-full rounded-xl" />
            <div className="skeleton h-28 w-full rounded-xl" />
            <div className="skeleton h-28 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Orders</h1>
          <p className="text-secondary-500 dark:text-secondary-400 text-sm flex items-center gap-2">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} · {orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length} active
            {/* Socket connection indicator */}
            <span className={`inline-flex items-center gap-1 text-xs ${isSocketConnected ? 'text-green-500' : 'text-amber-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              {isSocketConnected ? 'Live' : 'Offline'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Manual refresh — shown when socket is disconnected */}
          {!isSocketConnected && (
            <button
              onClick={fetchOrders}
              className="btn btn-secondary text-sm py-1.5"
              title="Socket disconnected — click to refresh manually"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          )}
          {/* Kanban group toggle — only visible in kanban mode */}
          {viewMode === 'kanban' && (
            <div className="flex bg-secondary-100 dark:bg-secondary-700 rounded-lg p-0.5 text-sm">
              <button
                onClick={() => setKanbanGroup('active')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${kanbanGroup === 'active' ? 'bg-white dark:bg-secondary-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-secondary-500 dark:text-secondary-400'}`}
              >
                Active
              </button>
              <button
                onClick={() => setKanbanGroup('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${kanbanGroup === 'all' ? 'bg-white dark:bg-secondary-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-secondary-500 dark:text-secondary-400'}`}
              >
                All
              </button>
            </div>
          )}
          {/* View mode toggle */}
          <div className="flex bg-secondary-100 dark:bg-secondary-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-secondary-600 text-primary-600 shadow-sm' : 'text-secondary-500'}`}
              title="Kanban view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-secondary-600 text-primary-600 shadow-sm' : 'text-secondary-500'}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search + Filters ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order # or customer…"
            className="input pl-10 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn text-sm py-2 ${filterStatus || filterType ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Filter className="w-4 h-4" /> Filters
          {(filterStatus || filterType) && <span className="ml-1 bg-white/30 text-xs rounded-full px-1.5 py-0.5">
            {[filterStatus, filterType].filter(Boolean).length}
          </span>}
        </button>
        {(filterStatus || filterType) && (
          <button onClick={() => { setFilterStatus(''); setFilterType(''); }} className="btn btn-secondary text-sm py-2">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as OrderStatus | '')} className="input">
                  <option value="">All Statuses</option>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Order Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input">
                  <option value="">All Types</option>
                  <option value="DINE_IN">Dine In</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Kanban View ──────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div
            className="flex gap-3"
            style={{ minWidth: `${kanbanColumns.length * 260}px` }}
          >
            {kanbanColumns.map((status) => {
              const colOrders = getByStatus(status);
              const cfg       = statusConfig[status];
              const Icon      = cfg.icon;
              const isTerminal = TERMINAL_STATUSES.includes(status);

              return (
                <div key={status} className="flex-1 min-w-[240px] max-w-[300px] flex flex-col">
                  {/* Column header */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2 border ${cfg.bgColor} ${cfg.borderColor}`}>
                    <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                    <span className={`text-sm font-semibold ${cfg.color} truncate flex-1`}>{cfg.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 flex-1">
                    {colOrders.length === 0 ? (
                      <div className={`rounded-xl border-2 border-dashed p-5 text-center ${isTerminal ? 'opacity-50' : ''}`}
                           style={{ borderColor: 'var(--border-dashed, #e2e8f0)' }}>
                        <Icon className={`w-6 h-6 mx-auto mb-1 opacity-30 ${cfg.color}`} />
                        <p className="text-xs text-secondary-400">No {cfg.label.toLowerCase()} orders</p>
                      </div>
                    ) : (
                      colOrders.map((order) => <OrderCard key={order._id} order={order} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Table View ───────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 dark:bg-secondary-700/50 border-b border-secondary-200 dark:border-secondary-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide hidden md:table-cell">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide hidden lg:table-cell">Time</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-500 uppercase tracking-wide">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-secondary-400">No orders found</td>
                  </tr>
                ) : filteredOrders.map((order) => {
                  const cfg  = statusConfig[order.status];
                  const Icon = cfg.icon;
                  return (
                    <motion.tr
                      key={order._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-secondary-50 dark:hover:bg-secondary-700/40 transition-colors cursor-pointer ${
                        order.status === 'PENDING' ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''
                      }`}
                      onClick={() => { setSelectedOrder(order); setShowDrawer(true); }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-secondary-900 dark:text-white">#{order.orderNumber}</span>
                          {order.status === 'PENDING' && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-primary-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-secondary-900 dark:text-white truncate max-w-[120px]">{order.customerId?.name || 'Guest'}</p>
                            <p className="text-xs text-secondary-400 truncate max-w-[120px]">{order.customerId?.mobile || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          order.orderType === 'DINE_IN'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {order.orderType === 'DINE_IN' ? 'Dine In' : 'Delivery'}
                        </span>
                        {order.tableNumber && (
                          <span className="ml-1 text-xs text-secondary-400">T-{order.tableNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${cfg.bgColor}`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color} shrink-0`} />
                          <span className={`text-xs font-medium ${cfg.color} hidden sm:inline`}>{cfg.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell font-semibold text-secondary-900 dark:text-white">
                        ₹{order.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-secondary-500 text-xs">
                        {getTimeAgo(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowDrawer(true); }}
                          className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                        >
                          <Eye className="w-4 h-4 text-secondary-500" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Order Detail Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {showDrawer && selectedOrder && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDrawer(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-secondary-800 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Order #{selectedOrder.orderNumber}</h2>
                  <p className="text-xs text-secondary-400 mt-0.5">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => setShowDrawer(false)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors">
                  <X className="w-5 h-5 text-secondary-500" />
                </button>
              </div>

              {/* Drawer body — scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Status update */}
                <div>
                  <label className="label">Update Status</label>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusUpdate(selectedOrder._id, e.target.value as OrderStatus)}
                    className="input"
                    disabled={selectedOrder.status === 'REJECTED' || selectedOrder.status === 'CANCELLED' || statusUpdating === selectedOrder._id}
                  >
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                  </select>
                </div>

                {/* Customer */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-3 text-sm">Customer</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-secondary-400 shrink-0" />
                      <span className="font-medium text-secondary-900 dark:text-white">{selectedOrder.customerId?.name || 'Guest'}</span>
                    </div>
                    {selectedOrder.customerId?.mobile && (
                      <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-300">
                        <span className="text-base shrink-0">📞</span>
                        <span>{selectedOrder.customerId.mobile}</span>
                      </div>
                    )}
                    {selectedOrder.customerId?.address && (
                      <div className="flex items-start gap-2 text-secondary-600 dark:text-secondary-300">
                        <span className="text-base shrink-0">📍</span>
                        <span>{selectedOrder.customerId.address}</span>
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
                        selectedOrder.orderType === 'DINE_IN'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {selectedOrder.orderType === 'DINE_IN' ? 'Dine In' : 'Delivery'}
                      </span>
                    </div>
                    {selectedOrder.tableNumber && (
                      <div className="flex justify-between">
                        <span className="text-secondary-500">Table</span>
                        <span className="font-medium text-secondary-900 dark:text-white">Table {selectedOrder.tableNumber}</span>
                      </div>
                    )}
                    {selectedOrder.orderType === 'DELIVERY' && selectedOrder.address && (
                      <div className="flex flex-col gap-1">
                        <span className="text-secondary-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Delivery Address</span>
                        <span className="font-medium text-secondary-900 dark:text-white bg-secondary-50 dark:bg-secondary-700/50 rounded-lg px-3 py-2 text-xs">{selectedOrder.address}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-secondary-500">Payment</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                        selectedOrder.paymentStatus === 'PAID'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {selectedOrder.paymentStatus || 'PENDING'}
                      </span>
                    </div>
                    {selectedOrder.estimatedTime && (
                      <div className="flex justify-between">
                        <span className="text-secondary-500">Est. Time</span>
                        <span className="font-medium text-secondary-900 dark:text-white">{selectedOrder.estimatedTime} min</span>
                      </div>
                    )}
                    {selectedOrder.note && (
                      <div className="flex flex-col gap-1">
                        <span className="text-secondary-500">Note</span>
                        <span className="text-secondary-700 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg px-3 py-2 text-xs italic">"{selectedOrder.note}"</span>
                      </div>
                    )}
                    {selectedOrder.rejectionReason && (
                      <div className="flex flex-col gap-1">
                        <span className="text-secondary-500">Rejection Reason</span>
                        <span className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-xs">{selectedOrder.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-3 text-sm">
                    Items
                    <span className="ml-1 text-secondary-400 font-normal">({selectedOrder.totalItems} item{selectedOrder.totalItems !== 1 ? 's' : ''})</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-3 pb-2 border-b border-secondary-100 dark:border-secondary-700 last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-900 dark:text-white">
                            <span className="text-primary-500 font-bold">{item.quantity}×</span> {item.name}
                          </p>
                          <p className="text-xs text-secondary-400">₹{item.price.toFixed(2)} each</p>
                          {item.itemNote && <p className="text-xs text-secondary-500 italic mt-0.5">"{item.itemNote}"</p>}
                        </div>
                        <span className="font-semibold text-sm text-secondary-900 dark:text-white shrink-0">₹{item.subtotal.toFixed(2)}</span>
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
                    {(selectedOrder.taxAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                        <span>Tax</span><span>₹{(selectedOrder.taxAmount ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(selectedOrder.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span><span>-₹{(selectedOrder.discountAmount ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-secondary-200 dark:border-secondary-700 text-secondary-900 dark:text-white">
                      <span>Total</span><span>₹{selectedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="space-y-1 text-xs text-secondary-400">
                  <p>📅 Placed: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                  {selectedOrder.acceptedAt  && <p>✅ Accepted: {new Date(selectedOrder.acceptedAt).toLocaleString()}</p>}
                  {selectedOrder.completedAt && <p>🏁 Completed: {new Date(selectedOrder.completedAt).toLocaleString()}</p>}
                  {selectedOrder.rejectedAt  && <p>❌ Rejected: {new Date(selectedOrder.rejectedAt).toLocaleString()}</p>}
                </div>

              </div>{/* end drawer body */}
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

