# AGENTS.md

## 文档范围与当前状态

本文件描述当前仓库的真实结构和可执行约束。当前任务只建立项目规则，不要求也不允许借此修改页面或业务代码。

当前仓库包含两个实际应用目录：

- `frontend/`：React + TypeScript + Vite 前端。
- `backend/`：Node.js + Express + TypeScript 后端，同时承载 Socket.io 和 Yjs WebSocket。

根目录没有 `package.json`，因此安装、检查、构建和启动命令都必须在对应子目录执行。当前仓库没有 `vercel.json`、`render.yaml`、`netlify.toml` 或 `Dockerfile`；下文对这些平台的内容是“以后增加配置时必须遵守的规则”，不是对现有部署文件的描述。

## 技术栈与架构

### 前端

- 入口：`frontend/src/main.tsx`；应用编排：`frontend/src/App.tsx`。
- 构建：Vite（`frontend/vite.config.ts`），React、TypeScript、Tailwind Vite 插件。
- 编辑器：Monaco Editor（`@monaco-editor/react`）。
- 状态与工作区：Zustand、`frontend/src/hooks/`、`frontend/src/services/`、`frontend/src/store/`、`frontend/src/types/`、`frontend/src/utils/`。
- 实时协同：`socket.io-client` 负责业务事件；`y-websocket`、Yjs、`y-indexeddb`、`y-monaco` 负责文档同步、本地持久化和 Monaco 绑定。
- 请求：`frontend/src/services/request.ts` 使用 Axios，读取 `VITE_API_BASE_URL`，并从 `localStorage` 的 `ide_token` 添加 Bearer Token。

### 后端

- 入口：`backend/index.ts`；Express 应用：`backend/src/app.ts`；配置：`backend/config.ts`。
- HTTP API：`/api/health`、`POST /api/join`、受认证保护的 `POST /api/save`，路由位于 `backend/src/routes/`。
- 认证：JWT，配置和校验位于 `backend/config.ts` 与 `backend/src/middlewares/`；前端登录/加入流程位于 `frontend/src/hooks/useAuthSession.ts`。
- Socket.io：`backend/src/socket/workspaceSocket.ts`。它校验握手 JWT、加入房间、同步文件树，并处理创建文件、删除文件、执行代码等事件。
- Yjs：`backend/src/yjs/yjsServer.ts` 使用 `ws` 的 HTTP upgrade；`/socket.io` 会被排除，Yjs 连接使用 `/yjs/:roomId?token=...`，再交给 `y-websocket`。
- 代码执行：`backend/src/services/codeService.ts` 写入临时 `.js`/`.ts` 文件并调用 Node/tsx；`ENABLE_TERMINAL` 默认关闭。该执行方式不是面向不可信公网代码的安全沙箱。
- 可选终端：PTY 相关依赖和逻辑仍存在，但必须受 `ENABLE_TERMINAL` 控制，不能默认打开。

### 关键连接关系

1. `useAuthSession` 调用 `/api/join`，保存 room/token，并建立 Socket.io 连接。
2. `useWorkspaceSocket` 创建 Y.Doc、`IndexeddbPersistence` 和 `WebsocketProvider`，Yjs 地址来自 `VITE_YJS_URL`。
3. `useEditorBinding` 使用 `y-monaco` 把 Y.Text 与 Monaco model 绑定；组件卸载时必须销毁 provider、binding、监听器和本地持久化实例。
4. Socket.io 与 Yjs 共用后端 HTTP 服务和端口，但分别使用 `/socket.io` 与 `/yjs` 协议路径。

## 不允许破坏的业务功能

页面重构、类型迁移或依赖升级不得改变以下协议和行为：

- 加入工作区：`POST /api/join`、JWT 的 room 信息和前端 `ide_token` 持久化。
- 健康检查：`GET /api/health`。
- 保存代码：认证后的 `POST /api/save`。
- Socket.io 的连接认证、房间加入、文件树初始化，以及 `createFile`、`deleteFile`、`executeCode`、`initCodePackage` 和执行状态/输出事件（`executionStarted`、`codeOutput`、`codeError`、`executionFinished`）。
- Yjs 的 roomId、token 校验、`/yjs` WebSocket upgrade 和协同编辑。
- Monaco 编辑、文件树、保存、运行、重连和错误提示；终端在 `ENABLE_TERMINAL=false` 时必须保持关闭。
- 不得把服务端 JWT、数据库/管理员凭据或任何私密密钥发送到浏览器。

## 页面重构规则

- 只在用户明确要求时改动视觉或交互；优先小步修改现有 `frontend/src/` 组件和 hooks，不重写整个页面。
- 保留 `App.tsx` 的编排职责；Socket、Yjs、请求和编辑器生命周期继续放在现有 services/hooks 中，不把底层连接逻辑复制到页面组件。
- 不改 API 路径、Socket 事件名、Yjs URL 结构、localStorage key 或环境变量名，除非同时完成兼容迁移并补充验收说明。
- 每个实时资源都要有对称清理：Socket 监听、Yjs provider、Y.Doc、IndexedDB persistence、Monaco binding。
- 页面改动后至少手工验证：加入工作区、文件树、编辑器输入同步、保存、运行、断线重连、错误提示和终端开关。
- 本次“建立 AGENTS.md”任务不得修改页面、业务逻辑或依赖文件。

## AI 功能开发规则

当前仓库没有 AI 路由、AI service、OpenAI SDK、AI UI 或 AI 环境变量；`frontend/package.json` 和 `backend/package.json` 中也没有 OpenAI 依赖。不得把“AI 已存在”写进文档或演示。

以后增加 AI 功能时：

- AI 密钥只能放在后端环境变量，新增变量必须同步写入 `backend/.env.example`；禁止使用 `VITE_*` 暴露密钥，禁止把密钥提交到 Git。
- 通过后端受认证的 API 调用模型，校验输入长度、超时、错误和速率；不要让浏览器直连模型服务。
- 模型生成的代码或命令只能作为待确认内容展示，不能自动写入工作区、自动执行或绕过现有保存/执行权限。
- 保持 AI 与现有 Socket.io/Yjs 协同协议解耦；新增接口必须有清晰的类型、失败回退和可关闭开关。
- 在没有实际实现和验收前，不在 README、简历或 UI 中宣称 AI 功能完成。

## 测试、类型检查和构建命令

### backend/

```text
npm run typecheck   # tsc --noEmit
npm run build       # tsc，输出 dist/
npm run dev         # tsx watch index.ts
npm start            # node dist/index.js（先执行 npm run build）
npm test             # 当前只是占位脚本，会以失败退出，不是真实测试套件
```

### frontend/

```text
npm run typecheck   # tsc --noEmit
npm run build       # vite build
npm run lint        # eslint . --ext js,jsx ...
npm run dev         # vite
npm run preview     # vite preview
npm run format      # prettier --write ...
```

当前根目录没有统一脚本；不要在根目录猜测或添加未被请求的命令。

## 部署规则

### Vercel

当前没有 `vercel.json`。若以后部署前端，真实构建入口是 `frontend/`，命令是 `npm run build`，产物是 `frontend/dist`。Socket.io/Yjs 需要长期运行的 Node WebSocket 服务，不应仅依赖 Vercel 静态前端；后端地址必须通过前端生产环境变量注入。

### Render

当前没有 `render.yaml`。现有 `frontend/.env.production` 把 API、Socket.io 和 Yjs 指向 `https://web-ide-project.onrender.com`（Yjs 使用 `wss://`）。若在 Render 配置后端，应使用 `backend/` 的 `npm run build` 与 `npm start`，监听 `PORT`，开启 WebSocket，并把 `CORS_ORIGIN` 精确设置为前端生产域名。

### Netlify

当前没有 Netlify 配置。若以后使用 Netlify，只部署 Vite 静态前端：工作目录 `frontend/`、构建命令 `npm run build`、发布目录 `frontend/dist`。后端 API、Socket.io 和 Yjs 仍必须由独立的长连接 Node 服务提供。

### Docker

当前没有 `Dockerfile`。若以后添加，必须保留前端构建产物、后端 `PORT`、Socket.io/Yjs WebSocket upgrade，并确保 `backend/.env` 和任何密钥不进入镜像或提交记录。不得凭空在文档中宣称已有 Docker 启动命令。

## 环境变量和密钥安全

- 后端示例变量来自 `backend/.env.example`：`NODE_ENV`、`PORT`、`HOST`、`CORS_ORIGIN`、`JWT_SECRET`、`JWT_EXPIRES`、`ENABLE_TERMINAL`。
- `JWT_SECRET` 必须至少 32 个字符；真实值只放在本地或部署平台 Secret，不打印、不提交、不写入前端。
- 前端公开变量来自 `.env`、`.env.development`、`.env.production`：`VITE_API_BASE_URL`、`VITE_WS_URL`、`VITE_YJS_URL`、`VITE_ENABLE_TERMINAL`。所有 `VITE_*` 都会进入浏览器，不能放秘密。
- 生产环境 API/Socket 使用 HTTPS，Yjs 使用 WSS；三者应指向同一后端部署，避免跨环境连接。
- 根 README 中出现的 `FRONTEND_ORIGIN` 与当前源码不一致；以 `backend/config.ts` 和 `backend/.env.example` 的 `CORS_ORIGIN` 为准，修改文档时要明确这一差异。
- 不复制、提交或在回答中展示 `backend/.env`、生产变量、JWT、管理员凭据或模型密钥。

## 每次修改后的验收要求

1. 先查看 `git diff` 和 `git status`，只保留本次有意修改；不得覆盖用户已有的未提交改动。
2. 前端至少执行 `npm run typecheck`、`npm run build`、`npm run lint`；后端至少执行 `npm run typecheck`、`npm run build`。
3. 修改后端协议时，额外检查 `/api/health`、`/api/join`、`/api/save`，并按影响范围验证 Socket.io 和 Yjs 连接。
4. 修改页面时，启动前后端开发命令并手工验证加入、编辑、同步、保存、运行、重连和错误处理；不要只以编译通过作为完成标准。
5. 检查生产环境变量、CORS、HTTPS/WSS、日志和密钥是否安全；确认没有把 `.env` 或构建产物误提交。
6. 在提交说明中列出修改文件、执行的命令、已知限制和未实现功能。当前仓库没有真实自动化测试套件，必须如实说明。
