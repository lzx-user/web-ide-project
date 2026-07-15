import jwt from 'jsonwebtoken';
import type { Server } from 'socket.io';

import config from '../../config.js';
import PtyManager from '../pty/PtyManager.js';
import { executeCode } from '../services/codeService.js';
import {
  buildFileTree,
  createWorkspaceEntry,
  deleteWorkspaceEntry,
} from '../services/fileService.js';
import { ensureRoomDir } from '../services/roomService.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/socket.js';

type WorkspaceServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const enableTerminal = process.env.ENABLE_TERMINAL === 'true';
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '未知错误';

/** 注册房间、文件操作、代码运行和可选终端的 Socket 事件。 */
export default function registerWorkspaceSocket(io: WorkspaceServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') {
      next(new Error('拒绝访问：未提供 Token'));
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret);
      if (
        typeof payload === 'string' ||
        typeof payload.roomId !== 'string' ||
        typeof payload.username !== 'string'
      ) {
        throw new Error('Token 中缺少房间信息');
      }

      // SocketData 是 Socket.io 官方提供的自定义数据容器，避免修改 socket 对象类型。
      socket.data.user = {
        roomId: payload.roomId,
        username: payload.username,
      };
      next();
    } catch {
      next(new Error('拒绝访问：Token 无效或已过期'));
    }
  });

  io.on('connection', (socket) => {
    const { roomId, username } = socket.data.user;
    const roomDir = ensureRoomDir(roomId);

    socket.join(roomId);
    console.log(`[房间 ${roomId}] 用户 ${username} 已连接`);
    socket.emit('initCodePackage', buildFileTree(roomDir));

    socket.on('createFile', ({ filename, isFolder }, callback) => {
      try {
        const result = createWorkspaceEntry(roomDir, filename, isFolder);
        callback?.(result);
        if (result.success) {
          io.to(roomId).emit('initCodePackage', buildFileTree(roomDir));
        }
      } catch (error) {
        callback?.({ success: false, msg: errorMessage(error) });
      }
    });

    socket.on('deleteFile', ({ filename }, callback) => {
      try {
        const result = deleteWorkspaceEntry(roomDir, filename);
        callback?.(result);
        if (result.success) {
          io.to(roomId).emit('initCodePackage', buildFileTree(roomDir));
        }
      } catch (error) {
        callback?.({ success: false, msg: errorMessage(error) });
      }
    });

    socket.on('executeCode', ({ code, filename }) => {
      io.to(roomId).emit('executionStarted');

      try {
        executeCode({
          roomDir,
          code,
          filename,
          onOutput: (output) => io.to(roomId).emit('codeOutput', output),
          onError: (error) => io.to(roomId).emit('codeError', error),
          onFinish: (exitCode) => {
            io.to(roomId).emit('executionFinished', exitCode);
          },
        });
      } catch (error) {
        io.to(roomId).emit('codeError', `服务器内部异常：${errorMessage(error)}`);
        io.to(roomId).emit('executionFinished', 1);
      }
    });

    // 终端默认关闭；保留原入口，便于以后接入隔离容器后再开放。
    const userPty = enableTerminal ? new PtyManager(socket, roomId) : null;
    if (userPty) {
      socket.on('terminal-resize', ({ cols, rows }) => {
        try {
          userPty.resize(cols, rows);
        } catch (error) {
          console.warn('调整终端大小失败：', errorMessage(error));
        }
      });
    }

    socket.on('disconnect', () => {
      console.log(`[房间 ${roomId}] 用户 ${username} 已断开连接`);
      userPty?.destroy();
    });
  });
}
