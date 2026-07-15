import { io } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  WorkspaceSocket,
} from '../types/ide';

export let socket: WorkspaceSocket | null = null;

export function connectSocket(roomId: string, token: string): WorkspaceSocket {
  socket = io(
    import.meta.env.VITE_WS_URL,
    {
      auth: { token },
      query: { roomId },
    },
  ) as WorkspaceSocket;

  socket.on('connect_error', (error) => {
    console.error('Socket 连接失败：', error.message);
  });

  return socket;
}
