import http from 'node:http';
import { Server } from 'socket.io';

import config from './config.js';
import createApp from './src/app.js';
import registerWorkspaceSocket from './src/socket/workspaceSocket.js';
import registerYjsServer from './src/yjs/yjsServer.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './src/types/socket.js';

const app = createApp();
const server = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
  },
});

registerWorkspaceSocket(io);
registerYjsServer(server);

server.listen(config.server.port, () => {
  console.log(`Web IDE backend: http://${config.server.host}:${config.server.port}`);
  console.log(`Yjs websocket: ws://${config.server.host}:${config.server.port}/yjs`);
  console.log(`Mode: ${config.env.current}`);
});
