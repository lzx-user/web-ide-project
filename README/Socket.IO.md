# 集成 Socket.IO

Socket.IO 由两部分组成：

- [`socket.io`](https://www.npmjs.com/package/socket.io)与 Node.js HTTP 服务器（软件包）集成（或挂载）的服务器
- 一个在浏览器端加载的客户端库（[`socket.io-client`](https://www.npmjs.com/package/socket.io-client)软件包）

开发过程中，`socket.io`客户端会自动为我们提供服务，这一点我们稍后会看到，所以目前我们只需要安装一个模块：

```text
npm install socket.io
```

这样就会安装模块并添加依赖项`package.json`。现在让我们编辑代码`index.js`来添加它：

- CommonJS

```js
const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected');
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
```

- ES模块

```js
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected');
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
```

`socket.io`请注意，我通过传递（HTTP 服务器）对象来初始化一个新的实例`server`。然后，我监听`connection`传入套接字的事件，并将其记录到控制台。

`</body>`现在在 index.html 文件中，在（body 标签结束）之前添加以下代码片段：

- ES6

```html
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io();
</script>
```

- ES5

```js
<script src="/socket.io/socket.io.js"></script>
<script>
  var socket = io();
</script>
```

只需这样即可加载`socket.io-client`，它会暴露一个`io`全局变量（以及端点`GET /socket.io/socket.io.js`），然后进行连接。

如果您想使用客户端 JS 文件的本地版本，可以在这里找到它`node_modules/socket.io/client-dist/socket.io.js`。

> [!NOTE]
>
> 您也可以使用 CDN 而不是本地文件（例如`<script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>`）。

请注意，我在调用时没有指定任何 URL `io()`，因为它默认会尝试连接到提供该页面的主机。

笔记

如果您使用的是反向代理（例如 apache 或 nginx），请查看[其文档](https://socket.io/docs/v4/reverse-proxy/)。

如果你的应用托管在网站根目录*以外*`https://example.com/chatapp`的文件夹中（例如， ），那么你还需要在服务器端和客户端都指定[路径。](https://socket.io/docs/v4/server-options/#path)

如果您现在重新启动该进程（通过按 Control+C 并`node index.js`再次运行），然后刷新网页，您应该会看到控制台打印“一个用户已连接”。

尝试打开多个标签页，你会看到多条消息。

![控制台显示多条消息，表明部分用户已连接。](https://socket.io/images/chat-4.png)

每个套接字还会触发一个特殊`disconnect`事件：

```js
io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});
```



然后，如果你多次刷新标签页，就能看到实际效果。

![控制台显示多条消息，表明部分用户已连接和断开连接。](https://socket.io/images/chat-5.png)