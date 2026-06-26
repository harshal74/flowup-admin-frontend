import { io, Socket } from "socket.io-client";

export const RESTAURANT_ID = "FLOWUP001";

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  query: { restaurantId: RESTAURANT_ID },
});

/** Connect the socket (idempotent — safe to call multiple times) */
export function connectSocket(): void {
  if (!socket.connected) {
    socket.connect();
  }
}

/** Disconnect the socket */
export function disconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;
