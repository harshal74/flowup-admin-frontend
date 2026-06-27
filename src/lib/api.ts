import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
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
