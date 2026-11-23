/**
 * FlowUp — Meta (Facebook) JS SDK loader for WhatsApp Embedded Signup (Phase 25).
 *
 * Safe, idempotent, single-instance loader. It injects the SDK <script> once,
 * initializes FB with the PUBLIC appId provided by the backend `/connect`
 * response (never a secret), and resolves a ready promise. React Strict Mode
 * double-mounts and repeated calls reuse the same in-flight/resolved promise.
 *
 * NEVER handles secrets: only the public App ID is used (App Secret,
 * encryption key, and webhook verify token stay server-side).
 */

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const SCRIPT_ID = "flowup-facebook-jssdk";
const GRAPH_VERSION = "v21.0"; // public, non-secret; pin the SDK Graph version

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let loadPromise: Promise<any> | null = null;
let initializedAppId: string | null = null;

/**
 * Ensure the Meta JS SDK is loaded and FB.init'd with the given public appId.
 * Idempotent: concurrent/repeated calls share one promise; re-init with the
 * same appId is a no-op. Rejects on load/timeout failure so callers can show a
 * safe error and allow retry.
 *
 * @param appId PUBLIC Meta App ID (from backend /connect). NOT a secret.
 * @returns resolves with window.FB
 */
export function ensureMetaSdk(appId: string): Promise<any> {
  if (!appId || typeof appId !== "string") {
    return Promise.reject(new Error("Missing Meta App ID"));
  }

  // Already initialized for this appId → reuse.
  if (window.FB && initializedAppId === appId) {
    return Promise.resolve(window.FB);
  }
  // In-flight load → reuse (Strict Mode / double-click safe).
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const doInit = () => {
      try {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: GRAPH_VERSION,
        });
        initializedAppId = appId;
        resolve(window.FB);
      } catch (e) {
        loadPromise = null; // allow retry
        reject(new Error("Meta SDK initialization failed"));
      }
    };

    // If FB already present (e.g. loaded by a prior attempt), just init.
    if (window.FB) {
      doInit();
      return;
    }

    // Guard against a duplicate <script> tag.
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    window.fbAsyncInit = doInit;

    if (existing) {
      // Script tag exists but FB not ready yet — fbAsyncInit will fire.
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      loadPromise = null; // allow retry after a failed load
      reject(new Error("Meta SDK failed to load"));
    };
    document.body.appendChild(script);

    // Safety timeout so a hung load surfaces a retryable error.
    setTimeout(() => {
      if (!window.FB) {
        loadPromise = null;
        reject(new Error("Meta SDK load timed out"));
      }
    }, 15000);
  });

  return loadPromise;
}

/** Whether the SDK is loaded + initialized (for UI readiness display). */
export function isMetaSdkReady(): boolean {
  return !!window.FB && !!initializedAppId;
}
