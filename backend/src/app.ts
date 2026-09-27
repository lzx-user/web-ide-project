import cors from 'cors';
import express from 'express';

import config from '../config.js';
import { databaseHealth } from './db/pool.js';
import codeRoutes from './routes/codeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import roomRoutes from './routes/roomRoutes.js';

/** 创建 Express 应用。这里只挂载 Web IDE 的核心接口。 */
export default function createApp() {
  const app = express();
  if (config.env.isProd) app.set('trust proxy', 1);

  app.use(
    cors({
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const database = await databaseHealth();
    const healthy = database === 'connected';
    res.status(healthy ? 200 : 503).json({
      success: healthy,
      message: 'Web IDE backend is running',
      database,
      codeExecution: config.features.codeExecution ? 'development_only' : 'disabled',
      terminal: config.features.terminal ? 'development_only' : 'disabled',
    });
  });

  app.use('/', roomRoutes);
  app.use('/', codeRoutes);
  app.use('/', aiRoutes);

  // 后台管理路由已移除。房间、保存、Socket.io 和 Yjs 不受影响。
  return app;
}
