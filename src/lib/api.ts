import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("flowup_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// FIX SEC-3: Auto-logout on 401 (invalid/expired token) or 403 suspended/expired.
// Clears the stored token and redirects to login so a suspended or expired
// restaurant admin cannot continue using the UI after the backend rejects them.
// 403 responses from specific non-auth routes (e.g. table conflict 409) are NOT
// caught here because those return 409, not 403.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      const data = error?.response?.data;
      // Only auto-logout for auth-related 403s (suspended, expired, unauthorized).
      // Do not logout for 403s that are business-logic rejections without these flags.
      if (status === 401 || data?.suspended || data?.expired || data?.message?.toLowerCase().includes("unauthorized")) {
        localStorage.removeItem("flowup_admin_token");
        // Redirect to login — use window.location to avoid a stale React Router state.
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
