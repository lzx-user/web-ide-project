// node-pty
import * as os from 'node:os';
import * as pty from 'node-pty';
import { socket } from '../../frontend/src/services/socket';

// 1. 为每个房间创建一个 pty 进程
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  row: 30,
  cwd: process.env.HOME,
  env: process.env
});

// ptyProcess.onData((data) => {
//   process.stdout.write(data);
// });

// ptyProcess.write('ls\r');
// ptyProcess.resize(100, 40);
// ptyProcess.write('ls\r');

// 2. 监听前端发来的输入
socket.on('terminal-in', (data) => {
  ptyProcess.write(data);  // 写入用户输入
});

// 3. 捕获 pty 的输出，实时发给后端
ptyProcess.on('data', (chunk) => {
  io.to(roomId).emit('terminal-out', chunk.toString());
})

module.exports = ptyProcess;