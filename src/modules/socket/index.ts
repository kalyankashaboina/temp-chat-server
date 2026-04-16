import type http from 'http';

import { createSocketServer } from './socket.server';
import { socketAuth } from './socket.auth';
import { registerSocketEvents } from './socket.events';

export function initSocket(server: http.Server) {
  const io = createSocketServer(server);

  //  auth FIRST
  io.use(socketAuth);

  // 📡 domain events
  registerSocketEvents(io);

  return io;
}
