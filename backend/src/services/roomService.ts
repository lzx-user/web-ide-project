import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { WorkspaceRole } from '../auth/roles.js';
import { createRoomRecord, findRoom, listRoomAccessCodes } from '../repositories/roomRepository.js';

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

async function hashAccessCode(accessCode: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(accessCode, salt, SCRYPT_KEY_LENGTH) as Buffer;
  return `scrypt:v1:${salt.toString('base64')}:${derived.toString('base64')}`;
}

async function verifyAccessCode(accessCode: string, encoded: string): Promise<boolean> {
  const [algorithm, version, saltText, hashText] = encoded.split(':');
  if (algorithm !== 'scrypt' || version !== 'v1' || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64');
  const actual = await scrypt(accessCode, Buffer.from(saltText, 'base64'), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeUsername(input: unknown): string {
  const username = String(input ?? '').trim();
  if (!username || username.length > 20) throw new Error('昵称需为 1-20 个字符');
  return username;
}

export async function createRoom(): Promise<{
  roomId: string;
  ownerAccessCode: string;
  editorAccessCode: string;
  viewerAccessCode: string;
}> {
  const roomId = randomUUID();
  const ownerAccessCode = randomBytes(12).toString('base64url');
  const editorAccessCode = randomBytes(12).toString('base64url');
  const viewerAccessCode = randomBytes(12).toString('base64url');
  await createRoomRecord(roomId, await Promise.all(([
    ['owner', ownerAccessCode],
    ['editor', editorAccessCode],
    ['viewer', viewerAccessCode],
  ] as const).map(async ([role, accessCode]) => ({
    role,
    accessCodeHash: await hashAccessCode(accessCode),
  }))), {
    id: randomUUID(),
    documentKey: randomUUID(),
  });
  return { roomId, ownerAccessCode, editorAccessCode, viewerAccessCode };
}

export async function authorizeRoomJoin(input: {
  username?: unknown;
  roomId?: unknown;
  accessCode?: unknown;
}): Promise<{ username: string; roomId: string; role: WorkspaceRole }> {
  const username = normalizeUsername(input.username);
  const roomId = String(input.roomId ?? '').trim();
  const accessCode = String(input.accessCode ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(roomId) || !accessCode) throw new Error('房间 ID 或访问口令无效');
  const room = await findRoom(roomId);
  if (!room || room.status !== 'active') throw new Error('房间不存在或已被冻结');

  const roleCodes = await listRoomAccessCodes(roomId);
  for (const candidate of roleCodes) {
    if (await verifyAccessCode(accessCode, candidate.accessCodeHash)) {
      return { username, roomId, role: candidate.role };
    }
  }
  if (room.accessCodeHash && await verifyAccessCode(accessCode, room.accessCodeHash)) {
    return { username, roomId, role: 'editor' };
  }
  throw new Error('访问口令错误');
}
