import type { PoolClient } from 'pg';

import { query } from '../db/pool.js';

export async function loadSnapshot(roomId: string): Promise<Uint8Array | null> {
  const result = await query<{ snapshot: Buffer }>(
    'SELECT snapshot FROM yjs_snapshots WHERE room_id = $1',
    [roomId],
  );
  return result.rows[0] ? new Uint8Array(result.rows[0].snapshot) : null;
}

export async function saveSnapshot(
  client: PoolClient,
  roomId: string,
  snapshot: Uint8Array,
  stateVector: Uint8Array,
): Promise<number> {
  const result = await client.query<{ version: string }>(
    `INSERT INTO yjs_snapshots (room_id, snapshot, state_vector, version)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (room_id) DO UPDATE SET
       snapshot = EXCLUDED.snapshot,
       state_vector = EXCLUDED.state_vector,
       version = yjs_snapshots.version + 1,
       updated_at = NOW()
     RETURNING version`,
    [roomId, Buffer.from(snapshot), Buffer.from(stateVector)],
  );
  return Number(result.rows[0]?.version ?? 1);
}
