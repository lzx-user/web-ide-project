const router = require('express').Router();

const { createRoomSession } = require('../services/roomService');
const { signRoomToken } = require('../services/authService');

/**
 * 加入协作房间
 *
 * 前端实际请求：
 * POST http://localhost:3000/api/join
 *
 * 为什么这里保留 /api/join：
 * 前端 axios baseURL 已经是 http://localhost:3000/api，
 * 前端调用 request.post('/join') 后，真实地址就是 /api/join。
 */
router.post('/api/join', (req, res) => {
  const { username, roomId } = req.body;

  try {
    const session = createRoomSession({
      username,
      roomId,
    });

    if (!session.success) {
      return res.status(session.status || 400).json({
        success: false,
        message: session.message,
      });
    }

    const token = signRoomToken({
      username: session.username,
      roomId: session.roomId,
    });

    return res.json({
      success: true,
      message: '加入房间成功',
      token,
      username: session.username,
      roomId: session.roomId,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `加入房间失败: ${err.message}`,
    });
  }
});

module.exports = router;