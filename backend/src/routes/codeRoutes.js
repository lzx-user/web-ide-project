const router = require('express').Router();

const authMiddleware = require('../middlewares/authMiddleware');
const { ensureRoomDir } = require('../services/roomService');
const { saveCodeToFile } = require('../services/codeService');
const { addSaveRecord } = require('../services/adminMemory');
/**
 * 接口：代码持久化保存
 *
 * 前端请求：
 * POST /api/save
 *
 * 为什么这里要加 authMiddleware：
 * 保存代码必须确认用户确实登录过，并且 token 合法。
 * 不能只相信前端传来的 roomId。
 */
router.post('/api/save', authMiddleware, (req, res) => {
  const { code, filename } = req.body;

  /**
   * roomId 优先使用 token 里的值
   *
   * 为什么不用 req.body.roomId：
   * 前端传来的 roomId 可以被篡改。
   * token 是 /api/join 后端签发的，更可信。
   */
  const roomId = req.user.roomId;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'Token 中缺少房间信息',
    });
  }

  try {
    const roomDir = ensureRoomDir(roomId);

    const result = saveCodeToFile({
      roomDir,
      filename,
      code,
    });

    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }

    console.log('[保存接口] 保存成功，准备写入保存记录：', {
      roomId,
      username: req.user.username,
      filename,
    });

    addSaveRecord({
      roomId,
      username: req.user.username,
      filename,
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `保存失败: ${err.message}`,
    });
  }
});

module.exports = router;
