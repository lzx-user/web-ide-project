// 顶部战区
// 职责： 专注展示标题、当前文件名和“运行”按钮。
// 需要接收的数据 (Props)： 只需要知道当前选中的文件是谁（用来展示名字）。

{/* 顶部导航栏 (固定高度 48px) */ }
<div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
  <span className="font-semibold text-gray-400 flex items-center gap-2">
    Web IDE <span className="text-gray-600">/</span>
    {/* 🎯 动态显示当前选中的文件名 */}
    <span className="text-gray-200">{activeFile}</span>
  </span>
  <button className="bg-green-600 hover:bg-green-500 active:scale-95 text-white px-5 py-1.5 rounded text-sm font-bold shadow-lg transition-colors">
    ▶ 运行 (Run)
  </button>
</div>