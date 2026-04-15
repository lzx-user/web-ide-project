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

# 发射事件

服务器和客户端之间可以通过多种方式发送事件。

对于 TypeScript 用户，可以为事件提供类型提示。请查看[此处](https://socket.io/docs/v4/typescript/)。

## 基本

在 Socket.io 中，`emit`（发射）这个动作，最标准的就是这两个参数：`socket.emit(频道名, 传输的数据)`。

Socket.IO API 的设计灵感来源于 Node.js [EventEmitter](https://nodejs.org/docs/latest/api/events.html#events_events)，这意味着你可以在一端发出事件，并在另一端注册监听器：

*服务器*

```js
io.on("connection", (socket) => {
  socket.emit("hello", "world");
});
```



*客户*

```js
socket.on("hello", (arg) => {
  console.log(arg); // world
});
```



反过来也一样：

*服务器*

```js
io.on("connection", (socket) => {
  socket.on("hello", (arg) => {
    console.log(arg); // world
  });
});
```



*客户*

```js
socket.emit("hello", "world");
```



您可以发送任意数量的参数，并且支持所有可序列化的数据结构，包括[Buffer](https://nodejs.org/docs/latest/api/buffer.html#buffer_buffer)或[TypedArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)等二进制对象。

*服务器*

```js
io.on("connection", (socket) => {
  socket.emit("hello", 1, "2", { 3: '4', 5: Buffer.from([6]) });
});
```



*客户*

```js
// client-side
socket.on("hello", (arg1, arg2, arg3) => {
  console.log(arg1); // 1
  console.log(arg2); // "2"
  console.log(arg3); // { 3: '4', 5: ArrayBuffer (1) [ 6 ] }
});
```



无需`JSON.stringify()`对对象进行任何操作，系统会自动完成。

```js
// BAD
socket.emit("hello", JSON.stringify({ name: "John" }));

// GOOD
socket.emit("hello", { name: "John" });
```



笔记：

- [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)对象将被转换为（并以）其字符串表示形式接收，例如：`1970-01-01T00:00:00.000Z`
- [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)和[Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)必须手动序列化：

```js
const serializedMap = [...myMap.entries()];
const serializedSet = [...mySet.keys()];
```



- 您可以使用该[`toJSON()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#tojson_behavior)方法自定义对象的序列化。

以类为例：

```js
class Hero {
  #hp;

  constructor() {
    this.#hp = 42;
  }

  toJSON() {
    return { hp: this.#hp };
  }
}

socket.emit("here's a hero", new Hero());
```



事件机制固然好用，但在某些情况下，您可能需要更传统的请求-响应式 API。在 Socket.IO 中，此功能称为确认机制。

你可以将回调函数作为最后一个参数添加`emit()`，一旦对方确认事件，就会调用这个回调函数：

*服务器*

```js
io.on("connection", (socket) => {
  socket.on("update item", (arg1, arg2, callback) => {
    console.log(arg1); // 1
    console.log(arg2); // { name: "updated" }
    callback({
      status: "ok"
    });
  });
});
```



*客户*

```js
socket.emit("update item", "1", { name: "updated" }, (response) => {
  console.log(response.status); // ok
});
```



## 

从 Socket.IO v4.4.0 开始，现在可以为每个 emit 事件设置超时时间：

```js
socket.timeout(5000).emit("my-event", (err) => {
  if (err) {
    // the other side did not acknowledge the event in the given delay
  }
});
```



您也可以同时使用超时和[确认机制](https://socket.io/docs/v4/emitting-events/#acknowledgements)：

```js
socket.timeout(5000).emit("my-event", (err, response) => {
  if (err) {
    // the other side did not acknowledge the event in the given delay
  } else {
    console.log(response);
  }
});
```



## 剧烈

不稳定事件是指如果底层连接未准备就绪，则不会发送的事件（在可靠性方面有点像[UDP ）。](https://en.wikipedia.org/wiki/User_Datagram_Protocol)

例如，如果您需要发送在线游戏中角色的位置（因为只有最新的值才有用），这可能会很有趣。

```js
socket.volatile.emit("hello", "might or might not be received");
```



另一个用例是当客户端未连接时丢弃事件（默认情况下，事件会被缓冲，直到重新连接）。

例子：

*服务器*

```js
io.on("connection", (socket) => {
  console.log("connect");

  socket.on("ping", (count) => {
    console.log(count);
  });
});
```



*客户*

```js
let count = 0;
setInterval(() => {
  socket.volatile.emit("ping", ++count);
}, 1000);
```



如果重启服务器，您将在控制台中看到：

```text
connect
1
2
3
4
# the server is restarted, the client automatically reconnects
connect
9
10
11
```



如果没有这`volatile`面旗帜，你会看到：

```text
connect
1
2
3
4
# the server is restarted, the client automatically reconnects and sends its buffered events
connect
5
6
7
8
9
10
11
```

# 广播活动

Socket.IO 可以轻松地向所有已连接的客户端发送事件。



> [!CAUTION]
>
> 请注意，广播功能**仅限服务器端**使用。

## 致所有已连接的

![向所有已连接的客户端广播](https://socket.io/images/broadcasting.png)

```js
io.emit("hello", "world");
```



> [!WARNING]
>
> 当前已断开连接（或正在重新连接）的客户端将不会收到此事件。是否将此事件存储在某个位置（例如数据库中）取决于您的具体使用场景。

## 除

如果你想向除特定发送套接字之外的所有人发送消息，我们有一个`broadcast`标志可以指定从该套接字发送消息：

![向除发送者之外的所有已连接客户端广播](https://socket.io/images/broadcasting2.png)

```js
io.on("connection", (socket) => {
  socket.broadcast.emit("hello", "world");
});
```

在上面的示例中，使用`socket.emit("hello", "world")`（不带标志）会将事件发送到“客户端 A”。您可以在[速查表](https://socket.io/docs/v4/emit-cheatsheet/)`broadcast`中找到发送事件的所有方法列表。

## 

从 Socket.IO 4.5.0 开始，您现在可以向多个客户端广播事件，并期望收到每个客户端的确认：

```js
io.timeout(5000).emit("hello", "world", (err, responses) => {
  if (err) {
    // some clients did not acknowledge the event in the given delay
  } else {
    console.log(responses); // one response per client
  }
});
```



支持所有广播形式：

- 在房间里

```js
io.to("room123").timeout(5000).emit("hello", "world", (err, responses) => {
  // ...
});
```



- 特定`socket`

```js
socket.broadcast.timeout(5000).emit("hello", "world", (err, responses) => {
  // ...
});
```



- 在命名空间中

```js
io.of("/the-namespace").timeout(5000).emit("hello", "world", (err, responses) => {
  // ...
});
```



## 使用多个 Socket.IO

广播功能也适用于多个 Socket.IO 服务器。

你只需要将默认适配器替换为[Redis 适配器](https://socket.io/docs/v4/redis-adapter/)或其他[兼容的适配器即可](https://socket.io/docs/v4/adapter/)。

![使用 Redis 进行广播](https://socket.io/images/broadcasting-redis.png)

在某些情况下，您可能只想向连接到当前服务器的客户端广播消息。您可以使用以下`local`标志来实现此目的：

```js
io.local.emit("hello", "world");
```



![使用 Redis 进行本地广播](https://socket.io/images/broadcasting-redis-local.png)

为了在广播时针对特定客户端，请参阅有关[房间的](https://socket.io/docs/v4/rooms/)文档。