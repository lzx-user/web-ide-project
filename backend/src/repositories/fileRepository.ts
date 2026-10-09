import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { PoolClient } from 'pg';

import config from '../../config.js';
import { query, transaction } from '../db/pool.js';

export type FileTreeNode = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  documentKey?: string;
  children?: FileTreeNode[];
};

type FileRow = {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
  type: 'file' | 'folder';
  document_key: string | null;
};

export function normalizeWorkspacePath(input: string): string {
  const normalized = path.posix.normalize(String(input).trim().replace(/\\/g, '/').replace(/\/+/g, '/'));
  const depth = normalized.split('/').filter(Boolean).length;
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error('文件路径无效或越界');
  }
  if (normalized.length > config.limits.maxPathLength) throw new Error('文件路径过长');
  if (depth > config.limits.maxDirectoryDepth) throw new Error('目录层级过深');
  return normalized;
}

export async function listRoomFiles(roomId: string): Promise<FileTreeNode[]> {
  const result = await query<FileRow>(
    `SELECT id, parent_id, name, path, type, document_key
     FROM room_files WHERE room_id = $1 AND deleted_at IS NULL ORDER BY path`,
    [roomId],
  );
  const nodes = new Map<string, FileTreeNode>();
  const roots: FileTreeNode[] = [];
  for (const row of result.rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      path: row.path,
      type: row.type,
      ...(row.document_key ? { documentKey: row.document_key } : {}),
      ...(row.type === 'folder' ? { children: [] } : {}),
    });
  }
  for (const row of result.rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parent_id ? nodes.get(row.parent_id) : null;
    if (parent?.children) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

async function findParent(client: PoolClient, roomId: string, filePath: string) {
  const parentPath = path.posix.dirname(filePath);
  if (parentPath === '.') return null;
  const result = await client.query<{ id: string; type: string }>(
    `SELECT id, type FROM room_files
     WHERE room_id = $1 AND path = $2 AND deleted_at IS NULL`,
    [roomId, parentPath],
  );
  if (result.rows[0]?.type !== 'folder') throw new Error('父目录不存在');
  return result.rows[0].id;
}

export async function createRoomFile(roomId: string, inputPath: string, isFolder: boolean) {
  const normalizedPath = normalizeWorkspacePath(inputPath);
  return transaction(async (client) => {
    const count = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM room_files WHERE room_id = $1 AND deleted_at IS NULL',
      [roomId],
    );

    const pathParts = normalizedPath.split('/');
    const parentPaths = pathParts.slice(0, -1).map((_, index) => pathParts.slice(0, index + 1).join('/'));
    const lookupPaths = [...parentPaths, normalizedPath];
    const existing = await client.query<{ id: string; path: string; type: 'file' | 'folder' }>(
      `SELECT id, path, type FROM room_files
       WHERE room_id = $1 AND path = ANY($2::text[]) AND deleted_at IS NULL`,
      [roomId, lookupPaths],
    );
    const existingByPath = new Map(existing.rows.map((row) => [row.path, row]));
    if (existingByPath.has(normalizedPath)) throw new Error('目标路径已存在');

    const missingParentCount = parentPaths.filter((parentPath) => !existingByPath.has(parentPath)).length;
    if (Number(count.rows[0]?.count ?? 0) + missingParentCount + 1 > config.limits.maxFilesPerRoom) {
      throw new Error('房间文件数量已达上限');
    }

    let parentId: string | null = null;
    for (const parentPath of parentPaths) {
      const parent = existingByPath.get(parentPath);
      if (parent) {
        if (parent.type !== 'folder') throw new Error(`父路径不是文件夹: ${parentPath}`);
        parentId = parent.id;
        continue;
      }
      const folderId = randomUUID();
      await client.query(
        `INSERT INTO room_files (id, room_id, parent_id, name, path, type, document_key)
         VALUES ($1, $2, $3, $4, $5, 'folder', NULL)`,
        [folderId, roomId, parentId, path.posix.basename(parentPath), parentPath],
      );
      parentId = folderId;
    }

    const id = randomUUID();
    const documentKey = isFolder ? null : randomUUID();
    await client.query(
      `INSERT INTO room_files (id, room_id, parent_id, name, path, type, document_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, roomId, parentId, path.posix.basename(normalizedPath), normalizedPath, isFolder ? 'folder' : 'file', documentKey],
    );
    return { normalizedPath, documentKey };
  });
}

export async function deleteRoomFile(roomId: string, inputPath: string) {
  const normalizedPath = normalizeWorkspacePath(inputPath);
  return transaction(async (client) => {
    const target = await client.query<{ id: string }>(
      `SELECT id FROM room_files WHERE room_id = $1 AND path = $2 AND deleted_at IS NULL`,
      [roomId, normalizedPath],
    );
    if (!target.rows[0]) throw new Error('文件不存在');
    const deleted = await client.query<{ document_key: string | null; path: string }>(
      `UPDATE room_files SET deleted_at = NOW(), updated_at = NOW()
       WHERE room_id = $1 AND deleted_at IS NULL
         AND (path = $2 OR LEFT(path, LENGTH($2) + 1) = $2 || '/')
       RETURNING document_key, path`,
      [roomId, normalizedPath],
    );
    return {
      normalizedPath,
      documentKeys: deleted.rows.flatMap((row) => row.document_key ? [row.document_key] : []),
      deletedPaths: deleted.rows.map((row) => row.path),
    };
  });
}

export async function moveRoomFile(roomId: string, sourceInput: string, targetInput: string) {
  const sourcePath = normalizeWorkspacePath(sourceInput);
  const targetPath = normalizeWorkspacePath(targetInput);
  if (sourcePath === targetPath) throw new Error('新路径与原路径相同');
  if (targetPath.startsWith(`${sourcePath}/`)) throw new Error('不能将文件夹移动到自身内部');

  return transaction(async (client) => {
    const target = await client.query<{ id: string; type: 'file' | 'folder' }>(
      `SELECT id, type FROM room_files
       WHERE room_id = $1 AND path = $2 AND deleted_at IS NULL`,
      [roomId, sourcePath],
    );
    if (!target.rows[0]) throw new Error('文件不存在');
    const duplicate = await client.query<{ id: string }>(
      `SELECT id FROM room_files
       WHERE room_id = $1 AND path = $2 AND deleted_at IS NULL`,
      [roomId, targetPath],
    );
    if (duplicate.rows[0]) throw new Error('目标路径已存在');
    const parentId = await findParent(client, roomId, targetPath);
    const affected = await client.query<{ path: string }>(
      `SELECT path FROM room_files
       WHERE room_id = $1 AND deleted_at IS NULL
         AND (path = $2 OR LEFT(path, LENGTH($2) + 1) = $2 || '/')
       ORDER BY LENGTH(path)`,
      [roomId, sourcePath],
    );

    await client.query(
      `UPDATE room_files
       SET path = CASE
             WHEN path = $2 THEN $3
             ELSE $3 || SUBSTRING(path FROM LENGTH($2) + 1)
           END,
           name = CASE WHEN path = $2 THEN $4 ELSE name END,
           parent_id = CASE WHEN path = $2 THEN $5 ELSE parent_id END,
           updated_at = NOW()
       WHERE room_id = $1 AND deleted_at IS NULL
         AND (path = $2 OR LEFT(path, LENGTH($2) + 1) = $2 || '/')`,
      [roomId, sourcePath, targetPath, path.posix.basename(targetPath), parentId],
    );

    return {
      sourcePath,
      targetPath,
      movedPaths: affected.rows.map(({ path: oldPath }) => ({
        oldPath,
        newPath: oldPath === sourcePath ? targetPath : `${targetPath}${oldPath.slice(sourcePath.length)}`,
      })),
    };
  });
}
