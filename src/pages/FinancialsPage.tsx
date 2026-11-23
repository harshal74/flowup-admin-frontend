import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, TrendingUp, TrendingDown, Package, Receipt, Percent,
  Plus, Edit2, Trash2, X, Loader2, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import API from '../lib/api';

// ── Types (backend is source of truth) ──────────────────────────
const EXPENSE_CATEGORIES = [
  'STAFF_SALARY', 'RENT', 'ELECTRICITY', 'WATER', 'INTERNET', 'GAS',
  'MAINTENANCE', 'MARKETING', 'CLEANING', 'DELIVERY_CHARGES',
  'PLATFORM_FEES', 'EQUIPMENT', 'OTHER',
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  STAFF_SALARY: 'Staff Salary', RENT: 'Rent', ELECTRICITY: 'Electricity',
  WATER: 'Water', INTERNET: 'Internet', GAS: 'Gas', MAINTENANCE: 'Maintenance',
  MARKETING: 'Marketing', CLEANING: 'Cleaning', DELIVERY_CHARGES: 'Delivery Charges',
  PLATFORM_FEES: 'Platform Fees', EQUIPMENT: 'Equipment', OTHER: 'Other',
};

const RANGE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'year', label: 'This Year' },
  { key: 'total', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
] as const;

interface Summary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  profitMargin: number;
  cogsEstimated: boolean;
  estimatedLineCount: number;
  expenseByCategory: { category: string; total: number }[];
  range: { start: string; end: string; label: string | null };
}

// Presets that support Prev/Next period navigation via offset.
// last_month is now navigable: offset 0 = previous calendar month (backend handles -1 base),
// offset -1 = two months ago, etc.
const NAVIGABLE = new Set(['today', 'week', 'month', 'last_month', 'year']);

interface Expense {
  _id: string;
  category: string;
  description?: string;
  amount: number;
  expenseDate: string;
  staffId?: { _id: string; name: string; role: string } | null;
  createdBy?: { _id: string; name: string } | null;
  notes?: string;
}

interface StaffOption { _id: string; name: string; role: string; }

const money = (n: number) =>
  `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyExpenseForm = {
  category: 'OTHER',
  description: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  staffId: '',
  notes: '',
};

export function FinancialsPage() {
  const [range, setRange] = useState<string>('month');
  const [offset, setOffset] = useState<number>(0); // 0 = current, -1 = previous period, …
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Changing the preset always resets navigation and pagination to the current period.
  const selectPreset = (key: string) => { setRange(key); setOffset(0); setExpPage(1); };

  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // Pagination state for expenses
  const [expPage, setExpPage] = useState<number>(1);
  const [expTotal, setExpTotal] = useState<number>(0);
  const [expTotalPages, setExpTotalPages] = useState<number>(1);
  const EXP_PAGE_SIZE = 50;

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...emptyExpenseForm });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Race-condition fix (Part 2): track the request ID so stale responses are ignored.
  const reqIdRef = useRef<number>(0);

  // Build the summary/expenses query string for the active range.
  const rangeQuery = useCallback(() => {
    const params: string[] = [`range=${range}`];
    if (range === 'custom') {
      params.push(`start=${encodeURIComponent(customStart)}`);
      params.push(`end=${encodeURIComponent(customEnd)}`);
    } else if (NAVIGABLE.has(range) && offset !== 0) {
      params.push(`offset=${offset}`);
    }
    return params.join('&');
  }, [range, offset, customStart, customEnd]);

  const fetchData = useCallback(async (page = 1) => {
    // Custom range needs both dates before we query.
    if (range === 'custom' && (!customStart || !customEnd)) return;

    // Stamp this request so we can discard stale responses.
    const myId = ++reqIdRef.current;

    setIsLoading(true);
    setError(null);
    try {
      const qs = rangeQuery();
      const [sumRes, expRes] = await Promise.all([
        API.get(`/financials/summary?${qs}`),
        API.get(`/financials/expenses?${qs}&page=${page}&limit=${EXP_PAGE_SIZE}`),
      ]);

      // Discard if a newer request has already started.
      if (myId !== reqIdRef.current) return;

      setSummary(sumRes.data?.data ?? null);
      setExpenses(expRes.data?.data ?? []);
      setExpTotal(expRes.data?.total ?? 0);
      setExpTotalPages(expRes.data?.totalPages ?? 1);
      setExpPage(page);
    } catch (err: any) {
      if (myId !== reqIdRef.current) return; // discard stale errors too
      // Suppress AbortError / cancellation noise — not an error the user should see.
      const msg = err?.response?.data?.message || err?.message || '';
      if (msg === 'canceled' || msg === 'Request aborted') return;
      setError(msg || 'Failed to load financials');
      setSummary(null);
      setExpenses([]);
    } finally {
      if (myId === reqIdRef.current) setIsLoading(false);
    }
  }, [range, offset, customStart, customEnd, rangeQuery]);

  // Reset pagination and refetch whenever the period changes.
  useEffect(() => { fetchData(1); }, [fetchData]);

  // Load staff once for the salary dropdown (best-effort; page works without it).
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/admin/staff?limit=200');
        const list = (res.data?.data || res.data?.staff || []).map((s: any) => ({
          _id: String(s._id), name: s.name, role: s.role,
        }));
        setStaffOptions(list);
      } catch { /* non-blocking */ }
    })();
  }, []);
  // ── Expense CRUD ──────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyExpenseForm, expenseDate: new Date().toISOString().slice(0, 10) });
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      category: e.category,
      description: e.description || '',
      amount: String(e.amount ?? ''),
      expenseDate: e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0, 10) : '',
      staffId: e.staffId?._id || '',
      notes: e.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ ...emptyExpenseForm });
    setIsSaving(false);
  };

  const saveExpense = async () => {
    if (isSaving) return;
    const amount = Number(form.amount);
    if (!EXPENSE_CATEGORIES.includes(form.category as any)) { toast.error('Select a valid category'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (!form.expenseDate || isNaN(new Date(form.expenseDate).getTime())) { toast.error('Select a valid date'); return; }

    const payload: any = {
      category: form.category,
      amount,
      expenseDate: form.expenseDate,
      description: form.description.trim(),
      notes: form.notes.trim(),
      staffId: form.staffId || null,
    };

    setIsSaving(true);
    try {
      if (editing) {
        await API.patch(`/financials/expenses/${editing._id}`, payload);
        toast.success('Expense updated');
      } else {
        await API.post('/financials/expenses', payload);
        toast.success('Expense recorded');
      }
      closeModal();
      fetchData(1); // reset to page 1 after create/edit
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await API.delete(`/financials/expenses/${deleteTarget._id}`);
      toast.success('Expense deleted');
      setDeleteTarget(null);
      fetchData(1); // reset to page 1 after delete
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete expense');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Summary cards config ──────────────────────────────────────
  const cards = summary ? [
    {
      label: 'Total Sales',
      sub: 'Money collected from completed orders',
      value: money(summary.revenue),
      icon: Wallet,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Ingredient Cost',
      sub: 'Raw material cost used in orders',
      value: money(summary.cogs),
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Profit After Ingredients',
      sub: 'Sales minus ingredient cost',
      value: money(summary.grossProfit),
      icon: summary.grossProfit >= 0 ? TrendingUp : TrendingDown,
      color: summary.grossProfit >= 0 ? 'text-teal-600' : 'text-red-600',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
    },
    {
      label: 'Running Expenses',
      sub: 'Rent, salary, electricity, etc.',
      value: money(summary.operatingExpenses),
      icon: Receipt,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
    {
      label: 'Final Profit / Loss',
      sub: 'What you actually earned (or lost)',
      value: money(summary.netProfit),
      icon: summary.netProfit >= 0 ? TrendingUp : TrendingDown,
      color: summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
      bg: summary.netProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
    {
      label: 'Profit %',
      sub: `Out of every ₹100 earned, ${summary.netProfit >= 0 ? '₹' + Math.abs(summary.profitMargin ?? 0).toFixed(1) + ' is profit' : '₹' + Math.abs(summary.profitMargin ?? 0).toFixed(1) + ' is loss'}`,
      value: `${(summary.profitMargin ?? 0).toFixed(1)}%`,
      icon: Percent,
      color: summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
      bg: 'bg-secondary-50 dark:bg-secondary-700/30',
    },
  ] : [];

  const chartData = summary ? [
    { name: 'Sales', value: summary.revenue },
    { name: 'Ingredient Cost', value: summary.cogs },
    { name: 'Running Exp.', value: summary.operatingExpenses },
    { name: 'Final Profit', value: summary.netProfit },
  ] : [];
  const chartColors = ['#10B981', '#F59E0B', '#6366F1', summary && summary.netProfit >= 0 ? '#059669' : '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Financials</h1>
          <p className="text-secondary-500 dark:text-secondary-400">Profit &amp; Loss overview and expense management</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary"><Plus className="w-5 h-5" /> Add Expense</button>
      </div>

      {/* Date range selector */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => selectPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === p.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Prev / Next period navigation (month/week/day/year/last_month) */}
        {NAVIGABLE.has(range) && (
          <div className="flex items-center justify-between gap-3 mt-3">
            <button
              onClick={() => { setOffset((o) => o - 1); setExpPage(1); }}
              className="btn btn-secondary py-1.5 px-3 text-sm"
              title="Previous period"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            <span className="text-sm font-semibold text-secondary-900 dark:text-white text-center flex-1 truncate">
              {summary?.range?.label || '—'}
              {offset !== 0 && (
                <button
                  onClick={() => { setOffset(0); setExpPage(1); }}
                  className="ml-2 text-xs font-medium text-primary-500 hover:underline"
                >
                  (back to current)
                </button>
              )}
            </span>

            <button
              onClick={() => { setOffset((o) => Math.min(0, o + 1)); setExpPage(1); }}
              disabled={offset >= 0}
              className="btn btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title={offset >= 0 ? 'Already at the most recent period' : 'Next period'}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* All-Time label — no navigation controls */}
        {range === 'total' && summary?.range?.label && (
          <div className="mt-3 text-center text-sm font-semibold text-secondary-900 dark:text-white">
            {summary.range.label}
          </div>
        )}
        {range === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <div>
              <label className="label">Start date</label>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">End date</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="card p-4 border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 text-danger-600 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
        </div>
      ) : summary ? (
        <>
          {/* COGS estimated warning */}
          {summary.cogsEstimated && (
            <div className="card p-3 flex items-start gap-2 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Some <strong>ingredient cost values are estimated</strong>: {summary.estimatedLineCount} older order
                {summary.estimatedLineCount === 1 ? '' : 's'} did not have the cost recorded at the time, so the
                current purchase price was used instead. All new orders record the exact ingredient cost automatically.
              </p>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.label} className={`card p-4 ${c.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wide">{c.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-secondary-400 dark:text-secondary-500 mt-1 leading-snug">{c.sub}</p>
                  </div>
                  <c.icon className={`w-6 h-6 shrink-0 ${c.color} mt-1`} />
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="card p-5">
            <h2 className="font-semibold text-secondary-900 dark:text-white mb-1">How Your Profit Is Calculated</h2>
            <p className="text-xs text-secondary-400 mb-4">A simple step-by-step of where your money goes</p>
            <div className="space-y-1.5 text-sm max-w-lg">
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-300">
                  💰 Total Sales
                  <span className="block text-xs text-secondary-400 font-normal">Money you collected from customers</span>
                </span>
                <span className="font-semibold text-green-600">{money(summary.revenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-300">
                  🧂 − Ingredient Cost
                  <span className="block text-xs text-secondary-400 font-normal">Raw materials used in your food orders</span>
                </span>
                <span className="font-medium text-amber-600">− {money(summary.cogs)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-secondary-200 dark:border-secondary-700 pt-2">
                <span className="font-semibold text-secondary-700 dark:text-secondary-200">
                  = Profit After Ingredients
                  <span className="block text-xs text-secondary-400 font-normal">What's left after food cost</span>
                </span>
                <span className={`font-semibold ${summary.grossProfit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{money(summary.grossProfit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-300">
                  🏢 − Running Expenses
                  <span className="block text-xs text-secondary-400 font-normal">Rent, salaries, electricity, etc.</span>
                </span>
                <span className="font-medium text-indigo-600">− {money(summary.operatingExpenses)}</span>
              </div>
              <div className="flex justify-between items-center border-t-2 border-secondary-300 dark:border-secondary-600 pt-2 mt-1">
                <span className="font-bold text-secondary-900 dark:text-white">
                  = Final Profit / Loss
                  <span className="block text-xs text-secondary-400 font-normal">What you actually earned (or lost)</span>
                </span>
                <span className={`font-bold text-lg ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(summary.netProfit)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-secondary-500 text-xs">
                  Profit %
                  <span className="block text-xs text-secondary-400 font-normal">Out of every ₹100 earned</span>
                </span>
                <span className={`text-sm font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(summary.profitMargin ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Chart + category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-semibold text-secondary-900 dark:text-white mb-1">Sales vs Costs Overview</h2>
              <p className="text-xs text-secondary-400 mb-3">Visual comparison of sales, ingredient cost, running expenses and final profit</p>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={chartColors[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-secondary-900 dark:text-white mb-1">Running Expenses by Type</h2>
              <p className="text-xs text-secondary-400 mb-3">Where your money is being spent</p>
              {summary.expenseByCategory.length === 0 ? (
                <p className="text-sm text-secondary-500 py-4 text-center">No running expenses recorded in this period.</p>
              ) : (
                <div className="space-y-1.5 text-sm">
                  {summary.expenseByCategory.map((c) => (
                    <div key={c.category} className="flex justify-between">
                      <span className="text-secondary-600 dark:text-secondary-300">{CATEGORY_LABEL[c.category] || c.category}</span>
                      <span className="font-medium text-secondary-900 dark:text-white">{money(c.total)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-secondary-200 dark:border-secondary-700 pt-1.5 mt-1.5">
                    <span className="font-bold text-secondary-900 dark:text-white">Total</span>
                    <span className="font-bold text-secondary-900 dark:text-white">{money(summary.operatingExpenses)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expense table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-secondary-200 dark:border-secondary-700 flex items-center justify-between">
              <h2 className="font-semibold text-secondary-900 dark:text-white">Expense Records</h2>
              <span className="text-xs text-secondary-400">
                {expTotal > 0
                  ? `${expTotal} record${expTotal === 1 ? '' : 's'} · page ${expPage} of ${expTotalPages}`
                  : '0 records'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 dark:bg-secondary-700/50 border-b border-secondary-200 dark:border-secondary-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-secondary-500 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-secondary-500 uppercase">Category</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-secondary-500 uppercase">Description</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-secondary-500 uppercase hidden sm:table-cell">Staff</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-secondary-500 uppercase">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-secondary-500 uppercase hidden md:table-cell">Created By</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-secondary-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <p className="text-secondary-400 mb-2">No expenses recorded in this period.</p>
                        <button onClick={openAdd} className="btn btn-primary text-sm py-1.5 px-4">
                          <Plus className="w-4 h-4" /> Add Expense
                        </button>
                      </td>
                    </tr>
                  ) : expenses.map((e) => (
                    <tr key={e._id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/40">
                      <td className="px-4 py-2.5 text-secondary-700 dark:text-secondary-300">{new Date(e.expenseDate).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-2.5"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300">{CATEGORY_LABEL[e.category] || e.category}</span></td>
                      <td className="px-4 py-2.5 text-secondary-700 dark:text-secondary-300 max-w-[220px] truncate">{e.description || '—'}</td>
                      <td className="px-4 py-2.5 text-secondary-500 hidden sm:table-cell">{e.staffId?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-secondary-900 dark:text-white">{money(e.amount)}</td>
                      <td className="px-4 py-2.5 text-secondary-500 hidden md:table-cell">{e.createdBy?.name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {expTotalPages > 1 && (
              <div className="px-5 py-3 border-t border-secondary-100 dark:border-secondary-700 flex items-center justify-between gap-3">
                <button
                  onClick={() => fetchData(expPage - 1)}
                  disabled={expPage <= 1}
                  className="btn btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-xs text-secondary-500">
                  Page {expPage} of {expTotalPages} &nbsp;·&nbsp; {expTotal} total expenses
                </span>
                <button
                  onClick={() => fetchData(expPage + 1)}
                  disabled={expPage >= expTotalPages}
                  className="btn btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        !error && (
          <div className="card p-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-primary-500" />
            </div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-2">Track Your Restaurant's Profit &amp; Loss</h2>
            <p className="text-secondary-500 dark:text-secondary-400 text-sm mb-5 leading-relaxed">
              Your financial overview will appear here automatically as you receive and complete paid orders.
              Add your restaurant expenses to start tracking your profit and loss.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-6">
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">💰 Revenue</p>
                <p className="text-xs text-secondary-500 dark:text-secondary-400">Automatically fetched from all your completed &amp; paid orders. No manual entry needed.</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">🧾 Expenses</p>
                <p className="text-xs text-secondary-500 dark:text-secondary-400">Enter your running costs manually — rent, salaries, electricity, and more.</p>
              </div>
              <div className="rounded-xl bg-teal-50 dark:bg-teal-900/20 p-3">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mb-1">📊 Profit</p>
                <p className="text-xs text-secondary-500 dark:text-secondary-400">Revenue − Ingredient Cost − Running Expenses = Your actual profit or loss.</p>
              </div>
            </div>
            <button onClick={openAdd} className="btn btn-primary">
              <Plus className="w-5 h-5" /> Add Your First Expense
            </button>
          </div>
        )
      )}

      {/* Add/Edit expense modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-secondary-800 rounded-2xl p-6 my-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount (₹)</label>
                    <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date</label>
                    <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Staff (optional)</label>
                    <select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="input">
                      <option value="">—</option>
                      {staffOptions.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="e.g., September salary" maxLength={300} />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-[70px]" maxLength={500} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1" disabled={isSaving}>Cancel</button>
                  <button type="button" onClick={saveExpense} disabled={isSaving} className="btn btn-primary flex-1">
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : editing ? 'Update' : 'Add Expense'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">Delete expense?</h3>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                {CATEGORY_LABEL[deleteTarget.category] || deleteTarget.category} · {money(deleteTarget.amount)} on {new Date(deleteTarget.expenseDate).toLocaleDateString('en-IN')}. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary flex-1" disabled={isDeleting}>Cancel</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="btn btn-danger flex-1">
                  {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FinancialsPage;
