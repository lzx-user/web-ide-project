import { Router } from 'express';

import authMiddleware from '../middlewares/authMiddleware.js';
import { ensureRoomDir } from '../services/roomService.js';
import { saveCodeToFile } from '../services/codeService.js';

const router = Router();

router.post('/api/save', authMiddleware, (req, res) => {
  const { code, filename } = req.body as {
    code?: unknown;
    filename?: unknown;
  };
  const roomId = req.user.roomId;

  if (typeof filename !== 'string' || typeof code !== 'string') {
    res.status(400).json({ success: false, message: '文件名或代码内容无效' });
    return;
  }

  try {
    const result = saveCodeToFile({
      roomDir: ensureRoomDir(roomId),
      filename,
      code,
    });

    if (!result.success) {
      res.status(result.status).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    res.status(500).json({ success: false, message });
  }
});

export default router;
