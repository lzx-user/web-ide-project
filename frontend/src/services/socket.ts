import { io } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  WorkspaceSocket,
} from '../types/ide';

export let socket: WorkspaceSocket | null = null;

export function connectSocket(roomId: string, token: string): WorkspaceSocket {
  // React Strict Mode 会在开发环境重复执行恢复会话的 effect；建立新连接前关闭旧实例，
  // 避免刷新或 HMR 后累积多个 Socket.IO 会话。
  socket?.disconnect();
  socket = io(
    import.meta.env.VITE_WS_URL,
    {
      auth: { token },
      query: { roomId },
      // 协作应用本身要求 WebSocket（Yjs 也依赖它），无需先用 long-polling 再升级。
      transports: ['websocket'],
    },
  ) as WorkspaceSocket;

  socket.on('connect_error', (error) => {
    console.error('Socket 连接失败：', error.message);
  });

  return socket;
}
