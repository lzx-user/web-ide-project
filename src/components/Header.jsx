// 顶部战区
// 职责： 专注展示标题、当前文件名和“运行”按钮。
// 需要接收的数据 (Props)： 只需要知道当前选中的文件是谁（用来展示名字）。



export default function Header({ activeFile, onRunCode, isRunning }) {
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
      <span className="font-semibold text-gray-400 flex items-center gap-2">
        Web IDE <span className="text-gray-600">/</span>
        <span className="text-gray-200">{activeFile}</span>
      </span>

      {/* 绑定执行事件，运行时禁用按钮防止重复点击 */}
      <button
        onClick={onRunCode}
        disabled={isRunning}
        className={`px-5 py-1.5 rounded text-sm font-bold shadow-lg transition-all ${isRunning
          ? 'bg-gray-600 cursor-not-allowed text-gray-300'
          : 'bg-green-600 hover:bg-green-500 active:scale-95 text-white'
          }`}
      >
        {isRunning ? '⏳ 运行中...' : '▶ 运行 (Run)'}
      </button>
    </div>
  );
}