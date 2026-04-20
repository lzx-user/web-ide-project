// import { useState } from 'react'; // 引入 React 的状态魔法
import Sidebar from './components/Sidebar'; // 引入侧边栏组件
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
import Login from './components/Login';
// T-06 后端的地址（比如 `http://localhost:3000`）发起连接请求。
// 6.1 引入刚刚装的拨号盘
import React, { useRef, useState, useEffect } from 'react';
import { socket, connectSocket } from './socket';
import { Editor } from '@monaco-editor/react';

/**
 * ================================================================
 * 【Web IDE 前端应用 - 完整执行流程说明】
 * ================================================================
 * 
 * 【初始化阶段】
 * 1. App组件挂载时，useEffect从URL获取roomId（如果有的话）
 * 2. 页面显示Login组件（登录大厅）
 * 
 * 【登录流程】
 * 1. 用户在Login组件输入昵称和房间号
 * 2. 点击"进入房间"按钮，调用handleJoinRoom(username, roomId)
 * 3. handleJoinRoom流程：
 *    (1) 调用 /api/join 后端接口，获取JWT Token
 *    (2) Token保存到localStorage（用于WebSocket认证）
 *    (3) 修改浏览器URL加入roomId参数
 *    (4) 调用connectSocket建立WebSocket长连接
 *    (5) 设置isJoined=true，界面切换到IDE编辑器
 * 
 * 【IDE编辑器运行】
 * 1. isJoined=true后，显示IDE主界面
 * 2. 用户在代码编辑器中输入代码 → handleCodeChange
 * 3. handleCodeChange：更新状态 + 通过WebSocket发送给后端
 * 4. 后端会广播给房间内的其他客户端（实时协作）
 * 5. 点击运行按钮 → handleRunCode
 * 6. handleRunCode：向后端发送代码 → 等待执行结果 → 终端显示输出
 * 
 * ================================================================
 */

/**
 * T-10 后端开发接收并保存前端代码字符串的 API
 * 前端：
 * 1. 确定触发时机
 * 2. 提取核心数据
 *    2.1 核心容器：存放编辑器底层实例 使用 useRef 钩子来创建一个引用容器。  状态管理：控制 UI 交互和终端显示
 *    2.2 捕获编辑器实例的回调函数 (传给 CodeEditor)  将实例装进 ref 容器
 *    2.3 保存逻辑 handleSave(传给 Header)   editorRef.current.getValue() 提取纯文本
 *    2.4 运行逻辑 handleRun(传给 Header)    editorRef.current.getValue() 提取纯文本
 *    2.5 App -> Header, CodeEditor, Terminal
 */

function App() {
  // 2.1 核心容器：存放编辑器底层实例 使用 useRef 钩子来创建一个引用容器。
  const editorRef = useRef(null);

  const [activeFile, setActiveFile] = useState('index.js');
  // 新增：保存当前编辑器里的代码
  const [currentCode, setCurrentCode] = useState('');
  // 新增：防抖状态，标记是否正在请求后端
  // 状态管理：控制 UI 交互和终端显示
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  // 新增：终端日志状态变更为可变状态
  const [terminalLogs, setTerminalLogs] = useState([
    { id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }
  ]);

  // 9.4 控制页面是显示“登录大厅”还是“IDE 编辑器”
  const [isJoined, setJoined] = useState(false);
  // 用于WebSocket连接，确保子组件能更新
  const [currentSocket, setCurrentSocket] = useState(null);
  // 从URL中获取roomId（用于快速进入指定房间）
  const [initialRoomId, setInitialRoomId] = useState('');

  // 模拟roomId
  const roomId = 'A2026';

  // 2.2 捕获编辑器实例的回调函数 (传给 CodeEditor) 
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;  // 将实例装进 ref 容器
    console.log("Monaco Editor 挂载成功，实例已捕获！");
  }

  // 2.3 保存逻辑 handleSave(传给 Header)   editorRef.current.getValue() 提取纯文本
  const handleSave = async () => {
    // console.log("🟢 按钮被点击了！当前状态检测:", {
    //   hasEditor: !!editorRef.current,
    //   isSaving: isSaving
    // });


    // 如果容器里有值就挂载 没有就返回
    if (!editorRef.current || isSaving) return;
    setIsSaving(true);
    addLog('info', '正在保存代码');

    try {
      const currentCode = editorRef.current.getValue();  // 提取纯文本
      // 也可以写成payload
      // const payload = {
      //   roomId: "project_1024",
      //   code: currentCode,
      //   language: 'javascript'
      // };
      // 用 fetch 方法像后端发送代码，请求执行
      const response = await fetch('http://localhost:3000/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // body: JSON.stringify(payload)
        body: JSON.stringify({
          roomId: roomId,
          code: currentCode,
          language: 'javascript'
        })
      })
    } catch (err) {
      console.log(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  /**
 * 执行代码
 * 流程：
 * 1. 校验编辑器有内容
 * 2. 设置运行状态为true（禁用按钮，防止重复点击）
 * 3. 向后端发送代码和语言类型
 * 4. 等待后端执行结果
 * 5. 根据执行结果在终端中输出相应颜色的日志
 * 6. 最后设置运行状态为false，恢复按钮
 */

  // 2.4 运行逻辑 handleRun(传给 Header)
  const handleRun = async () => {
    if (!editorRef.current || isRunning) return;
    setIsRunning(true);
    addLog('info', '正在运行代码');

    try {
      const currentCode = editorRef.current.getValue();  // 提前纯文本
      // 用 fetch 方法像后端发送代码，请求执行
      const response = await fetch('http://localhost:3000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomId,
          code: currentCode,
          language: 'javascript'
        })
      })
    } catch (err) {
      console.log(err.message);
    } finally {
      setIsRunning(false);
    }
  }

  // 6.3 使用 useEffect 来监听 Socket 的消息  保证只在页面刚打开时打一次电话
  useEffect(() => {
    // 9.5 页面加载时，检查 URL 中是否有 roomId 参数
    // 这样用户可以通过分享链接 (?roomId=123) 快速进入房间
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');
    if (roomFromUrl) {
      setInitialRoomId(roomFromUrl);
      console.log('从URL获取到roomId:', roomFromUrl);
    }

    // 监听前端自己是否连上了
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
  // 接收来自Login组件的用户名和房间号参数
  const handleJoinRoom = async (usernameInput, roomIdInput) => {
    // 注：Login组件已经验证过用户名和房间号不为空，这里无需再验证

    try {
      // ========== 【第1步】调用后端HTTP接口获取JWT Token ==========
      // 后端 /api/join 接口会：
      // 1. 验证roomId是否存在
      // 2. 生成JWT Token（包含用户信息）
      // 3. 返回Token给前端
      const res = await fetch('http://localhost:3000/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, roomId: roomIdInput })
      });
      const data = await res.json()

      if (data.success) {
        // ========== 【第2步】保存Token到localStorage ==========
        // Token会用于建立WebSocket长连接时进行身份验证
        localStorage.setItem('ide_token', data.token);

        // ========== 【第3步】更新浏览器URL，记录roomId ==========
        // 用户刷新页面时能自动恢复到该房间
        window.history.pushState({}, '', `?roomId=${roomIdInput}`);

        // ========== 【第4步】建立WebSocket长连接 ==========
        // connectSocket会：
        // 1. 创建socket连接到后端
        // 2. 携带roomId和Token进行身份验证
        // 3. 返回连接实例保存到状态
        const s = connectSocket(roomIdInput, data.token);
        setCurrentSocket(s);

        // ========== 【第5步】切换界面状态 ==========
        // isJoined变为true，触发App组件重新渲染
        // 页面从Login组件切换到真正的IDE编辑器界面
        setJoined(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.log('加入房间失败!', err.message);
    }
  }

  // T-07 前端监听编辑器内容并向服务器发送变更
  /**
   * 处理编辑器内容变化
   * 流程：
   * 1. 更新本地 currentCode 状态（保持UI和状态同步）
   * 2. 通过 WebSocket 向后端发送代码变更
   * 3. 后端会广播给房间内其他所有客户端，实现实时协作
   */
  const handleCodeChange = (newCode) => {
    // 同步更新状态
    setCurrentCode(newCode);
    // 如果WebSocket已连接，发送代码变更给后端
    if (currentSocket) {
      currentSocket.emit('codeChange', newCode);
    }
  }

  // 辅助函数：往终端追加日志
  /**
   * 向终端中添加新的日志消息
   * @param {string} type - 日志类型：'info'(蓝色)、'success'(绿色)、'error'(红色)
   * @param {string} text - 日志内容
   */
  const addLog = (type, text) => {
    setTerminalLogs(prev => [...prev, { id: Date.now(), type, text }]);
  };

  // ========== 【主要渲染逻辑】==========
  // 根据 isJoined 状态决定显示什么界面

  // 如果 isJoined = false，显示Login组件（登录/进入房间）
  if (!isJoined) {
    return <Login onJoinRoom={handleJoinRoom} initialRoomId={initialRoomId} />;
  };

  // 如果 isJoined = true，显示IDE编辑器界面
  // 整体布局：侧边栏 + 编辑器区域（上：代码编辑器 + 下：终端）
  return (
    // 最外层容器：撑满全屏，暗色背景
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">
      {/* 左侧：侧边栏（文件导航） */}
      <Sidebar activeFile={activeFile} setActiveFile={setActiveFile} />

      {/* 右侧：编辑器区域（flex-1占满剩余空间） */}
      <div className="flex-1 flex flex-col">

        {/* 顶部：Header（显示文件名、运行按钮） */}
        <Header
          activeFile={activeFile}
          isSaving={isSaving}
          isRunning={isRunning}
          onSave={handleSave}
          onRun={handleRun}
        />

        {/* 中间：代码编辑器（Monaco编辑器） */}
        {/* 
          Props说明：
          - code: 当前代码内容
          - setCode: 代码变更回调（会同步状态并广播给其他客户端）
          - roomId: 房间ID
          - socket: WebSocket实例（用于接收其他用户的代码变更）
        */}

        {/* 传入挂载拦截器 handleEditorDidMount */}
        <CodeEditor
          code={currentCode}
          setCode={handleCodeChange}
          roomId={initialRoomId}
          socket={currentSocket}
          onMount={handleEditorDidMount}
        />

        {/* 下方：终端（显示运行结果和日志） */}
        <Terminal logs={terminalLogs} />
      </div>
    </div>
  );
}

export default App;