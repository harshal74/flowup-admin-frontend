import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://flowup-backend-1.onrender.com/api",
});

API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(
  "flowup_admin_token"
);

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  }
);

export default API;

export const RESTAURANT_ID =
  "FLOWUP001";