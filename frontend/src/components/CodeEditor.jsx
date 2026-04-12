import Editor from '@monaco-editor/react';

// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。

export default function CodeEditor({ code, setCode }) {
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language="javascript"
        theme="vs-dark"
        value={code}
        onChange={(value) => setCode(value ?? '')}
        options={{
          fontSize: 16,
          minimap: { enabled: false },
          wordWrap: 'on',
          padding: { top: 16 }
        }}
      />
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> 77316cdc99d53785e0e0eea7ba7a838b30b3d428
