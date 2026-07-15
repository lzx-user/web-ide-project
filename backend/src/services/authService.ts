import jwt, { type SignOptions } from 'jsonwebtoken';

import config from '../../config.js';

export type RoomTokenPayload = {
  username: string;
  roomId: string;
};

export function signRoomToken(payload: RoomTokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  });
}
