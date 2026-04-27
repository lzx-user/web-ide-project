import React, { useEffect, useRef } from "react";

/**
 * Terminal 组件 (终端输出面板)
 * 职责：负责渲染系统日志、代码运行结果以及报错信息，并维护自动滚动到底部的体验。
 * @param {Object} props
 * @param {Array} props.logs - 日志数组，数据结构要求: { id: number, type: 'info'|'error'|'system', text: string }
 */
export default function Terminal({ logs }) {
  // 获取终端容器的 DOM 引用，用于后续操控滚动条
  const scrollRef = useRef(null);

  /**
   * 副作用：自动滚动逻辑
   * 监听 logs 数组的变化。每当追加新日志并触发重新渲染后，将容器的滚动高度 (scrollTop) 
   * 设置为容器的总内容高度 (scrollHeight)，实现紧跟最新日志的效果。
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={scrollRef}
      className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto"
    >
      {logs.map(log => {
        // 根据日志类型动态计算 Tailwind 文本颜色样式
        let textColorClass = 'text-gray-200'; // 默认普通信息颜色
        if (log.type === 'error') textColorClass = 'text-red-400';
        if (log.type === 'system') textColorClass = 'text-green-400 font-bold';

        return (
          <p
            key={log.id}
            className={`whitespace-pre-wrap mb-1 ${textColorClass}`}
          >
            {log.text}
          </p>
        );
      })}
    </div>
  );
}