/**
 * 接口：用户加入房间
 * 签发 Token，后续 Socket 连接必须携带此 Token。
 */
const router = require('express').Router();
const jwt = require('jsonwebtoken');
// 引用配置文件中的 JWT 密钥与过期时间
const config = require('../config');

router.post('/api/join', (req, res) => {
  const { username, roomId } = req.body;
  if (!username || !roomId) {
    return res.status(400).json({
      success: false,
      message: '用户名和房间号不能为空'
    });
  }
  // 把用户名和房间号打包成一个对象，作为 JWT 的载荷 (Payload)
  const payload = {
    username,
    roomId,
  }
  // 引用配置中的密钥与过期时间 签发一个 Token
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

  // 把生成的 Token 和成功状态，通过 res.json() 返回给前端
  res.json({
    success: true,
    token,
    payload
  })
});

module.exports = router;