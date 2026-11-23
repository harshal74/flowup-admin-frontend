import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Package, X, Loader2, AlertTriangle, Filter, SlidersHorizontal, History, PackagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';

// ── Types (backend is source of truth; see backend/src/models/RawMaterial.js) ──
const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet'] as const;
const BASE_UNITS = ['g', 'ml', 'piece'] as const;

interface RawMaterial {
  _id: string;
  name: string;
  unit: string;
  baseUnit: string;
  currentQuantity: number;
  minimumQuantity: number;
  purchasePrice: number;
  supplier?: string;
  isActive: boolean;
  createdAt?: string;
}

const emptyForm = {
  name: '', unit: 'kg', baseUnit: 'g',
  currentQuantity: '', minimumQuantity: '', purchasePrice: '', supplier: '',
};

function isLow(m: RawMaterial) {
  // Only flag as low when the owner has set a minimum threshold (> 0).
  // minimumQuantity = 0 means "no threshold" — never show LOW badge.
  return m.minimumQuantity > 0 && m.currentQuantity <= m.minimumQuantity;
}

export function InventoryPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RawMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status toggle confirmation
  const [toggleTarget, setToggleTarget] = useState<RawMaterial | null>(null);

  // Adjust-stock modal
  const [adjustTarget, setAdjustTarget] = useState<RawMaterial | null>(null);
  const [adjustMode, setAdjustMode] = useState<'delta' | 'set'>('delta');
  const [adjustValue, setAdjustValue] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Purchase / stock-in modal
  const [purchaseTarget, setPurchaseTarget] = useState<RawMaterial | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePriceMode, setPurchasePriceMode] = useState<'total' | 'unit'>('total'); // NEW: total batch price or per-unit price
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const openPurchase = (m: RawMaterial) => {
    setPurchaseTarget(m);
    setPurchaseQty('');
    setPurchasePriceMode('total');
    setPurchaseUnitPrice('');
  };

  // Derived unit price: in 'total' mode, divide total price by quantity.
  const derivedUnitPrice = (() => {
    const qty = Number(purchaseQty);
    const raw = Number(purchaseUnitPrice);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    if (purchasePriceMode === 'total') {
      if (!Number.isFinite(qty) || qty <= 0) return null;
      return raw / qty;
    }
    return raw; // 'unit' mode — already per-unit
  })();

  const handlePurchase = async () => {
    if (!purchaseTarget || purchasing) return;
    const qty = Number(purchaseQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error('Quantity must be greater than 0'); return; }
    if (derivedUnitPrice === null) {
      toast.error(purchasePriceMode === 'total' ? 'Enter the total price you paid for this batch' : 'Enter the price per unit');
      return;
    }
    if (derivedUnitPrice <= 0) { toast.error('Price must be greater than 0'); return; }
    const body: any = { quantity: qty, unitPrice: derivedUnitPrice };
    setPurchasing(true);
    try {
      await API.patch(`/inventory/${purchaseTarget._id}/purchase`, body);
      toast.success('Stock added');
      setPurchaseTarget(null);
      fetchMaterials();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add stock');
    } finally {
      setPurchasing(false);
    }
  };

  // History modal
  const [historyTarget, setHistoryTarget] = useState<RawMaterial | null>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (m: RawMaterial) => {
    setHistoryTarget(m);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res = await API.get(`/inventory/${m._id}/history?limit=100`);
      setHistoryRows(res.data.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Step 9: operational summary (totals, low-stock count, inventory value).
  const [summary, setSummary] = useState<{ totalMaterials: number; activeMaterials: number; lowStockCount: number; inventoryValue: number } | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await API.get('/inventory/summary');
      setSummary(res.data?.data ?? null);
    } catch {
      setSummary(null); // non-fatal: cards simply hide
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: string[] = [];
      if (activeFilter === 'active') params.push('active=true');
      if (activeFilter === 'inactive') params.push('active=false');
      if (searchQuery.trim()) params.push(`search=${encodeURIComponent(searchQuery.trim())}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const res = await API.get(`/inventory${qs}`);
      setMaterials(res.data.data || []);
      fetchSummary();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, searchQuery, fetchSummary]);

  useEffect(() => {
    const t = setTimeout(fetchMaterials, searchQuery ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchMaterials, searchQuery]);

  const resetForm = () => { setForm({ ...emptyForm }); setEditing(null); setIsSaving(false); };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (m: RawMaterial) => {
    setEditing(m);
    setForm({
      name: m.name,
      unit: m.unit,
      baseUnit: m.baseUnit,
      currentQuantity: String(m.currentQuantity),
      minimumQuantity: String(m.minimumQuantity),
      purchasePrice: String(m.purchasePrice ?? 0),
      supplier: m.supplier || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const min = Number(form.minimumQuantity || 0);
    const price = Number(form.purchasePrice || 0);
    if (min < 0) { toast.error('Minimum quantity cannot be negative'); return; }
    if (price < 0) { toast.error('Purchase price cannot be negative'); return; }

    setIsSaving(true);
    try {
      if (editing) {
        // Edit: only backend-supported editable fields (NOT currentQuantity — use Adjust).
        await API.patch(`/inventory/${editing._id}`, {
          name: form.name.trim(),
          unit: form.unit,
          baseUnit: form.baseUnit,
          minimumQuantity: min,
          purchasePrice: price,
          supplier: form.supplier.trim(),
        });
        toast.success('Raw material updated');
      } else {
        const current = Number(form.currentQuantity || 0);
        if (current < 0) { toast.error('Current quantity cannot be negative'); setIsSaving(false); return; }
        await API.post('/inventory', {
          name: form.name.trim(),
          unit: form.unit,
          baseUnit: form.baseUnit,
          currentQuantity: current,
          minimumQuantity: min,
          purchasePrice: price,
          supplier: form.supplier.trim(),
        });
        toast.success('Raw material created');
      }
      setShowModal(false);
      resetForm();
      fetchMaterials();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save raw material');
    } finally {
      setIsSaving(false);
    }
  };

  const openAdjust = (m: RawMaterial) => {
    setAdjustTarget(m);
    setAdjustMode('delta');
    setAdjustValue('');
  };

  const adjustResult = (() => {
    if (!adjustTarget) return null;
    const v = Number(adjustValue);
    if (!Number.isFinite(v)) return null;
    return adjustMode === 'set' ? v : adjustTarget.currentQuantity + v;
  })();

  const handleAdjust = async () => {
    if (!adjustTarget || isAdjusting) return;
    const v = Number(adjustValue);
    if (!Number.isFinite(v)) { toast.error('Enter a valid number'); return; }
    if (adjustMode === 'set' && v < 0) { toast.error('Set value cannot be negative'); return; }
    if (adjustResult !== null && adjustResult < 0) { toast.error('Resulting quantity cannot be negative'); return; }

    setIsAdjusting(true);
    try {
      const body = adjustMode === 'set' ? { set: v } : { delta: v };
      await API.patch(`/inventory/${adjustTarget._id}/adjust`, body);
      toast.success('Stock adjusted');
      setAdjustTarget(null);
      fetchMaterials();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleToggle = async (m: RawMaterial) => {
    // Gap 8 fix: show confirmation before deactivating, to prevent mis-clicks.
    if (m.isActive) {
      setToggleTarget(m); // open confirmation modal
      return;
    }
    // Re-activating needs no confirmation.
    await doToggle(m);
  };

  const doToggle = async (m: RawMaterial) => {
    try {
      await API.patch(`/inventory/${m._id}/toggle-status`);
      toast.success(`Raw material ${m.isActive ? 'deactivated' : 'activated'}`);
      setToggleTarget(null);
      fetchMaterials();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  // Gap 7 fix: delete handler with confirmation modal.
  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await API.delete(`/inventory/${deleteTarget._id}`);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      fetchMaterials();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete raw material');
    } finally {
      setIsDeleting(false);
    }
  };

  const lowCount = materials.filter(isLow).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Inventory</h1>
          <p className="text-secondary-500 dark:text-secondary-400">
            Manage raw materials. Quantities are stored in each item's <strong>base unit</strong>.
          </p>
        </div>
        <button onClick={openAdd} className="btn btn-primary"><Plus className="w-5 h-5" />Add Raw Material</button>
      </div>

      {/* Step 9: summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4"><div className="text-xs text-secondary-400">Total Materials</div><div className="text-xl font-bold text-secondary-900 dark:text-white">{summary.totalMaterials}</div></div>
          <div className="card p-4"><div className="text-xs text-secondary-400">Active</div><div className="text-xl font-bold text-secondary-900 dark:text-white">{summary.activeMaterials}</div></div>
          <div className="card p-4"><div className="text-xs text-secondary-400">Low Stock</div><div className={`text-xl font-bold ${summary.lowStockCount > 0 ? 'text-warning-600' : 'text-secondary-900 dark:text-white'}`}>{summary.lowStockCount}</div></div>
          <div className="card p-4"><div className="text-xs text-secondary-400">Inventory Value</div><div className="text-xl font-bold text-secondary-900 dark:text-white">₹{Number(summary.inventoryValue).toFixed(2)}</div></div>
        </div>
      )}

      {/* Low-stock summary */}
      {lowCount > 0 && (
        <div className="rounded-xl bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-600 shrink-0" />
          <span className="text-sm font-medium text-warning-700 dark:text-warning-400">
            {lowCount} material{lowCount > 1 ? 's' : ''} at or below minimum stock
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search raw materials..." className="input pl-12" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-secondary-400" />
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)} className="input">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* States */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="card p-4 h-20" />)}</div>
      ) : error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-danger-400 mb-3" />
          <p className="text-danger-600 mb-3">{error}</p>
          <button onClick={fetchMaterials} className="btn btn-secondary">Retry</button>
        </div>
      ) : materials.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-16 h-16 mx-auto text-secondary-300 dark:text-secondary-600 mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">No raw materials</h3>
          <p className="text-secondary-500 dark:text-secondary-400 mb-4">{searchQuery ? 'Try a different search' : 'Add your first raw material'}</p>
          <button onClick={openAdd} className="btn btn-primary"><Plus className="w-5 h-5" />Add Raw Material</button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 dark:bg-secondary-700/50 text-secondary-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-right px-4 py-3 font-medium">Current</th>
                    <th className="text-right px-4 py-3 font-medium">Minimum</th>
                    <th className="text-left px-4 py-3 font-medium">Unit</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-left px-4 py-3 font-medium">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m._id} className={`border-t border-secondary-100 dark:border-secondary-700 ${!m.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-secondary-900 dark:text-white">
                        {m.name}
                        {isLow(m) && <span className="ml-2 badge bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400">LOW</span>}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${isLow(m) ? 'text-warning-600 font-bold' : ''}`}>{m.currentQuantity} {m.baseUnit}</td>
                      <td className="px-4 py-3 text-right font-mono text-secondary-500">{m.minimumQuantity} {m.baseUnit}</td>
                      <td className="px-4 py-3 text-secondary-500">{m.unit} → {m.baseUnit}</td>
                      <td className="px-4 py-3 text-right">₹{Number(m.purchasePrice ?? 0).toFixed(2)}/{m.baseUnit}</td>
                      <td className="px-4 py-3 text-secondary-500">{m.supplier || '-'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggle(m)} className={`badge ${m.isActive ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-secondary-100 text-secondary-500'}`}>
                          {m.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openPurchase(m)} className="p-2 rounded-lg hover:bg-success-50 dark:hover:bg-success-900/20 text-success-600" title="Add stock (purchase)"><PackagePlus className="w-4 h-4" /></button>
                          <button onClick={() => openHistory(m)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500" title="History"><History className="w-4 h-4" /></button>
                          <button onClick={() => openAdjust(m)} className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500" title="Adjust stock"><SlidersHorizontal className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteTarget(m)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {materials.map((m) => (
              <div key={m._id} className={`card p-4 ${!m.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-secondary-900 dark:text-white truncate">
                      {m.name}
                      {isLow(m) && <span className="ml-2 badge bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400">LOW</span>}
                    </h3>
                    <p className="text-xs text-secondary-500">{m.unit} → {m.baseUnit} · {m.supplier || 'No supplier'}</p>
                  </div>
                  <button onClick={() => handleToggle(m)} className={`badge shrink-0 ${m.isActive ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-secondary-100 text-secondary-500'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div><div className="text-xs text-secondary-400">Current</div><div className={`font-mono ${isLow(m) ? 'text-warning-600 font-bold' : ''}`}>{m.currentQuantity} {m.baseUnit}</div></div>
                  <div><div className="text-xs text-secondary-400">Minimum</div><div className="font-mono">{m.minimumQuantity} {m.baseUnit}</div></div>
                  <div><div className="text-xs text-secondary-400">Price</div><div>₹{Number(m.purchasePrice ?? 0).toFixed(2)}/{m.baseUnit}</div></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openPurchase(m)} className="btn btn-secondary flex-1 text-sm"><PackagePlus className="w-4 h-4" />Add Stock</button>
                  <button onClick={() => openAdjust(m)} className="btn btn-secondary flex-1 text-sm"><SlidersHorizontal className="w-4 h-4" />Adjust</button>
                  <button onClick={() => openEdit(m)} className="btn btn-secondary flex-1 text-sm"><Edit2 className="w-4 h-4" />Edit</button>
                  <button onClick={() => openHistory(m)} className="btn btn-secondary text-sm px-3" title="History"><History className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteTarget(m)} className="btn text-sm px-3 bg-danger-50 dark:bg-danger-900/20 text-danger-600 hover:bg-danger-100 border-0" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-secondary-800 rounded-2xl p-6 my-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">{editing ? 'Edit Raw Material' : 'Add Raw Material'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="label">Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g., Paneer" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Display Unit</label><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                  <div><label className="label">Base Unit</label><select value={form.baseUnit} onChange={(e) => setForm({ ...form, baseUnit: e.target.value })} className="input">{BASE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                </div>
                <p className="text-xs text-secondary-500 -mt-2">
                  Current and minimum quantities are stored in the selected <strong>base unit</strong> (e.g. enter grams if base unit is g).
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Current Quantity ({form.baseUnit})</label>
                    <input type="number" step="0.001" min="0" value={form.currentQuantity} onChange={(e) => setForm({ ...form, currentQuantity: e.target.value })} className="input" placeholder="0" disabled={!!editing} />
                    {editing && <p className="text-[11px] text-secondary-400 mt-1">Use "Adjust" to change stock.</p>}
                  </div>
                  <div><label className="label">Minimum Quantity ({form.baseUnit})</label><input type="number" step="0.001" min="0" value={form.minimumQuantity} onChange={(e) => setForm({ ...form, minimumQuantity: e.target.value })} className="input" placeholder="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Purchase Price (₹)</label><input type="number" step="0.01" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} className="input" placeholder="0.00" /></div>
                  <div><label className="label">Supplier</label><input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input" placeholder="Optional" /></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1" disabled={isSaving}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="btn btn-primary flex-1">{isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : editing ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjust stock modal */}
      <AnimatePresence>
        {adjustTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAdjustTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Adjust Stock · {adjustTarget.name}</h2>
                <button onClick={() => setAdjustTarget(null)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="text-sm text-secondary-500">Current: <span className="font-mono font-semibold text-secondary-900 dark:text-white">{adjustTarget.currentQuantity} {adjustTarget.baseUnit}</span></div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAdjustMode('delta')} className={`btn flex-1 text-sm ${adjustMode === 'delta' ? 'btn-primary' : 'btn-secondary'}`}>Change (±)</button>
                  <button type="button" onClick={() => setAdjustMode('set')} className={`btn flex-1 text-sm ${adjustMode === 'set' ? 'btn-primary' : 'btn-secondary'}`}>Set exact</button>
                </div>
                <div>
                  <label className="label">{adjustMode === 'delta' ? `Change amount (${adjustTarget.baseUnit}, use - to reduce)` : `New quantity (${adjustTarget.baseUnit})`}</label>
                  <input type="number" step="0.001" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} className="input" placeholder="0" />
                </div>
                {adjustResult !== null && (
                  <div className={`text-sm ${adjustResult < 0 ? 'text-danger-600' : 'text-secondary-600 dark:text-secondary-300'}`}>
                    Resulting quantity: <span className="font-mono font-semibold">{adjustResult} {adjustTarget.baseUnit}</span>
                    {adjustResult < 0 && ' — not allowed'}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setAdjustTarget(null)} className="btn btn-secondary flex-1" disabled={isAdjusting}>Cancel</button>
                  <button type="button" onClick={handleAdjust} disabled={isAdjusting || adjustResult === null || adjustResult < 0} className="btn btn-primary flex-1">{isAdjusting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Apply'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase / Add Stock modal (Step 8) */}
      <AnimatePresence>
        {purchaseTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setPurchaseTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Add Stock · {purchaseTarget.name}</h2>
                <button onClick={() => setPurchaseTarget(null)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="text-sm text-secondary-500">Current: <span className="font-mono font-semibold text-secondary-900 dark:text-white">{purchaseTarget.currentQuantity} {purchaseTarget.baseUnit}</span></div>
                <div>
                  <label className="label">Quantity to add ({purchaseTarget.baseUnit})</label>
                  <input type="number" step="0.001" min="0" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} className="input" placeholder="0" />
                </div>

                {/* Price mode toggle */}
                <div>
                  <label className="label mb-1">How do you want to enter the price?</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setPurchasePriceMode('total'); setPurchaseUnitPrice(''); }}
                      className={`btn flex-1 text-sm ${purchasePriceMode === 'total' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Total I paid (₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPurchasePriceMode('unit'); setPurchaseUnitPrice(''); }}
                      className={`btn flex-1 text-sm ${purchasePriceMode === 'unit' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Per {purchaseTarget.baseUnit} (₹)
                    </button>
                  </div>
                </div>

                <div>
                  {purchasePriceMode === 'total' ? (
                    <>
                      <label className="label">
                        Total amount paid for this batch (₹)
                        <span className="ml-1 text-secondary-400 font-normal text-xs">e.g. ₹60 for 6 buns</span>
                      </label>
                      <input
                        type="number" step="0.01" min="0"
                        value={purchaseUnitPrice}
                        onChange={(e) => setPurchaseUnitPrice(e.target.value)}
                        className="input" placeholder="0.00"
                      />
                      {/* Live per-unit calculation */}
                      {derivedUnitPrice !== null ? (
                        <p className="text-xs text-success-600 dark:text-success-400 mt-1 font-medium">
                          = ₹{derivedUnitPrice.toFixed(2)} per {purchaseTarget.baseUnit}
                        </p>
                      ) : Number(purchaseQty) > 0 && purchaseUnitPrice !== '' ? (
                        <p className="text-xs text-secondary-400 mt-1">Enter a valid quantity and price to see per-unit cost.</p>
                      ) : (
                        <p className="text-xs text-secondary-400 mt-1">Enter quantity and total price to auto-calculate per-unit cost.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="label">
                        Price per {purchaseTarget.baseUnit} (₹)
                        <span className="ml-1 text-secondary-400 font-normal text-xs">e.g. ₹10 per bun</span>
                      </label>
                      <input
                        type="number" step="0.01" min="0"
                        value={purchaseUnitPrice}
                        onChange={(e) => setPurchaseUnitPrice(e.target.value)}
                        className="input" placeholder="0.00"
                      />
                      {Number(purchaseQty) > 0 && derivedUnitPrice !== null && (
                        <p className="text-xs text-success-600 dark:text-success-400 mt-1 font-medium">
                          = Total paid: ₹{(derivedUnitPrice * Number(purchaseQty)).toFixed(2)} for {purchaseQty} {purchaseTarget.baseUnit}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {Number(purchaseQty) > 0 && (
                  <div className="text-sm text-secondary-600 dark:text-secondary-300">
                    New stock balance: <span className="font-mono font-semibold">{purchaseTarget.currentQuantity + Number(purchaseQty)} {purchaseTarget.baseUnit}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setPurchaseTarget(null)} className="btn btn-secondary flex-1" disabled={purchasing}>Cancel</button>
                  <button
                    type="button" onClick={handlePurchase}
                    disabled={purchasing || !(Number(purchaseQty) > 0) || derivedUnitPrice === null || derivedUnitPrice <= 0}
                    className="btn btn-primary flex-1"
                  >
                    {purchasing ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Add Stock'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History modal (Step 7) */}
      <AnimatePresence>
        {historyTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setHistoryTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-secondary-800 rounded-2xl p-6 my-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">History · {historyTarget.name}</h2>
                <button onClick={() => setHistoryTarget(null)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              {historyLoading ? (
                <div className="py-8 flex items-center justify-center text-secondary-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
              ) : historyRows.length === 0 ? (
                <div className="py-8 text-center text-secondary-500">No history yet for this material.</div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {historyRows.map((h) => (
                    <div key={h._id} className="border-b border-secondary-100 dark:border-secondary-700 pb-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`badge text-xs ${h.type === 'DEDUCTION' ? 'bg-red-500/20 text-red-500' : h.type === 'ADJUSTMENT' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}`}>{h.type}</span>
                        <span className="text-xs text-secondary-400">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-secondary-600 dark:text-secondary-300">
                        <span>Change: <span className={`font-mono font-semibold ${h.quantityDelta < 0 ? 'text-red-500' : 'text-green-600'}`}>{h.quantityDelta > 0 ? '+' : ''}{h.quantityDelta} {h.baseUnit || ''}</span></span>
                        <span>Balance: <span className="font-mono">{h.balanceAfter} {h.baseUnit || ''}</span></span>
                        {h.source && <span className="text-xs text-secondary-400">{h.source}</span>}
                      </div>
                      {h.orderId && <div className="text-xs text-secondary-400 mt-0.5">Order: <span className="font-mono">{String(h.orderId)}</span></div>}
                      {h.shortage > 0 && (
                        <div className="text-xs text-warning-600 mt-0.5">Required: {h.requiredQuantity} · Shortage: {h.shortage} {h.baseUnit || ''}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal (Gap 7) */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">Delete raw material?</h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">
                <strong>{deleteTarget.name}</strong> will be permanently removed along with all its recipe mappings.
              </p>
              <p className="text-xs text-danger-600 mb-4">This cannot be undone. Existing inventory history records are preserved.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary flex-1" disabled={isDeleting}>Cancel</button>
                <button onClick={handleDelete} disabled={isDeleting} className="btn btn-danger flex-1">
                  {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting…</> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deactivate confirmation modal (Gap 8) */}
      <AnimatePresence>
        {toggleTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setToggleTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">Deactivate raw material?</h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                <strong>{toggleTarget.name}</strong> will be marked as inactive. It will be excluded from inventory deductions and the active stock value. You can re-activate it at any time.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setToggleTarget(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={() => doToggle(toggleTarget)} className="btn btn-primary flex-1">Deactivate</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InventoryPage;
