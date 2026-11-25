import { useCallback, useEffect, useState } from "react";
import { Search, Printer, X, ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import { getBillHistory } from "../services/billingService";

interface HistoryBill {
  _id: string;
  invoiceNumber: string;
  tableNumber: number | null;
  subtotal: number;
  sgst?: number;
  cgst?: number;
  gst: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  splitType?: string;
  splits?: { _id: string; label: string; amount: number; paymentMethod: string; paymentStatus: string }[];
  paidAmount?: number;
  createdAt: string;
  items: { name: string; quantity: number; price: number; total: number }[];
  orderIds?: { customerId?: { name?: string; mobile?: string } }[];
}

const PAGE_SIZE = 20;

const money = (n: number | undefined) => `₹${(n || 0).toFixed(2)}`;
const when = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function customerOf(b: HistoryBill) {
  const c = b.orderIds?.find((o) => o?.customerId)?.customerId;
  return { name: c?.name || "Guest", mobile: c?.mobile || "" };
}

function printBill(b: HistoryBill) {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) { toast.error("Allow pop-ups to print."); return; }
  const rows = b.items.map((i) => `<tr><td>${i.quantity} × ${esc(i.name)}</td><td style="text-align:right">${money(i.total)}</td></tr>`).join("");
  const splits = (b.splits || []).map((s) => `<tr><td>${esc(s.label)} (${esc(s.paymentMethod)}, ${esc(s.paymentStatus)})</td><td style="text-align:right">${money(s.amount)}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><title>${esc(b.invoiceNumber)}</title>
    <style>body{font-family:monospace;padding:16px;max-width:380px;margin:auto}td{padding:2px 0}h3{text-align:center;margin:4px 0}hr{border:0;border-top:1px dashed #000}</style></head><body>
    <h3>Invoice ${esc(b.invoiceNumber)}</h3>
    <div>${esc(when(b.createdAt))}${b.tableNumber ? ` · Table ${b.tableNumber}` : ""}</div><hr/>
    <table width="100%">${rows}</table><hr/>
    <table width="100%">
      <tr><td>Subtotal</td><td style="text-align:right">${money(b.subtotal)}</td></tr>
      ${(b.sgst || 0) > 0 ? `<tr><td>SGST</td><td style="text-align:right">${money(b.sgst)}</td></tr>` : ""}
      ${(b.cgst || 0) > 0 ? `<tr><td>CGST</td><td style="text-align:right">${money(b.cgst)}</td></tr>` : ""}
      ${b.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">−${money(b.discount)}</td></tr>` : ""}
      <tr><td><b>Total</b></td><td style="text-align:right"><b>${money(b.grandTotal)}</b></td></tr>
    </table>
    ${splits ? `<hr/><div>Split payments</div><table width="100%">${splits}</table>` : ""}
    <hr/><div>Status: ${esc(b.paymentStatus)} · ${esc(b.paymentMethod)}</div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

export default function BillHistoryPage() {
  const [bills, setBills] = useState<HistoryBill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryBill | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");
  const [invoice, setInvoice] = useState("");
  const [status, setStatus] = useState("");
  // Filters apply when the user presses Search, not on every keystroke.
  const [applied, setApplied] = useState({ from: "", to: "", table: "", invoice: "", status: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBillHistory({ page, limit: PAGE_SIZE, ...applied });
      setBills(res.bills || []);
      setTotal(res.total || 0);
    } catch {
      toast.error("Failed to load bill history.");
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { load(); }, [load]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (from && to && from > to) { toast.error("'From' date must be before 'To' date."); return; }
    setPage(1);
    setApplied({ from, to, table: table.trim(), invoice: invoice.trim(), status });
  };
  const reset = () => {
    setFrom(""); setTo(""); setTable(""); setInvoice(""); setStatus("");
    setPage(1);
    setApplied({ from: "", to: "", table: "", invoice: "", status: "" });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Bill History</h1>
        <p className="text-secondary-500 dark:text-secondary-400">All generated bills with search, filters and reprint</p>
      </div>

      <form onSubmit={search} className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Table</label>
          <input type="number" min={1} className="input" placeholder="Any" value={table} onChange={(e) => setTable(e.target.value)} />
        </div>
        <div>
          <label className="label">Invoice</label>
          <input className="input" placeholder="INV-…" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1"><Search className="w-4 h-4" /> Search</button>
          <button type="button" onClick={reset} className="btn btn-secondary">Reset</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : bills.length === 0 ? (
          <div className="p-10 text-center text-secondary-500">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No bills found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 dark:bg-secondary-700/50 text-secondary-500 text-left">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date (IST)</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b._id} onClick={() => setSelected(b)}
                    className="border-t border-secondary-100 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/40 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-secondary-900 dark:text-white">
                      {b.invoiceNumber}
                      {b.splitType && b.splitType !== "NONE" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">SPLIT</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{when(b.createdAt)}</td>
                    <td className="px-4 py-3">{b.tableNumber ?? "—"}</td>
                    <td className="px-4 py-3">{customerOf(b).name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(b.grandTotal)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                        b.paymentStatus === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 dark:border-secondary-700 text-sm">
          <span className="text-secondary-500">{total} bill{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary p-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary p-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-700">
              <div>
                <h3 className="font-bold text-secondary-900 dark:text-white">{selected.invoiceNumber}</h3>
                <p className="text-xs text-secondary-500">
                  {when(selected.createdAt)}{selected.tableNumber ? ` · Table ${selected.tableNumber}` : ""}
                </p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p className="text-secondary-600 dark:text-secondary-300">
                {customerOf(selected).name}{customerOf(selected).mobile ? ` · ${customerOf(selected).mobile}` : ""}
              </p>
              <div className="space-y-1">
                {selected.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{i.quantity} × {i.name}</span><span>{money(i.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-secondary-200 dark:border-secondary-700 pt-2 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(selected.subtotal)}</span></div>
                {(selected.sgst || 0) > 0 && <div className="flex justify-between"><span>SGST</span><span>{money(selected.sgst)}</span></div>}
                {(selected.cgst || 0) > 0 && <div className="flex justify-between"><span>CGST</span><span>{money(selected.cgst)}</span></div>}
                {selected.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>− {money(selected.discount)}</span></div>}
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>{money(selected.grandTotal)}</span></div>
              </div>
              {selected.splits && selected.splits.length > 0 && (
                <div className="border-t border-secondary-200 dark:border-secondary-700 pt-2 space-y-1">
                  <p className="text-xs text-secondary-500">Split payments</p>
                  {selected.splits.map((s) => (
                    <div key={s._id} className="flex justify-between">
                      <span>{s.label} · {s.paymentMethod} · {s.paymentStatus}</span><span>{money(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-secondary-500">Status: {selected.paymentStatus} · {selected.paymentMethod}</p>
              <button onClick={() => printBill(selected)} className="btn btn-primary w-full"><Printer className="w-4 h-4" /> Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
