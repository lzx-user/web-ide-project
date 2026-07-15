import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import config from '../../config.js';

export default function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, message: '缺少 Token，请重新登录' });
    return;
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret) as Express.Request['user'];
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token 无效或已过期' });
  }
}
