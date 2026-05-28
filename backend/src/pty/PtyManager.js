// 一个纯粹的管理器 写成一个类，每次有用户需要终端时，就 new 一个出来。
const os = require('node:os');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

class PtyManager {
  constructor(socket, roomId) {
    this.socket = socket;
    this.roomId = roomId;

    // 1. 获取该房间的专属虚拟工作区
    const workspaceDir = path.join(__dirname, '../../temp', roomId);
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    // 为每个房间创建一个 pty 进程
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const args = os.platform() === 'win32' ? ['-NoLogo'] : [];

    // 1. 拷贝当前宿主机的环境变量，并强制注入我们自定义的 PS1
    const customEnv = Object.assign({}, process.env);
    if (os.platform() !== 'win32') {
      customEnv.PS1 = "\\u@web-ide:\\W\\$";
    }

    // 2. 将终端的活动目录死死锁定在这个工作区
    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: workspaceDir,  // 还原真实的 IDE 目录体验
      env: customEnv.env
    });

    // 监听进程输出，推给前端
    this.ptyProcess.on('data', (data) => {
      // 只发给当前触发的这个 socket, 或者发给整个房间
      this.socket.emit('terminal-out', data);
    });

    // 3. 监听前端输入，写入进程
    this.socket.on('terminal-in', (data) => {
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
      // 杀死整个进程树，防止僵尸进程
      if (this.ptyProcess) this.ptyProcess.kill();
    } catch (error) {
      console.log('PTY 进程清理完毕');
    }
  }
}

module.exports = PtyManager;