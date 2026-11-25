import { useCallback, useEffect, useState } from "react";
import { Star, Loader2, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import API from "../lib/api";

interface FeedbackRow {
  _id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customerName: string;
  orderNumber: string;
  tableNumber: number | null;
}
interface Stats { average: number; count: number; distribution: Record<string, number> }

const PAGE_SIZE = 20;

function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-yellow-400 text-yellow-400" : "text-secondary-300"}`} />
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/feedback", { params: { page, limit: PAGE_SIZE } });
      setRows(res.data.data || []);
      setStats(res.data.stats || null);
      setTotalPages(Math.max(1, res.data.pagination?.totalPages || 1));
    } catch {
      toast.error("Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Customer Reviews</h1>
        <p className="text-secondary-500 dark:text-secondary-400">What customers say after their meal</p>
      </div>

      {stats && (
        <div className="card p-5 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="text-center">
            <p className="text-4xl font-bold text-secondary-900 dark:text-white">{stats.count ? stats.average.toFixed(1) : "—"}</p>
            <Stars value={stats.average} />
            <p className="text-xs text-secondary-500 mt-1">{stats.count} review{stats.count === 1 ? "" : "s"}</p>
          </div>
          <div className="flex-1 w-full space-y-1">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = stats.distribution?.[String(n)] || 0;
              const pct = stats.count ? (c / stats.count) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{n}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 rounded bg-secondary-100 dark:bg-secondary-700 overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-secondary-500">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card divide-y divide-secondary-100 dark:divide-secondary-700">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-secondary-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No reviews yet.
          </div>
        ) : rows.map((r) => (
          <div key={r._id} className="p-4 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-sm font-medium text-secondary-900 dark:text-white">{r.customerName || "Guest"}</span>
              </div>
              <span className="text-xs text-secondary-400">
                {new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {r.comment && <p className="text-sm text-secondary-700 dark:text-secondary-300">{r.comment}</p>}
            {r.orderNumber && (
              <p className="text-xs text-secondary-400">
                Order #{r.orderNumber}{r.tableNumber ? ` · Table ${r.tableNumber}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
