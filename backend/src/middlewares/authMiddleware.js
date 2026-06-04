const jwt = require('jsonwebtoken');
const config = require('../../config');

/**
 * HTTP JWT 鉴权中间件
 *
 * 为什么要单独抽出来：
 * 1. /api/save 这类接口不能只相信前端传来的 roomId。
 * 2. Token 里本来就包含 roomId / username，后端应该用 token 做身份依据。
 * 3. 后续如果加更多需要登录的接口，可以直接复用这个中间件。
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // 前端 request.js 会传：Authorization: Bearer xxx
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '缺少 Token，请重新登录',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);

    // 把 token 解析结果挂到 req.user，后面的路由直接用
    req.user = payload;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token 无效或已过期，请重新登录',
    });
  }
}

module.exports = authMiddleware;