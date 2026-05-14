import React from 'react';
import { Save, Play, LogOut, Code2, Terminal } from 'lucide-react';
import useIDEStore from '../store/useIDEStore';
/**
 * Header 组件 (顶部导航控制栏)
 * 职责：展示项目名称、当前活动文件，并提供全局级别的核心操作（保存、运行）。
 * 设计思路：
 * 1. 纯展示组件 (Dumb Component)：自身不维护任何状态，所有数据(activeFile)和交互状态(isRunning, isSaving)完全依赖父组件传递，遵循“单向数据流”。
 * 2. 防重复点击：利用 disabled 属性，在保存或运行时交叉锁死按钮，防止用户连续点击触发多重网络请求。
 */

export default function Header({
  activeFile,
  isRunning,
  onRun,
  onSave,
  isSaving,
  onLeave,
}) {
  // 直接从 Zustand 获取终端状态和方法
  const isTerminalOpen = useIDEStore((state) => state.isTerminalOpen);
  const toggleTerminal = useIDEStore((state) => state.toggleTerminal);

  return (
    // 背景纯白，边框极浅
    <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">

      <div className="flex items-center gap-3">
        <div className="bg-blue-50 p-1.5 rounded-md text-blue-600">
          <Code2 size={18} />
        </div>
        <span className="font-semibold text-gray-400 flex items-center gap-2 text-sm">
          Web IDE <span className="text-gray-300">/</span>
          <span className="text-gray-800">{activeFile}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTerminal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${isTerminalOpen
              ? 'text-blue-700 bg-blue-50 border border-blue-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
            }`}
        >
          <Terminal size={16} />
          终端
        </button>

        <div className="w-px h-4 bg-gray-200 mx-2"></div>

        <button
          onClick={onSave}
          disabled={isSaving || isRunning}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${isSaving
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
        >
          <Save size={16} className={isSaving ? 'animate-pulse text-blue-500' : ''} />
          保存
        </button>

        <button
          onClick={onRun}
          disabled={isRunning || isSaving}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${isRunning
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
        >
          <Play size={16} className={isRunning ? 'animate-pulse text-emerald-500' : ''} />
          运行
        </button>

        <div className="w-px h-4 bg-gray-200 mx-2"></div>

        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-md text-sm transition-all"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
