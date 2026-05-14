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
    // 使用 #161b22 提升层级，边框改为低对比度的 #30363d
    <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-6 shrink-0">

      {/* 左侧区域：项目与文件路径面包屑 */}
      <div className="flex items-center gap-3">
        {/* --- 新增：终端控制按钮 --- */}
        <button
          onClick={toggleTerminal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${isTerminalOpen
            ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' // 打开时的激活状态
            : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2d2e] border border-transparent' // 关闭时的闲置状态
            }`}
          title="切换终端面板"
        >
          <Terminal size={16} />
          终端
        </button>

        {/* 竖向分割线 */}
        <div className="w-px h-4 bg-[#30363d] mx-1"></div>

        {/* 项目 Logo 占位 */}
        <div className="bg-blue-500/10 p-1.5 rounded-md text-blue-400">
          <Code2 size={18} />
        </div>
        <span className="font-semibold text-gray-400 flex items-center gap-2 text-sm">
          Web IDE <span className="text-gray-600">/</span>
          <span className="text-gray-200">{activeFile}</span>
        </span>
      </div>

      {/* 右侧区域：核心操作按钮组 */}
      <div className="flex items-center gap-3">
        {/* 保存按钮 */}
        <button
          onClick={onSave}
          disabled={isSaving || isRunning} // 如果正在运行或正在保存，则禁用
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${isSaving
            ? 'text-gray-500 cursor-not-allowed'
            : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20'
            }`}
        >
          {/* 加入 animate-pulse 让 icon 在保存时有呼吸闪烁的效果 */}
          <Save size={16} className={isSaving ? 'animate-pulse' : ''} />
          {isSaving ? '保存中...' : '保存 (Save)'}
        </button>

        {/* 运行按钮 */}
        <button
          onClick={onRun}
          disabled={isRunning || isSaving} // 交叉互锁：保存时也不能运行
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${isRunning
            ? 'text-gray-500 cursor-not-allowed'
            : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
        >
          <Play size={16} className={isRunning ? 'animate-pulse' : ''} />
          {isRunning ? '运行中...' : '运行 (Run)'}
        </button>

        {/* 竖向分割线 */}
        <div className="w-px h-4 bg-gray-700 mx-1"></div>

        {/* --- 退出按钮 --- */}
        <button
          onClick={onLeave}
          className="flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-md text-sm transition-all"
          title="退出当前协作房间"
        >
          <LogOut size={16} />
          退出
        </button>
      </div>
    </div>
  );
}
