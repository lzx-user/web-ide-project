import type { PoolClient } from 'pg';

import { query, transaction } from '../db/pool.js';

export type RoomRecord = {
  id: string;
  accessCodeHash: string;
  status: 'active' | 'frozen';
};

export async function createRoomRecord(
  id: string,
  accessCodeHash: string,
  initialFile: { id: string; documentKey: string },
): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      'INSERT INTO rooms (id, access_code_hash) VALUES ($1, $2)',
      [id, accessCodeHash],
    );
    await client.query(
      `INSERT INTO room_files (id, room_id, name, path, type, document_key)
       VALUES ($1, $2, 'index.js', 'index.js', 'file', $3)`,
      [initialFile.id, id, initialFile.documentKey],
    );
  });
}

export async function findRoom(id: string): Promise<RoomRecord | null> {
  const result = await query<{
    id: string;
    access_code_hash: string;
    status: 'active' | 'frozen';
  }>('SELECT id, access_code_hash, status FROM rooms WHERE id = $1', [id]);
  const row = result.rows[0];
  return row ? { id: row.id, accessCodeHash: row.access_code_hash, status: row.status } : null;
}

export async function markRoomSaved(
  client: PoolClient,
  roomId: string,
): Promise<Date> {
  const result = await client.query<{ last_saved_at: Date }>(
    `UPDATE rooms SET last_saved_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING last_saved_at`,
    [roomId],
  );
  if (!result.rows[0]) throw new Error('房间不存在');
  return result.rows[0].last_saved_at;
}
