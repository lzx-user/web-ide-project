// import { useState } from 'react'; // 引入 React 的状态魔法
import Sidebar from './components/Sidebar'; // 引入侧边栏组件
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
// T-06 后端的地址（比如 `http://localhost:3000`）发起连接请求。
// 6.1 引入刚刚装的拨号盘
import React, { useState, useEffect } from 'react';
import { socket, connectSocket } from './socket';


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

  // 9.4 控制页面是显示“登录大厅”还是“IDE 编辑器”
  // 大步骤 2：开发前端大厅界面与状态管理
  const [isJoined, setJoined] = useState(false);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentSocket, setCurrentSocket] = useState(null);  // 存入状态，确保子组件能更新

  // 6.3 使用 useEffect 来监听 Socket 的消息  保证只在页面刚打开时打一次电话
  useEffect(() => {
    // 9.5 页面加载时，检查 URL 中是否有 roomId 参数
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
      console.log(roomFromUrl);
    }

    //监听前端自己是否连上了
    if (socket) {
      socket.on('connect', () => {
        console.log('我成功打通后端的电话了！');
      })
    }
    // 当组件卸载(比如关闭页面)时，主动挂断电话
    return () => {
      // socket.disconnect();
    }
  }, [])  // 空依赖数组表示仅在组件挂载时执行一次

  // 9.6 加入房间的函数
  const handleJoinRoom = async () => {
    if (!username || !roomId) {
      return alert('请输入昵称和房间号');
    }

    try {
      // 1. 调用后端的HTTP接口 获取Token
      const res = await fetch('http://localhost:3000/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roomId })
      });
      const data = await res.json()

      if (data.success) {
        // 2. 把拿到手的Token存进浏览器的 `localStorage` 里。
        const local = localStorage.setItem('ide_token', data.token);
        // console.log(local);
        // 3. 修改浏览器地址栏 带上roomId
        window.history.pushState({}, '', `?roomId=${roomId}`);
        // 4. 调用connectSocket,建立 WebSocket 长连接 连接并保存到State里
        const s = connectSocket(roomId, data.token);
        setCurrentSocket(s);
        // 5. 切换界面状态，显示真正的编辑器
        setJoined(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.log('加入房间失败!', err.message);
    }
  }

  // T-07 前端监听编辑器内容并向服务器发送变更
  // 7.1 编辑器内容变化时，触发 handleRunCode 函数，向后端发送当前代码。
  const handleCodeChange = (newCode) => {
    // console.log("📸 [总部确认]：收到车间代码，准备拨号发给后端！");
    // 1. 同步更新 currentCode 状态，保持编辑器内容和状态一致。
    setCurrentCode(newCode);
    // 2. 发送给后端
    if (socket) {
      socket.emit('codeChange', newCode);
    }
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

  // 渲染判断：如果没有加入房间，显示【检票大厅】
  if (!isJoined) {
    return (
      // 改为明亮背景：bg-slate-50
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-800">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-96">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Web IDE 协作空间</h1>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="你的昵称"
              className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="text"
              placeholder="房间号"
              className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button
              onClick={handleJoinRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold shadow-md transition-colors"
            >
              进入房间
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 如果 isJoined 为 true，显示【真正的编辑器页面】
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
        {/* 将 socket 作为 prop 传给编辑器，彻底解决空白/不更新问题 */}
        <CodeEditor code={currentCode} setCode={handleCodeChange} roomId={roomId} socket={currentSocket} />

        {/* 终端接收最新的日志数组进行渲染 */}
        <Terminal logs={terminalLogs} />
      </div>
    </div>
  );
}

export default App;