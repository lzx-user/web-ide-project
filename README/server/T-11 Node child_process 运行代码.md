# 📝 Web IDE 开发笔记：T-11 Node `child_process` 真实代码执行

## 一、 任务概述

- **任务目标**：将前端 Monaco Editor 中的代码发送至后端，利用 Node.js 真实运行，并将运行结果（或报错）实时流式推送回前端终端。
- **核心难点**：前后端状态同步、跨进程通信 (IPC)、流数据处理 (Streams)、系统安全边界 (防死循环) 以及文件系统的生命周期管理。
- **技术栈**：React (Hooks, 状态提升), Socket.io, Node.js (`child_process`, `fs`, `path`).

------

## 二、 架构设计与数据流转思路

在外企的工程标准中，这种复杂的全栈交互必须遵循**“单向数据流”**与**“事件驱动”**架构。我们将整个业务闭环拆解为四个阶段：

1. **状态枢纽 (Lifting State Up)**：在前端 `App.jsx` 顶层统管 `currentCode`（代码源）和 `terminalLogs`（终端日志流）。
2. **指令发射 (Trigger & Emit)**：用户点击运行，拦截空代码，开启 loading 状态，通过 Socket 将代码字符串发射给后端。
3. **沙箱执行 (Sandbox & Execute)**：后端接管代码 --> 写入物理临时文件 --> 开辟子进程 (`spawn`) --> 设置超时安全机制 $\rightarrow$ 运行文件。
4. **流式回音与清理 (Stream & Cleanup)**：后端监听子进程的 `stdout/stderr`，实时推回前端 --> 进程结束后，彻底删除临时物理文件 --> 前端终端接收数据并实现“自动滚动到底部”的真实交互体验。

------

## 三、 核心实现步骤

### 3.1 前端部分：状态流转与动态渲染

**1. 定义核心状态**

使用对象数组来管理日志，利用 `type` 区分普通日志和报错日志，方便后续独立上色。

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\App.jsx
const [currentCode, setCurrentCode] = useState('');
const [isRunning, setIsRunning] = useState(false);
const [terminalLogs, setTerminalLogs] = useState([
  { id: Date.now(), type: 'info', text: '# 终端已就绪。' }
]);
```

**2. 接收回音 (Socket 监听通道)**

利用 `useEffect` 挂载监听，并使用**防御性编程**防止组件未挂载时找不到 socket 实例。

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\App.jsx
useEffect(() => {
  if (!socket) return; // 安全门：防白屏空指针

  const handleOutput = (data) => setTerminalLogs(prev => [...prev, { id: Date.now(), type: 'info', text: data }]);
  const handleError = (data) => setTerminalLogs(prev => [...prev, { id: Date.now(), type: 'error', text: data }]);
  const handleFinish = (exitCode) => setIsRunning(false);

  socket.on('terminalOutput', handleOutput);
  socket.on('terminalError', handleError);
  socket.on('executionFinished', handleFinish);

  return () => {
    socket.off('terminalOutput', handleOutput);
    socket.off('terminalError', handleError);
    socket.off('executionFinished', handleFinish);
  };
}, [socket]);
```

**3. 终端动态渲染与体验优化**

利用 `useRef` 捕获 DOM，实现日志更新时的自动滚动。

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\components\Terminal.jsx
const scrollRef = useRef(null);
  // 4. 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      // 每次 logs 更新时，滚动条自动到底部，模拟真实终端体验
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);
```

### 3.2 后端部分：进程管理与文件生命周期

后端是本次任务的深水区，核心在于**安全**与**无痕**。

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\server\index.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// T-11 监听前端发送的事件名叫 executeCode
socket.on('executeCode', async (code) => {
    // 1. 准备唯一的临时文件路径
    const tempDir = path.join(__dirname, 'temp');
    const filePath = path.join(tempDir, `temp_${Date.now()}.js`);

    try {
        // 2. 代码落盘 (存为物理文件)
        await fs.promises.writeFile(filePath, code, 'utf8');

        // 3. 召唤子进程 (配置超时安全锁)
        const child = spawn('node', [filePath], { timeout: 5000 }); // 限制 5 秒必杀

        // 4 & 5. 收集标准输出与标准错误 (Buffer 转 String)
        // data 默认是 Buffer(二进制数据)，发给前端前必须 data.toString()！
        child.stdout.on('data', (data) => socket.emit('terminalOutput', data.toString()));
        child.stderr.on('data', (data) => socket.emit('terminalError', data.toString()));

        // 6. 进程结束与清理战场
        child.on('close', async (exitCode) => {
            socket.emit('executionFinished', exitCode);
            // 兜底清理：无论成功失败，必须删除物理文件，防止硬盘爆满
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        });
    } catch (err) {
        socket.emit('terminalError', `服务器错误: ${err.message}`);
    }
});
```

------

## 四、 踩坑记录与问题解决 (Troubleshooting)

在开发过程中，我们遇到了几个非常典型的工程级 Bug，这些排错经验非常宝贵：

### 🐛 坑点 1：前端白屏崩溃 (`Cannot read properties of null (reading 'on')`)

- **案情重现**：刷新页面直接白屏报错。
- **根本原因**：`App.jsx` 在初次渲染时，`socket` 实例可能因为登录校验未完成等原因还是 `null`。但 `useEffect` 却急着去执行 `socket.on(...)`，导致空指针异常。
- **解决方案**：引入**防御性编程 (Defensive Programming)**。在 `useEffect` 第一行加上 `if (!socket) return;`，并将 `socket` 加入依赖数组 `[socket]`。

### 🐛 坑点 2：代码发送失败 (`Cannot read properties of null (reading 'trim')`)

- **案情重现**：点击运行按钮，前端报错崩溃，后端无响应。
- **根本原因**：Monaco Editor 在初次挂载或清空时，传给 `onChange` 的值可能是 `null` 或 `undefined`。如果在发送前直接调用 `.trim()` 会引发崩溃。
- **解决方案**：加强空值校验逻辑：`if (isRunning || !currentCode || currentCode.trim() === '') return;`。

### 🐛 坑点 3：终端输出乱码或无法解析

- **案情重现**：后端抓取到了日志，但前端渲染异常。
- **根本原因**：Node.js 子进程触发 `data` 事件时，传输的默认类型是 **Buffer (二进制流)**，直接发送给 React 无法作为文本正确渲染。
- **解决方案**：在 Emit 发送前，必须调用 `data.toString()` 将其反序列化为人类可读的字符串。

### 🐛 坑点 4：死循环导致服务器宕机风险 (RCE 隐患)

- **案情重现**：如果用户提交 `while(true){}`，Node 单线程不会崩，但开辟出的子进程会占满 CPU 且永远不结束，最终拖垮服务器。
- **解决方案**：在 `spawn` 的配置参数中加入 `{ timeout: 5000 }`。这是后端的最后一道安全门，强制剥夺超时进程的生命权。

------

## 五、 任务总结与反思

完成 T-11 后，我对“全栈工程师”的理解有了质的飞跃：

1. **敬畏边界**：前端不能信任用户的输入（必须防抖、拦截空代码），后端不能信任前端传来的逻辑（必须挂载 Timeout 沙箱，必须清理遗留文件）。
2. **深入 Node.js 底层**：跳出了平时只写 CRUD 接口的舒适区，真正触碰到了操作系统的文件读写 (`fs`) 与进程调度 (`child_process`)。
3. **独立排错能力**：学会了根据报错信息的堆栈（如 `reading 'trim'`）精准定位数据断层的位置，并用防御性编程思维去加固代码。这比机械地默写 API 更有价值。

## 六、完整代码

### 前端

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\App.jsx
const express = require('express');
const cors = require('cors');
const fs = require('fs');  // 文件系统，用于读写临时文件
const { exec } = require('child_process');
const path = require('path');  // 路径处理，用于拼接绝对路径
const http = require('http'); // Node.js 自带的模块，不用 npm install
// 6. 后端引入 socket.io 建立长连接服务
// 6.1 导入socket.io
const { Server } = require('socket.io');
// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 9.1 引入 JWT 库
const jwt = require('jsonwebtoken');
// 子进程，用于拼接绝对路径
const { spawn } = require('child_process');
/**
 * T-11 Node child_process 运行代码
 *  1. 写入文件 fs.promises.writeFile
 *  2. 安全边界与沙箱隔离 (Sandbox) 挂载 Docker 容器或配置 isolated-vm
 *  3. 创建子进程 child_process.spawn
 *  4. 监听输出流 child_stdout.on('data', )
 *  5. 清理fs.promises.unlink 监听close事件
 */

const app = express();
// 开启跨域允许前端 (5173端口) 访问
app.use(cors());
// 解析 application/json 格式的请求体 (JSON 解析中间件)
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

  // T-11 监听前端发送的事件名叫 executeCode
  socket.on('executeCode', async (code) => {
    // 【步骤 1: 准备文件路径】
    // 提示: 用模板字符串和 Date.now() 拼一个唯一的文件名，比如 `temp_${Date.now()}.js`
    // API: path.join(__dirname, 'temp', 你的文件名) -> 存给一个叫 filePath 的变量
    const tempDir = path.join(__dirname, 'temp');
    // 注意: 你需要在 server 目录下手动建一个名叫 temp 的空文件夹
    const filePath = path.join(tempDir, `temp_${Date.now()}.js`);

    try {
      // 【步骤 2: 代码落盘 (存为物理文件)】
      // 提示: 把前端传来的 code 写入到 filePath。因为是异步，记得加 await！
      // API: fs.promises.writeFile(路径, 内容)
      await fs.promises.writeFile(filePath, code, 'utf8');
      console.log(`${filePath}`);

      // 【步骤 3: 召唤子进程 (执行代码)】
      // 提示: 用 node 命令去执行刚才生成的那个文件。
      // API: spawn('node', [要执行的文件路径], { 配置对象 })
      // 🔥 安全要点: 配置对象里一定要加上 timeout: 5000 (限制最多跑5秒，防止死循环)
      const child = spawn('node', [filePath], { timeout: 5000 });

      // 【步骤 4: 收集正常输出 (stdout)】
      // 提示: 监听子进程的 'data' 事件。
      // API: child.stdout.on('data', (data) => { ... })
      // ⚠️ 避坑指南: data 默认是 Buffer(二进制数据)，发给前端前必须 data.toString()！
      // 发送 API: socket.emit('terminalOutput', 处理后的字符串);
      child.stdout.on('data', (data) => {
        console.log(`${data}`);
        socket.emit('terminalOutput', data.toString());
      })

      // 【步骤 5: 收集错误输出 (stderr)】
      // 提示: 和步骤 4 一模一样，只是监听的对象换成了 child.stderr
      // 发送 API: socket.emit('terminalError', 处理后的字符串);
      child.stderr.on('data', (data) => {
        console.log(`${data}`);
        socket.emit('terminalError', data.toString());
      })

      // 【步骤 6: 进程结束与清理战场】
      // 提示: 监听子进程的 'close' 事件。
      // API: child.on('close', async (exitCode) => { ... })
      // 动作 A: 告诉前端执行结束了 -> socket.emit('executionFinished', exitCode);
      // 动作 B (极度重要): 删除刚才生成的临时文件！ -> await fs.promises.unlink(filePath);
      child.on('close', async (exitCode) => {
        console.log(`子进程退出，退出码 ${exitCode}`);
        socket.emit('executionFinished', exitCode);
        // 清理战场：删除临时文件
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      })

    } catch (err) {
      // 兜底：如果写入文件失败，通知前端
      socket.emit('terminalError', `服务器内部错误: ${err.message}`);
    }
  });

  // 6.4.1 监听挂断事件
  socket.on('disconnect', () => {
    // console.log('user disconnected', socket.id);
    console.log(`[房间 ${roomId}] 用户 ${username} 已离开`);
  })
})

// T-10 保存接口
app.post('/api/save', (req, res) => {
  // 1. 拿到从前端body中传过来的数据
  const { roomId, code, language } = req.body;
  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).json({ error: '代码不能为空' });
  }

  // 3. 生成一个 `.js` 临时文件并写入
  // 把文件存在 server 目录下的 temp 文件夹里
  const tempDir = path.join(__dirname, 'temp');
  // 如果 temp 这个文件夹还不存在，就让 Node.js 自动建一个
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  // 拼接出最终的文件名，例如: project_1024.js
  const filePath = path.join(tempDir, `${roomId}.js`);

  // 4. 执行写入
  try {
    // 强制同步写入物理硬盘 (utf8 编码)
    fs.writeFileSync(filePath, code, 'utf8');
    // 在后端 Node 控制台打印一下，方便你观察
    console.log(`${filePath}`);
    // 5. 必须给前端返回一个成功的 200 响应，形成闭环
    res.status(200).json({
      success: true,
      message: '代码已安全落盘'
    })
  } catch (error) {
    console.log('写入失败', error);
    // 如果硬盘满了或者没权限，返回 500 服务器错误
    res.status(500).json({ error: '服务器保存文件失败' })
  }
})

// 核心执行接口
app.post('/api/run', (req, res) => {
  const { roomId, code, language } = req.body;

  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).json({ error: '代码不能为空' });
  }

  // // 目前仅支持 JavaScript 的执行演示
  // if (language !== 'javascript') {
  //   return res.status(400).json({ error: 'Unsupported language' });
  // }

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

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\components\Terminal.jsx
// 底部战区
// 职责： 专注显示系统日志和代码运行结果。
import { useEffect, useRef } from "react";

// T-11 终端组件需要处理自动滚动，并根据日志类型（info/error/system）显示不同的颜色。
export default function Terminal({ logs }) {
  const scrollRef = useRef(null);
  // 4. 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      // 每次 logs 更新时，滚动条自动到底部，模拟真实终端体验
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div ref={scrollRef} className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto">
      {logs.map(log => (
        <p
          key={log.id}
          className={`whitespace-pre-wrap mb-1 ${log.type === 'error' ? 'text-red-400' :
            log.type === 'system' ? 'text-green-400 font-bold' :
              'text-gray-200'
            }`}
        >
          {log.text}
        </p>
      ))}
    </div>
  );
}

```

### 后端

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\server\index.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');  // 文件系统，用于读写临时文件
const { exec } = require('child_process');
const path = require('path');  // 路径处理，用于拼接绝对路径
const http = require('http'); // Node.js 自带的模块，不用 npm install
// 6. 后端引入 socket.io 建立长连接服务
// 6.1 导入socket.io
const { Server } = require('socket.io');
// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 9.1 引入 JWT 库
const jwt = require('jsonwebtoken');
// 子进程，用于拼接绝对路径
const { spawn } = require('child_process');
/**
 * T-11 Node child_process 运行代码
 *  1. 写入文件 fs.promises.writeFile
 *  2. 安全边界与沙箱隔离 (Sandbox) 挂载 Docker 容器或配置 isolated-vm
 *  3. 创建子进程 child_process.spawn
 *  4. 监听输出流 child_stdout.on('data', )
 *  5. 清理fs.promises.unlink 监听close事件
 */

const app = express();
// 开启跨域允许前端 (5173端口) 访问
app.use(cors());
// 解析 application/json 格式的请求体 (JSON 解析中间件)
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

  // T-11 监听前端发送的事件名叫 executeCode
  socket.on('executeCode', async (code) => {
    // 【步骤 1: 准备文件路径】
    // 提示: 用模板字符串和 Date.now() 拼一个唯一的文件名，比如 `temp_${Date.now()}.js`
    // API: path.join(__dirname, 'temp', 你的文件名) -> 存给一个叫 filePath 的变量
    const tempDir = path.join(__dirname, 'temp');
    // 注意: 你需要在 server 目录下手动建一个名叫 temp 的空文件夹
    const filePath = path.join(tempDir, `temp_${Date.now()}.js`);

    try {
      // 【步骤 2: 代码落盘 (存为物理文件)】
      // 提示: 把前端传来的 code 写入到 filePath。因为是异步，记得加 await！
      // API: fs.promises.writeFile(路径, 内容)
      await fs.promises.writeFile(filePath, code, 'utf8');
      console.log(`${filePath}`);

      // 【步骤 3: 召唤子进程 (执行代码)】
      // 提示: 用 node 命令去执行刚才生成的那个文件。
      // API: spawn('node', [要执行的文件路径], { 配置对象 })
      // 🔥 安全要点: 配置对象里一定要加上 timeout: 5000 (限制最多跑5秒，防止死循环)
      const child = spawn('node', [filePath], { timeout: 5000 });

      // 【步骤 4: 收集正常输出 (stdout)】
      // 提示: 监听子进程的 'data' 事件。
      // API: child.stdout.on('data', (data) => { ... })
      // ⚠️ 避坑指南: data 默认是 Buffer(二进制数据)，发给前端前必须 data.toString()！
      // 发送 API: socket.emit('terminalOutput', 处理后的字符串);
      child.stdout.on('data', (data) => {
        console.log(`${data}`);
        socket.emit('terminalOutput', data.toString());
      })

      // 【步骤 5: 收集错误输出 (stderr)】
      // 提示: 和步骤 4 一模一样，只是监听的对象换成了 child.stderr
      // 发送 API: socket.emit('terminalError', 处理后的字符串);
      child.stderr.on('data', (data) => {
        console.log(`${data}`);
        socket.emit('terminalError', data.toString());
      })

      // 【步骤 6: 进程结束与清理战场】
      // 提示: 监听子进程的 'close' 事件。
      // API: child.on('close', async (exitCode) => { ... })
      // 动作 A: 告诉前端执行结束了 -> socket.emit('executionFinished', exitCode);
      // 动作 B (极度重要): 删除刚才生成的临时文件！ -> await fs.promises.unlink(filePath);
      child.on('close', async (exitCode) => {
        console.log(`子进程退出，退出码 ${exitCode}`);
        socket.emit('executionFinished', exitCode);
        // 清理战场：删除临时文件
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      })

    } catch (err) {
      // 兜底：如果写入文件失败，通知前端
      socket.emit('terminalError', `服务器内部错误: ${err.message}`);
    }
  });

  // 6.4.1 监听挂断事件
  socket.on('disconnect', () => {
    // console.log('user disconnected', socket.id);
    console.log(`[房间 ${roomId}] 用户 ${username} 已离开`);
  })
})

// T-10 保存接口
app.post('/api/save', (req, res) => {
  // 1. 拿到从前端body中传过来的数据
  const { roomId, code, language } = req.body;
  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).json({ error: '代码不能为空' });
  }

  // 3. 生成一个 `.js` 临时文件并写入
  // 把文件存在 server 目录下的 temp 文件夹里
  const tempDir = path.join(__dirname, 'temp');
  // 如果 temp 这个文件夹还不存在，就让 Node.js 自动建一个
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  // 拼接出最终的文件名，例如: project_1024.js
  const filePath = path.join(tempDir, `${roomId}.js`);

  // 4. 执行写入
  try {
    // 强制同步写入物理硬盘 (utf8 编码)
    fs.writeFileSync(filePath, code, 'utf8');
    // 在后端 Node 控制台打印一下，方便你观察
    console.log(`${filePath}`);
    // 5. 必须给前端返回一个成功的 200 响应，形成闭环
    res.status(200).json({
      success: true,
      message: '代码已安全落盘'
    })
  } catch (error) {
    console.log('写入失败', error);
    // 如果硬盘满了或者没权限，返回 500 服务器错误
    res.status(500).json({ error: '服务器保存文件失败' })
  }
})

// 核心执行接口
app.post('/api/run', (req, res) => {
  const { roomId, code, language } = req.body;

  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).json({ error: '代码不能为空' });
  }

  // // 目前仅支持 JavaScript 的执行演示
  // if (language !== 'javascript') {
  //   return res.status(400).json({ error: 'Unsupported language' });
  // }

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

