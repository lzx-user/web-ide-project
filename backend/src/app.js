const express = require('express');
const cors = require('cors');

const config = require('../config');
const roomRoutes = require('./routes/roomRoutes.js');
const codeRoutes = require('./routes/codeRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');

/**
 * 创建 Express 应用实例
 *
 * 为什么要单独拆 app.js：
 * 1. index.js 只负责启动服务，不再塞 HTTP 路由和中间件。
 * 2. 后续如果要加测试、加更多 routes，只需要改这里。
 * 3. Express HTTP 接口和 Socket.io 控制面职责分开，项目结构更清楚。
 */

function createApp() {
  const app = express();

  /**
   * 统一 CORS 配置
   *
   * 为什么不用 app.use(cors())：
   * 生产环境不能放开所有来源，否则任何网站都能请求你的后端接口。
   * 这里统一读取 config.cors.origin，和 Socket.io 使用同一套跨域规则。
   */
  app.use(
    cors({
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  /**
   * 解析 JSON 请求体
   *
   * 前端 request.post('/join')、request.post('/save') 发来的都是 JSON。
   */
  app.use(express.json());

  /**
   * 健康检查接口
   *
   * 用途：
   * 1. 本地确认后端是否启动。
   * 2. Render 这类平台也可以用它做服务检测。
   */
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Web IDE backend is running',
    });
  });

  /**
   * HTTP 路由挂载
   *
   * /api/join 会进入 roomRoutes
   * /api/save 会进入 codeRoutes
   */
  app.use('/', roomRoutes);
  app.use('/', codeRoutes);
  app.use('/', adminRoutes);
  return app;
}

module.exports = createApp;