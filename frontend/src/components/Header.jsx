import React from "react";

/**
 * Header 组件 (顶部导航控制栏)
 * 职责：展示项目名称、当前活动文件，并提供全局级别的核心操作（保存、运行）。
 * 设计思路：
 * 1. 纯展示组件 (Dumb Component)：自身不维护任何状态，所有数据(activeFile)和交互状态(isRunning, isSaving)完全依赖父组件传递，遵循“单向数据流”。
 * 2. 防重复点击：利用 disabled 属性，在保存或运行时交叉锁死按钮，防止用户连续点击触发多重网络请求。
 */

export default function Header({ activeFile, isRunning, onRun, onSave, isSaving, onLeave }) {
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
      {/* 左侧区域：项目与文件路径面包屑 */}
      <span className="font-semibold text-gray-400 flex items-center gap-2">
        Web IDE <span className="text-gray-600">/</span>
        <span className="text-gray-200">{activeFile}</span>
      </span>

      {/* 右侧区域：核心操作按钮组 */}
      <div className="flex gap-4">
        {/* 保存按钮 */}
        <button
          onClick={onSave}
          disabled={isSaving || isRunning} // 如果正在运行或正在保存，则禁用
          className={`px-4 py-2 rounded transition-colors text-white ${isSaving
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {isSaving ? '⏳ 保存中...' : '💾 保存 (Save)'}
        </button>

        {/* 运行按钮 */}
        <button
          onClick={onRun}
          disabled={isRunning || isSaving} // 交叉互锁：保存时也不能运行
          className={`px-4 py-2 rounded transition-colors text-white ${isRunning
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700'
            }`}
        >
          {isRunning ? '⏳ 运行中...' : '▶ 运行 (Run)'}
        </button>

        {/* --- 新增的退出按钮 --- */}
        <button
          onClick={onLeave}
          className="bg-red-600/80 hover:bg-red-600 px-4 py-1.5 rounded text-sm transition-colors border border-red-500/30"
          title="退出当前协作房间"
        >
          退出房间
        </button>
      </div>
    </div>
  );
}