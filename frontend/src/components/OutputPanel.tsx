import React from 'react';
import useIDEStore from '../store/useIDEStore';

export default function OutputPanel() {
  // 1. 订阅全局状态：拿到我们在上一步收集到的运行结果
  const outputLogs = useIDEStore((state) => state.outputLogs);

  return (
    // 容器样式：占满父级、白色背景、允许垂直滚动
    <div className="h-full w-full bg-white overflow-y-auto p-4 font-mono text-sm leading-relaxed text-gray-700">
      {/* 2. 条件渲染：如果没有日志，显示提示语 */}
      {outputLogs.length === 0 ? (
        <div className='text-gray-400 italic'>等待代码运行...</div>
      ) : (
        /* 3. 列表渲染：遍历日志数组 */
        outputLogs.map((log) => (
          <div
            key={log.id}
            // 核心细节：whitespace-pre-wrap 可以完美保留后端传来的换行符和空格
            // 根据日志的 type 决定文字颜色
            className={`mb-1 whitespace-pre-wrap ${log.type === 'error' || log.type === 'stderr' ? 'text-red-500 font-semibold' : ''
              }`}
          >
            {log.text}
          </div>
        ))
      )}
    </div>
  )
}
