import fs from 'node:fs';
import path from 'node:path';

type CreateRoomSessionInput = {
  username?: unknown;
  roomId?: unknown;
};

type RoomSessionResult =
  | { success: true; username: string; roomId: string }
  | { success: false; status: number; message: string };

export function getTempDir(): string {
  return path.join(__dirname, '../../temp');
}

export function getRoomDir(roomId: string): string {
  return path.join(getTempDir(), roomId);
}

export function ensureRoomDir(roomId: string): string {
  const tempDir = getTempDir();
  const roomDir = getRoomDir(roomId);

  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(roomDir, { recursive: true });
  return roomDir;
}

export function createRoomSession({
  username,
  roomId,
}: CreateRoomSessionInput): RoomSessionResult {
  const cleanUsername = String(username ?? '').trim();
  const cleanRoomId = String(roomId ?? '').trim();

  if (!cleanUsername || !cleanRoomId) {
    return {
      success: false,
      status: 400,
      message: '请输入昵称和房间号',
    };
  }

  // 房间号会成为目录名，因此只允许安全、易分享的字符。
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanRoomId)) {
    return {
      success: false,
      status: 400,
      message: '房间号只能包含字母、数字、下划线和短横线',
    };
  }

  ensureRoomDir(cleanRoomId);
  return { success: true, username: cleanUsername, roomId: cleanRoomId };
}
