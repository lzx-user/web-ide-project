const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { setupWSConnection } = require('y-websocket/bin/utils');

const config = require('../../config');

/**
 * 注册 Yjs 数据面服务
 *
 * 这个模块保留你原来的单端口架构：
 * - Socket.io 继续走 /socket.io
 * - Yjs 协同数据走 /yjs/:roomId?token=xxx
 *
 * 为什么要单独拆：
 * Yjs 的 upgrade 分流逻辑很特殊，继续放在 index.js 会让入口文件越来越乱。
 */
function registerYjsServer(server) {
  /**
   * noServer: true 表示这个 WebSocket 服务不自己监听端口。
   * 它会复用 Express/Socket.io 的同一个 HTTP server。
   */
  const yjsWss = new WebSocket.Server({ noServer: true });

  yjsWss.on('connection', (ws, req) => {
    // request.url 此时已经在 upgrade 阶段被改成 /roomId
    const docName = req.url.slice(1).split('?')[0] || 'default-room';

    console.log(`[数据面] ⚡ 建立 CRDT 同步通道，目标文档: ${docName}`);

    // 交给 y-websocket 官方工具处理 CRDT 同步
    setupWSConnection(ws, req, { docName });
  });

  /**
   * 统一处理 WebSocket 升级请求
   *
   * 为什么这里要分流：
   * Socket.io 和 Yjs 都是 WebSocket，但协议不一样。
   * /socket.io 交给 Socket.io 自己处理；
   * /yjs/:roomId 交给 Yjs，并且必须先做 JWT 鉴权。
   */
  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';

    // Socket.io 自己处理 /socket.io 的 upgrade 请求，这里不要拦截它
    if (url.startsWith('/socket.io')) {
      return;
    }

    // 只允许 /yjs/:roomId 进入 Yjs 数据面
    if (!url.startsWith('/yjs/')) {
      socket.destroy();
      return;
    }

    try {
      const parsedUrl = new URL(url, `http://${request.headers.host}`);

      // /yjs/roomA -> roomA
      const roomFromUrl = parsedUrl.pathname.replace(/^\/yjs\//, '');
      const token = parsedUrl.searchParams.get('token');

      if (!token) {
        console.warn('[Yjs鉴权] 缺少 token，拒绝连接');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const payload = jwt.verify(token, config.jwt.secret);

      /**
       * 房间必须一致
       *
       * 为什么要检查 roomId：
       * 不能让用户拿 A 房间的 token 连接 B 房间的 Yjs 文档。
       */
      if (!payload || payload.roomId !== roomFromUrl) {
        console.warn('[Yjs鉴权] token 无效或房间不匹配，拒绝连接', {
          tokenRoom: payload?.roomId,
          urlRoom: roomFromUrl,
        });

        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      /**
       * 鉴权通过后，把 /yjs/:roomId?token=xxx 改成 /:roomId。
       *
       * 为什么要改：
       * y-websocket 内部会用 req.url 当文档名。
       * 如果不改，token 会混进文档名里，还会泄露到内部日志。
       */
      request.url = `/${roomFromUrl}`;

      yjsWss.handleUpgrade(request, socket, head, (ws) => {
        yjsWss.emit('connection', ws, request);
      });
    } catch (err) {
      console.error('[Yjs鉴权] token 校验失败:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });
}

module.exports = registerYjsServer;