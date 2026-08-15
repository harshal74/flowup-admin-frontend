import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Edit2, UserX, UserCheck, Eye,
  ChefHat, Coffee, User, Shield, Loader2, Clock,
  Activity, AlertTriangle, RefreshCw, Filter,
  ExternalLink, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import type { Order } from '../types';

// ── Types ─────────────────────────────────────────────────────────

type StaffRole   = 'CHEF' | 'WAITER' | 'ASSISTANT';
type StaffStatus = 'active' | 'blocked';

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: StaffRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin: string | null;
  profileImage: string;
  createdAt: string;
}

interface ActivityEntry {
  _id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string;
  newValue: string;
  timestamp: string;
}

interface Summary {
  total: number;
  active: number;
  blocked: number;
}

// ── Helpers ───────────────────────────────────────────────────────

const ROLES: StaffRole[] = ['CHEF', 'WAITER', 'ASSISTANT'];

const ROLE_CONFIG: Record<StaffRole, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  CHEF:      { label: 'Chef',      icon: ChefHat, color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-900/20' },
  WAITER:    { label: 'Waiter',    icon: Coffee,  color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20'   },
  ASSISTANT: { label: 'Assistant', icon: User,    color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Main Component ────────────────────────────────────────────────

export default function StaffPage() {
  // List state
  const [staff,     setStaff]     = useState<StaffMember[]>([]);
  const [summary,   setSummary]   = useState<Summary>({ total: 0, active: 0, blocked: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [roleFilter,  setRoleFilter]  = useState<StaffRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | ''>('');

  // Modals
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [showActivity,  setShowActivity]  = useState(false);
  const [blockTarget,   setBlockTarget]   = useState<StaffMember | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<StaffMember | null>(null);
  const [selected,      setSelected]      = useState<StaffMember | null>(null);

  // Forms
  const [addForm,  setAddForm]  = useState({ name:'', email:'', mobile:'', role:'WAITER' as StaffRole, password:'', confirmPassword:'' });
  const [editForm, setEditForm] = useState({ name:'', mobile:'', role:'WAITER' as StaffRole });
  const [saving,   setSaving]   = useState(false);
  const [blocking, setBlocking] = useState(false);

  // Add-staff OTP step
  const [addStep,        setAddStep]        = useState<'form' | 'otp'>('form');
  const [pendingStaffId, setPendingStaffId] = useState<string>('');
  const [pendingEmail,   setPendingEmail]   = useState<string>('');
  const [emailSent,      setEmailSent]      = useState<boolean>(true);
  const [otp,            setOtp]            = useState('');
  const [resending,      setResending]      = useState(false);
  // Activity
  const [activities,      setActivities]      = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityDays,    setActivityDays]    = useState(7);

  // Order detail (opened from activity timeline)
  const [activityOrder,        setActivityOrder]        = useState<Order | null>(null);
  const [loadingOrderId,       setLoadingOrderId]       = useState<string | null>(null);

  // ── Fetch staff list ──────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim())  params.append('search', search.trim());
      if (roleFilter)     params.append('role',   roleFilter);
      if (statusFilter)   params.append('status', statusFilter);
      const res = await API.get(`/admin/staff?${params.toString()}`);
      setStaff(res.data.data || []);
      if (res.data.summary) setSummary(res.data.summary);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchStaff(), 350);
    return () => clearTimeout(t);
  }, [search, roleFilter, statusFilter, fetchStaff]);

  // ── Fetch activity for selected staff ─────────────────────────
  const fetchActivity = useCallback(async (staffId: string) => {
    setActivityLoading(true);
    try {
      const res = await API.get(`/admin/staff/${staffId}/activity?days=${activityDays}&limit=50`);
      setActivities(res.data.data || []);
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setActivityLoading(false);
    }
  }, [activityDays]);

  useEffect(() => {
    if (showActivity && selected) fetchActivity(selected._id);
  }, [showActivity, selected, activityDays, fetchActivity]);

  // ── Add staff — Step 1: create account + send OTP ────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addForm.password !== addForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const res = await API.post('/admin/staff', {
        name:     addForm.name.trim(),
        email:    addForm.email.trim(),
        mobile:   addForm.mobile.trim(),
        role:     addForm.role,
        password: addForm.password,
      });

      setPendingStaffId(res.data.staffId);
      setPendingEmail(res.data.email || addForm.email.trim());
      setEmailSent(res.data.emailSent !== false);
      setOtp('');

      if (res.data.emailSent === false) {
        // Account created but email delivery failed — tell admin clearly
        toast('Staff account created, but the OTP email could not be sent.\nCheck backend terminal and use Resend OTP.', {
          icon: '⚠️',
          duration: 8000,
        });
      } else {
        // emailSent === true (or not present in older response format)
        toast.success('Account created! OTP sent to staff email.');
      }
      // Always advance to OTP step — admin can use Resend if email failed
      setAddStep('otp');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  // ── Add staff — Step 2: verify OTP ────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = otp.replace(/\s/g, '');
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setSaving(true);
    try {
      await API.post(`/admin/staff/${pendingStaffId}/verify-otp`, { otp: trimmed });
      toast.success('Email verified! Staff account is now active.');
      closeAddModal();
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid OTP');
    } finally {
      setSaving(false);
    }
  };

  const handleResendOtp = async () => {
    if (resending) return;
    setResending(true);
    try {
      const res = await API.post(`/admin/staff/${pendingStaffId}/resend-otp`);
      if (res.data.emailSent === false) {
        toast('New OTP generated but email could not be sent.\nCheck backend terminal.', {
          icon: '⚠️',
          duration: 8000,
        });
      } else {
        toast.success('New OTP sent to staff email!');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  // ── Open order from activity timeline ───────────────────────
  const openActivityOrder = async (orderId: string) => {
    if (!orderId || loadingOrderId === orderId) return;
    setLoadingOrderId(orderId);
    try {
      const res = await API.get(`/orders/${orderId}`);
      setActivityOrder(res.data.data || null);
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setLoadingOrderId(null);
    }
  };

  const closeAddModal = () => {    setShowAddModal(false);
    setAddStep('form');
    setOtp('');
    setEmailSent(true);
    setPendingStaffId('');
    setPendingEmail('');
    setAddForm({ name:'', email:'', mobile:'', role:'WAITER', password:'', confirmPassword:'' });
  };

  // ── Edit staff ────────────────────────────────────────────────
  const openEdit = (s: StaffMember) => {
    setSelected(s);
    setEditForm({ name: s.name, mobile: s.mobile, role: s.role });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await API.patch(`/admin/staff/${selected._id}`, editForm);
      toast.success('Staff updated');
      setShowEditModal(false);
      setSelected(res.data.data);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update staff');
    } finally {
      setSaving(false);
    }
  };

  // ── Block / Unblock ───────────────────────────────────────────
  const handleBlock = async () => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await API.patch(`/admin/staff/${blockTarget._id}/block`);
      toast.success(`${blockTarget.name} has been blocked`);
      setBlockTarget(null);
      if (selected?._id === blockTarget._id) setSelected(prev => prev ? { ...prev, isActive: false } : prev);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to block staff');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setBlocking(true);
    try {
      await API.patch(`/admin/staff/${unblockTarget._id}/unblock`);
      toast.success(`${unblockTarget.name} has been unblocked`);
      setUnblockTarget(null);
      if (selected?._id === unblockTarget._id) setSelected(prev => prev ? { ...prev, isActive: true } : prev);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to unblock staff');
    } finally {
      setBlocking(false);
    }
  };

  // ── Summary cards ─────────────────────────────────────────────
  const SummaryCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="card p-5">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">{label}</p>
    </div>
  );

  // ── Role badge ────────────────────────────────────────────────
  const RoleBadge = ({ role }: { role: StaffRole }) => {
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.ASSISTANT;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Staff Management</h1>
          <p className="text-secondary-500 dark:text-secondary-400 text-sm">
            Manage your restaurant staff and monitor activity.
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary self-start">
          <Plus className="w-5 h-5" /> Add Staff
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Staff"  value={summary.total}   color="text-secondary-900 dark:text-white" />
        <SummaryCard label="Active"       value={summary.active}  color="text-success-600 dark:text-success-400" />
        <SummaryCard label="Blocked"      value={summary.blocked} color="text-danger-600 dark:text-danger-400" />
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or mobile…"
            className="input pl-10 py-2 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as StaffRole | '')}
          className="input py-2 text-sm max-w-[140px]"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StaffStatus | '')}
          className="input py-2 text-sm max-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>

        <button
          onClick={fetchStaff}
          className="btn btn-secondary py-2 text-sm"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Staff table ── */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-secondary-300 dark:text-secondary-600 mb-3" />
          <p className="text-secondary-500 dark:text-secondary-400">
            {search || roleFilter || statusFilter ? 'No staff match your filters.' : 'No staff members yet. Add your first staff member.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_140px_120px_140px_120px] gap-4 px-5 py-3
                          bg-secondary-50 dark:bg-secondary-700/50 border-b border-secondary-200 dark:border-secondary-700
                          text-xs font-semibold text-secondary-500 uppercase tracking-wide">
            <span>Staff Member</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last Login</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-secondary-100 dark:divide-secondary-700">
            {staff.map(s => (
              <motion.div
                key={s._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px_140px_120px] gap-3 sm:gap-4
                           px-5 py-4 items-center hover:bg-secondary-50 dark:hover:bg-secondary-700/30
                           transition-colors"
              >
                {/* Staff info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center
                                   font-bold text-sm
                                   ${s.isActive
                                     ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                                     : 'bg-secondary-200 text-secondary-500 dark:bg-secondary-700'}`}>
                    {s.profileImage
                      ? <img src={s.profileImage} alt={s.name} className="w-full h-full object-cover" />
                      : s.name.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-secondary-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-xs text-secondary-400 truncate">{s.email}</p>
                  </div>
                </div>

                {/* Role */}
                <div><RoleBadge role={s.role} /></div>

                {/* Status */}
                <div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
                    ${s.isActive
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                      : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-success-500' : 'bg-danger-500'}`} />
                    {s.isActive ? 'Active' : 'Blocked'}
                  </span>
                </div>

                {/* Last login */}
                <div className="text-sm text-secondary-500 dark:text-secondary-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {timeAgo(s.lastLogin)}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => { setSelected(s); setShowProfile(true); }}
                    className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 transition-colors"
                    title="View Profile"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setSelected(s); setShowActivity(true); }}
                    className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 transition-colors"
                    title="View Activity"
                  >
                    <Activity className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {s.isActive ? (
                    <button
                      onClick={() => setBlockTarget(s)}
                      className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500 transition-colors"
                      title="Block"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setUnblockTarget(s)}
                      className="p-2 rounded-lg hover:bg-success-50 dark:hover:bg-success-900/20 text-success-600 transition-colors"
                      title="Unblock"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ADD STAFF MODAL  (2-step: form → OTP)
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <Modal
            onClose={closeAddModal}
            title={addStep === 'form' ? 'Add Staff Member' : 'Verify Email'}
          >
            {addStep === 'form' ? (
              <form onSubmit={handleAdd} className="space-y-4">
                <Field label="Full Name *">
                  <input className="input" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Rahul Sharma" required />
                </Field>
                <Field label="Email *">
                  <input className="input" type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="staff@example.com" required />
                </Field>
                <Field label="Mobile">
                  <input className="input" type="tel" value={addForm.mobile} onChange={e => setAddForm(p => ({ ...p, mobile: e.target.value }))} placeholder="+91 9876543210" />
                </Field>
                <Field label="Role *">
                  <select className="input" value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value as StaffRole }))} required>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
                  </select>
                </Field>
                <Field label="Password *">
                  <input className="input" type="password" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 6 characters" required />
                </Field>
                <Field label="Confirm Password *">
                  <input className="input" type="password" value={addForm.confirmPassword} onChange={e => setAddForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat password" required />
                </Field>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeAddModal} className="btn btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create & Send OTP'}
                  </button>
                </div>
              </form>
            ) : (
              /* ── OTP verification step ── */
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {/* Email delivery status banner */}
                {!emailSent ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl
                                  bg-warning-50 dark:bg-warning-900/20
                                  border border-warning-200 dark:border-warning-800">
                    <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-warning-700 dark:text-warning-300">
                      <p className="font-semibold">OTP email could not be sent.</p>
                      <p className="mt-0.5">Check the backend terminal for the OTP code, or use the Resend button below after fixing the email configuration.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-secondary-600 dark:text-secondary-300 text-center">
                    A 6-digit OTP has been sent to{' '}
                    <strong className="text-secondary-900 dark:text-white">{pendingEmail}</strong>.
                    Enter it below to activate the staff account.
                  </p>
                )}

                <Field label="OTP Code">
                  <input
                    className="input text-center text-2xl font-mono tracking-[0.4em]"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                  />
                </Field>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setAddStep('form'); setOtp(''); }}
                    className="btn btn-secondary flex-1"
                  >
                    ← Back
                  </button>
                  <button type="submit" disabled={saving || otp.length !== 6} className="btn btn-primary flex-1">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify & Activate'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-secondary-500">
                  <span>Didn't receive it?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                  >
                    {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Resend OTP
                  </button>
                </div>
              </form>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          EDIT STAFF MODAL
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showEditModal && selected && (
          <Modal onClose={() => setShowEditModal(false)} title={`Edit — ${selected.name}`}>
            <form onSubmit={handleEdit} className="space-y-4">
              <Field label="Full Name">
                <input className="input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label="Mobile">
                <input className="input" type="tel" value={editForm.mobile} onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))} />
              </Field>
              <Field label="Role">
                <select className="input" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as StaffRole }))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
                </select>
              </Field>
              <p className="text-xs text-secondary-400">Email cannot be changed. To reset password, the staff member should use the forgot-password flow.</p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          BLOCK CONFIRM
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {blockTarget && (
          <Modal onClose={() => setBlockTarget(null)} title="Block Staff Member" maxW="max-w-sm">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger-600" />
              </div>
              <div>
                <p className="font-semibold text-secondary-900 dark:text-white">Block {blockTarget.name}?</p>
                <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
                  This staff member will no longer be able to access the FlowUp staff portal.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBlockTarget(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleBlock} disabled={blocking} className="btn btn-danger flex-1">
                {blocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserX className="w-4 h-4" /> Block</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          UNBLOCK CONFIRM
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {unblockTarget && (
          <Modal onClose={() => setUnblockTarget(null)} title="Unblock Staff Member" maxW="max-w-sm">
            <p className="text-secondary-600 dark:text-secondary-300 mb-5">
              Unblock <strong>{unblockTarget.name}</strong>? They will be able to log in again.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setUnblockTarget(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleUnblock} disabled={blocking} className="btn btn-success flex-1">
                {blocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserCheck className="w-4 h-4" /> Unblock</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          PROFILE DRAWER
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showProfile && selected && (
          <Drawer onClose={() => setShowProfile(false)} title="Staff Profile">
            <div className="space-y-5">
              {/* Avatar + name */}
              <div className="text-center">
                <div className={`w-20 h-20 rounded-full mx-auto overflow-hidden flex items-center justify-center
                                 font-bold text-2xl
                                 ${selected.isActive
                                   ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                                   : 'bg-secondary-200 text-secondary-500 dark:bg-secondary-700'}`}>
                  {selected.profileImage
                    ? <img src={selected.profileImage} alt={selected.name} className="w-full h-full object-cover" />
                    : selected.name.charAt(0).toUpperCase()
                  }
                </div>
                <h3 className="mt-3 text-xl font-bold text-secondary-900 dark:text-white">{selected.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <RoleBadge role={selected.role} />
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${selected.isActive
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                      : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                    }`}>
                    {selected.isActive ? 'Active' : 'Blocked'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="card p-4 space-y-3 text-sm">
                <InfoRow label="Email"      value={selected.email} />
                <InfoRow label="Mobile"     value={selected.mobile || '—'} />
                <InfoRow label="Joined"     value={formatDateTime(selected.createdAt)} />
                <InfoRow label="Last Login" value={selected.lastLogin ? formatDateTime(selected.lastLogin) : 'Never'} />
                <InfoRow label="Email Verified" value={selected.isEmailVerified ? 'Yes' : 'No'} />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => { setShowProfile(false); openEdit(selected); }} className="btn btn-secondary flex-1">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => { setShowProfile(false); setShowActivity(true); }}
                  className="btn btn-secondary flex-1"
                >
                  <Activity className="w-4 h-4" /> Activity
                </button>
              </div>

              {selected.isActive ? (
                <button onClick={() => { setShowProfile(false); setBlockTarget(selected); }} className="btn btn-danger w-full">
                  <UserX className="w-4 h-4" /> Block Staff
                </button>
              ) : (
                <button onClick={() => { setShowProfile(false); setUnblockTarget(selected); }} className="btn btn-success w-full">
                  <UserCheck className="w-4 h-4" /> Unblock Staff
                </button>
              )}
            </div>
          </Drawer>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          ACTIVITY DRAWER
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showActivity && selected && (
          <Drawer onClose={() => setShowActivity(false)} title={`Activity — ${selected.name}`} wide>
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-secondary-400 shrink-0" />
                <span className="text-sm text-secondary-500">Show last:</span>
                {[1, 7, 14, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setActivityDays(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                      ${activityDays === d
                        ? 'bg-primary-500 text-white'
                        : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600'
                      }`}
                  >
                    {d === 1 ? 'Today' : `${d} days`}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {activityLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
                </div>
              ) : activities.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className="w-10 h-10 mx-auto text-secondary-300 dark:text-secondary-600 mb-3" />
                  <p className="text-secondary-500 dark:text-secondary-400">No activity recorded in this period.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-secondary-200 dark:bg-secondary-700" />

                  <div className="space-y-3 pl-10">
                    {activities.map(a => {
                      const isOrder   = a.entityType === 'Order';
                      const isAuth    = a.action === 'LOGIN' || a.action === 'LOGOUT';
                      const isStaff   = a.action.startsWith('STAFF_');
                      const dotColor  = isOrder  ? 'bg-orange-500'
                                      : isAuth   ? 'bg-green-500'
                                      : isStaff  ? 'bg-blue-500'
                                      : 'bg-primary-500';

                      return (
                        <div key={a._id} className="relative">
                          {/* Dot */}
                          <div className={`absolute -left-[26px] top-3.5 w-3 h-3 rounded-full ${dotColor} border-2 border-white dark:border-secondary-900`} />

                          <div className="card p-3 hover:border-secondary-300 dark:hover:border-secondary-600 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {/* Action label */}
                                <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                                  {a.action.replace(/_/g, ' ')}
                                </p>

                                {/* Status transition */}
                                {(a.oldValue || a.newValue) && (
                                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
                                    {a.oldValue && a.newValue
                                      ? <span><span className="text-secondary-400">{a.oldValue}</span> → <span className="font-medium text-secondary-700 dark:text-secondary-200">{a.newValue}</span></span>
                                      : a.newValue || a.oldValue
                                    }
                                  </p>
                                )}

                                {/* Entity type + open order link */}
                                {a.entityType && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full
                                      ${isOrder  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                 : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-700 dark:text-secondary-400'
                                      }`}>
                                      {a.entityType}
                                    </span>

                                    {/* Clickable "Open Order" when entityId is available */}
                                    {/* View Order — only shown when entityId is a valid MongoDB ObjectId */}
                                    {isOrder && a.entityId &&
                                     typeof a.entityId === 'string' &&
                                     /^[a-f\d]{24}$/i.test(a.entityId) && (() => {
                                       const isThisLoading = loadingOrderId !== null && loadingOrderId === a.entityId;
                                       return (
                                         <button
                                           onClick={() => !isThisLoading && openActivityOrder(a.entityId!)}
                                           disabled={isThisLoading}
                                           className="flex items-center gap-1 text-[10px] font-medium
                                                      text-primary-600 dark:text-primary-400
                                                      hover:text-primary-700 dark:hover:text-primary-300
                                                      transition-colors disabled:opacity-50"
                                         >
                                           {isThisLoading
                                             ? <Loader2 className="w-3 h-3 animate-spin" />
                                             : <ExternalLink className="w-3 h-3" />
                                           }
                                           {isThisLoading ? 'Loading…' : 'View Order'}
                                         </button>
                                       );
                                     })()
                                    }
                                  </div>
                                )}
                              </div>

                              <time className="text-xs text-secondary-400 shrink-0 whitespace-nowrap text-right">
                                {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                <span className="block text-[10px]">
                                  {new Date(a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              </time>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Drawer>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          ORDER DETAIL (from activity timeline)
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {activityOrder && (
          <Drawer onClose={() => setActivityOrder(null)} title={`Order #${activityOrder.orderNumber}`} wide>
            <div className="space-y-4 text-sm">
              {/* Status + type */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold
                  ${activityOrder.status === 'COMPLETED'  ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                  : activityOrder.status === 'REJECTED'   ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                  : activityOrder.status === 'PENDING'    ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                  : 'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300'}`}>
                  {activityOrder.status}
                </span>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold
                  ${activityOrder.orderType === 'DINE_IN'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                  {activityOrder.orderType === 'DINE_IN' ? 'Dine In' : 'Delivery'}
                </span>
                {activityOrder.tableNumber && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                    Table {activityOrder.tableNumber}
                  </span>
                )}
              </div>

              {/* Customer */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Customer</p>
                <p className="font-semibold text-secondary-900 dark:text-white">{activityOrder.customerId?.name || 'Guest'}</p>
                {activityOrder.customerId?.mobile && (
                  <p className="text-secondary-400 text-xs mt-0.5">📞 {activityOrder.customerId.mobile}</p>
                )}
              </div>

              {/* Delivery address */}
              {activityOrder.orderType === 'DELIVERY' && activityOrder.address && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Delivery Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-secondary-400 shrink-0 mt-0.5" />
                    <p className="text-secondary-700 dark:text-secondary-300">{activityOrder.address}</p>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-3">
                  Items ({activityOrder.totalItems})
                </p>
                <div className="space-y-2">
                  {activityOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-secondary-900 dark:text-white">
                          <span className="text-primary-500 font-bold">{item.quantity}×</span> {item.name}
                        </p>
                        {item.itemNote && (
                          <p className="text-xs text-secondary-400 italic">"{item.itemNote}"</p>
                        )}
                      </div>
                      <span className="font-semibold text-secondary-900 dark:text-white shrink-0">
                        ₹{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order note */}
              {activityOrder.note && (
                <div className="card p-3">
                  <p className="text-xs text-secondary-400 italic">📝 "{activityOrder.note}"</p>
                </div>
              )}

              {/* Bill summary */}
              <div className="card p-4 space-y-2">
                <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                  <span>Subtotal</span><span>₹{activityOrder.subtotalAmount.toFixed(2)}</span>
                </div>
                {(activityOrder.deliveryCharge ?? 0) > 0 && (
                  <div className="flex justify-between text-secondary-600 dark:text-secondary-400">
                    <span>Delivery</span><span>₹{(activityOrder.deliveryCharge ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-secondary-200 dark:border-secondary-700 text-secondary-900 dark:text-white">
                  <span>Total</span><span>₹{activityOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-secondary-500">
                  <span>Payment</span>
                  <span className={`font-medium px-2 py-0.5 rounded-full ${
                    activityOrder.paymentStatus === 'PAID'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>{activityOrder.paymentStatus}</span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-1 text-xs text-secondary-400">
                <p>📅 Placed: {new Date(activityOrder.createdAt).toLocaleString('en-IN')}</p>
                {activityOrder.acceptedAt  && <p>✅ Accepted: {new Date(activityOrder.acceptedAt).toLocaleString('en-IN')}</p>}
                {activityOrder.completedAt && <p>🏁 Completed: {new Date(activityOrder.completedAt).toLocaleString('en-IN')}</p>}
              </div>
            </div>
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Modal({ children, onClose, title, maxW = 'max-w-lg' }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  maxW?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className={`w-full ${maxW} bg-white dark:bg-secondary-800 rounded-2xl p-6 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-secondary-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <X className="w-5 h-5 text-secondary-500" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Drawer({ children, onClose, title, wide = false }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className={`fixed right-0 top-0 bottom-0 z-50 ${wide ? 'w-full max-w-xl' : 'w-full max-w-md'}
                   bg-white dark:bg-secondary-800 shadow-2xl flex flex-col overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700 shrink-0">
          <h2 className="text-lg font-bold text-secondary-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
            <X className="w-5 h-5 text-secondary-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </motion.div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-secondary-500 dark:text-secondary-400 shrink-0">{label}</span>
      <span className="font-medium text-secondary-900 dark:text-white text-right">{value}</span>
    </div>
  );
}
