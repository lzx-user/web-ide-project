const express = require('express');
const cors = require('cors');
const fs = require('fs');  // 文件系统，用于读写临时文件
const { exec } = require('child_process');
const path = require('path');  // 路径处理，用于拼接绝对路径
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const roomRouter = require('./src/routes/room');
const codeRouter = require('./src/routes/code');
const PtyManager = require('./src/pty/PtyManager');
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

// 3. 路由注册：把房间管理和代码管理的路由注册到 Express 应用上
app.use('/', roomRouter);
app.use('/', codeRouter);

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

// 4. Socket.io 安全与业务逻辑

// Socket 拦截器：验证 JWT 凭证
io.use((socket, next) => {
  // 从客户端的 auth 选项中提取 token
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("拒绝访问：未提供Token"));
  }

  // 验证 Token 的合法性，使用配置文件中的 JWT 密钥
  jwt.verify(token, config.jwt.secret, (err, decoded) => {
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

  // 新用户历史代码同步机制
  // 思路：当新用户加入房间时，服务器从临时目录读取该房间的最新代码（如果有），并通过 socket.emit 发送给这个新用户。
  // 1. 准备一个空包裹，等会儿用来装我们找到的代码
  // 最终长这样：{ 'index.js': 'console.log(1)', 'style.css': 'body{}' }
  const codePackage = {};
  try {
    // 同步读取(Sync)
    // 2. 读取临时目录下所有文件，找到属于这个房间的最新代码
    const allFiles = fs.readdirSync(tempDir);
    // 3. 遍历这个数组，挨个检查文件
    allFiles.forEach(fileName => {
      // 字符串过滤：通过 startsWith 和 replace 这两个原生的字符串方法
      // 4. 判断条件：这个文件是属于当前房间的吗？ 利用startsWith方法，房间ID是文件名前缀
      if (fileName.startsWith(`${roomId}_`)) {
        // 5. 如果是，就读取这个文件的内容，放到 codePackage 里
        const filePath = path.join(tempDir, fileName);
        // 6. 用fs.readFileSync同步读取文件内容
        const codeContent = fs.readFileSync(filePath, 'utf8');
        // 7. 从文件名中提取出原始文件名（去掉 roomId_ 前缀）把前缀替换成空字符串即可
        const realFileName = fileName.replace(`${roomId}_`, '');
        // 8. 把装好的代码的文件，放进我们的包裹里
        codePackage[realFileName] = codeContent;
      }
    });
    // 9. 无论包裹里有没有东西，都发给前端，让前端知道这是不是空房间！
    // 10. 如果有，就通过 socket.emit 发送给这个新用户，事件名叫 'initCodePackage' 
    // 精准投递：socket.emit 代表只给触发这个动作的本人发消息。
    socket.emit('initCodePackage', codePackage);
    // 打印日志，确认同步成功
    console.log(`[房间 ${roomId}] 已同步历史代码给用户 ${username} 发送了 ${Object.keys(codePackage).length} 个历史文件`);
  } catch (err) {
    console.error('读取代码文件失败:', err);
  }

  // 监听：代码变更同步 (排除发送者)
  socket.on('codeChange', (newCode) => {
    io.to(roomId).emit('codeChange', newCode);
  })

  // 新建文件
  socket.on('createFile', async (data) => {
    const { roomId, filename } = data;
    // 拼写出真实的文件路径，格式是：temp/房间ID_文件名
    const filePath = path.join(tempDir, `${roomId}_${filename}`);

    try {
      // 检查文件是否已经存在，防止覆盖别人的代码
      if (fs.existsSync(filePath)) {
        // 如果文件已经存在，直接返回，不创建新文件了
        socket.emit('terminalError', `创建文件：文件 ${filename} 已存在`);
        return;
      }

      // 用 fs 创建一个空文件 (写入空字符串)，代表新文件已经创建好了
      await fs.promises.writeFile(filePath, '', 'utf-8');

      // 创建成功后，广播给房间里所有人（包括自己），让大家的资源管理器都更新文件列表
      io.to(roomId).emit('fileCreated', {
        id: Date.now(),  // 给前端用的唯一 key
        name: filename,
        type: 'file',
        icon: '📄'
      });

    } catch (err) {
      // 如果写文件失败了，通知前端
      socket.emit('terminalError', `创建文件失败: ${err.message}`);
    }
  });

  // 监听：流式执行代码
  socket.on('executeCode', async (payload) => {
    // 兼容处理：从前端传来的对象中解构出代码字符串
    const codeStr = typeof payload === 'object' ? payload.code : payload;

    // 生成一个独一无二的临时文件路径
    const filePath = path.join(tempDir, `stream_${Date.now()}.js`);

    try {
      // 在准备写入文件和执行前，先广播给所有人：有人触发了运行！
      io.to(roomId).emit('executionStarted');

      await fs.promises.writeFile(filePath, codeStr, 'utf8');

      // API: spawn('node', [要执行的文件路径], { 配置对象 })
      // 安全要点: 配置对象里一定要加上 timeout: 5000 (限制最多跑5秒，防止死循环)
      const child = spawn('node', [filePath], { timeout: 5000 });

      // API: child.stdout.on('data', (data) => { ... })
      // data 默认是 Buffer(二进制数据)，发给前端前必须 data.toString()！
      // io.to(roomId).emit，实现全房间广播
      child.stdout.on('data', (data) => {
        io.to(roomId).emit('terminalOutput', data.toString());
      });

      child.stderr.on('data', (data) => {
        io.to(roomId).emit('terminalError', data.toString());
      });

      // API: child.on('close', async (exitCode) => { ... })
      // 动作 A: 告诉前端执行结束了 -> socket.emit('executionFinished', exitCode);
      // 动作 B (极度重要): 删除刚才生成的临时文件！ -> await fs.promises.unlink(filePath);
      child.on('close', async (exitCode) => {
        io.to(roomId).emit('executionFinished', exitCode);

        // 清理战场：删除临时文件
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      })

    } catch (err) {
      // 兜底：如果写入文件失败，通知前端
      io.to(roomId).emit('terminalError', `服务器内部错误: ${err.message}`);
    }
  });

  // 初始化用户的专属伪终端
  const userPty = new PtyManager(socket, roomId);

  socket.on('disconnect', () => {
    console.log(`[房间 ${roomId}] 用户 ${username} 已离开`);
    // 用户离开时，销毁属于他的终端进程
    if (userPty) {
      userPty.destroy();
    }
  })
})

// 5. 启动监听
server.listen(config.server.port, () => {
  console.log(`
  🚀 Server Running: http://${config.server.host}:${config.server.port}
  🔧 Mode: ${config.env.current}
  `);
});