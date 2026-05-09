import React, { useState } from 'react';

/**
 * Sidebar 组件 (侧边资源管理器)
 * 职责：展示项目文件树结构，并允许用户切换当前正在编辑的文件。
 * @param {Object} props
 * @param {string} props.activeFile - 当前被激活（选中）的文件名，用于 UI 高亮控制。
 * @param {Function} props.setActiveFile - 状态变更回调，用于通知父组件 App 切换当前编辑的文件。
 */

export default function Sidebar({ activeFile, setActiveFile, fileList, setFileList, handleCreateFile }) {
  // 控制输入框的显示与隐藏
  const [showInput, setShowInput] = useState(false);
  // 绑定输入框的值
  const [newFileName, setNewFileName] = useState('');

  // 处理键盘回车事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (newFileName.trim() === '') return; // 防止创建空文件

      handleCreateFile(newFileName.trim());  // 调用父组件传来的创建文件函数

      // 恢复原状
      setNewFileName('');
      setShowInput(false);
    }
    // 按 Esc 键取消新建
    if (e.key === 'Escape') {
      setNewFileName('');
      setShowInput(false);
    }
  }
  return (
    <div className="w-[250px] bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* 标题头部 */}
      <div className="p-4 border-b border-gray-700 font-bold tracking-wider text-gray-300">
        📂 资源管理器
      </div>

      {/* 动态切换按钮和输入框 */}
      {showInput ? (
        <div className="p-2">
          <input
            autoFocus
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setShowInput(false)}  // 失去焦点时隐藏输入框
            className="w-full bg-gray-900 text-white px-2 text-sm border border-blue-500 outline-none"
            placeholder="输入文件名回车..."
          />
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-left flex items-center gap-2"
        >
          <span>➕</span> 新建文件
        </button>
      )}


      {/* 文件列表区域 */}
      <div className="p-4 text-sm text-gray-400">
        {fileList.map((file) => (
          <p
            key={file.id}
            onClick={() => setActiveFile(file.name)}
            className={`cursor-pointer py-1.5 px-2 rounded transition-colors mb-1 ${activeFile === file.name
              ? 'bg-blue-600 text-white'  // 选中状态样式
              : 'hover:bg-gray-700 hover:text-white'  // 常规状态及悬停样式
              }`}
          >
            <span>{file.icon}</span>
            <span>{file.name}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
