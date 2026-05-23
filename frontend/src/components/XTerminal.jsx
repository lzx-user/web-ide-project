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

  // 终端清屏功能
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
      // 深度定制的高对比度亮色主题 (类似 VS Code Light / GitHub Light)
      theme: {
        background: '#ffffff',       // 纯白背景
        foreground: '#333333',       // 柔和的深灰主文字，避免纯黑的生硬感
        cursor: '#005cc5',           // 光标改为清晰的亮蓝色，提升现代感
        selectionBackground: '#add6ff',  // vsc 经典的浅蓝色选中色

        // --- ANSI 色板全面调优（专为亮色背景设计，解决刺眼问题） ---
        black: '#000000',
        brightBlack: '#666666',
        red: '#cd3131',
        brightRed: '#cd3131',
        green: '#008000',            // 压暗绿色，PowerShell 路径更清晰
        brightGreen: '#14ce14',
        yellow: '#795e26',           // 深土黄色，完美解决原版黄色刺眼且看不清的问题
        brightYellow: '#b58900',     // 稍亮的暗橙黄，保留警示感但不伤眼
        blue: '#0451a5',
        brightBlue: '#0451a5',
        magenta: '#bc05bc',
        brightMagenta: '#bc05bc',
        cyan: '#0598bc',
        brightCyan: '#0598bc',
        white: '#555555',
        brightWhite: '#a5a5a5'
      },
      fontFamily: "Consolas, 'Courier New', monospace", // 使用最标准的终端字体
      fontSize: 14,                  // 稍微调大1px，保护视力
      fontWeight: 'normal',   // 取消加粗，防止渲染边缘模糊
      cursorBlink: true,             // 开启光标闪烁，交互体验更原生
      macOptionIsMeta: true,  // 优化按键兼容性
    });

    // 加入自适应插件
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // 挂载到无 padding 的干净纯净容器上
    term.open(terminalRef.current);
    termRef.current = term;  // 缓存实例给其他 useEffect 用

    // 新增：等待后端初始化命令执行完毕，再清一次屏
    setTimeout(() => {
      if (termRef.current) {
        termRef.current.clear();
      }
    }, 800);

    // 增加宽高缓存，防止冗余 resize 触发后端 PTY 重绘清屏
    let lastCols = 0;
    let lastRows = 0;
    let resizeTimer = null;

    // 精准尺寸同步函数
    const syncSize = () => {
      try {
        // 增加安全拦截：只有当容器有了真实的宽高，才去计算
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
          fitAddon.fit();
          // 告诉后端当前的精准行列数
          if (currentSocket && term.cols && term.rows) {
            // 只有当真实的列数或行数发生改变时，才通知后端
            if (term.cols !== lastCols || term.rows !== lastRows) {
              currentSocket.emit('terminal-resize', {
                cols: term.cols,
                rows: term.rows
              });
              lastCols = term.cols;
              lastRows = term.rows;
            }
          }
        }
      } catch (e) {
        console.warn('Xterm 自适应尺寸调整被挂起:', e.message); // 良好的错误日志习惯
      }
    };

    // 引入 150ms 防抖，锁死 Allotment 分割线拖拽及状态重绘时的微小尺寸震荡
    const debouncedSyncSize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncSize, 150);
    };

    // 初始等待容器布局就绪后同步
    setTimeout(syncSize, 100);

    // 监听浏览器窗口大小变化，同步给后端
    const resizeObserver = new ResizeObserver(() => {
      debouncedSyncSize();
    });
    resizeObserver.observe(terminalRef.current);

    // 清理函数
    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      term.dispose(); // 组件彻底卸载时销毁终端
    };
  }, [currentSocket]); // 加上依赖，防止 Socket 状态机变更时未解绑

  // 2. 负责 Socket 数据的双向绑定
  useEffect(() => {
    const term = termRef.current;
    if (!currentSocket || !term) return;

    // 捕获前端键盘输入 -> 发给后端
    const disposable = term.onData((data) => {
      currentSocket.emit('terminal-in', data);
    });

    // 接收后端进程输出 -> 写入前端终端
    const handleOutput = (data) => {
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
    // 将 p-2 pl-4 从下面的真实渲染容器中剥离，移到最外层包裹 div 上！
    <div className="relative h-full w-full bg-white p-2 pl-4">
      <button
        onClick={handleClear}
        className="absolute top-3 right-6 z-10 p-1.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all shadow-sm"
        title="清空终端"
      >
        <Eraser size={16} />
      </button>

      {/* 核心安全区：这个容器是绝对纯净的、无 padding 干扰的，FitAddon 计算准确率达到 100% */}
      <div ref={terminalRef} className="h-full w-full overflow-hidden"></div>
    </div>
  );
}
