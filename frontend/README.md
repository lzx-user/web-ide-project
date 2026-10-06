# Web IDE Frontend

React + TypeScript + Vite 前端，负责 Monaco 多文件编辑、Yjs/IndexedDB 协同、Socket.io 文件树事件和持久化状态展示。

环境变量模板见 `.env.example`。代码执行、PTY 和 AI 默认关闭；这些不是前端安全边界，后端仍会独立门控。

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run lint
```
