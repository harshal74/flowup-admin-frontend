import axios from "axios";

const API = axios.create({
  // Falls back to Render URL if VITE_API_URL is not set
  baseURL: import.meta.env.VITE_API_URL || "https://flowup-backend-1.onrender.com/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("flowup_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;

// Read from env — change only .env to switch environments
export const RESTAURANT_ID =
  (import.meta.env.VITE_RESTAURANT_ID as string) || "FLOWUP001";
