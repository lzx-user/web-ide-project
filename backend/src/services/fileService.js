const fs = require('fs');
const path = require('path');
const { safeResolve } = require('../utils/safePath');

/**
 * 生成前端侧边栏需要的文件树
 *
 * 为什么放到 service：
 * Socket 初次连接、新建文件、删除文件后都要重新广播文件树。
 * 抽出来后 workspaceSocket.js 就不用关心具体怎么扫描目录。
 */
function buildFileTree(dir, basePath = '') {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => {
    const entryPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: relativePath,
        type: 'folder',
        children: buildFileTree(entryPath, relativePath),
      };
    }

    return {
      name: entry.name,
      path: relativePath,
      type: 'file',
    };
  });
}

/**
 * 创建文件或文件夹
 *
 * 为什么必须走 safeResolve：
 * Web IDE 允许用户输入文件路径，必须防止 ../../ 目录穿越。
 */
function createWorkspaceEntry(roomDir, filename, isFolder) {
  const { normalizedPath, resolvedPath } = safeResolve(roomDir, filename);

  if (fs.existsSync(resolvedPath)) {
    return {
      success: false,
      msg: '文件或文件夹已存在',
    };
  }

  if (isFolder) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  } else {
    const parentDir = path.dirname(resolvedPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, '', 'utf8');
  }

  return {
    success: true,
    cleaned: normalizedPath,
  };
}

/**
 * 删除文件或文件夹
 *
 * 为什么用 rmSync recursive：
 * 你的侧边栏既能删文件，也可能删文件夹。
 */
function deleteWorkspaceEntry(roomDir, filename) {
  const { resolvedPath } = safeResolve(roomDir, filename);

  if (!fs.existsSync(resolvedPath)) {
    return {
      success: false,
      msg: '文件不存在',
    };
  }

  fs.rmSync(resolvedPath, {
    recursive: true,
    force: true,
  });

  return {
    success: true,
  };
}

module.exports = {
  buildFileTree,
  createWorkspaceEntry,
  deleteWorkspaceEntry,
};