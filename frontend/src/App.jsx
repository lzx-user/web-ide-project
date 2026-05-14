import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cloneDeep, debounce } from 'lodash'; // 防抖
import axios from 'axios';
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import toast, { Toaster } from 'react-hot-toast';

// 组件与服务引入
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import XTerminal from './components/XTerminal';
import Login from './components/Login';
import { socket, connectSocket } from './services/socket';
import request from './services/request'; // 统一请求封装
import { Editor } from '@monaco-editor/react';
// 引入全新状态引擎
import useIDEStore from './store/useIDEStore';

// 状态定义 -> 核心业务逻辑 -> 副作用监听 -> UI 渲染。
/**
 * Web IDE 核心调度组件
 * 思路：
 * 1. 状态提升：将编辑器代码、终端日志和 Socket 实例存放在顶层 App，以便在 Header、Editor 和 Terminal 之间共享。
 * 2. 双重通信：利用 HTTP 请求（Axios）处理登录、保存等瞬时操作；利用 WebSocket 处理代码同步和运行结果实时输出。
 * 3. 实例捕获：通过 useRef 捕获 Monaco Editor 实例，直接读取内容以保证获取的是最新编辑值。
 */

function App() {
  // 1. 订阅 Zustand 仓库状态
  const isJoined = useIDEStore((state) => state.isJoined);
  const setJoined = useIDEStore((state) => state.setJoined);

  const roomId = useIDEStore((state) => state.roomId);
  const setRoomId = useIDEStore((state) => state.setRoomId);

  const currentSocket = useIDEStore((state) => state.socket);
  const setCurrentSocket = useIDEStore((state) => state.setSocket);

  const activeFile = useIDEStore((state) => state.activeFile);
  const setActiveFile = useIDEStore((state) => state.setActiveFile);

  // 目录树状态
  const fileList = useIDEStore((state) => state.fileList);
  const setFileList = useIDEStore((state) => state.setFileList);
  // 引入 Store 里的方法
  const addFileToFileList = useIDEStore((state) => state.addFileToFileList);

  const isTerminalOpen = useIDEStore((state) => state.isTerminalOpen);
  const setIsTerminalOpen = useIDEStore((state) => state.setIsTerminalOpen);

  // 2. 底层实例缓存(依然需要保留)
  const editorRef = useRef(null); //  用于存放编辑器的 DOM 容器，确保实例捕获与 UI 渲染解耦，避免不必要的 re-render 导致实例丢失。
  const monacoRef = useRef(null); // 缓存 Monaco 实例，用来创建模型和其他编辑器相关的操作
  const fileCacheMap = useRef(new Map()); // 使用 useRef 缓存文件状态，格式 { [path]: { model, viewState } }
  const prevFileRef = useRef(null); // 记录上一个文件路径，便于切换时保存视图状态
  const lastReceivedCodeRef = useRef({}); // 记录最后一次切换的文件路径，便于在收到后端代码包时正确更新当前文件的内容
  // 防断线重连覆盖锁
  const hasInitializedRef = useRef(false);

  // 3. 局部 UI 状态
  const [currentCode, setCurrentCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // 清除持久化状态的函数
  const clearPersistedState = () => {
    localStorage.removeItem('ide_token');
    localStorage.removeItem('ide_roomId');
    localStorage.removeItem('ide_isJoined');
  };

  // 4. 核心业务处理器

  // 捕获编辑器实例的回调函数 (传给 CodeEditor)
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor; // 将实例装进 ref 容器
    monacoRef.current = monaco; // 记录 monaco 核心对象，一会创建 Model 时会用到
    console.log('Monaco Editor 挂载成功，实例已捕获！');

    // 初始化：给默认打开的index.js 创建模型
    const initialModel = monaco.editor.createModel(
      currentCode || '', // 初始代码
      'javascript', // 语言
      monaco.Uri.parse(`file://index.js`) // 模拟文件路径
    );
    editor.setModel(initialModel); // 设置编辑器使用这个模型

    // 存入文件缓存
    fileCacheMap.current.set('index.js', {
      model: initialModel,
      viewState: null, // 初始没有视图状态
    });
  };

  // 登录/加入房间流程
  const handleJoinRoom = async (usernameInput, roomIdInput) => {
    try {
      // 1. 调用 /api/join 后端接口，获取JWT Token
      const { data } = await request.post('/join', {
        username: usernameInput,
        roomId: roomIdInput,
      });

      if (data.success) {
        // 2. 持久化Token到 localStorage 并在 URL 中记录 roomId
        localStorage.setItem('ide_token', data.token);
        localStorage.setItem('ide_roomId', roomIdInput);
        localStorage.setItem('ide_isJoined', 'true'); // 持久化登陆状态
        window.history.pushState({}, '', `?roomId=${roomIdInput}`); // 用户刷新页面时能自动恢复到该房间

        // 更新 Zustand 全局状态
        setRoomId(roomIdInput);

        // 3. 使用获取到的Token和房间号建立WebSocket连接
        const s = connectSocket(roomIdInput, data.token);
        setCurrentSocket(s); // 赋值给 state，去触发底下的 useEffect

        // 4. 进入 IDE 编辑器界面
        setJoined(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.log('加入房间失败:', err.message);
      toast.error('系统错误: 无法建立连接');
    }
  };

  // 创建文件逻辑 只管emit事件，具体文件创建和同步逻辑由后端处理
  const handleCreateFile = (filename) => {
    if (currentSocket) {
      // 像后端发送创建请求
      currentSocket.emit('createFile', { roomId, filename });
    }
  };

  // 保存代码逻辑
  const handleSave = async () => {
    // // 如果没有房间号，直接拦截，不让它往后端发瞎请求
    if (!editorRef.current || isSaving || !roomId) {
      writeLog('error', '未获取到房间号，无法保存');
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading('正在保存代码...');

    try {
      const code = editorRef.current.getValue(); // 提取纯文本
      // 使用 axios 发送 POST 请求，axios 会自动将对象转换为 JSON 并设置 Content-Type
      await request.post('/save', {
        roomId: roomId,
        code,
        filename: activeFile, // 传递当前编辑的文件名，后端可以根据这个信息进行保存
        language: 'javascript',
      });
      toast.success('保存成功', { id: loadingToast });
    } catch (err) {
      toast.error('保存失败: ' + err.message, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  // 运行代码逻辑
  const handleRun = async () => {
    if (!editorRef.current || isRunning || !roomId) {
      writeLog('error', '未获取到房间号，无法运行代码');
      return;
    }
    const code = editorRef.current.getValue(); // 提取纯文本

    // 通过 Socket 向后端发送执行请求，携带当前代码和文件名
    if (currentSocket) currentSocket.emit('executeCode', { roomId, code });
  };

  // 退出房间
  const handleLeaveRoom = () => {
    // 1. 清理浏览器的本地存储缓存
    clearPersistedState();

    // 2. 告诉后端我要断开了
    if (currentSocket) {
      currentSocket.disconnect();
    }

    // 3. 直接跳转回根路径，并刷新整个页面状态
    // 瞬间清空所有的 React 状态，内存缓存，并重新渲染 Login 页面
    window.location.href = '/';
  };

  // 代码变更同步(含防抖)  降维打击闭包陷阱！
  const debouncedEmitCode = useCallback(
    debounce((code) => {
      // 直接用 getState() 从金库拿绝对最新的实例和文件名！再也不用在依赖数组里猜了
      const latestSocket = useIDEStore.getState().socket;
      const latestFile = useIDEStore.getState().activeFile;

      if (latestSocket) {
        latestSocket.emit('codeChange', {
          code: code,
          filename: latestFile, // 告诉后端哪个文件变了
        });
      }
    }, 500),
    [] // 留空，保证防抖函数只创建一次，永不重新生成，彻底告别闭包陷阱
  );

  const handleCodeChange = (newCode) => {
    // 同步更新状态
    setCurrentCode(newCode);

    const currentFile = useIDEStore.getState().activeFile; // 从金库里拿最新的当前文件

    // 把每一笔敲下的代码实时拍进本地硬盘
    localStorage.setItem(`draft-${roomId}-${currentFile}`, newCode);

    // 如果当前代码等于刚刚 Socket 塞进来的代码，说明这是别人改的，不要再发回去了，直接返回
    if (newCode === lastReceivedCodeRef.current[currentFile]) return;

    // 如果是自己动手敲的，正常发给后端
    debouncedEmitCode(newCode);
  };

  // 5. 副作用监听 (URL & Socket)

  // 初始化：检查 URL 房间参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');

    // 检查本地存储是否有持久化状态
    const savedToken = localStorage.getItem('ide_token');
    const savedRoomId = localStorage.getItem('ide_roomId');
    const savedIsJoined = localStorage.getItem('ide_isJoined') === 'true';

    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }

    // 如果有持久化状态且token有效，自动恢复登陆状态
    if (savedToken && savedRoomId && savedIsJoined) {
      setRoomId(savedRoomId);
      setJoined(true);

      // 读取上次离开前正在看的文件
      const savedActiveFile = localStorage.getItem('ide_activeFile');
      if (savedActiveFile) {
        setActiveFile(savedActiveFile);
      }

      // 自动建立 Socket 连接
      const s = connectSocket(savedRoomId, savedToken);
      setCurrentSocket(s);
    }
  }, []);

  // Socket 消息监听：终端回音
  useEffect(() => {
    // 安全门防崩。如果 socket 是 null，直接中断执行  **防御性编程**防止组件未挂载时找不到 socket 实例。
    if (!currentSocket) return;

    const handleOutput = (data) => writeLog('info', data);
    const handleError = (data) => writeLog('error', data);
    const handleFinish = (exitCode) =>
      writeLog('info', `\n[进程执行完毕，退出码: ${exitCode}]`);

    // 监听后端广播的文件创建成功事件
    const handleFileCreated = (newFileObj) => {
      // Zustand 优雅写法：直接调用 Store 里的追加方法，不用担心闭包问题，内部会自动拿到最新状态
      addFileToFileList(newFileObj);
    };
    currentSocket.on('fileCreated', handleFileCreated);
    currentSocket.on('terminalOutput', handleOutput);
    currentSocket.on('terminalError', handleError);
    // 监听开始运行事件，这时候再统一更新所有人的 UI
    currentSocket.on('executionStarted', () => {
      setIsRunning(true);
      writeLog('info', '正在运行代码...'); // 让所有人的终端都打印这句话
    });
    currentSocket.on('executionFinished', (exitCode) => {
      handleFinish(exitCode);
      setIsRunning(false);
    });
    currentSocket.on('connect', () => console.log('WebSocket 已连接'));

    // 连接错误时清除持久化状态
    currentSocket.on('connect_error', (err) => {
      console.log('连接失败详情:', err.message);
      // 清除持久化状态，防止无限重连
      clearPersistedState();
      setJoined(false);
      alert('连接服务器失败，可能是登录已过期，请重新进入房间。');
    });

    // 监听后端发来的历史代码包
    currentSocket.on('initCodePackage', (codePackage) => {
      // 如果已经初始化过，说明这是断线重连，直接拒收旧代码！
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true; // 标记已经初始化过了

      console.log('📦 收到房间历史代码包:', codePackage);

      // 判断是不是 空房间
      if (Object.keys(codePackage).length === 0) {
        setActiveFile(''); // 清除默认的index.js
        setFileList([]); // 清空左侧文件树
        setCurrentCode(''); // 清空编辑器内容
        return;
      }

      // 1. 用 getState() 取最新文件
      const targetFile = useIDEStore.getState().activeFile; // 从金库里拿最新的目标文件名
      if (codePackage[targetFile] !== undefined) {
        // 同样去缓存找一下当前文件的草稿
        const draftCode = localStorage.getItem(`draft-${roomId}-${targetFile}`);
        // 更新 React状态，让编辑器初始显示这段代码
        setCurrentCode(
          draftCode !== null ? draftCode : codePackage[targetFile]
        );
      }
      // 2. 如果 Monaco 实例已经准备好了，把所有文件塞进底层模型
      if (monacoRef.current) {
        // 遍历代码包里的每个文件，创建模型并存入缓存 entries() 方法会返回一个给定对象自身可枚举属性的键值对数组 方便遍历
        Object.entries(codePackage).forEach(([filename, code]) => {
          // 把服务器发来的代码记录在小本本上，以便在收到后续的代码变更时能正确判断是否需要更新编辑器内容
          lastReceivedCodeRef.current[filename] = code;

          let cache = fileCacheMap.current.get(filename); // 先看看文件柜里有没有这个文件的模型
          if (cache) {
            // 如果有，就更新模型内容（说明这个文件之前就被打开过了）
            if (cache.model.getValue() !== code) {
              cache.model.setValue(code);
            }
          } else {
            // 如果服务器发来的是没保存的代码，先去本地兜底找
            const draftCode = localStorage.getItem(
              `draft-${roomId}-${filename}`
            );
            // 如果本地有草稿，优先用草稿的，否则用服务器的
            const finalCode = draftCode !== null ? draftCode : code;

            // 如果没有，就创建一个新的模型（说明这个文件之前没被打开过，是个新文件）
            const newModel = monacoRef.current.editor.createModel(
              finalCode,
              'javascript',
              monacoRef.current.Uri.parse(`file://${filename}`)
            );
            // 存入文件柜，初始视图状态为 null
            fileCacheMap.current.set(filename, {
              model: newModel,
              viewState: null,
            });
          }
        });
      }

      // 把历史文件名提取出来，生成初始的 fileList 数组
      const initFileList = Object.keys(codePackage).map((filename, index) => ({
        id: index,
        name: filename,
        type: 'file',
        icon: '📄',
      }));
      setFileList(initFileList); // 塞进 React 状态里渲染侧边栏
    });

    // 拦截别人发过来的协同代码
    currentSocket.on('codeChange', (payload) => {
      const { code, filename } = payload;

      // 如果发现解构出来的代码不是字符串，直接拦截，防止白屏
      if (typeof code !== 'string') return;

      // 记录最后一次收到的代码和对应的文件名，以便在 handleCodeChange 里判断这段代码是不是别人改的
      lastReceivedCodeRef.current[filename] = code;

      // 直接去文件柜里找别人改的那个文件
      const targetCache = fileCacheMap.current.get(filename);

      // 如果文件柜里有，直接悄悄修改底层 Model 的内容
      // 这里千万不能用 setCurrentCode，因为 setCurrentCode 会强行触发整个页面的重新渲染！
      // Monaco 的 setValue 是静默修改底层数据，极其丝滑，不会引起 React 的任何 re-render，所以编辑器实例不会丢失，用户体验极佳。
      if (targetCache) {
        // 额外加一个判断：为了防止光标乱跳，只有当传过来的代码和现在的代码不一样时才修改
        if (targetCache.model.getValue() !== code) {
          targetCache.model.setValue(code);
        }
      }
    });

    // 清理监听器，防止内存泄漏和重复监听
    return () => {
      currentSocket.off('terminalOutput', handleOutput);
      currentSocket.off('terminalError', handleError);
      currentSocket.off('executionFinished', handleFinish);
      currentSocket.off('codeChange');
      currentSocket.off('initCodePackage');
      currentSocket.off('executionStarted');
      currentSocket.off('fileCreated', handleFileCreated);
    };
  }, [currentSocket]);

  // 监听切换文件的动作
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    // 防御性编程：如果编辑器或 Monaco 实例尚未准备好，则不进行切换
    if (!editor || !monaco) return;

    const prevFile = prevFileRef.current;
    const targetFile = activeFile;

    // 每次文件真正切换时，存入本地记忆
    localStorage.setItem('ide_activeFile', targetFile);

    // 1. 整理旧文件现场：保存当前看的文件进度(viewState)
    if (prevFile && fileCacheMap.current.has(prevFile)) {
      const currentState = editor.saveViewState(); // 记录光标的位置'
      const oldCache = fileCacheMap.current.get(prevFile);
      oldCache.viewState = currentState; // 把viewState 夹进旧文件里
    }

    // 2. 找新文件：去fileCacheMap中查找目标文件
    let targetCache = fileCacheMap.current.get(targetFile);

    // 3. 如果没有就创建一个新的模型
    if (!targetCache) {
      // 去缓存里拿离线代码，如果没有就给空字符串
      const draftCode =
        localStorage.getItem(`draft-${roomId}-${targetFile}`) || '';
      // (在真实项目中，这里可能需要去发 axios 请求获取文件内容，这里我们先用空字符串代替)
      const newModel = monaco.editor.createModel(
        draftCode, // 离线代码
        'javascript',
        monaco.Uri.parse(`file://${targetFile}`) // 根据targetFile的后缀判断是css还是json
      );
      targetCache = { model: newModel, viewState: null };
      fileCacheMap.current.set(targetFile, targetCache); // 存入缓存

      // 同步到 React 状态，让界面刷新
      setCurrentCode(draftCode);
    } else {
      // 如果文件已经打开过，也要同步一下状态
      setCurrentCode(targetCache.model.getValue());
    }

    // 4. 切换模型并恢复视图状态
    editor.setModel(targetCache.model);
    if (targetCache.viewState) {
      editor.restoreViewState(targetCache.viewState); // 恢复上次的光标位置
    }

    // 5. 更新 prevFileRef 为当前文件，为下一次切换做准备
    prevFileRef.current = targetFile;
  }, [activeFile]); // 每当 activeFile 变化时触发切换逻辑

  // 6. 渲染 UI

  if (!isJoined) {
    return <Login onJoinRoom={handleJoinRoom} initialRoomId={roomId} />;
  }

  return (
    // 最外层容器改为 flex flex-col，为底部的状态栏留出位置
    <div className="h-screen w-screen bg-[#0d1117] text-gray-200 font-sans overflow-hidden flex flex-col">
      <Toaster position="top-center" reverseOrder={false} />

      {/* 主体工作区（占据除状态栏外的所有剩余空间） */}
      <div className="flex-1 overflow-hidden">
        <Allotment>
          {/* 左侧侧边栏 */}
          <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
            <Sidebar
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              fileList={fileList}
              setFileList={setFileList}
              handleCreateFile={handleCreateFile}
            />
          </Allotment.Pane>

          {/* 右侧编辑区与终端 */}
          <Allotment.Pane>
            <Allotment vertical>
              {/* 上半部：编辑器 */}
              <Allotment.Pane>
                <div className="flex flex-col h-full w-full">
                  <Header
                    activeFile={activeFile}
                    isSaving={isSaving}
                    isRunning={isRunning}
                    onSave={handleSave}
                    onRun={handleRun}
                    onLeave={handleLeaveRoom}
                  />
                  <CodeEditor
                    code={currentCode}
                    setCode={handleCodeChange}
                    onMount={handleEditorDidMount}
                  />
                </div>
              </Allotment.Pane>

              {/* 下半部：终端（通过 visible 属性控制显示/隐藏） */}
              <Allotment.Pane preferredSize={250} minSize={100} visible={isTerminalOpen}>
                <div className="h-full w-full flex flex-col bg-[#0d1117]">
                  <div className="h-9 flex items-center px-4 bg-[#161b22] border-b border-t border-[#30363d] shrink-0 justify-between">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest border-b-2 border-blue-500 h-full flex items-center">
                      Terminal
                    </span>
                    {/* 面板内部也可以加一个关闭按钮 */}
                    <button
                      onClick={() => setIsTerminalOpen(false)}
                      className="text-gray-500 hover:text-gray-300"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    {currentSocket && <XTerminal currentSocket={currentSocket} />}
                  </div>
                </div>
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>

      {/* --- 点睛之笔：底部状态栏 Status Bar --- */}
      <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-4 justify-between shrink-0 font-medium tracking-wide shadow-[0_-2px_10px_rgba(37,99,235,0.2)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 hover:bg-blue-700 px-1 py-0.5 rounded cursor-pointer transition-colors">
            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
            已连接房间: {roomId}
          </span>
        </div>
        <div className="flex items-center gap-4 text-blue-100">
          <span className="hover:bg-blue-700 px-1 py-0.5 rounded cursor-pointer">UTF-8</span>
          <span className="hover:bg-blue-700 px-1 py-0.5 rounded cursor-pointer">JavaScript</span>
          <span className="hover:bg-blue-700 px-1 py-0.5 rounded cursor-pointer">Prettier</span>
        </div>
      </div>

    </div>
  );
}

export default App;
