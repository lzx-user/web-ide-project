const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

/**
 * 管理后台 SQLite 数据库模块
 *
 * 说明：
 * 1. 使用 Node.js 自带的 node:sqlite，不需要额外 npm install。
 * 2. 用 SQLite 保存运行记录和保存记录。
 * 3. 在线用户还是继续放在 adminMemory.js 的 Map 里，因为在线状态属于实时状态。
 */

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'web-ide-admin.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

function initAdminDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS run_records (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      username TEXT,
      filename TEXT,
      language TEXT DEFAULT 'JavaScript',
      status TEXT NOT NULL,
      exit_code INTEGER,
      duration_ms INTEGER,
      duration_text TEXT,
      run_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS save_records (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      username TEXT,
      filename TEXT NOT NULL,
      save_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function createRecordId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function addRunRecordToDb({ roomId, username, filename, exitCode, duration }) {
  const finalExitCode = Number(exitCode);
  const durationMs = Number(duration) || 0;
  const now = formatTime();

  const record = {
    id: createRecordId(),
    roomId,
    username: username || '-',
    filename: filename || '临时代码',
    language: 'JavaScript',
    status: finalExitCode === 0 ? 'success' : 'failed',
    exitCode: Number.isNaN(finalExitCode) ? null : finalExitCode,
    durationMs,
    durationText: `${(durationMs / 1000).toFixed(2)}s`,
    runTime: now,
    createdAt: now,
  };

  const stmt = db.prepare(`
    INSERT INTO run_records (
      id,
      room_id,
      username,
      filename,
      language,
      status,
      exit_code,
      duration_ms,
      duration_text,
      run_time,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.roomId,
    record.username,
    record.filename,
    record.language,
    record.status,
    record.exitCode,
    record.durationMs,
    record.durationText,
    record.runTime,
    record.createdAt,
  );

  return record;
}

function addSaveRecordToDb({ roomId, username, filename }) {
  const now = formatTime();

  const record = {
    id: createRecordId(),
    roomId,
    username: username || '-',
    filename,
    saveTime: now,
    createdAt: now,
  };

  const stmt = db.prepare(`
    INSERT INTO save_records (
      id,
      room_id,
      username,
      filename,
      save_time,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.roomId,
    record.username,
    record.filename,
    record.saveTime,
    record.createdAt,
  );

  return record;
}

function getRunRecordsFromDb() {
  return db
    .prepare(`
      SELECT
        id,
        room_id AS roomId,
        username,
        filename,
        language,
        status,
        exit_code AS exitCode,
        duration_text AS duration,
        run_time AS runTime
      FROM run_records
      ORDER BY created_at DESC
      LIMIT 200
    `)
    .all();
}

function getSaveRecordsFromDb() {
  return db
    .prepare(`
      SELECT
        id,
        room_id AS roomId,
        username,
        filename,
        save_time AS saveTime
      FROM save_records
      ORDER BY created_at DESC
      LIMIT 200
    `)
    .all();
}

module.exports = {
  initAdminDb,
  addRunRecordToDb,
  addSaveRecordToDb,
  getRunRecordsFromDb,
  getSaveRecordsFromDb,
};