const express = require('express');
const cors = require('cors');
const fs = require('fs');  // 文件系统，用于读写临时文件
const { exec } = require('child_process');
const path = require('path');  // 路径处理，用于拼接绝对路径
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
// 1. 引入统一配置文件
const config = require('./config');

/**
 * Web IDE 后端核心服务
 * 思路：
 * - 基础设施：基于 Express 和 Socket.io 构建实时通信地基。
 * - 安全层：利用 JWT 和中间件对每个 WebSocket 连接进行身份“安检”。
 * - 执行层：通过子进程独立运行代码，确保主服务不会因为用户代码崩溃。
 */

const app = express();

// 2. 基础中间件配置
app.use(cors());
// 解析 application/json 格式的请求体 (JSON 解析中间件)
app.use(express.json());

// 用原生的http模块包装express应用
const server = http.createServer(app);
// 把socket.io服务器绑定到这个http服务器上
const io = new Server(server, {
  cors: { origin: config.cors.origin } // 引用配置中的跨域规则
})

// 确保临时目录存在，用于存放执行代码
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 3. HTTP 业务接口

/**
 * 接口：用户加入房间
 * 签发 Token，后续 Socket 连接必须携带此 Token。
 */
app.post('/api/join', (req, res) => {
  const { username, roomId } = req.body;
  if (!username || !roomId) {
    return res.status(400).json({
      success: false,
      message: '用户名和房间号不能为空'
    });
  }
  // 把用户名和房间号打包成一个对象，作为 JWT 的载荷 (Payload)
  const payload = {
    username,
    roomId,
  }
  // 引用配置中的密钥与过期时间 签发一个 Token
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

  // 把生成的 Token 和成功状态，通过 res.json() 返回给前端
  res.json({
    success: true,
    token,
    payload
  })
});

/**
 * 接口：代码持久化保存
 */
app.post('/api/save', (req, res) => {
  const { roomId, code } = req.body;
  if (!code) return res.status(400).json({ error: '内容不能为空' });

  const filePath = path.join(tempDir, `${roomId}.js`);
  try {
    fs.writeFileSync(filePath, code, 'utf8');
    res.status(200).json({ success: true, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ error: '文件系统写入失败' });
  }
});

/**
 * 接口：代码执行 (HTTP 短连接模式)
 */
app.post('/api/run', (req, res) => {
  const { code } = req.body;
  const tempFilePath = path.join(tempDir, `run_${Date.now()}.js`);
  fs.writeFileSync(tempFilePath, code);

  exec(`node ${tempFilePath}`, (error, stdout, stderr) => {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    res.json({ success: !error, output: stderr || stdout || error?.message });
  });
});

// 4. Socket.io 安全与业务逻辑

// Socket 拦截器：验证 JWT 凭证
io.use((socket, next) => {
  // 从客户端的 auth 选项中提取 token
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("拒绝访问：未提供Token"));
  }

  // 验证 Token 的合法性
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return next(new Error("拒绝访问：Token无效或已过期"));
    }

    // 3. 验证通过！把解码后的用户信息挂载到 socket 对象上, 方便后续使用
    socket.user = decoded;
    next();  // 放行，允许建立长连接
  });
})

// 监听客户端连接事件
io.on('connection', (socket) => {
  const { roomId, username } = socket.user;
  socket.join(roomId);  // 自动加入 JWT 中指定的房间
  console.log(`[房间 ${roomId}] 用户 ${username} 已连接`);

  // 监听：代码变更同步 (排除发送者)
  socket.on('codeChange', (newCode) => {
    socket.to(roomId).emit('codeChange', newCode);
  })

  // 监听：流式执行代码
  socket.on('executeCode', async (code) => {
    // 生成一个独一无二的临时文件路径
    const filePath = path.join(tempDir, `stream_${Date.now()}.js`);

    try {
      await fs.promises.writeFile(filePath, code, 'utf8');

      // API: spawn('node', [要执行的文件路径], { 配置对象 })
      // 安全要点: 配置对象里一定要加上 timeout: 5000 (限制最多跑5秒，防止死循环)
      const child = spawn('node', [filePath], { timeout: 5000 });

      // API: child.stdout.on('data', (data) => { ... })
      // data 默认是 Buffer(二进制数据)，发给前端前必须 data.toString()！
      // 发送 API: socket.emit('terminalOutput', 处理后的字符串);
      child.stdout.on('data', (data) => socket.emit('terminalOutput', data.toString()));

      // 发送 API: socket.emit('terminalError', 处理后的字符串);
      child.stderr.on('data', (data) => socket.emit('terminalError', data.toString()));

      // API: child.on('close', async (exitCode) => { ... })
      // 动作 A: 告诉前端执行结束了 -> socket.emit('executionFinished', exitCode);
      // 动作 B (极度重要): 删除刚才生成的临时文件！ -> await fs.promises.unlink(filePath);
      child.on('close', async (exitCode) => {
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

  socket.on('disconnect', () => {
    console.log(`[房间 ${roomId}] 用户 ${username} 已离开`);
  })
})

// 5. 启动监听
server.listen(config.server.port, () => {
  console.log(`
  🚀 Server Running: http://${config.server.host}:${config.server.port}
  🔧 Mode: ${config.env.current}
  `);
});