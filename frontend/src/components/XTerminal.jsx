// 基于xterm.js的交互式终端
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit'; // 引入官方自适应插件
import { Eraser } from 'lucide-react';
import 'xterm/css/xterm.css';

// 接收 App 传下来的 currentSocket
export default function XTerminal({ currentSocket }) {
  const terminalRef = useRef(null); // 指向 DOM 容器
  const termRef = useRef(null); // 用于缓存 terminal 实例，防止重复创建

  // 3. 终端清屏功能
  const handleClear = () => {
    // 安全检查：确保终端已经被创建出来了再去清空
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  // 1. 负责初始化终端 UI (只在组件挂载时执行一次)
  useEffect(() => {
    if (!currentSocket || !terminalRef.current) return;

    // 创建终端实例
    const term = new Terminal({
      // 配置 xterm 的亮色主题
      theme: {
        background: '#ffffff',
        foreground: '#333333',
        cursor: '#333333',
        selectionBackground: '#bfdbfe', // tailwind blue-200
        black: '#000000',
        red: '#e11d48',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#c026d3',
        cyan: '#0891b2',
        white: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 13,
    });

    // 加入自适应插件
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // 挂载到 DOM
    term.open(terminalRef.current);

    // 缓存实例给其他 useEffect 用
    termRef.current = term;

    // 延迟几毫秒执行自适应，确保 React 和浏览器已经把 DOM 撑开
    setTimeout(() => {
      try {
        fitAddon.fit();
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
      term.dispose(); // 组件彻底卸载时销毁终端
    };
  }, []); // 依赖为空数组，确保只初始化一次

  // 2. 负责 Socket 数据的收发绑定
  useEffect(() => {
    const term = termRef.current;
    if (!currentSocket || !term) return;

    // 捕获前端键盘输入 -> 发给后端
    const disposable = term.onData((data) => {
      console.log('1. [前端发往后端]:', JSON.stringify(data));
      currentSocket.emit('terminal-in', data);
    });

    // 接收后端进程输出 -> 写入前端终端
    const handleOutput = (data) => {
      console.log('4. [前端收到输出]:', JSON.stringify(data));
      term.write(data);
    };
    currentSocket.on('terminal-out', handleOutput);

    // 切换 Socket 时的清理工作
    return () => {
      disposable.dispose(); // 清除键盘事件监听
      currentSocket.off('terminal-out', handleOutput);
    };
  }, [currentSocket]); // 只有 Socket 变化时才重新绑定通信

  // overflow-hidden 防止终端计算尺寸时撑爆父容器
  // 4. 渲染带悬浮按钮的 UI
  return (
    // 父容器：必须加上 relative (相对定位)，这样里面的按钮才能以它为边界进行悬浮
    <div className="relative h-full w-full bg-white">
      <button
        onClick={handleClear}
        className="absolute top-3 right-6 z-10 p-1.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all shadow-sm"
        title="清空终端"
      >
        <Eraser size={16} />
      </button>
      <div ref={terminalRef} className="h-full w-full p-2 pl-4 overflow-hidden"></div>
    </div>
  );
}
