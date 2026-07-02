const {
  initAdminDb,
  addRunRecordToDb,
  addSaveRecordToDb,
  getRunRecordsFromDb,
  getSaveRecordsFromDb,
} = require('./adminDb');

/**
 * 管理后台运行时数据模块
 *
 * 改造说明：
 * 1. 在线用户 onlineUsers 继续使用 Map 保存，因为它是实时状态。
 * 2. 运行记录 runRecords 改为写入 SQLite 数据库。
 * 3. 保存记录 saveRecords 改为写入 SQLite 数据库。
 * 4. 对外暴露的函数名保持不变，避免 workspaceSocket / codeRoutes / adminService 大面积修改。
 */

// 启动时初始化 SQLite 表
initAdminDb();

const onlineUsers = new Map();
const socketUserMap = new Map();

function formatTime(date = new Date()) {
  const targetDate = new Date(date);

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(targetDate);

  const getPart = (type) => {
    return parts.find((item) => item.type === type)?.value;
  };

  return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

function markUserOnline({ socketId, username, roomId }) {
  const userKey = `${roomId}:${username}`;

  socketUserMap.set(socketId, userKey);

  onlineUsers.set(userKey, {
    id: userKey,
    username,
    roomId,
    role: '协作者',
    status: 'online',
    joinTime: formatTime(),
    lastActive: formatTime(),
  });

  console.log('[管理后台用户记录] 用户上线：', {
    socketId,
    username,
    roomId,
  });
}

function markUserOffline(socketId) {
  const userKey = socketUserMap.get(socketId);

  if (!userKey) return;

  const user = onlineUsers.get(userKey);

  if (user) {
    onlineUsers.set(userKey, {
      ...user,
      status: 'offline',
      lastActive: formatTime(),
    });
  }

  socketUserMap.delete(socketId);

  console.log('[管理后台用户记录] 用户离线：', {
    socketId,
    userKey,
  });
}

function touchUser(socketId) {
  const userKey = socketUserMap.get(socketId);

  if (!userKey) return;

  const user = onlineUsers.get(userKey);

  if (!user) return;

  onlineUsers.set(userKey, {
    ...user,
    lastActive: formatTime(),
  });
}

function addRunRecord({ roomId, username, filename, exitCode, duration }) {
  const record = addRunRecordToDb({
    roomId,
    username,
    filename,
    exitCode,
    duration,
  });

  console.log('[管理后台运行记录] 已写入 SQLite：', record);

  return record;
}

function addSaveRecord({ roomId, username, filename }) {
  const record = addSaveRecordToDb({
    roomId,
    username,
    filename,
  });

  console.log('[管理后台保存记录] 已写入 SQLite：', record);

  return record;
}

function getOnlineUsers() {
  return Array.from(onlineUsers.values());
}

function getRunRecords() {
  return getRunRecordsFromDb();
}

function getSaveRecords() {
  return getSaveRecordsFromDb();
}

module.exports = {
  markUserOnline,
  markUserOffline,
  touchUser,
  addRunRecord,
  addSaveRecord,
  getOnlineUsers,
  getRunRecords,
  getSaveRecords,
};