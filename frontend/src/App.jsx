import React, { useRef, useState, useEffect, useCallback } from 'react';
import { add, debounce } from 'lodash';  // 防抖
import axios from 'axios';

// 组件与服务引入
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
import Login from './components/Login';
import { socket, connectSocket } from './services/socket';
import request from './services/request';  // 统一请求封装
import { Editor } from '@monaco-editor/react';

// 状态定义 -> 核心业务逻辑 -> 副作用监听 -> UI 渲染。
/**
 * Web IDE 核心调度组件
 * 思路：
 * 1. 状态提升：将编辑器代码、终端日志和 Socket 实例存放在顶层 App，以便在 Header、Editor 和 Terminal 之间共享。
 * 2. 双重通信：利用 HTTP 请求（Axios）处理登录、保存等瞬时操作；利用 WebSocket 处理代码同步和运行结果实时输出。
 * 3. 实例捕获：通过 useRef 捕获 Monaco Editor 实例，直接读取内容以保证获取的是最新编辑值。
 */

function App() {
  // 1. 引用与状态定义
  const editorRef = useRef(null);  // 核心容器：存放编辑器底层实例 使用 useRef 钩子来创建一个引用容器。

  const [activeFile, setActiveFile] = useState('index.js');
  const [currentCode, setCurrentCode] = useState('');  // 编辑器代码内容
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([
    { id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }
  ]);

  const [isJoined, setJoined] = useState(false);  // 登录状态控制
  const [currentSocket, setCurrentSocket] = useState(null);  // WebSocket实例状态
  const [initialRoomId, setInitialRoomId] = useState('');  // URL初始房间号

  // 2. 辅助函数：往终端追加日志
  /**
   * 向终端中添加新的日志消息
   * @param {string} type - 日志类型：'info'(蓝色)、'success'(绿色)、'error'(红色)
   * @param {string} text - 日志内容
   */
  const addLog = (type, text) => {
    setTerminalLogs(prev => [...prev, { id: Date.now(), type, text }]);
  };

  // 3. 核心业务处理器

  // 捕获编辑器实例的回调函数 (传给 CodeEditor) 
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;  // 将实例装进 ref 容器
    console.log("Monaco Editor 挂载成功，实例已捕获！");
  }

  // 登录/加入房间流程
  const handleJoinRoom = async (usernameInput, roomIdInput) => {
    try {
      // 1. 调用 /api/join 后端接口，获取JWT Token
      const { data } = await request.post('/join', {
        username: usernameInput,
        roomId: roomIdInput
      });

      if (data.success) {
        // 2. 持久化Token到 localStorage 并在 URL 中记录 roomId
        localStorage.setItem('ide_token', data.token);
        window.history.pushState({}, '', `?roomId=${roomIdInput}`);  // 用户刷新页面时能自动恢复到该房间

        // 3. 使用获取到的Token和房间号建立WebSocket连接
        const s = connectSocket(roomIdInput, data.token);
        setCurrentSocket(s);

        // 4. 进入 IDE 编辑器界面
        setJoined(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.log('加入房间失败:', err.message);
      addLog('error', '系统错误: 无法建立连接');
    }
  }

  // 保存代码逻辑
  const handleSave = async () => {
    // 如果容器里有值就挂载 没有就返回
    if (!editorRef.current || isSaving) return;
    setIsSaving(true);
    addLog('info', '正在保存代码');

    try {
      const code = editorRef.current.getValue();  // 提取纯文本
      // 使用 axios 发送 POST 请求，axios 会自动将对象转换为 JSON 并设置 Content-Type
      await request.post('/save', {
        roomId: initialRoomId || 'A2026',  // 如果 URL 中没有 roomId 参数，默认使用 'A2026' 作为测试房间
        code,
        language: 'javascript'
      });
      addLog('info', '保存成功');
    } catch (err) {
      addLog('error', '保存失败: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  // 运行代码逻辑
  const handleRun = async () => {
    if (!editorRef.current || isRunning) return;
    setIsRunning(true);

    const code = editorRef.current.getValue();  // 提取纯文本
    addLog('info', '正在运行代码...');

    // 1. 通过 Socket 告知后端开始执行(用于状态同步)
    if (currentSocket) currentSocket.emit('executeCode', code);

    try {
      // 2. 通过HTTP 触发真实执行流程
      await request.post('/run', {
        roomId: initialRoomId || 'A2026',
        code,
        language: 'javascript'
      });
    } catch (err) {
      addLog('error', '运行失败: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  }

  // 代码变更同步(含防抖)
  const debouncedEmitCode = useCallback(
    debounce((code) => {
      if (currentSocket) currentSocket.emit('codeChange', code);
    }, 500),
    [currentSocket]
  );

  const handleCodeChange = (newCode) => {
    // 同步更新状态
    setCurrentCode(newCode);
    // 防抖发送给后端
    debouncedEmitCode(newCode);
  }

  // 4. 副作用监听 (URL & Socket)

  // 初始化：检查 URL 房间参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');
    if (roomFromUrl) setInitialRoomId(roomFromUrl);
  }, []);

  // Socket 消息监听：终端回音
  useEffect(() => {
    // 安全门防崩。如果 socket 是 null，直接中断执行  **防御性编程**防止组件未挂载时找不到 socket 实例。
    if (!socket) return;

    const handleOutput = (data) => addLog('info', data);
    const handleError = (data) => addLog('error', data);
    const handleFinish = (exitCode) => addLog('info', `\n[进程执行完毕，退出码: ${exitCode}]`);

    currentSocket.on('terminalOutput', handleOutput);
    currentSocket.on('terminalError', handleError);
    currentSocket.on('executionFinished', handleFinish);
    currentSocket.on('connect', () => console.log('WebSocket 已连接'));

    // 清理监听器，防止内存泄漏和重复监听
    return () => {
      currentSocket.off('terminalOutput', handleOutput);
      currentSocket.off('terminalError', handleError);
      currentSocket.off('executionFinished', handleFinish);
    }
  }, [currentSocket]);



  // 5. 渲染逻辑

  // 场景 A：未登录，显示登录大厅
  if (!isJoined) {
    return <Login onJoinRoom={handleJoinRoom} initialRoomId={initialRoomId} />;
  };

  // 场景 B：登录成功，显示 IDE 主界面
  return (
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">
      <Sidebar activeFile={activeFile} setActiveFile={setActiveFile} />

      {/* 右侧：编辑器区域（flex-1占满剩余空间） */}
      <div className="flex-1 flex flex-col">

        <Header
          activeFile={activeFile}
          isSaving={isSaving}
          isRunning={isRunning}
          onSave={handleSave}
          onRun={handleRun}
        />

        {/* 传入挂载拦截器 handleEditorDidMount */}
        <CodeEditor
          code={currentCode}
          setCode={handleCodeChange}
          roomId={initialRoomId}
          socket={currentSocket}
          onMount={handleEditorDidMount}
        />

        <Terminal logs={terminalLogs} />
      </div>
    </div>
  );
}

export default App;