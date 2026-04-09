import { useState } from 'react'; // 引入 React 的状态魔法
import Editor from '@monaco-editor/react'; // 引入 Monaco Editor 组件
import Sidebar from './components/Sidebar'; // 引入侧边栏组件
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';

function App() {
  // 🌟 核心魔法：记录当前选中的是哪个文件，默认选中第一个
  const [activeFile, setActiveFile] = useState('index.js');
  return (
    // 最外层容器：撑满全屏 (h-screen w-screen)，采用 Flex 横向布局
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">
      {/* 把状态和修改状态的方法，当做参数 (Props) 传给侧边栏 */}
      <Sidebar activeFile={activeFile} setActiveFile={setActiveFile} />

      {/* 🟢 T-02 任务核心 2：右侧主工作区 (占据剩余全部宽度) */}
      <div className="flex-1 flex flex-col">、

        {/* 顶部导航只需要知道当前名字，不需要修改它 */}
        <Header activeFile={activeFile} />

        {/* 中间的编辑器 */}
        <CodeEditor />

        {/* 底部终端 */}
        <Terminal />
      </div>
    </div>
  );
}

export default App;