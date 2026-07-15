# TypeScript 重构说明

## 这次保留的功能

- React + Vite 前端
- Express + Socket.io + Yjs 协作后端
- 房间加入与 JWT 鉴权
- 文件树创建、删除和同步
- Monaco Editor 多文件编辑
- JavaScript / TypeScript 语言识别
- 保存和运行代码
- 可选终端（默认仍然关闭）

## 这次移除的功能

后台管理功能与 IDE 核心流程没有关系，因此已移除：

- 管理员登录和管理员鉴权
- `/api/admin/*` 路由
- 管理员用户、房间、文件查询接口
- SQLite 管理记录
- 在线用户和运行记录内存统计

删除这些内容是为了减少无关类型错误和模块耦合，不会影响普通用户加入房间、协作编辑、文件保存和运行代码。

## TypeScript 改动

- 前端业务文件改为 `.ts/.tsx`
- 后端业务文件改为 `.ts`
- 增加前后端 `tsconfig.json`
- 为 Zustand Store、文件树、Socket.io 事件、JWT 用户信息和 Monaco 引用增加类型
- 为 `catch` 错误统一使用安全的 `Error` 判断
- 增加 `typecheck` 脚本，避免只依赖 Vite 打包来判断类型是否正确

## 验证命令

```powershell
cd backend
npm run typecheck
npm run build

cd ..\frontend
npm run typecheck
npm run build
```

## 当前目录结构

```text
backend/
  index.ts
  config.ts
  src/
    routes/roomRoutes.ts
    routes/codeRoutes.ts
    socket/workspaceSocket.ts
    yjs/yjsServer.ts
    services/
    types/socket.ts

frontend/
  src/
    App.tsx
    components/
    hooks/
    services/
    store/useIDEStore.ts
    types/ide.ts
    utils/
```

`backend/src/services/codeService.ts` 目前仍然会启动 Node 子进程执行代码。这是为了保持原有功能；如果部署到公网，下一步必须把它替换成隔离的容器 Runner，不能直接执行不可信代码。
