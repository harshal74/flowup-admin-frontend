import { io, Socket } from "socket.io-client";

// Read from env — change only .env to switch environments
export const RESTAURANT_ID =
  (import.meta.env.VITE_RESTAURANT_ID as string) || "FLOWUP001";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? (import.meta.env.VITE_API_URL as string).replace(/\/api\/?$/, "")
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
