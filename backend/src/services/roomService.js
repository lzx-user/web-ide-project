const fs = require('fs');
const path = require('path');

/**
 * 获取后端临时工作区根目录
 *
 * 为什么这样写：
 * 所有房间文件都统一放在 backend/temp 下，避免路径分散。
 */
function getTempDir() {
  return path.join(__dirname, '../../temp');
}

/**
 * 获取指定房间的工作目录
 *
 * 为什么要单独封装：
 * 后面 createFile、deleteFile、executeCode 都要用 roomDir。
 * 统一从这里拿，可以避免路径写散。
 */
function getRoomDir(roomId) {
  return path.join(getTempDir(), roomId);
}

/**
 * 确保房间目录存在
 *
 * 为什么要这样改：
 * 用户第一次进入房间时，后端必须自动创建目录。
 */
function ensureRoomDir(roomId) {
  const tempDir = getTempDir();
  const roomDir = getRoomDir(roomId);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  if (!fs.existsSync(roomDir)) {
    fs.mkdirSync(roomDir, { recursive: true });
  }

  return roomDir;
}

/**
 * 创建/恢复房间会话
 *
 * 为什么放在 roomService：
 * /api/join 的本质不是“登录系统账号”，而是进入一个协作房间。
 * 所以这里负责校验房间参数，并确保房间目录存在。
 */
function createRoomSession({ username, roomId }) {
  const cleanUsername = String(username || '').trim();
  const cleanRoomId = String(roomId || '').trim();

  if (!cleanUsername || !cleanRoomId) {
    return {
      success: false,
      status: 400,
      message: '请输入昵称和房间号',
    };
  }

  ensureRoomDir(cleanRoomId);

  return {
    success: true,
    username: cleanUsername,
    roomId: cleanRoomId,
  };
}


module.exports = {
  getTempDir,
  getRoomDir,
  ensureRoomDir,
  createRoomSession,
};