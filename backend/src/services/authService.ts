import jwt, { type SignOptions } from 'jsonwebtoken';

import config from '../../config.js';

export type RoomTokenPayload = {
  sessionId: string;
  username: string;
  roomId: string;
  role: 'owner' | 'editor';
};

export function signRoomToken(payload: RoomTokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  });
}

export function verifyRoomToken(token: string): RoomTokenPayload {
  const payload = jwt.verify(token, config.jwt.secret);
  if (
    typeof payload === 'string' ||
    typeof payload.sessionId !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.roomId !== 'string' ||
    (payload.role !== 'owner' && payload.role !== 'editor')
  ) throw new Error('Token 中缺少会话信息');
  return {
    sessionId: payload.sessionId,
    username: payload.username,
    roomId: payload.roomId,
    role: payload.role,
  };
}
