import Editor from '@monaco-editor/react';

// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。

// 这里的 { setCode } 就是接收总部传下来的那个 handleCodeChange 方法的引用，
export default function CodeEditor({ code, setCode }) {
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language="javascript"  // 开启 JS 语法高亮，让代码变彩色。
        theme="vs-dark"
        value={code}
        // 第三步实现：Monaco Editor 一旦发现内容变了，立刻执行 setCode
        // 这里的 value 就是用户刚打进去的最新的那一串代码
        onChange={(value) => {
          // console.log("📸 [车间汇报]：Monaco 察觉到打字了！当前内容是：", value);
          setCode(value ?? '');
        }}
        options={{
          fontSize: 16,
          minimap: { enabled: false },   // 关掉右侧小地图，小屏幕下节省空间。
          wordWrap: 'on',   // 自动折行，代码太长时不用拉横向滚动条。
          padding: { top: 16 }
        }}
      />
    </div>
  );
}
