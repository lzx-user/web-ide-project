import { useState } from 'react'; // 引入 React 的状态魔法
import Sidebar from './components/Sidebar'; // 引入侧边栏组件
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
// T-06 后端的地址（比如 `http://localhost:3000`）发起连接请求。
// 6.1 引入刚刚装的拨号盘
import { useEffect } from 'react';
import socket from './socket'; // 引入我们刚刚建立的 Socket 连接实例

function App() {
  const [activeFile, setActiveFile] = useState('index.js');
  // 新增：保存当前编辑器里的代码
  const [currentCode, setCurrentCode] = useState('console.log("Hello, 全栈世界!");');
  // 新增：防抖状态，标记是否正在请求后端
  const [isRunning, setIsRunning] = useState(false);
  // 新增：终端日志状态变更为可变状态
  const [terminalLogs, setTerminalLogs] = useState([
    { id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }
  ]);

  // T-07 前端监听编辑器内容并向服务器发送变更
  // 7.1 编辑器内容变化时，触发 handleRunCode 函数，向后端发送当前代码。
  const handleCodeChange = (newCode) => {
    // console.log("📸 [总部确认]：收到车间代码，准备拨号发给后端！");
    // 1. 同步更新 currentCode 状态，保持编辑器内容和状态一致。
    setCurrentCode(newCode);
    // 2. 发送给后端
    socket.emit('codeChange', newCode);
  }


  // 核心函数：触发代码运行
  const handleRunCode = async () => {
    if (!currentCode.trim()) return;

    setIsRunning(true);
    // 在终端打印开始执行的提示
    addLog('info', `> 正在执行 ${activeFile} ...`);

    try {
      // 向我们刚才写好的本地 Node.js 服务器发送代码
      const response = await fetch('http://localhost:3000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCode,
          language: 'javascript'
        })
      });

      const result = await response.json();

      // 根据后端返回的 success 字段决定输出颜色
      if (result.success) {
        addLog('success', result.output || '(无输出结果)');
      } else {
        addLog('error', result.output);
      }
    } catch (err) {
      addLog('error', '❌ 连接后端服务器失败，请检查 Server 是否已启动 (端口3000)。');
    } finally {
      setIsRunning(false);
    }
  };

  // 辅助函数：往终端追加日志
  const addLog = (type, text) => {
    setTerminalLogs(prev => [...prev, { id: Date.now(), type, text }]);
  };

  // 6.3 使用 useEffect 来监听 Socket 的消息  保证只在页面刚打开时打一次电话
  useEffect(() => {
    //监听前端自己是否连上了
    socket.on('connect', () => {
      console.log('我成功打通后端的电话了！');
    })
    // 当组件卸载(比如关闭页面)时，主动挂断电话
    return () => {
      // socket.disconnect();
    }
  }, [])

  return (
    // 最外层容器：撑满全屏 (h-screen w-screen)，采用 Flex 横向布局
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">
      {/* 把状态和修改状态的方法，当做参数 (Props) 传给侧边栏 */}
      <Sidebar activeFile={activeFile} setActiveFile={setActiveFile} />

      {/* {flex-1：确保编辑器能填满右侧剩余的所有空间，不留白边。} */}
      <div className="flex-1 flex flex-col">

        {/* 将方法作为 Props 传递 */}
        <Header activeFile={activeFile} onRunCode={handleRunCode} isRunning={isRunning} />

        {/* 编辑器需要 onChange 事件将用户输入同步给 currentCode 状态 */}
        {/* 7.2 把 handleCodeChange 包装成 setCode 传给子组件 */}
        <CodeEditor code={currentCode} setCode={handleCodeChange} />

        {/* 终端接收最新的日志数组进行渲染 */}
        <Terminal logs={terminalLogs} />
      </div>
    </div>
  );
}

export default App;