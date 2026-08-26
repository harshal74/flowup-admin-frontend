import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Phone, MessageCircle, Trash2, X, MapPin, Mail,
  Clock, CheckCircle2, Search, RefreshCw, ExternalLink,
  Eye, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import { useNotification } from '../context/NotificationContext';

// ── Types ─────────────────────────────────────────────────────────
interface DeliveryEnquiry {
  _id: string;
  customerName: string;
  mobile: string;
  email?: string;
  address: string;
  deliveryLocation?: { latitude: number; longitude: number };
  message?: string;
  status: 'NEW' | 'CONTACTED' | 'RESOLVED' | 'CLOSED';
  note?: string;
  resolvedBy?: { name: string; email: string };
  resolvedAt?: string;
  createdAt: string;
}

interface Summary {
  total: number;
  new: number;
  contacted: number;
  resolved: number;
  closed: number;
}

// ── Status helpers ─────────────────────────────────────────────────
const STATUS_CFG = {
  NEW:       { label: 'New',       bg: 'bg-amber-100 dark:bg-amber-900/30',       text: 'text-amber-700 dark:text-amber-400',       dot: 'bg-amber-500'   },
  CONTACTED: { label: 'Contacted', bg: 'bg-blue-100 dark:bg-blue-900/30',          text: 'text-blue-700 dark:text-blue-400',          dot: 'bg-blue-500'    },
  RESOLVED:  { label: 'Resolved',  bg: 'bg-success-100 dark:bg-success-900/30',    text: 'text-success-700 dark:text-success-400',    dot: 'bg-success-500' },
  CLOSED:    { label: 'Closed',    bg: 'bg-secondary-100 dark:bg-secondary-700/50',text: 'text-secondary-500 dark:text-secondary-400',dot: 'bg-secondary-400'},
} as const;

function StatusBadge({ status }: { status: DeliveryEnquiry['status'] }) {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── WhatsApp number helper (Indian number convention) ─────────────
function toWaNumber(mobile: string): string {
  const d = mobile.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d;
  const ten = d.replace(/^0/, '').slice(-10);
  return ten.length === 10 ? `91${ten}` : d;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────
export default function DeliveryEnquiriesPage() {
  const { deliveryEnquiries: socketEnquiries } = useNotification();

  const [enquiries,    setEnquiries]    = useState<DeliveryEnquiry[]>([]);
  const [summary,      setSummary]      = useState<Summary>({ total: 0, new: 0, contacted: 0, resolved: 0, closed: 0 });
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<DeliveryEnquiry | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [noteInput,    setNoteInput]    = useState('');
  const [updating,     setUpdating]     = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null);

  // Track IDs already received via socket so we can merge without duplicates
  const socketIdsRef = useRef<Set<string>>(new Set());

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await API.get(`/delivery-enquiries?${params}`);
      const data: DeliveryEnquiry[] = res.data.data || [];
      setEnquiries(data);
      setSummary(res.data.summary || { total: 0, new: 0, contacted: 0, resolved: 0, closed: 0 });
      // Reset tracking so new socket events can add missing items again
      socketIdsRef.current = new Set(data.map(e => e._id));
    } catch {
      toast.error('Failed to load delivery enquiries');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchEnquiries(); }, [fetchEnquiries]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchEnquiries(), 380);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Merge live socket enquiries (NEW items only) ───────────────
  useEffect(() => {
    if (!socketEnquiries.length) return;
    socketEnquiries.forEach(se => {
      if (!socketIdsRef.current.has(se._id) && (!statusFilter || statusFilter === 'NEW')) {
        socketIdsRef.current.add(se._id);
        setEnquiries(prev => {
          if (prev.some(e => e._id === se._id)) return prev;
          const newItem: DeliveryEnquiry = { ...se, status: 'NEW' as const };
          return [newItem, ...prev];
        });
        setSummary(prev => ({ ...prev, total: prev.total + 1, new: prev.new + 1 }));
      }
    });
  }, [socketEnquiries, statusFilter]);

  // ── Status update ──────────────────────────────────────────────
  const handleStatusUpdate = async (id: string, status: DeliveryEnquiry['status']) => {
    setUpdating(true);
    try {
      const res = await API.patch(`/delivery-enquiries/${id}`, { status });
      const updated = res.data.data as DeliveryEnquiry;
      setEnquiries(prev => prev.map(e => e._id === id ? updated : e));
      if (selected?._id === id) setSelected(updated);

      // Adjust summary counts
      const old = enquiries.find(e => e._id === id);
      if (old) {
        setSummary(prev => {
          const next = { ...prev };
          const oldKey = old.status.toLowerCase() as keyof Summary;
          const newKey = status.toLowerCase() as keyof Summary;
          next[oldKey] = Math.max(0, (next[oldKey] as number) - 1);
          (next[newKey] as number) += 1;
          return next;
        });
      }
      toast.success(`Marked as ${STATUS_CFG[status].label}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // ── Note save ──────────────────────────────────────────────────
  const handleNoteSave = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await API.patch(`/delivery-enquiries/${selected._id}`, { note: noteInput });
      const updated = res.data.data as DeliveryEnquiry;
      setEnquiries(prev => prev.map(e => e._id === selected._id ? updated : e));
      setSelected(updated);
      toast.success('Note saved');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setUpdating(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await API.delete(`/delivery-enquiries/${id}`);
      const old = enquiries.find(e => e._id === id);
      setEnquiries(prev => prev.filter(e => e._id !== id));
      if (selected?._id === id) setSelected(null);
      setConfirmDel(null);
      if (old) {
        setSummary(prev => {
          const next = { ...prev, total: Math.max(0, prev.total - 1) };
          const k = old.status.toLowerCase() as keyof Summary;
          (next[k] as number) = Math.max(0, (next[k] as number) - 1);
          return next;
        });
      }
      toast.success('Enquiry deleted');
    } catch {
      toast.error('Failed to delete enquiry');
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = (e: DeliveryEnquiry) => {
    setSelected(e);
    setNoteInput(e.note || '');
    setConfirmDel(null);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Delivery Enquiries</h1>
          <p className="text-secondary-500 dark:text-secondary-400 text-sm mt-0.5">
            Customer delivery requests and lead follow-ups
          </p>
        </div>
        <button onClick={fetchEnquiries} className="btn btn-secondary text-sm py-2 self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary tiles — each tile acts as a quick filter toggle */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: '',          label: 'Total',     value: summary.total,     color: 'text-secondary-900 dark:text-white' },
          { key: 'NEW',       label: 'New',       value: summary.new,       color: 'text-amber-600 dark:text-amber-400' },
          { key: 'CONTACTED', label: 'Contacted', value: summary.contacted, color: 'text-blue-600 dark:text-blue-400' },
          { key: 'RESOLVED',  label: 'Resolved',  value: summary.resolved,  color: 'text-success-600 dark:text-success-400' },
        ].map(tile => (
          <button
            key={tile.key}
            onClick={() => setStatusFilter(s => s === tile.key ? '' : tile.key)}
            className={`card p-4 text-left transition-all hover:shadow-md active:scale-[0.98]
              ${statusFilter === tile.key ? 'ring-2 ring-primary-500' : ''}`}
          >
            <p className="text-xs text-secondary-500 dark:text-secondary-400 font-medium">{tile.label}</p>
            <p className={`text-2xl font-bold mt-1 ${tile.color}`}>{tile.value}</p>
          </button>
        ))}
      </div>

      {/* Search + filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, mobile, address…"
            className="input pl-10 py-2 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input py-2 text-sm max-w-[160px]"
        >
          <option value="">All Status</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card h-16 animate-pulse bg-secondary-100 dark:bg-secondary-700/50" />
          ))}
        </div>
      ) : enquiries.length === 0 ? (
        <div className="card p-14 text-center">
          <Truck className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-3" />
          <p className="font-semibold text-secondary-700 dark:text-secondary-300 text-base">
            No delivery enquiries yet
          </p>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1 max-w-xs mx-auto">
            Customer delivery enquiries will appear here when someone asks about delivery.
          </p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ─────────────────────────────── */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-700
                                bg-secondary-50 dark:bg-secondary-800/50">
                  {['Customer', 'Mobile', 'Address', 'Message', 'Submitted', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold
                                          text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700/50">
                {enquiries.map(e => (
                  <tr key={e._id}
                    className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-secondary-900 dark:text-white">{e.customerName}</td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400 font-mono text-xs">{e.mobile}</td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400 max-w-[160px] truncate">{e.address || '—'}</td>
                    <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400 max-w-[180px] truncate">{e.message || '—'}</td>
                    <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400 whitespace-nowrap text-xs">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(e)}
                        className="btn btn-secondary text-xs py-1 px-2.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ──────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {enquiries.map(e => (
              <div key={e._id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-secondary-900 dark:text-white">{e.customerName}</p>
                    <p className="text-xs text-secondary-500 font-mono mt-0.5">{e.mobile}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                {e.address && (
                  <p className="text-sm text-secondary-600 dark:text-secondary-400">{e.address}</p>
                )}
                {e.message && (
                  <p className="text-sm text-secondary-400 italic truncate">"{e.message}"</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary-400">{fmtDate(e.createdAt)}</span>
                  <button onClick={() => openDetail(e)} className="btn btn-secondary text-xs py-1 px-2.5">
                    <ChevronRight className="w-3.5 h-3.5" /> View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Detail Drawer ──────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Slide-in drawer */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md
                         bg-white dark:bg-secondary-800 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-4
                              border-b border-secondary-200 dark:border-secondary-700 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30
                                  flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-secondary-900 dark:text-white truncate">
                      {selected.customerName}
                    </p>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-xl hover:bg-secondary-100 dark:hover:bg-secondary-700
                             text-secondary-400 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* ── Contact info ────────────────────────── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                    Contact
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-secondary-400 shrink-0" />
                      <span className="text-sm text-secondary-700 dark:text-secondary-300 font-mono">
                        {selected.mobile}
                      </span>
                    </div>
                    {selected.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-secondary-400 shrink-0" />
                        <span className="text-sm text-secondary-700 dark:text-secondary-300">
                          {selected.email}
                        </span>
                      </div>
                    )}
                    {selected.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-secondary-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-secondary-700 dark:text-secondary-300">
                          {selected.address}
                        </span>
                      </div>
                    )}
                    {selected.deliveryLocation?.latitude != null && (
                      <div className="flex items-center gap-3">
                        <ExternalLink className="w-4 h-4 text-secondary-400 shrink-0" />
                        <a
                          href={`https://maps.google.com/maps?q=${selected.deliveryLocation.latitude},${selected.deliveryLocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          View on Map
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-secondary-400 shrink-0" />
                      <span className="text-xs text-secondary-500">{fmtDate(selected.createdAt)}</span>
                    </div>
                    {selected.message && (
                      <div className="p-3 rounded-xl bg-secondary-50 dark:bg-secondary-700/50
                                      text-sm text-secondary-700 dark:text-secondary-300 italic">
                        "{selected.message}"
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Contact customer ────────────────────── */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                    Contact Customer
                  </h3>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${selected.mobile}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                                 bg-secondary-100 dark:bg-secondary-700
                                 text-secondary-700 dark:text-secondary-300
                                 hover:bg-secondary-200 dark:hover:bg-secondary-600
                                 text-sm font-medium transition-colors"
                    >
                      <Phone className="w-4 h-4" /> Call
                    </a>
                    <a
                      href={`https://wa.me/${toWaNumber(selected.mobile)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                                 bg-green-100 dark:bg-green-900/30
                                 text-green-700 dark:text-green-400
                                 hover:bg-green-200 dark:hover:bg-green-900/50
                                 text-sm font-medium transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  </div>
                </section>

                {/* ── Status update ───────────────────────── */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                    Update Status
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(['NEW', 'CONTACTED', 'RESOLVED', 'CLOSED'] as const).map(s => (
                      <button
                        key={s}
                        disabled={updating || selected.status === s}
                        onClick={() => handleStatusUpdate(selected._id, s)}
                        className={`py-2.5 rounded-xl text-xs font-semibold transition-all
                          disabled:opacity-50 disabled:cursor-default
                          ${selected.status === s
                            ? `${STATUS_CFG[s].bg} ${STATUS_CFG[s].text} cursor-default`
                            : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600'
                          }`}
                      >
                        {STATUS_CFG[s].label}
                      </button>
                    ))}
                  </div>
                  {selected.resolvedBy && selected.resolvedAt && (
                    <p className="text-xs text-secondary-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolved by {selected.resolvedBy.name} · {fmtDate(selected.resolvedAt)}
                    </p>
                  )}
                </section>

                {/* ── Internal note ───────────────────────── */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                    Internal Note
                  </h3>
                  <textarea
                    rows={3}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Private note about this enquiry…"
                    className="input text-sm resize-none w-full"
                    maxLength={1000}
                  />
                  <button
                    disabled={updating}
                    onClick={handleNoteSave}
                    className="btn btn-secondary text-xs py-1.5 w-full disabled:opacity-50"
                  >
                    {updating ? 'Saving…' : 'Save Note'}
                  </button>
                </section>

                {/* ── Danger zone ─────────────────────────── */}
                <section className="pt-2 border-t border-secondary-200 dark:border-secondary-700">
                  {confirmDel === selected._id ? (
                    <div className="space-y-2">
                      <p className="text-sm text-danger-600 dark:text-danger-400">
                        Delete this enquiry permanently?
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={deleting}
                          onClick={() => handleDelete(selected._id)}
                          className="btn btn-danger text-xs py-1.5 flex-1 disabled:opacity-50"
                        >
                          {deleting ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDel(null)}
                          className="btn btn-secondary text-xs py-1.5 flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(selected._id)}
                      className="btn btn-secondary text-xs py-1.5 w-full
                                 text-danger-600 dark:text-danger-400
                                 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Enquiry
                    </button>
                  )}
                </section>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
