// 顶部战区
// 职责： 专注展示标题、当前文件名和“运行”按钮。
// 需要接收的数据 (Props)： 只需要知道当前选中的文件是谁（用来展示名字）。


// 1. 定义组件，并接收总部传来的“快递包裹”
export default function Header({ activeFile, onRunCode, isRunning }) {
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
      <span className="font-semibold text-gray-400 flex items-center gap-2">
        Web IDE <span className="text-gray-600">/</span>
        <span className="text-gray-200">{activeFile}</span>
      </span>

      {/* 绑定执行事件，运行时禁用按钮防止重复点击 */}
      <button
        // 3. 点击事件：用户一点，立刻按响总部给的“对讲机” (onRunCode)
        onClick={onRunCode}
        // 4. 禁用逻辑：如果总部说正在运行 (isRunning)，按钮就锁死，不让点
        disabled={isRunning}
        // 5. 动态变色：正在跑就变灰色 (bg-gray-600)，没跑就是绿色 (bg-green-600)
        className={`px-5 py-1.5 rounded text-sm font-bold shadow-lg transition-all ${isRunning
          ? 'bg-gray-600 cursor-not-allowed text-gray-300'
          : 'bg-green-600 hover:bg-green-500 active:scale-95 text-white'
          }`}
      >
        {/* 6. 动态文字：根据状态显示是“运行中”还是“运行”按钮 */}
        {isRunning ? '⏳ 运行中...' : '▶ 运行 (Run)'}
      </button>
    </div>
  );
}