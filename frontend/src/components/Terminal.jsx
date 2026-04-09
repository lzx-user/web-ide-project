// 底部战区
// 职责： 专注显示系统日志和代码运行结果。
// 内部逻辑： 它自己管理一个 terminalLogs 的日志数组。

// 底部终端
const terminalLogs = [
  { id: 1, type: 'info', text: '# 终端控制台已启动，等待执行指令...' },
  { id: 2, type: 'success', text: '> [19:50:26] 编译成功，无语法错误。' },
  { id: 3, type: 'error', text: '> [19:50:27] Error: 这是一个测试报错信息！(红色警告)' }
]

{/* 底部终端控制台 (固定高度 256px) */ }
<div className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto">
  {/* 🎯 用 map 循环渲染日志，并根据日志的 type 改变字体颜色 */}
  {terminalLogs.map(log => (
    <p
      key={log.id}
      className={`mb-1 ${log.type === 'error' ? 'text-red-400' :
        log.type === 'success' ? 'text-green-400' :
          'text-gray-500'
        }`}
    >
      {log.text}
    </p>
  ))}
</div>