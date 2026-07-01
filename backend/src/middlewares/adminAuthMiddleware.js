const jwt = require('jsonwebtoken')
const config = require('../../config')

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || ''

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '缺少管理员 Token',
    })
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret)

    if (payload.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有管理员权限',
      })
    }

    req.admin = payload
    next()
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: '管理员登录已过期，请重新登录',
    })
  }
}

module.exports = adminAuthMiddleware