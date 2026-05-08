import React from 'react';

/**
 * 模拟文件列表数据
 * 在真实项目中，这些数据通常来自后端 API 或全局状态管理（如 Redux/Context）
 */

const FILE_LIST = [
  { id: 1, name: 'index.js', type: 'file', icon: '📄' },
  { id: 2, name: 'package.json', type: 'file', icon: '📄' },
  { id: 3, name: 'style.css', type: 'file', icon: '📄' }
];

/**
 * Sidebar 组件 (侧边资源管理器)
 * 职责：展示项目文件树结构，并允许用户切换当前正在编辑的文件。
 * @param {Object} props
 * @param {string} props.activeFile - 当前被激活（选中）的文件名，用于 UI 高亮控制。
 * @param {Function} props.setActiveFile - 状态变更回调，用于通知父组件 App 切换当前编辑的文件。
 */

export default function Sidebar({ activeFile, setActiveFile }) {
  return (
    <div className="w-[250px] bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* 标题头部 */}
      <div className="p-4 border-b border-gray-700 font-bold tracking-wider text-gray-300">
        📂 资源管理器
      </div>

      {/* 文件列表区域 */}
      <div className="p-4 text-sm text-gray-400">
        {FILE_LIST.map((file) => (
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
