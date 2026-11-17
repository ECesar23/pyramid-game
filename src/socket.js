import { io } from 'socket.io-client';

// In dev: Vite proxies /socket.io → localhost:3001
// In prod: same origin as the served app
export const socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
