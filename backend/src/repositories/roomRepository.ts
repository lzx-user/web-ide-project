import type { PoolClient } from 'pg';

import type { WorkspaceRole } from '../auth/roles.js';
import { query, transaction } from '../db/pool.js';

export type RoomRecord = {
  id: string;
  accessCodeHash: string | null;
  status: 'active' | 'frozen';
};

export async function createRoomRecord(
  id: string,
  accessCodes: Array<{ role: WorkspaceRole; accessCodeHash: string }>,
  initialFile: { id: string; documentKey: string },
): Promise<void> {
  const editorHash = accessCodes.find((item) => item.role === 'editor')?.accessCodeHash;
  if (!editorHash) throw new Error('缺少编辑口令');
  await transaction(async (client) => {
    await client.query(
      'INSERT INTO rooms (id, access_code_hash) VALUES ($1, $2)',
      [id, editorHash],
    );
    for (const accessCode of accessCodes) {
      await client.query(
        `INSERT INTO room_access_codes (room_id, role, access_code_hash)
         VALUES ($1, $2, $3)`,
        [id, accessCode.role, accessCode.accessCodeHash],
      );
    }
    await client.query(
      `INSERT INTO room_files (id, room_id, name, path, type, document_key)
       VALUES ($1, $2, 'index.js', 'index.js', 'file', $3)`,
      [initialFile.id, id, initialFile.documentKey],
    );
  });
}

export async function listRoomAccessCodes(
  roomId: string,
): Promise<Array<{ role: WorkspaceRole; accessCodeHash: string }>> {
  const result = await query<{ role: WorkspaceRole; access_code_hash: string }>(
    'SELECT role, access_code_hash FROM room_access_codes WHERE room_id = $1',
    [roomId],
  );
  return result.rows.map((row) => ({ role: row.role, accessCodeHash: row.access_code_hash }));
}

export async function findRoom(id: string): Promise<RoomRecord | null> {
  const result = await query<{
    id: string;
    access_code_hash: string | null;
    status: 'active' | 'frozen';
  }>('SELECT id, access_code_hash, status FROM rooms WHERE id = $1', [id]);
  const row = result.rows[0];
  return row ? { id: row.id, accessCodeHash: row.access_code_hash, status: row.status } : null;
}

export async function markRoomSaved(client: PoolClient, roomId: string): Promise<Date> {
  const result = await client.query<{ last_saved_at: Date }>(
    `UPDATE rooms SET last_saved_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING last_saved_at`,
    [roomId],
  );
  if (!result.rows[0]) throw new Error('房间不存在');
  return result.rows[0].last_saved_at;
}
