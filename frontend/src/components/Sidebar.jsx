import React, { useState } from 'react';
import { FolderKanban, Plus, FileCode2, X } from 'lucide-react';
/**
 * Sidebar 组件 (侧边资源管理器)
 * 职责：展示项目文件树结构，并允许用户切换当前正在编辑的文件。
 * @param {Object} props
 * @param {string} props.activeFile - 当前被激活（选中）的文件名，用于 UI 高亮控制。
 * @param {Function} props.setActiveFile - 状态变更回调，用于通知父组件 App 切换当前编辑的文件。
 */

export default function Sidebar({
  activeFile,
  setActiveFile,
  fileList,
  setFileList,
  handleCreateFile,
}) {
  // 控制输入框的显示与隐藏
  const [showInput, setShowInput] = useState(false);
  // 绑定输入框的值
  const [newFileName, setNewFileName] = useState('');

  // 处理键盘回车事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (newFileName.trim() === '') return; // 防止创建空文件

      handleCreateFile(newFileName.trim()); // 调用父组件传来的创建文件函数

      // 恢复原状
      setNewFileName('');
      setShowInput(false);
    }
    // 按 Esc 键取消新建
    if (e.key === 'Escape') {
      setNewFileName('');
      setShowInput(false);
    }
  };
  return (
    <div className="w-full h-full bg-[#161b22] flex flex-col shrink-0">
      {/* 标题头部 */}
      <div className="h-12 px-4 border-b border-[#30363d] flex items-center text-gray-300 font-medium text-sm tracking-wide gap-2">
        <FolderKanban size={18} className="text-blue-400" />
        资源管理器
      </div>

      {/* 动态切换按钮和输入框 */}
      <div className="p-3">
        {showInput ? (
          <div className="relative flex items-center">
            <input
              autoFocus
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setShowInput(false)}
              className="w-full bg-[#0d1117] text-gray-200 px-3 py-1.5 text-sm rounded border border-blue-500 outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
              placeholder="输入文件名回车..."
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowInput(false); }}
              className="absolute right-2 text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded text-sm text-gray-400 border border-dashed border-gray-600 hover:border-gray-400 hover:text-gray-200 transition-colors"
          >
            <Plus size={16} /> 新建文件
          </button>
        )}
      </div>

      {/* 文件列表区域 */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileList.map((file) => {
          const isActive = activeFile === file.name;
          return (
            <div
              key={file.id}
              onClick={() => setActiveFile(file.name)}
              className={`group cursor-pointer flex items-center gap-2.5 px-4 py-2 text-sm transition-all ${isActive
                ? 'bg-[#0d1117] text-blue-400 border-l-2 border-blue-500' // 精细的高亮指示线
                : 'text-gray-400 border-l-2 border-transparent hover:bg-[#2a2d2e] hover:text-gray-200'
                }`}
            >
              <FileCode2
                size={16}
                className={isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400"}
              />
              <span className="truncate">{file.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
