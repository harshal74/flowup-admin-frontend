import { io, Socket } from "socket.io-client";

export const RESTAURANT_ID = "FLOWUP001";

// In production: set VITE_SOCKET_URL to your Railway backend root URL
// e.g.  https://your-backend.up.railway.app
// In development: defaults to localhost:5000
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  query: { restaurantId: RESTAURANT_ID },
});

export function connectSocket(): void {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
  if (socket.connected) socket.disconnect();
}

export default socket;
