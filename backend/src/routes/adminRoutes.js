const router = require('express').Router()
const jwt = require('jsonwebtoken')

const config = require('../../config')
const adminAuthMiddleware = require('../middlewares/adminAuthMiddleware')
const adminService = require('../services/adminService')

router.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456'

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({
      success: false,
      message: '管理员账号或密码错误',
    })
  }

  const token = jwt.sign(
    {
      username,
      role: 'admin',
    },
    config.jwt.secret,
    {
      expiresIn: '2h',
    }
  )

  return res.json({
    success: true,
    message: '管理员登录成功',
    token,
  })
})

router.get('/api/admin/overview', adminAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    data: adminService.getOverview(),
  })
})

router.get('/api/admin/users', adminAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    data: adminService.listUsers(req.query),
  })
})

router.get('/api/admin/rooms', adminAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    data: adminService.listRooms(req.query),
  })
})

router.get('/api/admin/files', adminAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    data: adminService.listFiles(req.query),
  })
})

router.get('/api/admin/runs', adminAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    data: adminService.listRuns(req.query),
  })
})

module.exports = router