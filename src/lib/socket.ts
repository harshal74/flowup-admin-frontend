import { io, Socket } from "socket.io-client";

// Derive restaurantId from the stored Admin JWT (trusted source)
function getRestaurantIdFromToken(): string {
  try {
    const token = localStorage.getItem("flowup_admin_token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.restaurantId || "";
  } catch {
    return "";
  }
}

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? (import.meta.env.VITE_API_URL as string).replace(/\/api\/?$/, "")
    : "");

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  query: { get restaurantId() { return getRestaurantIdFromToken(); } },
  auth: {
    get token() {
      return localStorage.getItem("flowup_admin_token") || "";
    },
  },
});

export function connectSocket(): void {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
  if (socket.connected) socket.disconnect();
}

export default socket;
