/**
 * 配置文件 - 集中管理应用程序的配置和敏感信息
 */

// 加载环境变量（从 .env 文件中读取）
require('dotenv').config();

// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 9.2 定义一个密钥，用于 JWT 的签名和验证（实际项目中请使用更安全的方式管理密钥）
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_here';

// 6. 后端引入 socket.io 建立长连接服务
// 6.2 改造地基：用原生的http模块包装express应用
// 6.3 把socket.io服务器绑定到这个http服务器上
// 允许跨域（因为前端 Vite 通常是 5173 端口，后端是 3000，必须允许跨域"来电"）
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// 服务器端口配置
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// 环境标识
const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  // JWT 配置
  jwt: {
    secret: JWT_SECRET,
    expiresIn: '24h' // 这个 Token 24小时后过期，过期后需要重新获取
  },

  // 服务器配置
  server: {
    port: PORT,
    host: HOST
  },

  // Socket.IO CORS 配置
  cors: {
    origin: CORS_ORIGIN
  },

  // 环境标识
  env: NODE_ENV,
  isProd: NODE_ENV === 'production'
};
