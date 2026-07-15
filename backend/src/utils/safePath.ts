import path from 'node:path';

export type SafePathResult = {
  normalizedPath: string;
  resolvedPath: string;
};

/** 把用户输入的相对路径限制在当前房间目录中。 */
export function safeResolve(roomDir: string, userPath: string): SafePathResult {
  if (typeof userPath !== 'string' || userPath.trim() === '') {
    throw new Error('文件路径不能为空');
  }

  let normalizedPath = userPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  normalizedPath = path.posix.normalize(normalizedPath);

  if (
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    path.posix.isAbsolute(normalizedPath)
  ) {
    throw new Error('越界访问被拒绝');
  }

  const resolvedRoomDir = path.resolve(roomDir);
  const resolvedPath = path.resolve(resolvedRoomDir, normalizedPath);

  if (
    resolvedPath !== resolvedRoomDir &&
    !resolvedPath.startsWith(`${resolvedRoomDir}${path.sep}`)
  ) {
    throw new Error('越界访问被拒绝');
  }

  return { normalizedPath, resolvedPath };
}
