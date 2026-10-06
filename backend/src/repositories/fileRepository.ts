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
    if (Number(count.rows[0]?.count ?? 0) >= config.limits.maxFilesPerRoom) {
      throw new Error('房间文件数量已达上限');
    }
    const parentId = await findParent(client, roomId, normalizedPath);
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
