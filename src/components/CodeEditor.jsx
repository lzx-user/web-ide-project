// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。

{/* 🟢 T-03 任务核心：中间代码编辑区 (占据中间剩余全部高度) */ }
<div className="flex-1">
  <Editor
    height="100%"
    defaultLanguage="javascript"
    theme="vs-dark"
    defaultValue="// 欢迎来到你的 Web IDE！&#10;// 在这里写下你的第一行代码：&#10;console.log('Hello, 面试官!');"
    options={{
      fontSize: 16,             // 字体大小
      minimap: { enabled: false }, // 关闭右侧代码缩略图，保持界面清爽
      wordWrap: 'on',           // 自动换行
      padding: { top: 16 }      // 顶部留白，视觉更舒适
    }}
  />
</div>