// 基于xterm.js的交互式终端

import { socket } from "../services/socket";
import Terminal from "./Terminal";

// 1. 初始化 xterm
const term = new Terminal();
term.open(document.getElementById(Terminal));

// 2. 捕获用户按键
term.onData((data) => {
  socket.on('terminal-in', data);  // 发给后端
})

// 3. 接收后端输出
socket.on('terminal-out', (data) => {
  term.write(data);  // 实时显示
})