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
    return res.status(400).join({ error: '代码不能为空' });
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
    return res.status(400).join({ error: '代码不能为空' });
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