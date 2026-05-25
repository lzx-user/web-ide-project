### 🧱 知识沙盘第二站：JWT（JSON Web Token）

#### 1. 它的核心作用是什么？

在本项目中，JWT 扮演的是**协作空间的“电子身份证 / 数字通行证”**。 它是一个经过加密签名的字符串，里面塞进了用户的核心特征（在你的项目里是 `username` 和 `roomId`）。用户在大厅登录成功后，后端会现场给他发这张身份证；从此以后，用户不论是发送 HTTP 请求保存代码，还是建立 Socket.io 长连接，都必须在胸前挂着这张身份证。后端通过纯数学计算，一眼就能认出“你是不是假冒的，你到底有没有权限进这个房间”。

#### 2. 为什么要用它？（不用的痛点是什么？）

在传统网站中，我们通常使用 **Session / Cookie** 的机制来记录登录状态。如果不引入 JWT，而沿用 Session 机制，在 Web IDE 这种长连接协作系统里会遭遇**三大毁灭性痛点**：

- **痛点一：服务器内存爆炸（无状态 vs 有状态）。** Session 是“有状态”的。每一个用户登录，服务器内存里都必须开辟一块空间存一个 Session ID。如果有 1 万个学生同时在线写代码，服务器内存就会被卡死。而 JWT 是“无状态（Stateless）”的，服务器**不需要在内存里存任何东西**。信息全在用户手里那个 Token 字符串里，服务器只保留一个密钥，来一个 Token 就用数学公式算一下签名，算完就丢掉，极大地释放了服务器压力。
- **痛点二：分布式与多端口架构天然瘫痪。** 你的项目未来如果要上线，前端、后端、协同数据面可能会部署在不同的服务器实例上。如果用 Session，用户在 A 服务器登录了，他的 Session 记录在 A 上，当他的 Yjs 协作流连向 B 服务器时，B 服务器的内存里没有他的记录，就会认为他“未登录”。而 JWT 天然是分布式友好的，A 签发的 Token，B 只要拥有相同的密钥（Secret），不需要查任何数据库，直接在本地计算就能放行。
- **痛点三：WebSocket 握手无法天然携带 Cookie。** 原生的 WebSocket 握手阶段对 Cookie 的支持有很多局限性，特别是在跨域部署时。使用 JWT 可以让前端自由地把 Token 塞进内存，在建立 Socket 连接时通过 `auth` 或者是请求头自由传输。

#### 3. 结合你的源码进行深度拆解

在你的前后端代码中，JWT 的生命周期极其严密，分为“签发”和“验票”两步：

##### 步骤一：前门验票，现场发证（Token 签发）

- **【源码出处】** `backend/src/routes/room.js`

- **【工程落地】** 当用户输入“尤雨溪”和房间号“888”点击进入时，触发了 `/api/join` 接口。后端验证非空后，调用 `jwt.sign` 现场盖章：

  ```js
  // backend
  const payload = { username, roomId }; // 🌟 亮点：只打包必要非敏感信息（载荷）
  // 引用配置中的加密密钥，签发一张 24小时有效的身份证
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  res.json({ success: true, token, payload });
  ```

  **注意**：JWT 的字符串由三部分组成：`Header（头部）`、`Payload（载荷）`、`Signature（签名）`。中间那个 Payload 是用 Base64 编码的，这意味着**前端可以直接解密看里面的内容，所以绝对不能把用户密码写进 Payload 里**。

##### 步骤二：关卡拦截，对齐安检（Token 验证）

- **【源码出处】** `backend/index.js` 中的 `io.use()`

- **【工程落地】** 前端拿到 Token 后存在本地（`ide_token`），在 Socket.io 拨号时作为通关文牒传给后端。后端在连接确立前进行拦截：

  ```js
  // backend
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    // 现场数学计算：用我们握在手里的全局密钥，去解密这个 token
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) return next(new Error("拒绝访问：Token无效或已过期"));
  
      // 🌟 核心亮点：把解密出来的真实用户名和房间号，强行塞给当前 socket
      socket.user = decoded; 
      next(); // 放行
    });
  });
  ```

  **为什么这个设计很高级？** 只要通过了这一层，后面的 `io.on('connection')` 逻辑就完全信任这个连接了。我们能直接通过 `socket.user.roomId` 知道他去哪个房间，**彻底杜绝了前端通过伪造 roomId 企图越界偷看别人代码的黑客行为**。

为了让你彻底看懂 JWT 内部的“三段式结构”**，以及**“为什么修改了 Payload 签名就会立刻失效”的数学原理，我为你量身定制了这套 **【JWT（身份令牌）剖析与黑客篡改模拟沙盘】**。

在这个沙盘里，你初始化就能看到你项目中的真实密钥。你可以尝试修改用户名、房间号，或者模拟黑客直接去改生成的 Token 字符串。沙盘会实时为你展示：**JWT 字符串的颜色分段、后端解密状态、以及大厂面试官在这里准备的死磕连环问与教科书级回答**。请你务必在下方沙盘中操纵体验一遍！

![image-20260524192942342](C:\Users\林子霞\AppData\Roaming\Typora\typora-user-images\image-20260524192942342.png)

![image-20260524193006662](C:\Users\林子霞\AppData\Roaming\Typora\typora-user-images\image-20260524193006662.png)