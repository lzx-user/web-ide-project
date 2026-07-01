const fs = require('fs');
const path = require('path');

const { getTempDir } = require('./roomService');
const {
  getOnlineUsers,
  getRunRecords,
  getSaveRecords,
} = require('./adminMemory');

function formatTime(date) {
  if (!date) return '-';
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();

  if (['.js', '.jsx'].includes(ext)) return 'JavaScript';
  if (ext === '.css') return 'CSS';
  if (ext === '.json') return 'JSON';
  if (ext === '.html') return 'HTML';
  if (ext === '.md') return 'Markdown';

  return 'Other';
}

function walkFiles(roomId, dir, basePath = '') {
  if (!fs.existsSync(dir)) return [];

  const result = [];

  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      result.push(...walkFiles(roomId, fullPath, relativePath));
      return;
    }

    const stat = fs.statSync(fullPath);

    result.push({
      id: `${roomId}-${relativePath}`,
      filename: relativePath,
      type: getFileType(relativePath),
      roomId,
      size: formatSize(stat.size),
      updateTime: formatTime(stat.mtime),
      owner: '-',
    });
  });

  return result;
}

function getRooms() {
  const tempDir = getTempDir();

  if (!fs.existsSync(tempDir)) return [];

  const users = getOnlineUsers();

  return fs
    .readdirSync(tempDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry, index) => {
      const roomId = entry.name;
      const roomDir = path.join(tempDir, roomId);
      const stat = fs.statSync(roomDir);
      const files = walkFiles(roomId, roomDir);

      const roomUsers = users.filter((user) => user.roomId === roomId);
      const onlineCount = roomUsers.filter(
        (user) => user.status === 'online'
      ).length;

      return {
        id: index + 1,
        roomId,
        owner: roomUsers[0]?.username || '-',
        onlineCount,
        fileCount: files.length,
        status: onlineCount > 0 ? 'active' : 'idle',
        createTime: formatTime(stat.birthtime),
        lastActive: formatTime(stat.mtime),
      };
    })
    .sort((a, b) => {
      // 活跃房间排在前面
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }

      // 最近活跃时间新的排在前面
      return new Date(b.lastActive) - new Date(a.lastActive);
    });
}

function getFiles() {
  const tempDir = getTempDir();

  if (!fs.existsSync(tempDir)) return [];

  return fs
    .readdirSync(tempDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const roomId = entry.name;
      const roomDir = path.join(tempDir, roomId);

      return walkFiles(roomId, roomDir);
    });
}

function isToday(timeText) {
  const today = new Date().toISOString().slice(0, 10);
  return String(timeText || '').startsWith(today);
}

function filterList(list, query, fields = []) {
  const keyword = String(query.keyword || '')
    .trim()
    .toLowerCase();
  const status = query.status || 'all';
  const type = query.type || 'all';

  let result = [...list];

  if (keyword) {
    result = result.filter((item) =>
      fields.some((field) =>
        String(item[field] || '')
          .toLowerCase()
          .includes(keyword)
      )
    );
  }

  if (status !== 'all') {
    result = result.filter((item) => item.status === status);
  }

  if (type !== 'all') {
    result = result.filter((item) => item.type === type);
  }

  return result;
}

function paginate(list, query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 10);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    list: list.slice(start, end),
    total: list.length,
    page,
    pageSize,
  };
}

function getOverview() {
  const users = getOnlineUsers();
  const rooms = getRooms();
  const files = getFiles();
  const runs = getRunRecords();
  const saves = getSaveRecords();

  const todayRuns = runs.filter((item) => isToday(item.runTime)).length;
  const todaySaves = saves.filter((item) => isToday(item.saveTime)).length;

  const successRuns = runs.filter((item) => item.status === 'success').length;
  const failedRuns = runs.filter((item) => item.status === 'failed').length;

  // 没有运行记录时，成功率和失败率都应该是 0
  // 否则页面会误显示“失败率 100%”，看起来像系统全失败
  const successRate = runs.length
    ? Math.round((successRuns / runs.length) * 100)
    : 0;
  const failedRate = runs.length
    ? Math.round((failedRuns / runs.length) * 100)
    : 0;

  return {
    statistics: [
      {
        title: '总用户数',
        value: users.length,
        desc: '累计加入 Web IDE 的用户数量',
        color: 'primary',
        progress: Math.min(users.length * 10, 100),
      },
      {
        title: '在线房间数',
        value: rooms.filter((room) => room.status === 'active').length,
        desc: '当前正在协作编辑的房间',
        color: 'success',
        progress: Math.min(rooms.length * 20, 100),
      },
      {
        title: '今日运行次数',
        value: todayRuns,
        desc: '今日代码运行请求次数',
        color: 'warning',
        progress: Math.min(todayRuns * 10, 100),
      },
      {
        title: '今日保存次数',
        value: todaySaves,
        desc: '今日代码保存操作次数',
        color: 'info',
        progress: Math.min(todaySaves * 10, 100),
      },
    ],
    activeRooms: rooms.slice(0, 5),
    runRecords: runs.slice(0, 5),
    charts: {
      successRate,
      failedRate,
    },
  };
}

function listUsers(query) {
  const list = filterList(getOnlineUsers(), query, ['username', 'roomId']);
  return paginate(list, query);
}

function listRooms(query) {
  const list = filterList(getRooms(), query, ['roomId', 'owner']);
  return paginate(list, query);
}

function listFiles(query) {
  const list = filterList(getFiles(), query, ['filename', 'roomId']);
  return paginate(list, query);
}

function listRuns(query) {
  const list = filterList(getRunRecords(), query, ['roomId', 'filename']);
  return paginate(list, query);
}

module.exports = {
  getOverview,
  listUsers,
  listRooms,
  listFiles,
  listRuns,
};
