const fs = require('fs');
const path = require('path');

// 这个文件用来保存管理后台需要的运行时数据
// 优化版：在线用户仍然存在内存中，运行记录和保存记录持久化到 JSON 文件中
// 这样后端重启后，运行记录 / 保存记录不会丢失

const onlineUsers = new Map();
const socketUserMap = new Map();

// 持久化文件路径：放在 backend/temp/admin-records.json
// 你的 npm run dev 已经忽略 temp 目录，所以写入这个文件不会触发 nodemon 重启
const DATA_FILE = path.join(__dirname, '../../temp/admin-records.json');

function ensureDataFile() {
  const dataDir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          runRecords: [],
          saveRecords: [],
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

function loadPersistedData() {
  try {
    ensureDataFile();

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '{}');

    return {
      runRecords: Array.isArray(data.runRecords) ? data.runRecords : [],
      saveRecords: Array.isArray(data.saveRecords) ? data.saveRecords : [],
    };
  } catch (err) {
    console.log('[管理后台持久化] 读取记录失败，使用空数据：', err.message);

    return {
      runRecords: [],
      saveRecords: [],
    };
  }
}

function persistData() {
  try {
    ensureDataFile();

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          runRecords,
          saveRecords,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (err) {
    console.log('[管理后台持久化] 写入记录失败：', err.message);
  }
}

const persistedData = loadPersistedData();

const runRecords = persistedData.runRecords;
const saveRecords = persistedData.saveRecords;

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

function createRecordId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const finalExitCode = Number(exitCode);

  const record = {
    id: createRecordId(),
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

  persistData();

  console.log('[管理后台运行记录] 已写入：', record);
  console.log('[管理后台运行记录] 当前总数：', runRecords.length);
}

function addSaveRecord({ roomId, username, filename }) {
  const record = {
    id: createRecordId(),
    roomId,
    username,
    filename,
    saveTime: formatTime(),
  };

  saveRecords.unshift(record);

  if (saveRecords.length > 200) {
    saveRecords.pop();
  }

  persistData();

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
