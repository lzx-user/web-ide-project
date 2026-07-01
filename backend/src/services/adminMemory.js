const onlineUsers = new Map()
const runRecords = []
const saveRecords = []

function formatTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function markUserOnline({ socketId, username, roomId }) {
  onlineUsers.set(socketId, {
    id: socketId,
    username,
    roomId,
    role: '协作者',
    status: 'online',
    joinTime: formatTime(),
    lastActive: formatTime(),
  })
}

function markUserOffline(socketId) {
  const user = onlineUsers.get(socketId)

  if (!user) return

  onlineUsers.set(socketId, {
    ...user,
    status: 'offline',
    lastActive: formatTime(),
  })
}

function touchUser(socketId) {
  const user = onlineUsers.get(socketId)

  if (!user) return

  onlineUsers.set(socketId, {
    ...user,
    lastActive: formatTime(),
  })
}

function addRunRecord({ roomId, username, filename, exitCode, duration }) {
  runRecords.unshift({
    id: Date.now(),
    roomId,
    username,
    filename: filename || '临时代码',
    language: 'JavaScript',
    status: exitCode === 0 ? 'success' : 'failed',
    exitCode,
    duration: `${(duration / 1000).toFixed(2)}s`,
    runTime: formatTime(),
  })

  if (runRecords.length > 200) {
    runRecords.pop()
  }
}

function addSaveRecord({ roomId, username, filename }) {
  saveRecords.unshift({
    id: Date.now(),
    roomId,
    username,
    filename,
    saveTime: formatTime(),
  })

  if (saveRecords.length > 200) {
    saveRecords.pop()
  }
}

function getOnlineUsers() {
  return Array.from(onlineUsers.values())
}

function getRunRecords() {
  return runRecords
}

function getSaveRecords() {
  return saveRecords
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
}