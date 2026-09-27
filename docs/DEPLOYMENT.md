# 生产部署与恢复说明

## PostgreSQL

在 Supabase、Neon 或 Render PostgreSQL 创建数据库，连接串只供后端使用。部署前执行：

```bash
cd backend
DATABASE_URL='postgresql://...' DATABASE_SSL=true npm run db:migrate
```

迁移创建 `rooms`、`room_files`、`yjs_snapshots` 及索引。发布前先做数据库快照；恢复时先恢复 PostgreSQL，再启动后端，Y.Doc 会在房间首次连接时加载快照。

## Render 后端

- Root Directory：`backend`
- Build Command：`npm ci && npm run build`
- Start Command：`npm start`
- Health Check：`/api/health`

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=<Render 注入>
CORS_ORIGIN=https://<前端域名>
JWT_SECRET=<至少 32 位随机值>
JWT_EXPIRES=24h
DATABASE_URL=<平台 Secret>
DATABASE_SSL=true
ENABLE_CODE_EXECUTION=false
ENABLE_TERMINAL=false
```

## Vercel / Netlify 前端

- Root Directory：`frontend`
- Build Command：`npm run build`
- Output Directory：`dist`

```text
VITE_API_BASE_URL=https://<后端域名>/api
VITE_WS_URL=https://<后端域名>
VITE_YJS_URL=wss://<后端域名>/yjs
VITE_ENABLE_TERMINAL=false
VITE_ENABLE_CODE_EXECUTION=false
VITE_ENABLE_AI=false
```

## 上线验收

用两个无痕窗口连续做三次：创建房间、错误口令拒绝、正确加入、创建目录/文件、同时编辑、远程光标、Cmd/Ctrl+S、刷新恢复。让一端离线编辑 30 秒再联网确认合并；重启后端并清空第三个浏览器缓存确认恢复；删除并同名重建确认旧内容不复活。

最后确认 `/api/health` 的 `database=connected`、`codeExecution=disabled`、`terminal=disabled`，且日志中没有 Token、accessCode、连接串或 AI Key。
