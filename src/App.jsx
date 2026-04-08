import Editor from '@monaco-editor/react';

function App() {
  return (
    // 最外层容器：撑满全屏 (h-screen w-screen)，采用 Flex 横向布局
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">

      {/* 🟢 T-02 任务核心 1：左侧侧边栏 (固定宽度 250px) */}
      <div className="w-[250px] bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 font-bold tracking-wider text-gray-300">
          📂 资源管理器
        </div>
        <div className="p-4 text-sm text-gray-400">
          {/* 这里先写死几个假文件，后续阶段我们再把它们做成动态的 */}
          <p className="cursor-pointer hover:text-green-400 py-1 transition-colors">📄 index.js</p>
          <p className="cursor-pointer hover:text-white py-1 transition-colors">📄 package.json</p>
        </div>
      </div>

      {/* 🟢 T-02 任务核心 2：右侧主工作区 (占据剩余全部宽度) */}
      <div className="flex-1 flex flex-col">

        {/* 顶部导航栏 (固定高度 48px) */}
        <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
          <span className="font-semibold text-gray-400">Web IDE - 独立开发版</span>
          <button className="bg-green-600 hover:bg-green-500 text-white px-5 py-1.5 rounded text-sm font-bold shadow-lg transition-colors">
            ▶ 运行 (Run)
          </button>
        </div>

        {/* 🟢 T-03 任务核心：中间代码编辑区 (占据中间剩余全部高度) */}
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            defaultValue="// 欢迎来到你的 Web IDE！&#10;// 在这里写下你的第一行代码：&#10;console.log('Hello, 面试官!');"
            options={{
              fontSize: 16,             // 字体大小
              minimap: { enabled: false }, // 关闭右侧代码缩略图，保持界面清爽
              wordWrap: 'on',           // 自动换行
              padding: { top: 16 }      // 顶部留白，视觉更舒适
            }}
          />
        </div>

        {/* 底部终端控制台 (固定高度 256px) */}
        <div className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto">
          <p className="text-gray-500 mb-2"># 终端控制台已启动，等待执行指令...</p>
          <p className="text-green-400">{"> "} 程序运行结果将在此处输出</p>
        </div>

      </div>
    </div>
  );
}

export default App;