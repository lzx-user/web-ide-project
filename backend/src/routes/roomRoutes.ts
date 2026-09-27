import { randomUUID } from 'node:crypto';
import { Router } from 'express';

import { rateLimit } from '../middlewares/rateLimit.js';
import { signRoomToken } from '../services/authService.js';
import { authorizeRoomJoin, createRoom } from '../services/roomService.js';

const router = Router();

router.post('/api/rooms', rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'create-room' }), async (_req, res) => {
  try {
    res.status(201).json({ success: true, ...(await createRoom()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建房间失败';
    res.status(503).json({ success: false, message });
  }
});

router.post('/api/join', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'join' }), async (req, res) => {
  try {
    const session = await authorizeRoomJoin(req.body ?? {});
    const role = 'editor' as const;
    res.json({
      success: true,
      message: '加入房间成功',
      token: signRoomToken({ ...session, sessionId: randomUUID(), role }),
      ...session,
      role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '加入房间失败';
    res.status(401).json({ success: false, message });
  }
});

export default router;
