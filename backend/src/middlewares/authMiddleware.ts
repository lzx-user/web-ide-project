import type { NextFunction, Request, Response } from 'express';
import { canEditWorkspace } from '../auth/roles.js';
import { verifyRoomToken } from '../services/authService.js';

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
    req.user = verifyRoomToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token 无效或已过期' });
  }
}

export function requireWorkspaceEditor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!canEditWorkspace(req.user.role)) {
    res.status(403).json({ success: false, message: '当前为只读成员，无权执行此操作' });
    return;
  }
  next();
}
