import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import API from "../lib/api";
import socket, { connectSocket } from "../lib/socket";

export interface WaiterRequest {
  _id: string;
  tableNumber: number;
  customerName: string;
  status: "PENDING" | "ACCEPTED" | "COMPLETED";
  createdAt: string;
}

export interface DeliveryEnquiryNotif {
  _id: string;
  customerName: string;
  mobile: string;
  address: string;
  message: string;
  status: "NEW" | "CONTACTED" | "RESOLVED" | "CLOSED";
  createdAt: string;
}

interface NotificationContextType {
  pendingOrders: any[];
  waiterRequests: WaiterRequest[];
  deliveryEnquiries: DeliveryEnquiryNotif[];
  newDeliveryEnquiryCount: number;
  unreadCount: number;
  isLoading: boolean;
  isRinging: boolean;
  soundEnabled: boolean;
  isConnected: boolean;

  dismissWaiterRequest: (id: string) => Promise<void>;
  clearAllWaiterRequests: () => Promise<void>;
  toggleSound: () => void;
  stopRinging: () => void;
  acceptOrder: (orderId: string) => Promise<any>;
  rejectOrder: (orderId: string, reason?: string) => Promise<any>;
  refreshOrders: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function createAudioCtx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [pendingOrders,      setPendingOrders]      = useState<any[]>([]);
  const [waiterRequests,     setWaiterRequests]     = useState<WaiterRequest[]>([]);
  const [deliveryEnquiries,  setDeliveryEnquiries]  = useState<DeliveryEnquiryNotif[]>([]);
  const [isLoading,          setIsLoading]          = useState(false);
  const [isRinging,          setIsRinging]          = useState(false);
  const [soundEnabled,       setSoundEnabled]       = useState(true);
  const [isConnected,        setIsConnected]        = useState(false);

  const audioCtxRef      = useRef<AudioContext | null>(null);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef         = useRef(true);
  const waiterLoadedRef  = useRef(false);

  // ── Unlock AudioContext on first user gesture ─────────────────
  // Browsers won't play any audio until there's been a click/keydown.
  // We create the context on first interaction so it's ready when
  // a socket event fires later.
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = createAudioCtx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      // Remove after first interaction — it's unlocked for the session
      window.removeEventListener("click",   unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click",      unlock, { once: true });
    window.addEventListener("keydown",    unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click",      unlock);
      window.removeEventListener("keydown",    unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Derive unreadCount directly — no separate state to get out of sync
  const newDeliveryEnquiryCount = deliveryEnquiries.filter(e => e.status === "NEW").length;
  const unreadCount = pendingOrders.length + waiterRequests.length + newDeliveryEnquiryCount;

  // ── Audio ─────────────────────────────────────────────────────
  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
      const ctx = audioCtxRef.current;
      // Resume if suspended (happens when no user gesture has occurred yet)
      const play = () => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = 1000; g.gain.value = 0.2;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      };
      if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
      else play();
    } catch { /* ignore */ }
  }, []);

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
      const ctx = audioCtxRef.current;
      const play = () => {
        [880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.frequency.value = freq; g.gain.value = 0.15;
          osc.start(ctx.currentTime + i * 0.18);
          osc.stop(ctx.currentTime  + i * 0.18 + 0.25);
        });
      };
      if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
      else play();
    } catch { /* ignore */ }
  }, []);

  const startRinging = useCallback(() => {
    if (!soundRef.current || audioIntervalRef.current) return;
    setIsRinging(true); playBeep();
    audioIntervalRef.current = setInterval(playBeep, 1000);
  }, [playBeep]);

  const stopRinging = useCallback(() => {
    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null; }
    setIsRinging(false);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => { const next = !prev; soundRef.current = next; if (!next) stopRinging(); return next; });
  }, [stopRinging]);

  // ── Load orders from REST ─────────────────────────────────────
  const refreshOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await API.get("/orders");
      const pending = (res.data.data || []).filter((o: any) => o.status === "PENDING");
      setPendingOrders(pending);
      if (soundRef.current && pending.length > 0) startRinging();
      else if (pending.length === 0) stopRinging();
    } catch (e) {
      console.error("[Notification] refreshOrders:", e);
      // BUG 25 FIX: stop ringing so the alarm doesn't loop forever on error
      stopRinging();
    } finally {
      setIsLoading(false);
    }
  }, [startRinging, stopRinging]);

  // ── Load waiter requests from DB (strictly once) ─────────────
  const loadWaiterRequests = useCallback(async () => {
    if (waiterLoadedRef.current) return; // Strict Mode double-invoke guard
    waiterLoadedRef.current = true;
    try {
      const res = await API.get("/waiter-requests");
      const items: WaiterRequest[] = (res.data.data || []).map((r: any) => ({
        _id:          String(r._id),
        tableNumber:  r.tableNumber,
        customerName: r.customerName || "",
        status:       r.status,
        createdAt:    r.createdAt,
      }));
      setWaiterRequests(items);
    } catch (e) {
      console.error("[Notification] loadWaiterRequests:", e);
      waiterLoadedRef.current = false; // allow retry on error
    }
  }, []);

  // ── Load new delivery enquiries from REST ─────────────────────
  const loadDeliveryEnquiries = useCallback(async () => {
    try {
      const res = await API.get("/delivery-enquiries?status=NEW&limit=100");
      const items: DeliveryEnquiryNotif[] = (res.data.data || []).map((e: any) => ({
        _id:          String(e._id),
        customerName: e.customerName || "",
        mobile:       e.mobile       || "",
        address:      e.address      || "",
        message:      e.message      || "",
        status:       e.status,
        createdAt:    e.createdAt,
      }));
      setDeliveryEnquiries(items);
    } catch (e) {
      console.error("[Notification] loadDeliveryEnquiries:", e);
    }
  }, []);

  // ── Dismiss one notification — DELETE first, then remove from state ──
  const dismissWaiterRequest = useCallback(async (id: string) => {
    // Delete from DB first so a concurrent loadWaiterRequests won't re-add it
    try { await API.delete(`/waiter-requests/${id}`); } catch { /* ignore network errors */ }
    // Remove from UI after the DB is cleared
    setWaiterRequests(prev => prev.filter(r => r._id !== id));
  }, []);

  // ── Clear all — DELETE from DB first, then clear state ────────
  const clearAllWaiterRequests = useCallback(async () => {
    try { await API.delete("/waiter-requests/all"); } catch { /* ignore */ }
    setWaiterRequests([]);
  }, []);

  // ── Socket setup (once on mount) ──────────────────────────────
  useEffect(() => {
    refreshOrders();
    loadWaiterRequests();
    loadDeliveryEnquiries();
    connectSocket();

    const onConnect    = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onError      = (err: Error) => console.error("[Socket]", err.message);

    const onNewOrder = (order: any) => {
      setPendingOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev]);
      if (soundRef.current) startRinging();
    };

    const onStatusUpdated = (payload: { orderId: string; status: string }) => {
      if (payload.status !== "PENDING") {
        setPendingOrders(prev => {
          const next = prev.filter(o => o._id !== payload.orderId);
          if (next.length === 0) stopRinging();
          return next;
        });
      }
    };

    const onWaiterRequested = (req: any) => {
      const id = String(req._id);
      const item: WaiterRequest = {
        _id: id,
        tableNumber:  req.tableNumber,
        customerName: req.customerName || "",
        status:       req.status || "PENDING",
        createdAt:    req.createdAt || new Date().toISOString(),
      };
      setWaiterRequests(prev => prev.some(r => r._id === id) ? prev : [item, ...prev]);
      if (soundRef.current) playChime();
    };

    // When waiter staff resolve/dismiss a request — remove it from admin panel too
    const onWaiterRequestUpdated = (payload: { _id: string; status: string }) => {
      if (payload.status === "COMPLETED") {
        setWaiterRequests(prev => prev.filter(r => r._id !== payload._id));
      }
    };

    // ── Delivery enquiry socket handlers ──────────────────────
    const onDeliveryEnquiryCreated = (enquiry: any) => {
      const id = String(enquiry._id);
      const item: DeliveryEnquiryNotif = {
        _id:          id,
        customerName: enquiry.customerName || "",
        mobile:       enquiry.mobile       || "",
        address:      enquiry.address      || "",
        message:      enquiry.message      || "",
        status:       enquiry.status       || "NEW",
        createdAt:    enquiry.createdAt    || new Date().toISOString(),
      };
      setDeliveryEnquiries(prev => prev.some(e => e._id === id) ? prev : [item, ...prev]);
      if (soundRef.current) playChime();
    };

    const onDeliveryEnquiryUpdated = (payload: { _id: string; status: string }) => {
      // Remove from the "NEW" notification list when it moves to another status
      if (payload.status !== "NEW") {
        setDeliveryEnquiries(prev => prev.filter(e => e._id !== payload._id));
      }
    };

    socket.on("connect",               onConnect);
    socket.on("disconnect",            onDisconnect);
    socket.on("connect_error",         onError);
    socket.on("new_order",             onNewOrder);
    socket.on("order_status_updated",  onStatusUpdated);
    socket.on("waiter_requested",      onWaiterRequested);
    socket.on("waiter_request_updated", onWaiterRequestUpdated);
    socket.on("delivery_enquiry_created", onDeliveryEnquiryCreated);
    socket.on("delivery_enquiry_updated", onDeliveryEnquiryUpdated);

    return () => {
      socket.off("connect",               onConnect);
      socket.off("disconnect",            onDisconnect);
      socket.off("connect_error",         onError);
      socket.off("new_order",             onNewOrder);
      socket.off("order_status_updated",  onStatusUpdated);
      socket.off("waiter_requested",      onWaiterRequested);
      socket.off("waiter_request_updated", onWaiterRequestUpdated);
      socket.off("delivery_enquiry_created", onDeliveryEnquiryCreated);
      socket.off("delivery_enquiry_updated", onDeliveryEnquiryUpdated);
      stopRinging();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptOrder = async (orderId: string) => {
    try {
      stopRinging();
      setPendingOrders(prev => prev.filter(o => o._id !== orderId));
      const res = await API.patch(`/orders/${orderId}/accept`);
      return { success: true, data: res.data };
    } catch (error: any) {
      await refreshOrders();
      return { success: false, error: error?.response?.data?.message || "Failed to accept" };
    }
  };

  const rejectOrder = async (orderId: string, reason = "") => {
    try {
      stopRinging();
      setPendingOrders(prev => prev.filter(o => o._id !== orderId));
      const res = await API.patch(`/orders/${orderId}/reject`, { reason });
      return { success: true, data: res.data };
    } catch (error: any) {
      await refreshOrders();
      return { success: false, error: error?.response?.data?.message || "Failed to reject" };
    }
  };

  return (
    <NotificationContext.Provider value={{
      pendingOrders, waiterRequests, deliveryEnquiries, newDeliveryEnquiryCount,
      unreadCount, isLoading, isRinging, soundEnabled, isConnected,
      dismissWaiterRequest, clearAllWaiterRequests,
      toggleSound, stopRinging,
      acceptOrder, rejectOrder, refreshOrders,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}