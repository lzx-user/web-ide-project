const express = require('express');
const cors = require('cors');
const fs = require('fs');  // 文件系统，用于读写临时文件
const path = require('path');  // 路径处理，用于拼接绝对路径
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { spawn, exec } = require('child_process');
const roomRouter = require('./src/routes/room');
const codeRouter = require('./src/routes/code');
const PtyManager = require('./src/pty/PtyManager');
const { safeResolve } = require('./src/utils/safePath');
// 引入 ws 模块
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');
// 1. 引入统一配置文件
const config = require('./config');
const { randomUUID } = require('crypto');
const ENABLE_TERMINAL = process.env.ENABLE_TERMINAL === 'true';  // 从环境变量读取配置
/**
 * Web IDE 后端核心服务
 * 思路：
 * - 基础设施：基于 Express 和 Socket.io 构建实时通信地基。
 * - 安全层：利用 JWT 和中间件对每个 WebSocket 连接进行身份“安检”。
 * - 执行层：通过子进程独立运行代码，确保主服务不会因为用户代码崩溃。
 */

const app = express();

// 2. 基础中间件配置
app.use(cors());
// 解析 application/json 格式的请求体 (JSON 解析中间件)
app.use(express.json());

// 3. 路由注册：把房间管理和代码管理的路由注册到 Express 应用上
app.use('/', roomRouter);
app.use('/', codeRouter);

// 用原生的http模块包装express应用
const server = http.createServer(app);
// 把socket.io服务器绑定到这个http服务器上
const io = new Server(server, {
  cors: { origin: config.cors.origin } // 引用配置中的跨域规则
})

// 确保临时目录存在，用于存放执行代码
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// ==========================================
// 1. Socket.io 逻辑 (控制面与状态面)
// ==========================================

// Socket 拦截器：验证 JWT 凭证
io.use((socket, next) => {
  // 从客户端的 auth 选项中提取 token
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("拒绝访问：未提供Token"));
  }

  // 验证 Token 的合法性，使用配置文件中的 JWT 密钥
  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      return next(new Error("拒绝访问：Token无效或已过期"));
    }

    // 3. 验证通过！把解码后的用户信息挂载到 socket 对象上, 方便后续使用
    socket.user = decoded;
    next();  // 放行，允许建立长连接
  });
})

// 监听客户端连接事件
io.on('connection', (socket) => {
  const { roomId, username } = socket.user;
  socket.join(roomId);  // 自动加入 JWT 中指定的房间
  console.log(`[房间 ${roomId}] 用户 ${username} 已连接 (Socket.io)`);

  // 1. 建立极其干净的沙箱根目录
  const roomDir = path.join(tempDir, roomId);
  if (!fs.existsSync(roomDir)) fs.mkdirSync(roomDir, { recursive: true });

  // 2. 重构文件树递归（去除了难看的 roomId_ 前缀逻辑）
  const buildFileTree = (dirPath, basePath = '') => {
    const result = [];
    // 如果目录不存在，直接返回空数组
    if (!fs.existsSync(dirPath)) return result;

    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    items.forEach(item => {
      // 过滤掉非当前房间的文件，且屏蔽掉临时执行产生的 stream_ 碎片文件
      if (basePath === '' && item.name.startsWith(`stream_`)) return;

      // 剔除房间号前缀，还原真实的文件/文件夹名
      const relativePath = basePath === '' ? item.name : `${basePath}/${item.name}`;
      const fullItemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        result.push({
          id: relativePath,  // 利用相对路径作为前端渲染的唯一 Key
          name: item.name,
          type: 'folder',
          path: relativePath,
          children: buildFileTree(fullItemPath, relativePath)  // 递归深入子目录
        });
      } else {
        result.push({
          id: relativePath,
          name: item.name,
          type: 'file',
          path: relativePath
        });
      }
    });
    return result;
  };

  try {
    socket.emit('initCodePackage', buildFileTree(roomDir));
  } catch (err) {
    console.log('读取目录失败:', err);
  }

  // 新建文件/文件夹 （支持多级目录探测与完全隔离）
  socket.on('createFile', async (data, callback) => {
    // 接收前端传来的 isFolder 标识
    const { filename, isFolder } = data || {};

    try {
      if (!filename) {
        throw new Error('文件名不能为空');
      }

      // 不信任前端传来的 roomId，统一使用 socket.user 里的 roomId
      const { normalizedPath, resolvedPath: filePath } = safeResolve(roomDir, filename);

      // 防止重名
      if (fs.existsSync(filePath)) {
        throw new Error('同名冲突');
      }

      if (isFolder) {
        await fs.promises.mkdir(filePath, { recursive: true });
      } else {
        const parentDir = path.dirname(filePath);
        await fs.promises.mkdir(parentDir, { recursive: true });

        // flag: 'wx' 表示文件已存在时直接失败，避免并发覆盖
        await fs.promises.writeFile(filePath, '', { flag: 'wx' });
      }

      // 创建成功后广播最新文件树
      io.to(roomId).emit('initCodePackage', buildFileTree(roomDir));

      // 点对点触发当前用户的 Toast 提示预期管理
      if (typeof callback === 'function') {
        callback({
          success: true,
          isSanitized: normalizedPath !== filename,  // 告诉前端：我帮你清洗过路径了
          original: filename,  // 用户原本输入的错误路径
          cleaned: normalizedPath  // 净化后的标准路径
        });
      }
    } catch (err) {
      console.error('创建文件失败:', err.message);

      if (typeof callback === 'function') {
        callback({
          success: false,
          msg: err.message || '创建文件失败'
        });
      }
    }
  });

  // 删除文件 / 文件夹
  socket.on('deleteFile', async (data, callback) => {
    const { filename } = data || {};

    try {
      if (!filename) {
        throw new Error('文件名不能为空');
      }

      // 使用 JWT 中的 roomId, 不信任前端传来的 roomId
      const { resolvedPath: filePath } = safeResolve(roomDir, filename);

      if (!fs.existsSync(filePath)) {
        throw new Error('文件不存在或已被删除');
      }

      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
        // 删除文件夹：连同子内容一起删除
        await fs.promises.rm(filePath, { recursive: true, force: true });
      } else {
        // 删除普通文件
        await fs.promises.unlink(filePath);
      }

      // 删除后广播最新文件树
      io.to(roomId).emit('initCodePackage', buildFileTree(roomDir));

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('删除文件失败:', err.message);

      if (typeof callback === 'function') {
        callback({ success: false, msg: err.message });
      }

      socket.emit('codeError', `删除文件失败: ${err.message}`);
    }
  });

  // 运行代码（终极方案：沙箱 + PTY 纯净执行，彻底消灭长路径与结果消失）
  socket.on('executeCode', async (payload) => {
    const codeStr = typeof payload === 'object' ? payload.code : payload;

    // 纯净文件名：不再带有任何绝对路径前缀
    const fileName = `stream_${randomUUID()}.js`;
    const filePath = path.join(roomDir, fileName);

    try {
      // 触发前端按钮 Loading 状态
      io.to(roomId).emit('executionStarted');

      // 1. 将代码写入专属沙箱目录
      // 现在：注入基础沙箱防御，拦截敏感模块
      const safeCodeWrapper = `
        // --- 系统级沙箱拦截 ---
        const _require = require;
        require = function(moduleName) {
          const blockedModules = ['fs', 'child_process', 'os', 'path', 'cluster'];
          if (blockedModules.includes(moduleName)) {
            throw new Error('❌ 警告：出于安全考虑，Web IDE 已在沙箱环境中禁用 ' + moduleName + ' 模块。');
          }
          return _require(moduleName);
        };
        // --- 用户代码 ---
        ${codeStr}
      `;
      await fs.promises.writeFile(filePath, safeCodeWrapper, 'utf8');

      // 2. 使用 child_process.exec 独立执行代码，而不是通过 PTY
      // 面试亮点：配置 timeout: 5000（5秒超时），防止用户写了 while(true) 死循环导致服务器 CPU 爆炸
      exec(`node ${fileName}`, { cwd: roomDir, timeout: 5000 }, async (error, stdout, stderr) => {
        // 3. 无论执行成功还是失败，必须第一时间清理刚刚创建的 stream 文件，防止磁盘爆满
        try {
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
          }
        } catch (cleanupErr) {
          console.error(`清理临时文件失败: ${cleanupErr.message}`);
        }

        // 4. 处理执行结果
        if (error) {
          // 如果是被 timeout 强制 kill 掉的
          if (error.killed) {
            io.to(roomId).emit('codeError', '❌ 执行超时：程序运行超过 5 秒已被强制终止 (请检查是否有死循环)');
          } else {
            // 正常的语法错误或运行时错误
            io.to(roomId).emit('codeError', stderr || error.message);
          }
          io.to(roomId).emit('executionFinished', 1);
          return;
        }

        // 5. 将纯净的标准输出（stdout）和标准错误（stderr）推给前端的新面板
        if (stdout) {
          io.to(roomId).emit('codeOutput', stdout);
        }
        if (stderr) {
          io.to(roomId).emit('codeError', stderr);
        }

        // 解锁前端运行按钮
        io.to(roomId).emit('executionFinished', 0);
      });

    } catch (err) {
      io.to(roomId).emit('codeError', `服务器内部异常: ${err.message}`);
      io.to(roomId).emit('executionFinished', 1);
    }
  });

  // 初始化用户的专属伪终端
  let userPty = null;

  // 只有在明确开启终端时，才创建真实的PTY
  if (ENABLE_TERMINAL) {
    userPty = new PtyManager(socket, roomId);

    // 监听前端发来的窗口大小变化，调用 pty 的 resize 方法调整后端进程
    socket.on('terminal-resize', ({ cols, rows }) => {
      if (userPty && userPty.ptyProcess) {
        try {
          userPty.resize(cols, rows);
        } catch (err) {
          console.log('重置终端大小失败:', err.message);
        }
      }
    });
  } else {
    console.log(`[房间 ${roomId}] 生产环境已禁用真实终端`);
  }

  socket.on('disconnect', () => {
    console.log(`[房间 ${roomId}] 用户 ${username} 已断开连接`);

    // 如果本次连接创建过终端，断开时才销毁
    if (userPty) {
      userPty.destroy();
    }
  });
});

// ==========================================
// 2. Yjs 数据面改造 (不再独立监听端口)
// ==========================================

// 创建一个“不绑定任何端口”的 WebSocket 服务器，专为 Yjs 服务
// noServer: true 是关键，意思是“不要自己建服务器，我一会儿把请求塞给你”
const yjsWss = new WebSocket.Server({ noServer: true });

yjsWss.on('connection', (ws, req) => {
  // 从 req.url 中提取文档名 (兼容 y-websocket 客户端默认格式)
  const docName = req.url.slice(1).split('?')[0] || 'default-room';
  console.log(`[数据面] ⚡ 建立 CRDT 同步通道，目标文档: ${docName}`);

  // 把原生的 ws 连接直接丢给 Yjs 的底层工具函数
  // 光标同步，代码冲突合并，离线重连 全包了
  setupWSConnection(ws, req, { docName });
})

// ==========================================
// 3. 终极合并：升级请求路由 (Protocol Upgrade Routing)
// ==========================================

/**
 * 监听 HTTP 服务器的 upgrade 事件
 * 任何 WebSocket 连接在建立前，都会发一个 HTTP 请求要求升级协议 (Upgrade: websocket)
 * 我们在这里进行“安检分流”：
 */
server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  // 1. 如果是 Socket.io 的请求 (默认路径是 /socket.io/)
  if (url.startsWith('/socket.io')) {
    // 交给 Socket.io 引擎处理，不需要我们管
    return;
  }

  // 2. 如果前端连接 Yjs 的 URL 以 /yjs 开头
  if (url.startsWith('/yjs/')) {
    try {
      const parsedUrl = new URL(url, `http://${request.headers.host}`);

      // yjs/111 -> 111
      const roomFromUrl = parsedUrl.pathname.replace(/^\/yjs\//, '');

      const token = parsedUrl.searchParams.get('token');

      if (!token) {
        console.warn('[Yjs鉴权] 缺少 token,  拒接连接');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const payload = jwt.verify(token, config.jwt.secret);

      if (!payload || payload.roomId !== roomFromUrl) {
        console.warn('[Yjs鉴权] token 无效或房间不匹配, 拒接连接', {
          tokenRoom: payload?.roomId,
          urlRoom: roomFromUrl,
        });
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // 鉴权通过后，再把 /yjs/111?token=xxx 改成 /111
      // 注意：这里不要把 token 继续暴露给 Yjs 内部
      request.url = `/${roomFromUrl}`;

      yjsWss.handleUpgrade(request, socket, head, (ws) => {
        yjsWss.emit('connection', ws, request);
      });

      return;

    } catch (err) {
      console.error('[Yjs鉴权] token 校验失败:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

  }
  // 3. 非法或未知的升级请求，直接销毁连接
  socket.destroy();
})

// ==========================================
// 4. 启动统一监听
// ==========================================
server.listen(config.server.port, () => {
  console.log(`
  🚀 [单端口微服务架构] 启动成功！
  🌍 API & Socket.io 服务: http://${config.server.host}:${config.server.port}
  📡 Yjs CRDT 数据流分发: ws://${config.server.host}:${config.server.port}/yjs
  🔧 Mode: ${config.env.current}
  `);
});