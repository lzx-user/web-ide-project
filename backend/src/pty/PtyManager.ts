import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty, { type IPty } from 'node-pty';
import type { Socket } from 'socket.io';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/socket.js';

type WorkspaceSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export default class PtyManager {
  readonly socket: WorkspaceSocket;
  readonly roomId: string;
  readonly ptyProcess: IPty;

  constructor(socket: WorkspaceSocket, roomId: string) {
    this.socket = socket;
    this.roomId = roomId;

    const workspaceDir = path.join(__dirname, '../../temp', roomId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'powershell.exe' : 'bash';
    const args = isWindows ? ['-NoLogo'] : ['--norc'];
    const env = { ...process.env } as Record<string, string>;
    if (!isWindows) env.PS1 = '\\u@web-ide:\\W\\$';

    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: workspaceDir,
      env,
    });

    this.ptyProcess.onData((data) => this.socket.emit('terminal-out', data));
    this.socket.on('terminal-in', (data) => this.ptyProcess.write(data));
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
  }

  destroy(): void {
    this.socket.removeAllListeners('terminal-in');
    try {
      this.ptyProcess.kill();
    } catch {
      // 连接断开时进程可能已经退出，无需再次处理。
    }
  }
}
