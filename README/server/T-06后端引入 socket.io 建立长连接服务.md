# 后端引入 socket.io 建立长连接服务

## 1、开发思路

### **第一步：后端“装电话机并等待铃响”**。

你的 Node.js 服务需要引入 `socket.io`，把它绑定到现有的服务器上，然后写一个监听事件（叫做 `connection`），就像是坐在电话机旁等铃声。

#### 1.1 怎么在 Express 里引入 Socket.io

Socket.io 官方文档： https://socket.io/docs/v4/tutorial/step-3

**安装依赖**

```
npm install socket.io
```

#### 1.2 把电话机接在服务器上（手敲代码）

**核心知识点（敲黑板）：** 

原本 Express 是直接通过 `app.listen` 启动的。但是 `socket.io` 不能直接挂在 Express 上，它需要依附在 Node.js 更底层的原生 `http` 模块上。所以我们需要稍微改造一下地基。

```jsx
const http = require('http'); // Node.js 自带的模块，不用 npm install
// 6. 后端引入 socket.io 建立长连接服务
// 6.1 导入socket.io
const { Server } = require('socket.io');

// 6.2 改造地基：用原生的http模块包装express应用
const server = http.createServer(app);

// 6.3 把socket.io服务器绑定到这个http服务器上
const io = new Server(server, {
  cors: {
    // 允许跨域（因为前端 Vite 通常是 5173 端口，后端是 3000，必须允许跨域“来电”）
    origin: '*',
  }
})

// 6.4 监听客户端连接事件
io.on('connection', (socket) => {
  console.log('user connected');
  // 监听挂断事件
  socket.on('disconnect', () => {
    console.log('user disconnected');
  })
})

// 6.5 启动服务（非常重要：把原来的 app.listen 删掉或注释掉，换成 server.listen）
server.listen(PORT, () => {
  console.log(`🚀 后端服务器已启动，监听端口: ${PORT}`);
});
```

### **第二步：前端“拨号”**。

前端的 React 项目里引入客户端的包，朝着后端的地址（比如 `http://localhost:3000`）发起连接请求。

**两个终端（Terminal）**：一个是刚才跑后端的（让它一直开着别关），另一个是你用来跑前端（Vite + React）的。

#### 2.1 前端买“拨号盘”（安装客户端依赖）

打开你**前端项目**的终端，输入这行命令安装前端专用的 socket 包：

```js
npm install socket.io-client
```

#### 2.2 拨打后端的电话

```jsx
// 1. 在文件最上面，引入刚刚装的拨号盘
import { useEffect } from 'react';
import { io } from 'socket.io-client';

// 2. 拨号！目标地址是你后端的 3000 端口
const socket = io('http://localhost:3000');

function App() {
  
  // 3. 用 useEffect 保证只在页面刚打开时打一次电话
  useEffect(() => {
    // 监听前端自己是否连上了
    socket.on('connect', () => {
      console.log('前端控制台：我成功打通后端的电话啦！');
    });

    // 养成好习惯：当组件卸载（比如关闭页面）时，主动挂断电话
    return () => {
      socket.disconnect();
    };
  }, []);

  // ... 这里是你原本的 return 页面结构代码，什么都不用改 ...
  return (
    // ...
  )
}
```

**第三步：后端听到并“记录来电”**。

电话接通的一瞬间，后端触发刚刚写好的监听事件，在控制台打印出一句 `user connected`。

![image-20260415151125093](C:\Users\林子霞\AppData\Roaming\Typora\typora-user-images\image-20260415151125093.png)