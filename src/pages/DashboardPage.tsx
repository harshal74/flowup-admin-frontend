import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag, DollarSign, Users, Clock,
  TrendingUp, TrendingDown, ArrowRight, ChefHat,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import API from '../lib/api';
import socket from '../lib/socket';
import type { Order } from '../types';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  ACCEPTED: '#3B82F6',
  PREPARING: '#8B5CF6',
  READY: '#14B8A6',
  OUT_FOR_DELIVERY: '#6366F1',
  COMPLETED: '#10B981',
  REJECTED: '#EF4444',
  CANCELLED: '#6B7280',
};

type Period = 'daily' | 'weekly' | 'monthly' | 'total';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
  { value: 'total',   label: 'Total'   },
];

// ─────────────────────────────────────────────────────────────────
// Date-range helpers (all pure, no API calls)
// ─────────────────────────────────────────────────────────────────

/** Returns { start, end } for a given period + offset (0 = current, -1 = previous, …) */
function getRange(period: Period, offset: number): { start: Date; end: Date } | null {
  if (period === 'total') return null;

  const now = new Date();

  if (period === 'daily') {
    const start = new Date(now);
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === 'weekly') {
    // Week: Mon → Sun
    const dow = now.getDay(); // 0=Sun
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const start = new Date(now);
    start.setDate(now.getDate() + diffToMon + offset * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // monthly
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Human-readable label for the selected range */
function getPeriodLabel(period: Period, offset: number): string {
  if (period === 'total') return 'All Time';
  const range = getRange(period, offset)!;

  if (period === 'daily') {
    return range.start.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
  }
  if (period === 'weekly') {
    const s = range.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = range.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }
  // monthly
  return range.start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** Filter an array of orders to those whose createdAt falls inside the range */
function filterByRange(orders: Order[], range: { start: Date; end: Date } | null): Order[] {
  if (!range) return orders;
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  });
}

// ─────────────────────────────────────────────────────────────────
// Revenue chart builders
// ─────────────────────────────────────────────────────────────────

function buildDailyChart(orders: Order[], range: { start: Date; end: Date }) {
  // orders is already filtered to the range — bucket by hour
  const map: Record<number, number> = {};
  orders.forEach((o) => {
    const h = new Date(o.createdAt).getHours();
    map[h] = (map[h] || 0) + o.totalAmount;
  });
  return Array.from({ length: 24 }, (_, h) => ({
    date: `${h}:00`,
    revenue: map[h] || 0,
  }));
}

function buildWeeklyChart(orders: Order[], range: { start: Date; end: Date }) {
  // orders is already filtered to the range — bucket by day Mon-Sun
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const map: Record<string, number> = {};

  orders.forEach((o) => {
    const d = new Date(o.createdAt).getDay(); // 0=Sun
    const label = days[d === 0 ? 6 : d - 1];
    map[label] = (map[label] || 0) + o.totalAmount;
  });

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(range.start);
    d.setDate(range.start.getDate() + i);
    const dayLabel = days[i];
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return {
      date: `${dayLabel}\n${dateStr}`,
      revenue: map[dayLabel] || 0,
    };
  });
}

function buildMonthlyChart(orders: Order[], range: { start: Date; end: Date }) {
  // orders is already filtered to the range — bucket by week of month
  const map: Record<string, number> = {};

  orders.forEach((o) => {
    const day = new Date(o.createdAt).getDate();
    const week = `W${Math.ceil(day / 7)}`;
    map[week] = (map[week] || 0) + o.totalAmount;
  });

  const daysInMonth = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil(daysInMonth / 7);
  return Array.from({ length: weeks }, (_, i) => ({
    date: `W${i + 1}`,
    revenue: map[`W${i + 1}`] || 0,
  }));
}

function buildTotalChart(orders: Order[]) {
  // All completed orders — bucket by calendar month (last 12)
  const now = new Date();
  const map: Record<string, number> = {};

  orders.forEach((o) => {
    const d = new Date(o.createdAt);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    map[label] = (map[label] || 0) + o.totalAmount;
  });

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return { date: label, revenue: map[label] || 0 };
  });
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const [allOrders, setAllOrders]   = useState<Order[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  const [period, setPeriod]   = useState<Period>('weekly');
  const [offset, setOffset]   = useState(0);

  // Fetch ALL orders once on mount; then keep in sync via socket
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const res = await API.get('/orders');
        setAllOrders(res.data?.data || []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    })();

    // ── new_order: prepend so charts update instantly ──
    const onNewOrder = (order: any) => {
      setAllOrders((prev) => {
        if (prev.some((o) => o._id === order._id)) return prev;
        return [order, ...prev];
      });
    };

    // ── order_status_updated: update status in-place ──
    const onStatusUpdated = (payload: { orderId: string; status: string; [key: string]: any }) => {
      setAllOrders((prev) =>
        prev.map((o) =>
          o._id === payload.orderId
            ? { ...o, status: payload.status as Order['status'], ...(payload.completedAt && { completedAt: payload.completedAt }) }
            : o
        )
      );
    };

    socket.on('new_order',            onNewOrder);
    socket.on('order_status_updated', onStatusUpdated);

    return () => {
      socket.off('new_order',            onNewOrder);
      socket.off('order_status_updated', onStatusUpdated);
    };
  }, []);

  const handlePeriodChange = (p: Period) => { setPeriod(p); setOffset(0); };
  const handlePrev         = () => setOffset((o) => o - 1);
  const handleNext         = () => { if (offset < 0) setOffset((o) => o + 1); };

  // ── All calculations are pure derivations from allOrders ──────
  const periodLabel = useMemo(() => getPeriodLabel(period, offset), [period, offset]);

  const currentRange = useMemo(() => getRange(period, offset), [period, offset]);
  const prevRange    = useMemo(() => (period !== 'total' ? getRange(period, offset - 1) : null), [period, offset]);

  // All COMPLETED orders (base set for every calculation)
  const allCompleted = useMemo(() => allOrders.filter((o) => o.status === 'COMPLETED'), [allOrders]);

  /** COMPLETED orders in the selected window */
  const currentOrders = useMemo(() => filterByRange(allCompleted, currentRange), [allCompleted, currentRange]);
  /** COMPLETED orders in the previous window (for trends) */
  const prevOrders    = useMemo(() => filterByRange(allCompleted, prevRange),    [allCompleted, prevRange]);

  // ── Stats (all based on COMPLETED orders only) ─────────────────
  const stats = useMemo(() => {
    const uniqueCustomers = new Set(
      currentOrders.map((o) => (o.customerId as any)?._id || (o.customerId as any) || '').filter(Boolean)
    );
    // Pending is always a live count regardless of period
    const pendingLive = allOrders.filter((o) =>
      ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status)
    ).length;

    return {
      totalOrders:    currentOrders.length,
      totalRevenue:   currentOrders.reduce((s, o) => s + o.totalAmount, 0),
      totalCustomers: uniqueCustomers.size,
      pendingOrders:  pendingLive,
    };
  }, [currentOrders, allOrders]);

  // ── Trends (COMPLETED vs previous COMPLETED) ───────────────────
  const trends = useMemo(() => {
    if (period === 'total') return { ordersTrend: 0, revenueTrend: 0, customersTrend: 0 };

    const prevRevenue   = prevOrders.reduce((s, o) => s + o.totalAmount, 0);
    const prevCustomers = new Set(
      prevOrders.map((o) => (o.customerId as any)?._id || (o.customerId as any) || '').filter(Boolean)
    ).size;

    const calcTrend = (cur: number, prev: number) =>
      prev === 0 ? (cur > 0 ? 100 : 0) : Number((((cur - prev) / prev) * 100).toFixed(1));

    return {
      ordersTrend:    calcTrend(currentOrders.length, prevOrders.length),
      revenueTrend:   calcTrend(stats.totalRevenue, prevRevenue),
      customersTrend: calcTrend(stats.totalCustomers, prevCustomers),
    };
  }, [period, currentOrders, prevOrders, stats]);

  // ── Revenue Chart (COMPLETED orders only) ──────────────────────
  const revenueChart = useMemo(() => {
    if (period === 'daily'   && currentRange) return buildDailyChart(currentOrders,   currentRange);
    if (period === 'weekly'  && currentRange) return buildWeeklyChart(currentOrders,  currentRange);
    if (period === 'monthly' && currentRange) return buildMonthlyChart(currentOrders, currentRange);
    // total — all completed orders across all time
    return buildTotalChart(allCompleted);
  }, [period, currentOrders, currentRange, allCompleted]);

  // ── Status Pie — all statuses scoped to current period ─────────
  const statusChart = useMemo(() => {
    // Use ALL orders (not just completed) filtered to the selected period
    const periodOrders = filterByRange(allOrders, currentRange);
    const map: Record<string, number> = {};
    periodOrders.forEach((o) => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [allOrders, currentRange]);

  // ── Top Items (from COMPLETED orders in selected period) ────────
  const topItems = useMemo(() => {
    const map: Record<string, number> = {};
    currentOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        map[item.name] = (map[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(map)
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);
  }, [currentOrders]);

  // ── Recent Orders (always latest 10) ───────────────────────────
  const recentOrders = useMemo(
    () => [...allOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10),
    [allOrders]
  );

  // ─────────────────────────────────────────────────────────────────
  // Stat Card component
  // ─────────────────────────────────────────────────────────────────
  const StatCard = ({
    title, value, icon: Icon, trend, color, prefix = '', showTrend,
  }: {
    title: string; value: number; icon: React.ElementType;
    trend?: number; color: string; prefix?: string; showTrend?: boolean;
  }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 rounded-full opacity-10" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-secondary-900 dark:text-white">
            {prefix}{value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          {showTrend && trend !== undefined && period !== 'total' && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {trend >= 0 ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
              <span>{trend >= 0 ? '+' : ''}{trend}% vs prev {period}</span>
            </div>
          )}
          {period === 'total' && (
            <p className="text-sm text-secondary-400 mt-2">All time</p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </motion.div>
  );

  // ─────────────────────────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-6">
            <div className="skeleton h-4 w-20 mb-2" />
            <div className="skeleton h-8 w-32 mb-2" />
            <div className="skeleton h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="card p-6 lg:col-span-2"><div className="skeleton h-64 w-full" /></div>
        <div className="card p-6"><div className="skeleton h-64 w-full" /></div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header + Period Controls ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Dashboard</h1>
          <p className="text-secondary-500 dark:text-secondary-400">Welcome back! Here's your restaurant overview.</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Prev / Next (hidden for "total") */}
            {period !== 'total' && (
              <div className="flex items-center bg-secondary-100 dark:bg-secondary-700 rounded-xl overflow-hidden">
                <button
                  onClick={handlePrev}
                  className="px-3 py-2 hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                  title={`Previous ${period}`}
                >
                  <ChevronLeft className="w-4 h-4 text-secondary-600 dark:text-secondary-300" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={offset >= 0}
                  className="px-3 py-2 hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={`Next ${period}`}
                >
                  <ChevronRight className="w-4 h-4 text-secondary-600 dark:text-secondary-300" />
                </button>
              </div>
            )}

            {/* Period tabs */}
            <div className="flex bg-secondary-100 dark:bg-secondary-700 rounded-xl p-1 gap-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePeriodChange(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    period === p.value
                      ? 'bg-white dark:bg-secondary-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period label shown below controls */}
          <p className="text-xs font-medium text-secondary-500 dark:text-secondary-400 pr-1">
            Showing: <span className="text-secondary-700 dark:text-secondary-200">{periodLabel}</span>
          </p>
        </div>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Total Orders"    value={stats.totalOrders}    icon={ShoppingBag} trend={trends.ordersTrend}    color="#F97316" showTrend />
        <StatCard title="Total Revenue"   value={stats.totalRevenue}   icon={DollarSign}  trend={trends.revenueTrend}   color="#10B981" prefix="₹" showTrend />
        <StatCard title="Total Customers" value={stats.totalCustomers} icon={Users}       trend={trends.customersTrend} color="#3B82F6" showTrend />
        <StatCard title="Pending Orders"  value={stats.pendingOrders}  icon={Clock}       color="#F59E0B" />
      </div>

      {/* ── Revenue Chart + Status Pie ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

        {/* Revenue Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-6 lg:col-span-2"
        >
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Revenue Overview</h3>
            <span className="text-xs text-secondary-400 dark:text-secondary-500 mt-1">{periodLabel}</span>
          </div>

          {/* Sub-label explaining X-axis grouping */}
          <p className="text-xs text-secondary-400 mb-4">
            {period === 'daily'   && 'Plotted by hour (0:00 – 23:00)'}
            {period === 'weekly'  && 'Plotted by day (Mon – Sun)'}
            {period === 'monthly' && 'Plotted by week of month (W1 – W4/W5)'}
            {period === 'total'   && 'Plotted by month (last 12 months)'}
          </p>

          {revenueChart.every((d) => d.revenue === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center text-secondary-400">
              <TrendingUp className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm">No completed orders in this period</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    stroke="#6B7280"
                    fontSize={10}
                    tick={{ fill: '#6B7280' }}
                    interval={period === 'daily' ? 3 : 0}
                    // Show newline-split labels for weekly (day + date)
                    tickFormatter={(v) => v.split('\n')[0]}
                  />
                  <YAxis stroke="#6B7280" fontSize={11} tick={{ fill: '#6B7280' }} tickFormatter={(v) => `₹${v}`} width={55} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', color: '#f1f5f9' }}
                    formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Revenue']}
                    labelFormatter={(label) => label.replace('\n', ' ')}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Order Status Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-1">Order Status</h3>
          <p className="text-xs text-secondary-400 mb-4">{period === 'total' ? 'All time' : periodLabel}</p>
          {statusChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No data</div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChart} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">
                      {statusChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6B7280'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', color: '#f1f5f9' }}
                      formatter={(v: any, name: any) => [v, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                {statusChart.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[entry.name] || '#6B7280' }} />
                    <span className="text-xs text-secondary-500 dark:text-secondary-400">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Recent Orders + Top Items ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

        {/* Recent Orders */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
          <div className="p-6 border-b border-secondary-200 dark:border-secondary-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Recent Orders</h3>
                <p className="text-xs text-secondary-400 mt-0.5">Latest 10 across all time</p>
              </div>
              <a href="/orders" className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
          <div className="divide-y divide-secondary-100 dark:divide-secondary-700">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center">
                <ShoppingBag className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-2" />
                <p className="text-secondary-500 dark:text-secondary-400">No recent orders</p>
              </div>
            ) : recentOrders.map((order) => (
              <div key={order._id} className="p-4 hover:bg-secondary-50 dark:hover:bg-secondary-700/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                      <ChefHat className="w-5 h-5 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-secondary-900 dark:text-white truncate">#{order.orderNumber}</p>
                      <p className="text-xs text-secondary-500 truncate">
                        {(order.customerId as any)?.name || 'Guest'} · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-secondary-900 dark:text-white">₹{order.totalAmount.toFixed(2)}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        order.status === 'COMPLETED'  ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300' :
                        order.status === 'PENDING'    ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300' :
                        order.status === 'REJECTED'   ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'   :
                        'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Selling Items (scoped to selected period) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-6">
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-1">Top Selling Items</h3>
          <p className="text-xs text-secondary-400 mb-4">Based on {periodLabel}</p>
          {topItems.length === 0 ? (
            <div className="py-8 text-center">
              <TrendingUp className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-2" />
              <p className="text-secondary-500 dark:text-secondary-400">No orders in this period</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" stroke="#6B7280" fontSize={12} tick={{ fill: '#6B7280' }} />
                  <YAxis type="category" dataKey="name" stroke="#6B7280" fontSize={11} width={90} tick={{ fill: '#6B7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', color: '#f1f5f9' }}
                    formatter={(v: any) => [v, 'Qty sold']}
                  />
                  <Bar dataKey="orders" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
