# T-03：集成 Monaco Editor 打造专业编辑器

## 1、开发思路

### **第一步：安装“顶级内核”**

原本我们用普通的 `<textarea>` 只能打字，没有颜色，也没有自动补全。我们要引入微软开源的 `monaco-editor` 的 React 版本。

#### **1.1 安装依赖**

在前端项目的终端输入：

```
npm install @monaco-editor/react
```

### **第二步：编写专业编辑器组件 (CodeEditor.jsx)**

我们要把这个内核封装成一个好用的组件，并设置好主题、字号和各种“防乱码”逻辑。

**核心知识点（敲黑板）：** * **`value`**：这是受控组件的核心，它显示的是总部传来的那份代码。

- **`onChange`**：这是实时监听器，只要用户敲了一个字母，它就立刻把新代码发回总部。
- **`?? ''`**：这是防崩溃咒语，万一编辑器传回个空值，我们也给总部一个空字符串，保证程序不闪退。

```react
// CodeEditor.jsx
import Editor from '@monaco-editor/react';

export default function CodeEditor({ code, setCode }) {
  return (
    <div className="flex-1"> {/* 撑满剩余空间 */}
      <Editor
        height="100%" // 高度填满
        language="javascript" // 开启 JS 彩色高亮
        theme="vs-dark" // 酷黑主题
        value={code} // 总部传给我的代码
        
        // 核心：打字就同步给总部
        onChange={(value) => setCode(value ?? '')} 
        
        options={{
          fontSize: 16, // 字大一点
          minimap: { enabled: false }, // 关掉右边的小地图
          wordWrap: 'on', // 自动折行，不让代码跑出屏幕
          padding: { top: 16 } // 顶部留空，不压抑
        }}
      />
    </div>
  );
}
```

------

### **第三步：总部联动 (App.jsx)**

总部需要准备一个专门存代码的容器（State），并把它分发给编辑器。

```react
// App.jsx
function App() {
  // 3.1 准备好存代码的“大脑”
  const [currentCode, setCurrentCode] = useState('console.log("Hello, 全栈世界!");');

  return (
    // ... 其他代码 ...
    
    {/* 3.2 传给组件：code 是内容，setCode 是改内容的对讲机 */}
    <CodeEditor code={currentCode} setCode={setCurrentCode} />
    
    // ...
  )
}
```

------

## 2、验证结果

1. **视觉验证**：打开浏览器，你应该能看到一个和 VS Code 几乎一模一样的黑底编辑器。
2. **功能验证**：
   - 在里面敲代码，是否有彩色高亮？
   - 尝试把代码全删掉，看看页面有没有报错（如果没有报错，说明你的 `?? ''` 起作用了）！

------

## 💡 面试必杀技

如果面试官问：“你为什么选择 `@monaco-editor/react` 而不是直接操作原生的 Monaco 实例？”

你要这样回答：

> “在外企的 React 项目中，我们追求 **‘声明式编程’**。这个库帮我们处理了 Monaco 的异步加载和实例卸载等复杂的生命周期逻辑，让我能通过简单的 `value` 和 `onChange` 属性来操作编辑器。这极大提升了开发效率，并减少了内存泄漏的风险。
