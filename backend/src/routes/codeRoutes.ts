import { Router } from 'express';

import authMiddleware from '../middlewares/authMiddleware.js';
import { flushRoomDocument } from '../yjs/yjsServer.js';

const router = Router();

router.post('/api/save', authMiddleware, async (req, res) => {
  try {
    const result = await flushRoomDocument(req.user.roomId);
    res.json({ success: true, message: '协同文档已持久化', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    res.status(500).json({ success: false, message });
  }
});

export default router;
