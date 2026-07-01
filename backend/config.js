/**
 * 配置文件 - 集中管理应用程序配置与环境变量
 * 职责：
 * 1. 自动读取 .env 环境变量。
 * 2. 为全局提供统一的参数（JWT 密钥、端口、跨域地址）。
 */

// 加载环境变量（从 .env 文件中读取）
require('dotenv').config();

// 运行环境标识
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// JWT 相关配置
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

if (!JWT_SECRET) {
  throw new Error('缺少必要环境变量 JWT_SECRET，请在 backend/.env 或部署平台环境变量中配置');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET 长度过短，建议至少 32 位以上');
}

// 服务器运行配置
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// 跨域设置
// 开发环境：默认允许本地前端
// 生产环境：必须显式配置 CORS_ORIGIN，不能使用 *
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// 把 .env 里的 CORS_ORIGIN 转成数组
// 为什么要这样写：
// 1. 主 Web IDE 前端运行在 http://localhost:5173
// 2. 管理后台前端运行在 http://localhost:5174
// 3. 后端需要同时允许这两个前端访问，否则浏览器会因为 CORS 拦截请求
function parseCorsOrigin(originText) {
  return String(originText || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

if (isProd && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*')) {
  throw new Error('生产环境必须配置具体的 CORS_ORIGIN，不能使用 *');
}

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
    // 支持多个前端地址访问后端
    // 例如：http://localhost:5173,http://localhost:5174
    origin: parseCorsOrigin(CORS_ORIGIN),
  },
  env: {
    isProd: NODE_ENV === 'production',
    current: NODE_ENV
  }
};