import React, { useCallback, useEffect, useRef, useState } from 'react';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ensureMetaSdk } from '../../lib/metaSdk';

/**
 * Phase 16 — Admin Meta WhatsApp section (VISIBILITY / ONBOARDING / SYNC only).
 *
 * OUTBOUND-INACTIVE: this component never sends WhatsApp messages, never enables
 * the Meta outbound gate, and never lets the admin edit template approval. It
 * only reads status, launches Embedded Signup, submits the callback, and
 * triggers the server-trusted template sync. Backend remains authoritative for
 * tenant identity, credentials, OAuth state, and approval status.
 *
 * Consumed backend endpoints (all protected by the admin session):
 *   GET  /api/whatsapp/meta/status
 *   POST /api/whatsapp/meta/connect
 *   POST /api/whatsapp/meta/callback   { code, state }
 *   POST /api/whatsapp/meta/templates/sync
 */

type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | string;

interface TemplateRecord {
  name: string;
  languageCode: string;
  status: TemplateStatus;
  wabaId?: string;
  approvedAt?: string | null;
}

interface MetaStatus {
  connected: boolean;
  provider: string | null;
  status: string | null;
  metaOutboundEnabled?: boolean;
  statusReason?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  countryCode?: string | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  templates: TemplateRecord[];
}

// Phase 9 canonical event → Meta template name (display mapping only).
const CANONICAL_TEMPLATES: { event: string; name: string }[] = [
  { event: 'ORDER_PLACED',     name: 'flowup_order_placed' },
  { event: 'ORDER_ACCEPTED',   name: 'flowup_order_accepted' },
  { event: 'ORDER_REJECTED',   name: 'flowup_order_rejected' },
  { event: 'OUT_FOR_DELIVERY', name: 'flowup_out_for_delivery' },
  { event: 'DELIVERED',        name: 'flowup_delivered' },
  { event: 'PAYMENT_SUCCESS',  name: 'flowup_payment_success' },
  { event: 'BILL',             name: 'flowup_bill' },
];

function statusBadgeClass(status: TemplateStatus): string {
  switch (status) {
    case 'APPROVED': return 'bg-green-500/20 text-green-400';
    case 'PENDING':  return 'bg-amber-500/20 text-amber-400';
    case 'REJECTED': return 'bg-red-500/20 text-red-400';
    case 'PAUSED':   return 'bg-gray-500/20 text-gray-400';
    default:         return 'bg-gray-500/20 text-gray-400';
  }
}

function safeErr(error: any, fallback: string): string {
  const msg = error?.response?.data?.message;
  return typeof msg === 'string' && msg.length < 200 ? msg : fallback;
}

const MetaWhatsAppSection: React.FC = () => {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingOutbound, setTogglingOutbound] = useState(false);
  const inFlight = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/whatsapp/meta/status');
      setStatus(res.data?.data ?? null);
    } catch (error) {
      // Non-fatal: the Meta section simply shows as unavailable.
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Launch Embedded Signup. The backend returns the appId/configId/redirectUri/
  // state; the frontend never generates or trusts its own state, and never
  // handles secrets. If the Meta JS SDK is not present/configured, we surface a
  // clear message instead of failing silently.
  const handleConnect = async () => {
    if (connecting || inFlight.current) return;
    inFlight.current = true;
    setConnecting(true);
    try {
      const res = await API.post('/whatsapp/meta/connect', {});
      const cfg = res.data?.data;
      if (!cfg?.appId || !cfg?.configId) {
        toast.error('WhatsApp onboarding is not configured yet. Please contact support.');
        return;
      }

      // Load + initialize the Meta JS SDK using the PUBLIC appId from the
      // backend (no secret). Idempotent + retryable; failure shows a safe error.
      let FB: any;
      try {
        FB = await ensureMetaSdk(cfg.appId);
      } catch {
        toast.error('WhatsApp onboarding could not load. Please check your connection and try again.');
        return;
      }
      if (!FB || typeof FB.login !== 'function') {
        toast.error('WhatsApp onboarding is temporarily unavailable. Please try again.');
        return;
      }

      // Launch Meta Embedded Signup. The backend-provided `state` is passed
      // through unchanged and returned to our callback.
      FB.login(
        (response: any) => {
          const code = response?.authResponse?.code;
          if (!code) {
            toast.error('WhatsApp connection was cancelled or failed.');
            return;
          }
          submitCallback(code, cfg.state);
        },
        {
          config_id: cfg.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: 2 },
          state: cfg.state,
        }
      );
    } catch (error) {
      toast.error(safeErr(error, 'Could not start WhatsApp connection.'));
    } finally {
      setConnecting(false);
      inFlight.current = false;
    }
  };

  // Submit only { code, state } to the protected callback. No token/secret is
  // ever stored client-side; tenant identity is recovered by the backend from
  // the validated state.
  const submitCallback = async (code: string, state: string) => {
    try {
      const res = await API.post('/whatsapp/meta/callback', { code, state });
      if (res.data?.success) {
        toast.success('WhatsApp connected');
        await loadStatus();
      } else {
        toast.error(res.data?.message || 'WhatsApp connection failed.');
      }
    } catch (error) {
      toast.error(safeErr(error, 'WhatsApp connection failed.'));
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      // Empty body — backend derives restaurantId/wabaId/status server-side.
      await API.post('/whatsapp/meta/templates/sync', {});
      toast.success('Template statuses synced');
      await loadStatus();
    } catch (error) {
      toast.error(safeErr(error, 'Template sync failed.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleOutbound = async () => {
    if (togglingOutbound || !status) return;
    setTogglingOutbound(true);
    try {
      const next = !(status.metaOutboundEnabled === true);
      await API.patch('/whatsapp/meta/outbound', { enabled: next });
      toast.success(next ? 'Meta outbound enabled for this restaurant' : 'Meta outbound disabled for this restaurant');
      await loadStatus();
    } catch (error) {
      toast.error(safeErr(error, 'Could not update Meta outbound setting.'));
    } finally {
      setTogglingOutbound(false);
    }
  };

  const templateByName = new Map((status?.templates || []).map((t) => [t.name, t]));
  const anyApproved = (status?.templates || []).some((t) => t.status === 'APPROVED');
  const allApproved =
    CANONICAL_TEMPLATES.every((c) => templateByName.get(c.name)?.status === 'APPROVED');

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">WhatsApp (Meta Cloud API)</h3>
          <p className="text-xs text-secondary-400 mt-1">
            Connect your own WhatsApp Business number. Order notifications currently use the
            default provider; Meta messaging is not active yet.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-secondary-400">Loading WhatsApp status…</p>
      ) : !status || !status.connected ? (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="px-2 py-0.5 rounded-lg bg-gray-500/20 text-gray-400 text-xs font-medium">
              Not connected
            </span>
            <p className="text-xs text-secondary-400 mt-2">
              {status?.status
                ? `Current state: ${status.status}. Reconnect to continue.`
                : 'Your restaurant is using the default WhatsApp provider.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="btn btn-primary"
          >
            {connecting ? 'Starting…' : 'Connect WhatsApp'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connection info (non-secret only) */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-secondary-400">Provider</div>
              <div>{status.provider || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-secondary-400">Status</div>
              <span className="px-2 py-0.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium">
                {status.status}
              </span>
            </div>
            {status.displayPhoneNumber && (
              <div>
                <div className="text-xs text-secondary-400">WhatsApp Number</div>
                <div>{status.displayPhoneNumber}</div>
              </div>
            )}
            {status.wabaId && (
              <div>
                <div className="text-xs text-secondary-400">WABA ID</div>
                <div className="font-mono text-xs break-all">{status.wabaId}</div>
              </div>
            )}
            {status.lastVerifiedAt && (
              <div>
                <div className="text-xs text-secondary-400">Last Verified</div>
                <div>{new Date(status.lastVerifiedAt).toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Outbound-disabled banner */}
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
            {allApproved
              ? 'WhatsApp is connected and all templates are approved, but outbound Meta messaging is currently disabled.'
              : anyApproved
              ? 'Some templates are approved, but unapproved templates remain blocked. Meta outbound messaging is currently disabled.'
              : 'Meta messaging cannot be activated until the required templates are approved. Meta outbound messaging is currently disabled.'}
          </div>

          {/* Per-restaurant Meta outbound gate (Phase 20) */}
          <div className="flex items-center justify-between rounded-lg border border-white/10 p-3">
            <div>
              <div className="text-sm font-medium">Meta outbound for this restaurant</div>
              <p className="text-xs text-secondary-400 mt-0.5">
                {status.metaOutboundEnabled === true ? 'Enabled' : 'Disabled'}. Messages are still subject
                to the platform gate, an active connection, and approved templates. Enabling this alone does
                not activate Meta messaging.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleOutbound}
              disabled={togglingOutbound}
              className={`btn text-xs ${status.metaOutboundEnabled === true ? 'btn-secondary' : 'btn-primary'}`}
            >
              {togglingOutbound
                ? 'Saving…'
                : status.metaOutboundEnabled === true ? 'Disable' : 'Enable'}
            </button>
          </div>

          {/* Template approval status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Message Templates</h4>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="btn btn-secondary text-xs"
              >
                {syncing ? 'Syncing…' : 'Sync Templates'}
              </button>
            </div>
            <div className="space-y-1">
              {CANONICAL_TEMPLATES.map((c) => {
                const rec = templateByName.get(c.name);
                return (
                  <div key={c.name} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                    <div>
                      <div className="font-medium">{c.event}</div>
                      <div className="text-secondary-400 font-mono">
                        {c.name}{rec?.languageCode ? ` · ${rec.languageCode}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-lg font-medium ${statusBadgeClass(rec?.status || 'NONE')}`}>
                        {rec?.status || 'NOT SYNCED'}
                      </span>
                      {rec?.status === 'APPROVED' && rec.approvedAt && (
                        <div className="text-secondary-400 mt-0.5">
                          {new Date(rec.approvedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaWhatsAppSection;
