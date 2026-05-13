// 基于xterm.js的交互式终端
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit'; // 引入官方自适应插件
import 'xterm/css/xterm.css';

// 接收 App 传下来的 currentSocket
export default function XTerminal({ currentSocket }) {
  const terminalRef = useRef(null);  // 指向 DOM 容器
  const termRef = useRef(null);  // 用于缓存 terminal 实例，防止重复创建

  // 1. 负责初始化终端 UI (只在组件挂载时执行一次)
  useEffect(() => {
    if (!currentSocket || !terminalRef.current) return;

    // 创建终端实例
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' },  // 可以自定义一些漂亮的外观
      fontFamily: 'Consolas, "Courier New", monospace',
    });

    // 加入自适应插件
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // 挂载到 DOM
    term.open(terminalRef.current);
    term.write('欢迎来到 Web IDE 终端...\r\n');

    // 缓存实例给其他 useEffect 用
    termRef.current = term;

    // 延迟几毫秒执行自适应，确保 React 和浏览器已经把 DOM 撑开
    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch (e) { }
    }, 50);

    // 监听浏览器窗口大小变化，终端自动重排
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) { }
    });
    resizeObserver.observe(terminalRef.current);

    // 清理函数
    return () => {
      resizeObserver.disconnect();
      term.dispose();  // 组件彻底卸载时销毁终端
    };
  }, []);  // 依赖为空数组，确保只初始化一次

  // 2. 负责 Socket 数据的收发绑定
  useEffect(() => {
    const term = termRef.current;
    if (!currentSocket || !term) return;

    // 捕获前端键盘输入 -> 发给后端
    const disposable = term.onData((data) => {
      console.log('1. [前端发往后端]:', JSON.stringify(data));
      currentSocket.emit('terminal-in', data);
    })

    // 接收后端进程输出 -> 写入前端终端
    const handleOutput = (data) => {
      console.log('4. [前端收到输出]:', JSON.stringify(data));
      term.write(data);
    };
    currentSocket.on('terminal-out', handleOutput);

    // 切换 Socket 时的清理工作
    return () => {
      disposable.dispose();  // 清除键盘事件监听
      currentSocket.off('terminal-out', handleOutput);
    };
  }, [currentSocket]);  // 只有 Socket 变化时才重新绑定通信

  // overflow-hidden 防止终端计算尺寸时撑爆父容器
  return <div ref={terminalRef} className='h-full w-full overflow-hidden'></div>;
} 