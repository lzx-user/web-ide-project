# 秋招简历与演示材料

## 简历描述

- 基于 React、Monaco Editor、Socket.io 与 Yjs 构建多人实时协作 Web IDE，以 CRDT 处理并发编辑冲突，并通过 Awareness 同步在线成员、远程光标和选区。
- 设计控制面与数据面分离架构：Socket.io 负责文件树等业务事件，Yjs WebSocket 负责文档增量同步；接入 IndexedDB 支持离线编辑与重连合并。
- 以 PostgreSQL `room_files + yjs_snapshots` 统一数据真相，使用不可变 `document_key` 隔离文件生命周期，实现同名重建防旧内容复活、服务重启恢复和手动强制快照。
- 统一 HTTP、Socket.io、Yjs 三条链路的 JWT 房间鉴权，引入 scrypt 房间口令、限流、路径/容量限制，并默认关闭未隔离的代码执行与 PTY 终端。

## 3～5 分钟 Demo

1. 创建房间，说明 accessCode 只显示一次、服务端只保存哈希。
2. 两个无痕窗口加入，创建 `src/app.ts`，展示文件树广播。
3. 两端同时输入，展示 CRDT 合并、成员和远程光标。
4. 一端断网继续输入，指出 IndexedDB 本地草稿和连接状态；恢复网络后展示合并。
5. Cmd/Ctrl+S，展示“已协同同步”与“已持久化”是两个状态。
6. 重启后端并用新浏览器加入，展示文件树和快照恢复。
7. 删除并同名重建文件，证明 `document_key` 防止旧内容复活。
8. 展示 Run 灰置，说明公网环境不把 `child_process` 冒充安全沙箱。

## 高频问答

1. 为什么不用 Socket.io 直接同步字符串？CRDT 能处理并发、乱序和离线增量合并，避免最后写入覆盖。
2. 为什么同时需要 Socket.io 和 Yjs？文件事务与高频文本数据流职责不同。
3. 数据真相是什么？文件身份在 `room_files`，在线内容在 Y.Doc，恢复副本在快照，IndexedDB 只是缓存。
4. 为什么不用路径作为 Y.Text key？删除再同名创建可能重新引用旧共享类型。
5. 保存与同步有什么区别？同步说明协作者收到更新；保存表示快照已写入 PostgreSQL。
6. 如何避免每次按键写库？Yjs update 做 2 秒 debounce，手动保存和退出时强制 flush。
7. 如何做三条链路鉴权？共用 Token verification，Yjs 额外校验 URL roomId。
8. 房间口令如何保存？随机 salt 的 scrypt 派生结果，恒定时间比较。
9. 断网为何不丢输入？Y.Doc 写入 IndexedDB，重连交换缺失增量。
10. Monaco 为何需要 model registry？复用 model/viewState，删除时精确 dispose。
11. 为什么关闭 Run？无容器隔离和资源限额的 Node 子进程不是安全沙箱。
12. 如何限制滥用？接口、请求体、payload、路径、层级、文件数量和日志都有上限。
13. 重启如何恢复？首次创建服务端 Y.Doc 时先 apply PostgreSQL 快照。
14. 当前限制？无完整账号/撤销体系、无隔离 Runner，协同 E2E 仍需加强。
15. 下一步？AI 真实服务验收、增量快照、隔离 Runner、浏览器 E2E 与可观测性。
