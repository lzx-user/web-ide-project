### 怎么写进简历

可以这样写：

> **Web IDE 实时协作平台**（个人项目）
>
> 基于 React + Monaco Editor + Yjs 构建的多人实时协同代码编辑器，支持 CRDT 冲突解决、光标感知（Awareness 协议）与离线草稿持久化（IndexedDB）。后端采用 Express + Socket.io 单端口微服务架构，通过 HTTP Upgrade 事件路由分流 Socket.io 控制面与 Yjs 数据面；集成 node-pty 实现真实 PTY 交互终端，并实现沙箱代码执行（路径越界防御 + 模块黑名单 + 5s 超时熔断）。

**面试时可以重点讲：**

- 为什么要把控制面和数据面分开，又为什么合并到同一端口（节省资源 + 避免跨域）
- Yjs CRDT 和 OT（Operational Transformation）的区别
- Monaco Model 缓存设计，为什么不每次切文件都销毁重建
- `bindingRef.destroy()` 为什么要在切文件前调用（防止跨文件同步污染）

先把上面那个 `ydocRef` 的 Bug 修掉，其他问题修完就可以放心上线了。