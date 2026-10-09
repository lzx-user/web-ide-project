import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import { query, transaction } from '../db/pool.js';

type VersionFileRow = {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
  type: 'file' | 'folder';
  document_key: string | null;
};

export type WorkspaceVersionSummary = {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
};

export async function listWorkspaceVersions(roomId: string): Promise<WorkspaceVersionSummary[]> {
  const result = await query<{ id: string; label: string; created_by: string; created_at: Date }>(
    `SELECT id, label, created_by, created_at
     FROM workspace_versions WHERE room_id = $1
     ORDER BY created_at DESC LIMIT 30`,
    [roomId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createWorkspaceVersion(
  roomId: string,
  createdBy: string,
  labelInput: string,
  snapshot: Uint8Array,
): Promise<WorkspaceVersionSummary> {
  const label = labelInput.trim().slice(0, 40) || '手动快照';
  return transaction(async (client) => {
    const files = await client.query<VersionFileRow>(
      `SELECT id, parent_id, name, path, type, document_key
       FROM room_files WHERE room_id = $1 AND deleted_at IS NULL ORDER BY path`,
      [roomId],
    );
    const id = randomUUID();
    const inserted = await client.query<{ created_at: Date }>(
      `INSERT INTO workspace_versions (id, room_id, label, created_by, snapshot, file_tree)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING created_at`,
      [id, roomId, label, createdBy, Buffer.from(snapshot), JSON.stringify(files.rows)],
    );
    await client.query(
      `DELETE FROM workspace_versions WHERE room_id = $1 AND id NOT IN (
         SELECT id FROM workspace_versions WHERE room_id = $1 ORDER BY created_at DESC LIMIT 30
       )`,
      [roomId],
    );
    return { id, label, createdBy, createdAt: inserted.rows[0]!.created_at.toISOString() };
  });
}

export async function restoreWorkspaceVersionFiles(roomId: string, versionId: string) {
  return transaction(async (client) => {
    const version = await client.query<{ snapshot: Buffer; file_tree: VersionFileRow[] }>(
      `SELECT snapshot, file_tree FROM workspace_versions WHERE id = $1 AND room_id = $2`,
      [versionId, roomId],
    );
    const row = version.rows[0];
    if (!row) throw new Error('版本不存在');

    await client.query(
      'UPDATE room_files SET deleted_at = NOW(), updated_at = NOW() WHERE room_id = $1 AND deleted_at IS NULL',
      [roomId],
    );
    for (const file of row.file_tree) {
      await restoreFileRow(client, roomId, file);
    }
    return new Uint8Array(row.snapshot);
  });
}

async function restoreFileRow(client: PoolClient, roomId: string, file: VersionFileRow) {
  await client.query(
    `INSERT INTO room_files (id, room_id, parent_id, name, path, type, document_key, deleted_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW())
     ON CONFLICT (id) DO UPDATE SET
       parent_id = EXCLUDED.parent_id,
       name = EXCLUDED.name,
       path = EXCLUDED.path,
       type = EXCLUDED.type,
       document_key = EXCLUDED.document_key,
       deleted_at = NULL,
       updated_at = NOW()`,
    [file.id, roomId, file.parent_id, file.name, file.path, file.type, file.document_key],
  );
}
