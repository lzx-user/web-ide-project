import React from 'react';
import Editor from '@monaco-editor/react';

/**
 * 纯展示组件 (Dumb Component)
 * 职责：只负责渲染 Monaco Editor，所有通信和防抖逻辑都交由父组件处理。
 */
export default function CodeEditor({ onMount, code, setCode }) {
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language="javascript"
        theme="light"
        value={code} // 永远只接收 App.jsx 传来的纯文本字符串
        onChange={(value) => setCode(value)} // 用户打字时，直接把最新字符串汇报给 App.jsx
        onMount={onMount}
        options={{
          fontSize: 15,
          minimap: { enabled: false },
          wordWrap: 'on',
          padding: { top: 16 },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", // 推荐的极客字体
        }}
      />
    </div>
  );
}
