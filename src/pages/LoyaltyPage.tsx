import { useCallback, useEffect, useState } from "react";
import { Star, ChevronLeft, ChevronRight, Loader2, Gift } from "lucide-react";
import toast from "react-hot-toast";
import API from "../lib/api";

interface LoyaltyRow {
  _id: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  customerId?: { _id: string; name?: string; mobile?: string } | null;
  updatedAt: string;
}

const PAGE_SIZE = 30;

export default function LoyaltyPage() {
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // ── Redeem modal state ──────────────────────────────────────────
  const [redeemTarget, setRedeemTarget] = useState<LoyaltyRow | null>(null);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);

  // ── Earn modal state (replaces browser prompt()) ───────────────
  const [earnTarget,  setEarnTarget]  = useState<LoyaltyRow | null>(null);
  const [earnOrderId, setEarnOrderId] = useState("");
  const [earnBusy,    setEarnBusy]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/loyalty", { params: { page, limit: PAGE_SIZE } });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { toast.error("Failed to load loyalty data."); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleEarn = async () => {
    if (!earnTarget || !earnOrderId.trim()) return;
    setEarnBusy(true);
    try {
      const res = await API.post("/loyalty/earn", { orderId: earnOrderId.trim() });
      toast.success(`${res.data.pointsEarned} pts awarded. New balance: ${res.data.balance}`);
      setEarnTarget(null);
      setEarnOrderId("");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to award points.");
    } finally { setEarnBusy(false); }
  };

  const handleRedeem = async () => {
    if (!redeemTarget) return;
    const pts = Number(redeemPoints);
    if (!Number.isInteger(pts) || pts < 10) { toast.error("Minimum 10 points to redeem."); return; }
    setRedeemBusy(true);
    try {
      const res = await API.post(`/loyalty/${redeemTarget.customerId?._id}/redeem`, { points: pts });
      toast.success(`${pts} pts redeemed → ₹${res.data.discountAmount} discount. Balance: ${res.data.balance}`);
      setRedeemTarget(null);
      setRedeemPoints("");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to redeem points.");
    } finally { setRedeemBusy(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary-500" /> Loyalty Points
        </h1>
        <p className="text-secondary-500 dark:text-secondary-400 text-sm mt-0.5">
          1 point per ₹100 spent · 1 point = ₹1 discount · Min 10 pts to redeem
        </p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-secondary-500">
            <Star className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No customers have earned points yet. Points are earned automatically when you complete and pay an order. Use the "+ Earn" button to manually award points for a specific order ID.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 dark:bg-secondary-700/50 text-secondary-500 text-left">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Lifetime Earned</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Redeemed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-t border-secondary-100 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-secondary-900 dark:text-white">{r.customerId?.name || "Guest"}</p>
                      <p className="text-xs text-secondary-400">{r.customerId?.mobile || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-primary-600 dark:text-primary-400">{r.balance} pts</span>
                      <p className="text-xs text-secondary-400">≈ ₹{r.balance}</p>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-secondary-500">{r.lifetimeEarned} pts</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-secondary-500">{r.lifetimeRedeemed} pts</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEarnTarget(r); setEarnOrderId(""); }}
                          className="text-xs btn btn-secondary py-1 px-2.5"
                          title="Award points for a specific order"
                        >
                          + Earn
                        </button>
                        {r.balance >= 10 && (
                          <button
                            onClick={() => { setRedeemTarget(r); setRedeemPoints(""); }}
                            className="text-xs btn btn-primary py-1 px-2.5"
                            title="Redeem points as discount"
                          >
                            Redeem
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 dark:border-secondary-700 text-sm">
          <span className="text-secondary-500">{total} customer{total !== 1 ? "s" : ""} with points</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary p-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary p-2" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Earn modal (replaces prompt()) ─────────────────────────── */}
      {earnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEarnTarget(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-secondary-900 dark:text-white">Award Points</h3>
            <p className="text-sm text-secondary-500">
              Award points to <strong>{earnTarget.customerId?.name || "this customer"}</strong> for a completed and paid order.
            </p>
            <div>
              <label className="label">Order ID</label>
              <input
                type="text"
                className="input font-mono text-sm"
                placeholder="Paste the MongoDB Order _id here"
                value={earnOrderId}
                onChange={e => setEarnOrderId(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-secondary-400 mt-1">
                Find the Order _id in the Orders page → View Order → copy from the URL or order detail.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEarnTarget(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleEarn}
                disabled={earnBusy || !earnOrderId.trim()}
                className="btn btn-primary flex-1 disabled:opacity-60"
              >
                {earnBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Award Points"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Redeem modal ───────────────────────────────────────────── */}
      {redeemTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRedeemTarget(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-secondary-900 dark:text-white">Redeem Points</h3>
            <p className="text-sm text-secondary-500">
              <strong>{redeemTarget.customerId?.name}</strong> has{" "}
              <strong className="text-primary-600">{redeemTarget.balance} pts</strong>{" "}
              (worth ₹{redeemTarget.balance}).
            </p>
            <div>
              <label className="label">Points to redeem (min 10, max {redeemTarget.balance})</label>
              <input
                type="number"
                min={10}
                max={redeemTarget.balance}
                className="input"
                value={redeemPoints}
                onChange={e => setRedeemPoints(e.target.value)}
                placeholder="e.g. 50"
                autoFocus
              />
              {redeemPoints && Number(redeemPoints) >= 10 && (
                <p className="text-xs text-primary-600 mt-1">
                  = ₹{redeemPoints} discount on the customer's next order
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRedeemTarget(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleRedeem}
                disabled={redeemBusy || !redeemPoints || Number(redeemPoints) < 10}
                className="btn btn-primary flex-1 disabled:opacity-60"
              >
                {redeemBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Redeem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
