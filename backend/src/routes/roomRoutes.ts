import { Router } from 'express';

import { signRoomToken } from '../services/authService.js';
import { createRoomSession } from '../services/roomService.js';

const router = Router();

router.post('/api/join', (req, res) => {
  const session = createRoomSession(req.body ?? {});

  if (!session.success) {
    res.status(session.status).json({
      success: false,
      message: session.message,
    });
    return;
  }

  res.json({
    success: true,
    message: '加入房间成功',
    token: signRoomToken({
      username: session.username,
      roomId: session.roomId,
    }),
    username: session.username,
    roomId: session.roomId,
  });
});

export default router;
