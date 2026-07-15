import cors from 'cors';
import express from 'express';

import config from '../config.js';
import codeRoutes from './routes/codeRoutes.js';
import roomRoutes from './routes/roomRoutes.js';

/** 创建 Express 应用。这里只挂载 Web IDE 的核心接口。 */
export default function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      message: 'Web IDE backend is running',
    });
  });

  app.use('/', roomRoutes);
  app.use('/', codeRoutes);

  // 后台管理路由已移除。房间、保存、Socket.io 和 Yjs 不受影响。
  return app;
}
