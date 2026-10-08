import type { Server } from 'socket.io';

import config from '../../config.js';
import { canEditWorkspace } from '../auth/roles.js';
import PtyManager from '../pty/PtyManager.js';
import { createRoomFile, deleteRoomFile, listRoomFiles, moveRoomFile } from '../repositories/fileRepository.js';
import { createWorkspaceVersion, listWorkspaceVersions, restoreWorkspaceVersionFiles } from '../repositories/workspaceVersionRepository.js';
import { verifyRoomToken } from '../services/authService.js';
import { executeCode, isRunnableFile } from '../services/codeService.js';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types/socket.js';
import { captureRoomDocument, removeRoomDocuments, restoreRoomDocument } from '../yjs/yjsServer.js';

type WorkspaceServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '未知错误';

export default function registerWorkspaceSocket(io: WorkspaceServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('AUTH_MISSING: 未提供 Token'));
    try {
      socket.data.user = verifyRoomToken(token);
      next();
    } catch {
      next(new Error('AUTH_INVALID: Token 无效或已过期'));
    }
  });

  io.on('connection', (socket) => {
    const { roomId, username, role } = socket.data.user;
    const canEdit = canEditWorkspace(role);
    socket.join(roomId);
    console.log(`[房间 ${roomId}] 用户 ${username} 已连接`);
    void listRoomFiles(roomId).then((tree) => socket.emit('initCodePackage', tree)).catch((error) => {
      socket.emit('workspaceError', `文件树加载失败：${errorMessage(error)}`);
    });

    socket.on('createFile', async ({ filename, isFolder }, callback) => {
      if (!canEdit) {
        callback?.({ success: false, msg: '当前为只读成员，不能创建文件' });
        return;
      }
      try {
        const result = await createRoomFile(roomId, filename, isFolder);
        callback?.({ success: true, cleaned: result.normalizedPath });
        io.to(roomId).emit('initCodePackage', await listRoomFiles(roomId));
      } catch (error) {
        const raw = errorMessage(error);
        callback?.({ success: false, msg: raw.includes('duplicate key') ? '文件或文件夹已存在' : raw });
      }
    });

    socket.on('deleteFile', async ({ filename }, callback) => {
      if (!canEdit) {
        callback?.({ success: false, msg: '当前为只读成员，不能删除文件' });
        return;
      }
      try {
        const result = await deleteRoomFile(roomId, filename);
        await removeRoomDocuments(roomId, result.documentKeys);
        callback?.({ success: true, deletedPaths: result.deletedPaths });
        io.to(roomId).emit('initCodePackage', await listRoomFiles(roomId));
      } catch (error) {
        callback?.({ success: false, msg: errorMessage(error) });
      }
    });

    socket.on('moveFile', async ({ sourcePath, targetPath }, callback) => {
      if (!canEdit) {
        callback?.({ success: false, msg: '当前为只读成员，不能移动或重命名文件' });
        return;
      }
      try {
        const result = await moveRoomFile(roomId, sourcePath, targetPath);
        callback?.({ success: true, cleaned: result.targetPath, movedPaths: result.movedPaths });
        io.to(roomId).emit('initCodePackage', await listRoomFiles(roomId));
      } catch (error) {
        const raw = errorMessage(error);
        callback?.({ success: false, msg: raw.includes('duplicate key') ? '目标路径已存在' : raw });
      }
    });

    socket.on('listVersions', async (callback) => {
      try {
        callback?.({ success: true, versions: await listWorkspaceVersions(roomId) });
      } catch (error) {
        callback?.({ success: false, msg: errorMessage(error) });
      }
    });

    socket.on('createVersion', async ({ label }, callback) => {
      if (!canEdit) {
        callback?.({ success: false, msg: '当前为只读成员，不能创建版本快照' });
        return;
      }
      try {
        const snapshot = await captureRoomDocument(roomId);
        const version = await createWorkspaceVersion(roomId, username, label ?? '', snapshot);
        const versions = await listWorkspaceVersions(roomId);
        callback?.({ success: true, version, versions });
        io.to(roomId).emit('versionHistoryChanged', versions);
      } catch (error) {
        callback?.({ success: false, msg: errorMessage(error) });
      }
    });

    socket.on('restoreVersion', async ({ versionId }, callback) => {
      if (role !== 'owner') {
        callback?.({ success: false, msg: '只有房主可以恢复历史版本' });
        return;
      }
      try {
        const snapshot = await restoreWorkspaceVersionFiles(roomId, versionId);
        await restoreRoomDocument(roomId, snapshot);
        const tree = await listRoomFiles(roomId);
        io.to(roomId).emit('initCodePackage', tree);
        callback?.({ success: true });
      } catch (error) {
        callback?.({ success: false, msg: errorMessage(error) });
      }
    });

    socket.on('executeCode', ({ code, filename }) => {
      if (!canEdit) {
        socket.emit('executionStarted');
        socket.emit('codeError', '当前为只读成员，不能运行代码');
        socket.emit('executionFinished', 1);
        return;
      }
      io.to(roomId).emit('executionStarted');
      if (!config.features.codeExecution) {
        io.to(roomId).emit('codeError', '演示环境已关闭代码执行；代码不会发送给本机子进程。');
        io.to(roomId).emit('executionFinished', 1);
        return;
      }
      if (!isRunnableFile(filename)) {
        io.to(roomId).emit('codeError', '当前只支持运行 JavaScript 和 TypeScript 文件。');
        io.to(roomId).emit('executionFinished', 1);
        return;
      }
      if (Buffer.byteLength(code, 'utf8') > config.limits.maxDocumentBytes) {
        io.to(roomId).emit('codeError', '代码内容超过运行大小限制。');
        io.to(roomId).emit('executionFinished', 1);
        return;
      }
      executeCode({
        code,
        filename,
        onOutput: (output) => io.to(roomId).emit('codeOutput', output),
        onError: (error) => io.to(roomId).emit('codeError', error),
        onFinish: (exitCode) => io.to(roomId).emit('executionFinished', exitCode),
      });
    });

    const userPty = config.features.terminal && canEdit ? new PtyManager(socket, roomId) : null;
    if (userPty) socket.on('terminal-resize', ({ cols, rows }) => userPty.resize(cols, rows));
    socket.on('disconnect', () => {
      console.log(`[房间 ${roomId}] 用户 ${username} 已断开连接`);
      userPty?.destroy();
    });
  });
}
