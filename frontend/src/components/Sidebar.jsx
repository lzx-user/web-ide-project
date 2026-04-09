// 左侧区域
// 职责： 专注渲染文件树列表。
// 需要接收的数据 (Props)： 需要知道当前选中的文件是谁（用来高亮），还需要一个能修改当前选中文件的方法（点击时触发）。

// 左侧文件树
const fileList = [
  { id: 1, name: 'index.js', type: 'file', icon: '📄' },
  { id: 2, name: 'package.json', type: 'file', icon: '📄' },
  { id: 3, name: 'style.css', type: 'file', icon: '📄' }
];

{/* 🟢 T-02 任务核心 1：左侧侧边栏 (固定宽度 250px) */ }
<div className="w-[250px] bg-gray-800 border-r border-gray-700 flex flex-col">
  <div className="p-4 border-b border-gray-700 font-bold tracking-wider text-gray-300">
    📂 资源管理器
  </div>
  <div className="p-4 text-sm text-gray-400">
    {fileList.map((file) => (
      <p
        key={file.id}
        onClick={() => setActiveFile(file.name)} // 🎯 点击时，改变当前激活的文件名
        className={`cursor-pointer py-1.5 px-2 rounded transition-colors mb-1 ${activeFile === file.name
          ? 'bg-blue-600 text-white' // 如果被选中了，变成蓝色底
          : 'hover:bg-gray-700 hover:text-white' // 如果没被选中，保留你的 hover 效果
          }`}
      >
        {file.icon} {file.name}
      </p>
    ))}
  </div>
</div>