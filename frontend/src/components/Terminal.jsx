// 底部战区
// 职责： 专注显示系统日志和代码运行结果。

export default function Terminal({ logs }) {
  return (
    <div className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto">
      {logs.map(log => (
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
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> 77316cdc99d53785e0e0eea7ba7a838b30b3d428
