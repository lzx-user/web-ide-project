### 一、 核心解密：保存逻辑与 API 是怎么拼接的？

你问“我们没有用到 axios 吗？”——**用到了，而且用的是非常高级的“企业级 Axios 实例封装”方案。**

看你第一张前端截图的第 14 行： `await request.post('/save', { ... })`

这里的 `request` 并不是浏览器原生的方法，而是你在项目中自己封装的 Axios 实例。这种架构设计在外企面试中极具含金量，它的流转和拼接逻辑如下：

#### 1. 前端 Axios 拦截器注入 (基建层)

在你的项目源码（`frontend/src/services/request.js`）中，有这样一段核心配置：

JavaScript

```js
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // 这里读取了环境变量
});
```

在开发环境下，`VITE_API_BASE_URL` 的值是 `http://localhost:3000/api`。

#### 2. 路由无缝拼接 (业务层)

当你在保存函数中调用 `request.post('/save')` 时，Axios 会在底层自动帮你做一次字符串拼接： `baseURL` + `请求路径` = `http://localhost:3000/api/save`

与此同时，Axios 的请求拦截器（Request Interceptor）会默默地把 JWT Token 塞进请求头（Headers）里，然后把你在代码里写的对象（roomId, code, filename）自动转换成 JSON 字符串发给后端。

#### 3. 后端精准捕获 (接收层)

看你第二张后端截图的第 12 行： `router.post('/api/save', (req, res) => { ... })`

后端 Express 路由监听的正是 `/api/save` 这个完整路径。 收到请求后，通过 `req.body` 解构出代码和路径，利用 `path.join` 拼接出物理硬盘的绝对路径，最后用 `fs.writeFileSync` 强行将这串文本写进服务器的磁盘里。

**面试防御话术**：“为了提升工程可维护性，我没有在组件里到处散落原始的 axios 调用，而是抽离了一个 `request` 实例统一管理 baseURL 和 JWT 拦截注入。这样在多环境部署时，只需要切换环境变量，API 拼接就能自动对齐。”

### 二、 外企面试深水区：React 现代生命周期与 Hooks 哲学

在外企前端面试中，如果你还在背诵 `componentDidMount`（挂载）这种老旧的 Class 时代生命周期，是绝对过不了关的。

现代 React（Functional Component）的生命周期哲学只有两个字：**渲染（Render）** 与 **副作用（Effect）**。为了控制渲染，React 发明了各种 Hook。结合你的 Web IDE 项目，它们的定位极其清晰：

#### 1. `useRef`：法外之地的“保险箱”

- **大白话**：它就像一个盒子，你可以往里面随便塞东西、改东西，**绝对不会引发组件重新刷新（Re-render）**。
- **项目实战**：你看截图里 `editorRef.current.getValue()`。Monaco 编辑器里的代码是高频变动的（用户一秒钟能敲几个字母）。如果我们用 `useState` 来存代码，每敲一个字母，整个 IDE 页面就会全局刷新一次，浏览器当场卡死。所以我们把 Monaco 实例塞进 `useRef` 这个保险箱里，让它默默变化，等到点击保存时，再打开保险箱提取纯文本。

#### 2. `useState`：驱动页面的“发动机”

- **大白话**：只要你修改了它的值，React 就会立刻重新执行一遍当前组件的函数，把新的值画到屏幕上。
- **项目实战**：截图里的 `setIsSaving(true)`。因为你要让保存按钮变成 Loading 状态，这个状态必须被用户“看到”，所以必须用 state 驱动 UI 刷新。

#### 3. `useEffect`：联络外部世界的“外交官”（副作用）

- **大白话**：React 是一个只管画 UI 的纯净体系。凡是需要和“外部黑盒”打交道的事情（比如：发起网络请求、监听 WebSocket、在 DOM 上挂载 Xterm 终端），都叫“副作用”。`useEffect` 就是专门用来干这些脏活累活的。
- **项目实战**：在你的 `XTerminal.jsx` 里，当组件第一次画到屏幕上后，`useEffect` 启动，负责把 Xterm 实例挂载到真实的 DOM 节点上，并向后端发起 Socket 监听。当组件被销毁时，它里面的 `return () => {}` 清理函数会负责断开连接，防止内存泄漏。

#### 4. `useCallback`：锁死内存地址的“记忆锁”

- **大白话**：在 JavaScript 中，每次组件重新渲染，里面写的函数都会在内存里生成一个**全新的地址**（长得一样，但不是同一个）。如果把这个新函数传给子组件，子组件会误以为收到了新东西，跟着做无意义的刷新。`useCallback` 就是用来把函数的内存地址“锁死”的。
- **项目实战**：在你的 `Sidebar.jsx` 文件树里，你把右键菜单函数 `handleContextMenu` 用 `useCallback` 锁死，配合 `React.memo`，彻底阻断了编辑器打字时引发的侧边栏无效闪烁。

为了让你彻底看清这几个 Hook 在浏览器内存里是如何运作的，我为你搭建了一个 **【React Hooks 渲染调度与内存隔离模拟器】**。

在这个模拟器里，你可以亲自点击按钮，观察 **State（状态）** 变化时组件是如何疯狂高亮闪烁（重绘）的，而 **Ref（引用）** 变化时又是如何做到“暗流涌动但波澜不惊”的。请务必动手点一点！