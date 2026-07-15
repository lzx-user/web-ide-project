import fs from 'node:fs';
import path from 'node:path';

import { safeResolve } from '../utils/safePath.js';

export type FileTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
};

export function buildFileTree(dir: string, basePath = ''): FileTreeNode[] {
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

    return { name: entry.name, path: relativePath, type: 'file' };
  });
}

export function createWorkspaceEntry(
  roomDir: string,
  filename: string,
  isFolder = false,
) {
  const { normalizedPath, resolvedPath } = safeResolve(roomDir, filename);

  if (fs.existsSync(resolvedPath)) {
    return { success: false as const, msg: '文件或文件夹已存在' };
  }

  if (isFolder) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, '', 'utf8');
  }

  return { success: true as const, cleaned: normalizedPath };
}

export function deleteWorkspaceEntry(roomDir: string, filename: string) {
  const { resolvedPath } = safeResolve(roomDir, filename);

  if (!fs.existsSync(resolvedPath)) {
    return { success: false as const, msg: '文件不存在' };
  }

  fs.rmSync(resolvedPath, { recursive: true, force: true });
  return { success: true as const };
}
