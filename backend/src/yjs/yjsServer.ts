import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import WebSocket, { WebSocketServer } from 'ws';

import config from '../../config.js';

// y-websocket 1.x 没有为这个内部入口提供完整 TS 声明，因此只在这里补最小签名。
const { setupWSConnection } = require('y-websocket/bin/utils') as {
  setupWSConnection: (
    socket: WebSocket,
    request: IncomingMessage,
    options: { docName: string },
  ) => void;
};

export default function registerYjsServer(server: HttpServer): void {
  const yjsWss = new WebSocketServer({ noServer: true });

  yjsWss.on('connection', (ws, request) => {
    const docName = request.url?.slice(1).split('?')[0] || 'default-room';
    setupWSConnection(ws, request, { docName });
  });

  server.on(
    'upgrade',
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = request.url ?? '';

      if (url.startsWith('/socket.io')) return;
      if (!url.startsWith('/yjs/')) {
        socket.destroy();
        return;
      }

      try {
        const parsedUrl = new URL(url, `http://${request.headers.host ?? 'localhost'}`);
        const roomFromUrl = decodeURIComponent(
          parsedUrl.pathname.replace(/^\/yjs\//, ''),
        );
        const token = parsedUrl.searchParams.get('token');

        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const payload = jwt.verify(token, config.jwt.secret);
        if (typeof payload === 'string' || payload.roomId !== roomFromUrl) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        // y-websocket 会把 request.url 作为文档名，移除 token 可避免进入日志和文档键。
        request.url = `/${roomFromUrl}`;
        yjsWss.handleUpgrade(request, socket, head, (ws) => {
          yjsWss.emit('connection', ws, request);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        console.error('[Yjs 鉴权] 连接失败：', message);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    },
  );
}
