const http = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const createApp = require('./src/app');
const registerWorkspaceSocket = require('./src/socket/workspaceSocket');
const registerYjsServer = require('./src/yjs/yjsServer');

/**
 * 后端启动入口
 *
 * 为什么这样改：
 * 原来的 index.js 同时负责 Express、Socket.io、Yjs、文件操作、代码执行。
 * 一旦功能变多，入口文件会越来越难维护。
 *
 * 现在 index.js 只负责：
 * 1. 创建 Express app
 * 2. 创建 HTTP server
 * 3. 挂载 Socket.io 控制面
 * 4. 挂载 Yjs 数据面
 * 5. 启动监听
 */
const app = createApp();
const server = http.createServer(app);

/**
 * Socket.io 控制面
 *
 * 注意：
 * Express 的 CORS 和 Socket.io 的 CORS 要保持一致，
 * 否则会出现 HTTP 能访问、Socket 连不上的诡异问题。
 */
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
  },
});

// 注册协作空间相关 Socket 事件
registerWorkspaceSocket(io);

// 注册 Yjs WebSocket upgrade 分流
registerYjsServer(server);

server.listen(config.server.port, () => {
  console.log(`
  🚀 [单端口微服务架构] 启动成功！
  🌍 API & Socket.io 服务: http://${config.server.host}:${config.server.port}
  📡 Yjs CRDT 数据流分发: ws://${config.server.host}:${config.server.port}/yjs
  🔧 Mode: ${config.env.current}
  `);
});