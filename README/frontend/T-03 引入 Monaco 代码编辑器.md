# Web IDE 开发文档 - T-03: 引入 Monaco 代码编辑器

## 🎯 核心目标

在右侧的中间自适应区域，接入微软开源的 Monaco Editor（VS Code 的底层核心），赋予项目真实的代码编辑、语法高亮和智能提示功能。

## 🛠️ 开发思路与关键配置

### 1. 安装与引入

通过引入 `@monaco-editor/react` 封装包，在 React 中无缝使用 Monaco 引擎，无需手动操作底层 DOM。

- 安装命令：`npm install @monaco-editor/react`

### 2. 编辑器核心配置参数

使用 `<Editor />` 组件时，通过传递 `props` 深度定制编辑器体验：

- `theme="vs-dark"`：一键使用经典的 VS Code 暗黑主题。
- `defaultLanguage="javascript"`：默认开启 JS 语法高亮和错误检查。
- `options={{ minimap: { enabled: false } }}`：关闭右侧代码缩略图，在有限的网页版面中节省空间。

### 3. 核心代码集成

```react
import Editor from '@monaco-editor/react';

// ...在 T-02 预留的中间 flex-1 区域插入组件...
<div className="flex-1">
  <Editor
    height="100%"
    defaultLanguage="javascript"
    theme="vs-dark"
    defaultValue="// 欢迎来到 Web IDE"
    options={{
      fontSize: 16,
      minimap: { enabled: false }, // 关闭缩略图
      wordWrap: 'on',              // 开启自动换行
      padding: { top: 16 }         // 顶部留白，提升视觉呼吸感
    }}
  />
</div>
```

