// 顶部战区
// 职责： 专注展示标题、当前文件名和“运行”按钮。
// 需要接收的数据 (Props)： 只需要知道当前选中的文件是谁（用来展示名字）。


// 1. 定义组件，并接收总部传来的“快递包裹”
export default function Header({ activeFile, isRunning, onRun, onSave, isSaving }) {
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
      <span className="font-semibold text-gray-400 flex items-center gap-2">
        Web IDE <span className="text-gray-600">/</span>
        <span className="text-gray-200">{activeFile}</span>
      </span>

      {/* 保存按钮 */}
      <button
        onClick={onSave}
        disabled={isSaving || isRunning}  // 如果正在运行也禁用保存
        className={`px-4 py-2 rounded ${isSaving ? 'bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
      >
        {isSaving ? '保存中...' : '💾 保存 (Save)'}
      </button>
      {/* 绑定执行事件，运行时禁用按钮防止重复点击 */}
      <button
        // 3. 点击事件：用户一点，立刻按响总部给的“对讲机” (onRunCode)
        onClick={onRun}
        // 4. 禁用逻辑：如果总部说正在运行 (isRunning)，按钮就锁死，不让点
        disabled={isRunning || isSaving} // 如果正在保存，也禁用运行
        className={`px-4 py-2 rounded ${isRunning ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'} transition-colors`}
      >
        {/* 6. 动态文字：根据状态显示是“运行中”还是“运行”按钮 */}
        {isRunning ? '⏳ 运行中...' : '▶ 运行 (Run)'}
      </button>
    </div>
  );
}