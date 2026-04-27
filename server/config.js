/**
 * 配置文件 - 集中管理应用程序配置与环境变量
 * 职责：
 * 1. 自动读取 .env 环境变量。
 * 2. 为全局提供统一的参数（JWT 密钥、端口、跨域地址）。
 */

// 加载环境变量（从 .env 文件中读取）
require('dotenv').config();

// JWT 相关配置
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_here';
const JWT_EXPIRES = '24h';

// 服务器运行配置
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// 跨域设置：开发环境下建议设为 '*'，生产环境应设为具体的域名
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// 运行环境标识
const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  jwt: {
    secret: JWT_SECRET,
    expiresIn: JWT_EXPIRES
  },
  server: {
    port: PORT,
    host: HOST
  },
  cors: {
    origin: CORS_ORIGIN
  },
  env: {
    isProd: NODE_ENV === 'production',
    current: NODE_ENV
  }
};