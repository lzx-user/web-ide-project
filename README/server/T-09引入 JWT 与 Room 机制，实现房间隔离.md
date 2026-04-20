# T-09：引入 JWT 鉴权与 Room 机制实现多租户房间隔离

## 1、开发思路

在 T-08 中，我们成功实现了代码的实时广播。但这带来了一个致命的问题：**“大混战”**。 只要用户连上 WebSocket，全网所有人都会在同一个“大群聊”里，A 写的代码会被强行同步给毫无关系的 B。此外，我们的 WebSocket 接口目前是“裸奔”状态，任何人哪怕不输入名字也能强行连接。

为了把我们的玩具升级为**商业级 SaaS 架构**，我们必须解决两个核心痛点：

### **第一步：发放电子房卡 (HTTP + JWT 鉴权)**

WebSocket 协议本身在握手阶段不易传递复杂的验证逻辑。我们的思路是：**“先走正门领房卡，再走专线进房间”**。 用户必须先通过普通的 HTTP 请求调用后端的登录/加入接口，换取一张加密的电子凭证（JWT）。然后，带着这张凭证去连接 WebSocket。

### **第二步：设立安检闸口 (Socket.IO Middleware)**

后端不能谁来都接。我们需要在 WebSocket 真正建立长连接之前，设立一个“中间件保安”。检查连接请求中是否携带了合法的 JWT，只有真卡放行，假卡直接踢掉。

### **第三步：物理包间隔离 (Socket.IO Rooms)**

安检通过后，不能把所有人放进大厅。后端保安需要看看用户的房卡上写着哪个房间号（`roomId`），然后把他单独领进那个指定的“虚拟包间”。以后的代码广播，**只在这个包间内部进行**。

------

## 2、核心知识点与官方文档梳理

### 2.1 JSON Web Token (JWT)

- **官方定义：** JWT 是一种开放标准，用于在各方之间以 JSON 对象安全地传输信息。此信息是经过数字签名的，因此可以被验证和信任。
- **白话理解：** 就像酒店的房卡。前台（HTTP 接口）核对你的身份后，给你一张刷了磁的卡（加密字符串）。你拿着卡去刷房间门（连 WebSocket），门禁只认卡不认人。

### 2.2 核心机制：Socket.IO Rooms (房间/频道)

为了实现物理隔离，我们用到了 Socket.IO 最强大的内置功能：**Rooms**。

> 📖 **Socket.IO 官方文档提炼：** "A room is an arbitrary channel that sockets can `join` and `leave`. It can be used to broadcast events to a subset of clients." （房间是一个任意的频道，Socket 可以加入和离开。它可以用来向一部分特定的客户端广播事件。）

**官方基础示例：**

```jsx
// 1. 让当前 socket 加入名为 "some-room" 的房间
socket.join("some-room");

// 2. 向 "some-room" 房间内的所有人（包括自己）广播
io.to("some-room").emit("some-event");

// 3. 向 "some-room" 房间内的所有人广播，但【排除自己】
socket.to("some-room").emit("some-event");
```

*💡 注：在我们的协作编辑器中，必须使用第三种 `socket.to().emit()`，否则自己会收到自己的代码导致死循环！*

------

## 3、实操步骤与代码实现

### 3.1 后端：开发发卡接口 (HTTP API)

**核心职责：** 接收前端的 `username` 和 `roomId`，用 `SECRET_KEY` 签发一张 24 小时有效的 JWT 房卡。

```jsx
// server/index.js
// 导入jwt
const jwt = require('jsonwebtoken');
// 密钥
const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_here';

app.post('/api/join', (req, res) => {
  const { username, roomId } = req.body;
  if (!username || !roomId) return res.status(400).json({ message: '参数不能为空' });

  // 1. 打包载荷 (Payload)
  const payload = { username, roomId };
  
  // 2. 签发 Token
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '24h' });
  
  res.json({ success: true, token, username, roomId });
});
```

### 3.2 前端：持卡发起连接 (socket.js & App.jsx)

**核心职责：** 前端拿到 Token 后，把它存起来，并在初始化 `io()` 时，塞入 `auth` 对象中。

```jsx
// frontend/src/socket.js
import { io } from 'socket.io-client';

// 初始化为空的socket变量，等用户加入房间后才真正建立连接并赋值
export let socket = null;

// 只有当用户点击“进入房间”拿到了 Token 后，才调用此函数真正建立连接
export const connectSocket = (roomId, token) => {
  socket = io({
    auth: { token: token },    // 凭据塞在这里，对应后端的 socket.handshake.auth
    query: { roomId: roomId }  // 参数塞在这里，对应后端的 socket.handshake.query
  });
  return socket;
};
```

### 3.3 后端：设立中间件拦截 (Socket.IO Middleware)

**核心职责：** 在 `io.on('connection')` 触发前，强行拦截并解密 Token。

```jsx
// server/index.js
io.use((socket, next) => {
  // 1. 提取前端 auth 传来的 token
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("拒绝访问：未提供Token"));

  // 2. 解密并验证
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return next(new Error("拒绝访问：Token无效"));
    
    // 3. 验证通过！把用户信息挂载到 socket 对象上，带进房间
    socket.user = decoded; 
    next(); // 放行
  });
});
```

### 3.4 后端：分配房间与定向广播 (Room Isolation)

**核心职责：** 结合官方的 `join()` 和 `to().emit()` API，实现真正的代码隔离。

```jsx
// server/index.js
io.on('connection', (socket) => {
  // 此时进来的绝对是合法用户，直接从 socket.user 取出刚才中间件绑定的数据
  const { roomId, username } = socket.user;
  
  // 🚨 核心逻辑 1：物理隔离 - 将该用户拉入指定的房间
  socket.join(roomId);
  console.log(`[房间 ${roomId}] 用户 ${username} 已连接`);

  // 🚨 核心逻辑 2：定向广播 - 监听代码变更
  socket.on('codeChange', (newCode) => {
    // 替换掉原来的 socket.broadcast.emit
    // 意思是：只把 newCode 发给处于 roomId 这个房间里的其他人！
    socket.to(roomId).emit('codeChange', newCode);
  });
});
```

## 4、完整代码

C:\Users\林子霞\Desktop\web-ide-project\frontend\src\components\CodeEditor.jsx

```jsx
import Editor from '@monaco-editor/react';
// T-08 T-08服务器广播代码，实现多端同步
// 8.1 定义一个全局标志位，默认为false(代表是手动输入)
import { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';
import { socket } from '../socket'; // 引入我们刚刚建立的 Socket 连接实例
// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。



// 接收父组件 (App.jsx) 传过来的 socket 实例
export default function CodeEditor({ socket }) {
  // 本地存储代码的状态
  const [code, setCode] = useState('// 请在此输入代码...');

  // 8.2 拦截：用于区分本地手动输入 还是 远程Socket 推送的代码更新
  // 默认为 false, 代表本地输入
  const isRemoteUpdate = useRef(false);

  // 8.3 定义防抖发送函数(延迟400ms发送)
  // 使用 useCallback 包裹，确保组件在重新渲染时，防抖函数不会被重置而失效。
  const emitCodeChange = useCallback(
    debounce((newCode) => {
      if (socket) {
        socket.emit('codeChange', newCode);
      }
    }, 500),  // 500毫秒防抖
    [socket]
  )

  // 8.4 监听服务器广播的代码变更(接收端)
  useEffect(() => {
    if (!socket) return;  // 如果还没有连接成功，先不监听

    const handleReceiveChange = (newCode) => {
      // 代码更新来自于其他人推送
      isRemoteUpdate.current = true; // 标记这是一个远程更新
      // 更新本地编辑器显示的内容 触发下方 Monaco 的 onChange 事件
      setCode(newCode);
    }

    // 监听服务器广播的 'codeChange' 消息
    socket.on('codeChange', handleReceiveChange);

    // 清理函数：组件卸载时取消监听，避免内存泄漏和重复监听
    return () => {
      socket.off('codeChange', handleReceiveChange);
    }
  }, [socket])  // 依赖 socket 变化

  // 处理本地编辑器的onChange事件(发送端)
  const handleEditorChange = (value) => {
    // 检查锁状态
    if (isRemoteUpdate.current) {
      // 如果锁是闭合的（true），说明这个 onChange 是刚才上面 setCode(newCode) 被动触发的。
      // 我们直接拦截，不再向服务器发回数据（打破死循环）。
      // 拦截完毕后，把锁打开，准备迎接下一次用户的真实手动输入。
      isRemoteUpdate.current = false; // 打开锁，准备迎接下一次用户输入
      return; // 直接返回，不发送消息
    }

    // 如果锁是打开的（false），说明这是用户的手动输入，我们正常处理，发送给服务器。
    setCode(value); //  实时更新本地 React状态，保证打字的流畅性和编辑器内容一致。
    emitCodeChange(value); // 调用防抖函数，400ms 后发送给服务器。如果在这400ms内用户继续输入，之前的发送会被取消，直到用户停下来超过400ms才真正发送一次。这样可以大幅减少网络请求次数，提高性能。
  }
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language="javascript"  // 开启 JS 语法高亮，让代码变彩色。
        theme="vs-dark"
        value={code}
        // 第三步实现：Monaco Editor 一旦发现内容变了，立刻执行 setCode
        // 这里的 value 就是用户刚打进去的最新的那一串代码
        onChange={handleEditorChange} // 监听编辑器内容变化事件，触发 handleEditorChange 函数
        options={{
          fontSize: 16,
          minimap: { enabled: false },   // 关掉右侧小地图，小屏幕下节省空间。
          wordWrap: 'on',   // 自动折行，代码太长时不用拉横向滚动条。
          padding: { top: 16 }
        }}
      />
    </div>
  );
}

```

C:\Users\林子霞\Desktop\web-ide-project\frontend\src\App.jsx

```jsx
// import { useState } from 'react'; // 引入 React 的状态魔法
import Sidebar from './components/Sidebar'; // 引入侧边栏组件
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
// T-06 后端的地址（比如 `http://localhost:3000`）发起连接请求。
// 6.1 引入刚刚装的拨号盘
import React, { useState, useEffect } from 'react';
import { socket, connectSocket } from './socket';


function App() {
  const [activeFile, setActiveFile] = useState('index.js');
  // 新增：保存当前编辑器里的代码
  const [currentCode, setCurrentCode] = useState('');
  // 新增：防抖状态，标记是否正在请求后端
  const [isRunning, setIsRunning] = useState(false);
  // 新增：终端日志状态变更为可变状态
  const [terminalLogs, setTerminalLogs] = useState([
    { id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }
  ]);

  // 9.4 控制页面是显示“登录大厅”还是“IDE 编辑器”
  // 大步骤 2：开发前端大厅界面与状态管理
  const [isJoined, setJoined] = useState(false);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentSocket, setCurrentSocket] = useState(null);  // 存入状态，确保子组件能更新

  // 6.3 使用 useEffect 来监听 Socket 的消息  保证只在页面刚打开时打一次电话
  useEffect(() => {
    // 9.5 页面加载时，检查 URL 中是否有 roomId 参数
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
      console.log(roomFromUrl);
    }

    //监听前端自己是否连上了
    if (socket) {
      socket.on('connect', () => {
        console.log('我成功打通后端的电话了！');
      })
    }
    // 当组件卸载(比如关闭页面)时，主动挂断电话
    return () => {
      // socket.disconnect();
    }
  }, [])  // 空依赖数组表示仅在组件挂载时执行一次

  // 9.6 加入房间的函数
  const handleJoinRoom = async () => {
    if (!username || !roomId) {
      return alert('请输入昵称和房间号');
    }

    try {
      // 1. 调用后端的HTTP接口 获取Token
      const res = await fetch('http://localhost:3000/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roomId })
      });
      const data = await res.json()

      if (data.success) {
        // 2. 把拿到手的Token存进浏览器的 `localStorage` 里。
        const local = localStorage.setItem('ide_token', data.token);
        // console.log(local);
        // 3. 修改浏览器地址栏 带上roomId
        window.history.pushState({}, '', `?roomId=${roomId}`);
        // 4. 调用connectSocket,建立 WebSocket 长连接 连接并保存到State里
        const s = connectSocket(roomId, data.token);
        setCurrentSocket(s);
        // 5. 切换界面状态，显示真正的编辑器
        setJoined(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.log('加入房间失败!', err.message);
    }
  }

  // T-07 前端监听编辑器内容并向服务器发送变更
  // 7.1 编辑器内容变化时，触发 handleRunCode 函数，向后端发送当前代码。
  const handleCodeChange = (newCode) => {
    // console.log("📸 [总部确认]：收到车间代码，准备拨号发给后端！");
    // 1. 同步更新 currentCode 状态，保持编辑器内容和状态一致。
    setCurrentCode(newCode);
    // 2. 发送给后端
    if (socket) {
      socket.emit('codeChange', newCode);
    }
  }

  // 核心函数：触发代码运行
  const handleRunCode = async () => {
    if (!currentCode.trim()) return;

    setIsRunning(true);
    // 在终端打印开始执行的提示
    addLog('info', `> 正在执行 ${activeFile} ...`);

    try {
      // 向我们刚才写好的本地 Node.js 服务器发送代码
      const response = await fetch('http://localhost:3000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCode,
          language: 'javascript'
        })
      });

      const result = await response.json();

      // 根据后端返回的 success 字段决定输出颜色
      if (result.success) {
        addLog('success', result.output || '(无输出结果)');
      } else {
        addLog('error', result.output);
      }
    } catch (err) {
      addLog('error', '❌ 连接后端服务器失败，请检查 Server 是否已启动 (端口3000)。');
    } finally {
      setIsRunning(false);
    }
  };



  // 辅助函数：往终端追加日志
  const addLog = (type, text) => {
    setTerminalLogs(prev => [...prev, { id: Date.now(), type, text }]);
  };

  // 渲染判断：如果没有加入房间，显示【检票大厅】
  if (!isJoined) {
    return (
      // 改为明亮背景：bg-slate-50
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-800">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-96">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Web IDE 协作空间</h1>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="你的昵称"
              className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="text"
              placeholder="房间号"
              className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button
              onClick={handleJoinRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold shadow-md transition-colors"
            >
              进入房间
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 如果 isJoined 为 true，显示【真正的编辑器页面】
  return (
    // 最外层容器：撑满全屏 (h-screen w-screen)，采用 Flex 横向布局
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">
      {/* 把状态和修改状态的方法，当做参数 (Props) 传给侧边栏 */}
      <Sidebar activeFile={activeFile} setActiveFile={setActiveFile} />

      {/* {flex-1：确保编辑器能填满右侧剩余的所有空间，不留白边。} */}
      <div className="flex-1 flex flex-col">

        {/* 将方法作为 Props 传递 */}
        <Header activeFile={activeFile} onRunCode={handleRunCode} isRunning={isRunning} />

        {/* 编辑器需要 onChange 事件将用户输入同步给 currentCode 状态 */}
        {/* 7.2 把 handleCodeChange 包装成 setCode 传给子组件 */}
        {/* 将 socket 作为 prop 传给编辑器，彻底解决空白/不更新问题 */}
        <CodeEditor code={currentCode} setCode={handleCodeChange} roomId={roomId} socket={currentSocket} />

        {/* 终端接收最新的日志数组进行渲染 */}
        <Terminal logs={terminalLogs} />
      </div>
    </div>
  );
}

export default App;
```

C:\Users\林子霞\Desktop\web-ide-project\frontend\src\socket.js

```jsx
// 6.1 引入刚刚装的拨号盘
import { io } from 'socket.io-client';

// 建立连接并导出
// 6.2 创建一个全局的 Socket 实例 也就是拨号！目标地址是你后端的 3000 端口
// const socket = io('http://localhost:3000');
// export default socket;

// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 大步骤 3：前端携带凭据发起连接
// 1. 初始化为空的socket变量，等用户加入房间后才真正建立连接并赋值
export let socket = null;

// 2. 用户在大厅输入完毕并拿到Token 后，再调用这个函数去连接
export const connectSocket = (roomId, token) => {
  // 携带凭据和房间号，向后端 3000 端口发起长连接
  // 关键：必须指定后端的具体地址和端口
  socket = io('http://localhost:3000', {
    auth: { token: token },  // 塞入凭据 (对应后端的 socket.handshake.auth)
    query: { roomId: roomId },  // 塞入房间号 (对应后端的 socket.handshake.query)
  });

  // 监听可能发生的鉴权失败
  socket.on('connect_error', (err) => {
    console.log(err.message);
    alert("连接服务器失败，可能是登录已过期，请刷新页面重新进入。");
  });

  return socket;
};

```

C:\Users\林子霞\Desktop\web-ide-project\server\index.js

```jsx
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const http = require('http'); // Node.js 自带的模块，不用 npm install
// 6. 后端引入 socket.io 建立长连接服务
// 6.1 导入socket.io
const { Server } = require('socket.io');
// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 9.1 引入 JWT 库
const jwt = require('jsonwebtoken');


const app = express();
// 开启跨域允许前端 (5173端口) 访问
app.use(cors());
// 解析 application/json 格式的请求体
app.use(express.json());

// 6.2 改造地基：用原生的http模块包装express应用
const server = http.createServer(app);
// 6.3 把socket.io服务器绑定到这个http服务器上
const io = new Server(server, {
  cors: {
    // 允许跨域（因为前端 Vite 通常是 5173 端口，后端是 3000，必须允许跨域“来电”）
    origin: '*',
  }
})

// 9.2 定义一个密钥，用于 JWT 的签名和验证（实际项目中请使用更安全的方式管理密钥）
const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_here';

// 大步骤 1：开发后端发卡接口 (HTTP API)
app.post('/api/join', (req, res) => {
  // 1. 从请求体 (req.body) 中获取前端传来的 用户名(username) 和 房间号(roomId)
  const { username, roomId } = req.body;
  // 2. 检查参数是否为空，为空则返回 400 错误提示并终止
  if (!username || !roomId) {
    return res.status(400).json({
      success: false,
      message: '用户名和房间号不能为空'
    });
  }
  // 3. 把用户名和房间号打包成一个对象，作为 JWT 的载荷 (Payload)
  const payload = {
    username,
    roomId,
  }
  // 4. 使用你的专属密钥 (SECRET_KEY) 和 jsonwebtoken 库，签发一个 Token
  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: '24h' // 这个 Token 24小时后过期，过期后需要重新获取
  })
  console.log('生成的 JWT:', token);
  // 5. 把生成的 Token 和成功状态，通过 res.json() 返回给前端
  res.json({
    success: true,
    token: token,
    payload: payload
  })
});

// 大步骤 4：后端设立保安检查 (Socket 中间件)
io.use((socket, next) => {
  // 1. 从客户端的 auth 选项中提取 token
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("拒绝访问：未提供Token"));
  }

  // 2. 验证 Token 的合法性
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return next(new Error("拒绝访问：Token无效或已过期"));
    }

    // 3. 验证通过！把解码后的用户信息挂载到 socket 对象上, 方便后续使用
    socket.user = decoded;
    next();  // 放行，允许建立长连接
  });
})

// 6.4 监听客户端连接事件
io.on('connection', (socket) => {
  // 大步骤 5：后端分配房间与广播改造
  // 此时能进来的，一定是通过了上方 io.use 中间件的合法用户!
  // 5.1 从握手 query 中提取前端想进的房间号
  const { roomId, username } = socket.user;
  // 5.2 将该 socket拉入专属房间
  socket.join(roomId);
  console.log(`[房间 ${roomId}] 用户 ${username} 已连接`);

  console.log('A user connected:', socket.id); // 打印连接的用户ID，方便调试
  // 7.1 监听前端刚才发出的 'codeChange' 频道的消息
  socket.on('codeChange', (newCode) => {
    // console.log(newCode); // 这里我们先简单地在后端控制台打印一下收到的代码，确认通信正常。
    // 8.1 使用socket.broadcast.emit来把这个消息广播给除了自己以外的所有连接到这个服务器的客户端
    // 5.3 不再使用 socket.broadcast.emit(全网广播)
    // 而是使用 socket.to(roomId).emit，只发给同房间的其他人
    // socket.broadcast.emit('codeChange', newCode);
    socket.to(roomId).emit('codeChange', newCode);
  })


  // 6.4.1 监听挂断事件
  socket.on('disconnect', () => {
    // console.log('user disconnected', socket.id);
    console.log(`[房间 ${roomId}] 用户 ${username} 已离开`);
  })
})

// 核心执行接口
app.post('/api/run', (req, res) => {
  const { code, language } = req.body;

  // 目前仅支持 JavaScript 的执行演示
  if (language !== 'javascript') {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  // 1. 生成临时文件路径
  const tempFilePath = path.join(__dirname, 'temp.js');

  // 2. 将前端传来的代码写入临时文件
  fs.writeFileSync(tempFilePath, code);

  // 3. 创建子进程，执行该临时文件
  exec(`node ${tempFilePath}`, (error, stdout, stderr) => {
    // 执行完毕后，无论成功失败，都清理掉临时文件
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // 如果执行过程中有语法或运行错误
    if (error || stderr) {
      return res.json({
        success: false,
        output: stderr || error.message
      });
    }

    // 执行成功，返回标准输出
    return res.json({
      success: true,
      output: stdout
    });
  });
});

const PORT = 3000;
// 6.5 启动服务（非常重要：把原来的 app.listen 删掉或注释掉，换成 server.listen）
server.listen(PORT, () => {
  console.log(`🚀 后端服务器已启动，监听端口: ${PORT}`);
});
```



------

## 💡 面试必杀技

**👨‍💼 面试官提问：**

> “在你的 Web IDE 项目中，如果有多个团队同时在使用，你是如何保证 A 团队的代码不会同步到 B 团队的屏幕上的？WebSocket 连接的安全性你又是怎么考虑的？”

**👩‍💻 你的满分回答：**

> “为了解决多租户隔离和连接安全问题，我采用的是 **JWT 握手鉴权 + Socket.IO Room 频道机制** 的混合架构。
>
> **关于安全性：** > WebSocket 协议本身不擅长做复杂的登录校验。因此我设计了前置的 HTTP 鉴权：用户在大厅输入信息后，先通过 Express 的 POST 接口获取由 `jsonwebtoken` 签发的 Token。前端在发起 `io()` 连接时，将 Token 挂载在握手协议的 `auth` 载荷中。在 Node.js 后端，我编写了 `io.use()` 全局中间件，在握手阶段拦截请求、校验 JWT 的签名和有效期。如果校验失败直接切断连接，校验成功则将解码后的用户信息直接挂载到当前 `socket` 实例上，避免了后续高频通信时的重复查库。
>
> **关于多租户隔离：** 鉴权通过后，在 `connection` 事件中，我通过前端握手传来的 `roomId`，调用了官方提供的 `socket.join(roomId)` 方法，将用户的 Socket 通道强行划入指定的虚拟房间。 在处理代码同步的高频广播时，我彻底废弃了全网广播的 API，转而使用 `socket.to(roomId).emit()`。这不仅实现了严格的物理隔离——让 101 房间的打字事件绝对无法透传到 202 房间，同时基于 Socket.IO 底层的 Adapter 机制，这种定向派发极大地节省了服务器的带宽和内存消耗，支撑起了项目的商业级可用性。”