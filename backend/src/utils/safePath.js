const path = require('path');

/**
 * 将用户传入的相对路径安全地解析到 roomDir 内部。
 * 防止 ../、绝对路径、Windows 反斜杠等路径穿越问题。
 */

function safeResolve(roomDir, userPath) {
  if (typeof userPath !== 'string' || userPath.trim() === '') {
    throw new Error('文件路径不能为空');
  }

  // 1. 统一路径分隔符， 兼容 Windows 输入
  let normalizedPath = userPath.replace(/\\/g, '/').replace(/\/+/g, '/');

  // 2. 使用 POSIX 规则规范化，避免平台差异
  normalizedPath = path.posix.normalize(normalizedPath);

  // 3. 禁止绝对路径和向上越界
  if (
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    path.posix.isAbsolute(normalizedPath)
  ) {
    throw new Error('越界访问被拒绝');
  }

  // 4. 解析成物理路径
  const resolvedPath = path.resolve(roomDir, normalizedPath);
  const resolvedRoomDir = path.resolve(roomDir);

  // 5. 二次物理越界检查
  if (
    resolvedPath !== resolvedRoomDir &&
    !resolvedPath.startsWith(resolvedRoomDir + path.sep)
  ) {
    throw new Error('越界访问被拒绝');
  }

  return {
    normalizedPath,
    resolvedPath,
  };
}

module.exports = {
  safeResolve
};