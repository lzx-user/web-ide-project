// 这个文件用来保存管理后台需要的运行时数据
// 注意：当前是内存版，重启后端后数据会清空
// 后续如果接数据库，可以把这里换成 MySQL / MongoDB

const onlineUsers = new Map();
const socketUserMap = new Map();
const runRecords = [];
const saveRecords = [];

function formatTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// 用户连接时记录在线用户
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

// 用户断开时，把对应用户标记为离线
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

// 更新用户最近活跃时间
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

// 记录代码运行日志
function addRunRecord({ roomId, username, filename, exitCode, duration }) {
  const finalExitCode = Number(exitCode);

  const record = {
    id: Date.now(),
    roomId,
    username,
    filename: filename || '临时代码',
    language: 'JavaScript',
    status: finalExitCode === 0 ? 'success' : 'failed',
    exitCode: Number.isNaN(finalExitCode) ? exitCode : finalExitCode,
    duration: `${(duration / 1000).toFixed(2)}s`,
    runTime: formatTime(),
  };

  runRecords.unshift(record);

  if (runRecords.length > 200) {
    runRecords.pop();
  }

  console.log('[管理后台运行记录] 已写入：', record);
  console.log('[管理后台运行记录] 当前总数：', runRecords.length);
}

// 记录保存日志
function addSaveRecord({ roomId, username, filename }) {
  const record = {
    id: Date.now(),
    roomId,
    username,
    filename,
    saveTime: formatTime(),
  };

  saveRecords.unshift(record);

  if (saveRecords.length > 200) {
    saveRecords.pop();
  }

  console.log('[管理后台保存记录] 已写入：', record);
  console.log('[管理后台保存记录] 当前总数：', saveRecords.length);
}

function getOnlineUsers() {
  return Array.from(onlineUsers.values());
}

function getRunRecords() {
  return runRecords;
}

function getSaveRecords() {
  return saveRecords;
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
