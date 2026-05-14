// 一个纯粹的管理器 写成一个类，每次有用户需要终端时，就 new 一个出来。
const os = require('node:os');
const pty = require('node-pty');

class PtyManager {
  constructor(socket, roomId) {
    this.socket = socket;
    this.roomId = roomId;

    // 为每个房间创建一个 pty 进程
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    // 如果是 windows，传入 -NoLogo 参数隐藏版权信息
    const args = os.platform() === 'win32' ? ['-NoLogo'] : [];

    // 1. 创建进程
    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.cwd(),
      env: process.env
    });

    // 2. 监听进程输出，推给前端
    this.ptyProcess.on('data', (data) => {
      console.log('3. [后端] Pty进程产生输出:', JSON.stringify(data)); // 埋点
      // 只发给当前触发的这个 socket, 或者发给整个房间
      this.socket.emit('terminal-out', data);
    });

    // 3. 监听前端输入，写入进程
    this.socket.on('terminal-in', (data) => {
      console.log('2. [后端] 收到前端输入指令:', JSON.stringify(data)); // 埋点
      this.ptyProcess.write(data);
    });
  }

  // 预留调整大小的方法
  resize(cols, rows) {
    this.ptyProcess.resize(cols, rows);
  }

  // 销毁方法：用户断开时一定要清理，防止服务器卡死
  destroy() {
    this.socket.removeAllListeners('terminal-in');
    try {
      // 退出进程，防止孤儿进程占用系统资源
      if (this.ptyProcess) {
        this.ptyProcess.kill();
      }
    } catch (error) {
      console.log('PTY 进程已销毁或无需销毁');
    }
  }
}

module.exports = PtyManager;