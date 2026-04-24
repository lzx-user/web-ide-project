// 底部战区
// 职责： 专注显示系统日志和代码运行结果。
import { useEffect, useRef } from "react";

// T-11 终端组件需要处理自动滚动，并根据日志类型（info/error/system）显示不同的颜色。
export default function Terminal({ logs }) {
  const scrollRef = useRef(null);
  // 4. 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      // 每次 logs 更新时，滚动条自动到底部，模拟真实终端体验
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div ref={scrollRef} className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto">
      {logs.map(log => (
        <p
          key={log.id}
          className={`whitespace-pre-wrap mb-1 ${log.type === 'error' ? 'text-red-400' :
            log.type === 'system' ? 'text-green-400 font-bold' :
              'text-gray-200'
            }`}
        >
          {log.text}
        </p>
      ))}
    </div>
  );
}
