const jwt = require('jsonwebtoken');

const config = require('../../config');
const PtyManager = require('../pty/PtyManager');
const { ensureRoomDir } = require('../services/roomService');
const {
  buildFileTree,
  createWorkspaceEntry,
  deleteWorkspaceEntry,
} = require('../services/fileService');
const { executeJavaScriptCode } = require('../services/codeService');

const ENABLE_TERMINAL = process.env.ENABLE_TERMINAL === 'true';

/**
 * 注册 Socket.io 控制面
 *
 * 控制面负责：
 * 1. 校验 Socket.io JWT
 * 2. 加入房间
 * 3. 初始化文件树
 * 4. 创建文件/文件夹
 * 5. 删除文件/文件夹
 * 6. 执行代码
 * 7. 可选 PTY 真实终端
 */
function registerWorkspaceSocket(io) {
  /**
   * Socket.io 鉴权中间件
   *
   * 为什么必须保留：
   * /api/join 只是签发 token；
   * 用户真正创建文件、删除文件、执行代码都是通过 Socket.io 完成。
   * 所以 Socket.io 层必须再次校验 token。
   */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('拒绝访问：未提供Token'));
    }

    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        return next(new Error('拒绝访问：Token无效或已过期'));
      }

      // 把 JWT 解码结果挂到 socket 上，后面 connection 里直接使用
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const { roomId, username } = socket.user;

    socket.join(roomId);
    console.log(`[房间 ${roomId}] 用户 ${username} 已连接 (Socket.io)`);

    // 确保当前房间的工作目录存在
    const roomDir = ensureRoomDir(roomId);

    /**
     * 初次连接时推送文件树
     *
     * 为什么保留 initCodePackage：
     * 前端 useWorkspaceSocket 监听的就是这个事件。
     * 改事件名会导致文件树不显示。
     */
    socket.emit('initCodePackage', buildFileTree(roomDir));

    /**
     * 创建文件/文件夹
     *
     * 下面这段如果你原 index.js 里已经有更完整的“路径净化提示 isSanitized”逻辑，
     * 请优先复制原来的，不要用这里覆盖。
     */
    socket.on('createFile', ({ filename, isFolder }, callback) => {
      try {
        const result = createWorkspaceEntry(roomDir, filename, isFolder);

        callback?.(result);

        if (result.success) {
          io.to(roomId).emit('initCodePackage', buildFileTree(roomDir));
        }
      } catch (err) {
        callback?.({
          success: false,
          msg: err.message,
        });
      }
    });

    /**
     * 删除文件/文件夹
     *
     * 注意：
     * 这里用 rmSync recursive，保留删除文件夹的能力。
     */
    socket.on('deleteFile', ({ filename }, callback) => {
      try {
        const result = deleteWorkspaceEntry(roomDir, filename);

        callback?.(result);

        if (result.success) {
          io.to(roomId).emit('initCodePackage', buildFileTree(roomDir));
        }
      } catch (err) {
        callback?.({
          success: false,
          msg: err.message,
        });
      }
    });

    /**
     * 执行代码
     *
     * 这里保留你原来的 executeCode 事件名。
     * 如果你原 index.js 里已经有更完整的执行逻辑，请把原逻辑搬过来。
     */
    socket.on('executeCode', ({ code }) => {
      try {
        io.to(roomId).emit('executionStarted');

        executeJavaScriptCode({
          roomDir,
          code,
          onOutput: (output) => {
            io.to(roomId).emit('codeOutput', output);
          },
          onError: (error) => {
            io.to(roomId).emit('codeError', error);
          },
          onFinish: (exitCode) => {
            io.to(roomId).emit('executionFinished', exitCode);
          },
        });
      } catch (err) {
        io.to(roomId).emit('codeError', `服务器内部异常: ${err.message}`);
        io.to(roomId).emit('executionFinished', 1);
      }
    });

    /**
     * 真实终端 PTY
     *
     * 为什么保留但受 ENABLE_TERMINAL 控制：
     * 生产环境真实终端风险很高，你前面已经设为 false。
     * 但功能入口先保留，未来有 Docker 沙箱后还能重新打开。
     */
    let userPty = null;

    if (ENABLE_TERMINAL) {
      userPty = new PtyManager(socket, roomId);

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

      if (userPty) {
        userPty.destroy();
      }
    });
  });
}

module.exports = registerWorkspaceSocket;