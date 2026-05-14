import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cloneDeep, debounce } from 'lodash'; // 防抖
import axios from 'axios';
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import toast, { Toaster } from 'react-hot-toast';
import { STORAGE_KEYS } from './utils/constants';
import useWorkspaceSocket from './hooks/useWorkspaceSocket';

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
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
    localStorage.removeItem(STORAGE_KEYS.IS_JOINED);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
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
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomIdInput);
        localStorage.setItem(STORAGE_KEYS.IS_JOINED, 'true');   // 持久化登陆状态
        window.history.pushState({}, '', `?roomId=${roomIdInput}`);  // 用户刷新页面时能自动恢复到该房间

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

  // 专门的卸载监听器
  useEffect(() => {
    // 组件卸载时，清空可能还处于倒计时中的防抖函数
    return () => {
      debouncedEmitCode.cancel();
    };
  }, [debouncedEmitCode]);

  // 用于彻底销毁底层编辑器模型
  useEffect(() => {
    // 页面刷新或彻底退出 IDE 界面时，销毁所有驻留内存的 Monaco Model
    return () => {
      if (monacoRef.current) {
        const models = monacoRef.current.editor.getModels();
        models.forEach((model) => model.dispose());
        console.log('已清理所有 Monaco Model 防止内存泄漏');
      }
    };
  }, []);
  // 5. 副作用监听 (URL & Socket)

  // 初始化：检查 URL 房间参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');

    // 检查本地存储是否有持久化状态
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
    const savedIsJoined = localStorage.getItem(STORAGE_KEYS.IS_JOINED) === 'true';

    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }

    // 如果有持久化状态且token有效，自动恢复登陆状态
    if (savedToken && savedRoomId && savedIsJoined) {
      setRoomId(savedRoomId);
      setJoined(true);

      // 读取上次离开前正在看的文件
      const savedActiveFile = localStorage.getItem(STORAGE_KEYS.ACTIVE_FILE);
      if (savedActiveFile) {
        setActiveFile(savedActiveFile);
      }

      // 自动建立 Socket 连接
      const s = connectSocket(savedRoomId, savedToken);
      setCurrentSocket(s);
    }
  }, []);

  /// 5. 挂载自定义 Hook：接管所有 Socket 核心业务通信
  // 为了让 Hook 里的 monaco 实例获取正确，将 monacoRef 挂载到 fileCacheMap 上传递
  fileCacheMap.current.monacoRef = monacoRef;

  useWorkspaceSocket({
    currentSocket,
    roomId,
    fileCacheMap,
    lastReceivedCodeRef,
    hasInitializedRef,
    setCurrentCode,
    setIsRunning,
    setJoined,
    clearPersistedState
  });

  // 监听切换文件的动作
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // 读取离线草稿 辅助函数
    const safeGetLocalStorage = (key) => {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn('读取本地存储失败 (可能处于无痕模式):', error);
        return null;
      }
    };
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
      const draftCode = safeGetLocalStorage(STORAGE_KEYS.getDraftKey(roomId, targetFile));
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
    // 最外层背景改为纯白
    <div className="h-screen w-screen bg-white text-gray-800 font-sans overflow-hidden flex flex-col">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="flex-1 overflow-hidden">
        <Allotment>
          <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
            <Sidebar
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              fileList={fileList}
              setFileList={setFileList}
              handleCreateFile={handleCreateFile}
            />
          </Allotment.Pane>

          <Allotment.Pane>
            <Allotment vertical>
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

              <Allotment.Pane preferredSize={250} minSize={100} visible={isTerminalOpen}>
                <div className="h-full w-full flex flex-col bg-white">
                  {/* 终端 Tab 栏变浅色 */}
                  <div className="h-9 flex items-center px-4 bg-[#f8f9fa] border-t border-b border-gray-200 shrink-0 justify-between">
                    <span className="text-[12px] font-mono text-gray-500 uppercase tracking-widest border-b-2 border-blue-500 h-full flex items-center pt-0.5">
                      Terminal
                    </span>
                    <button
                      onClick={() => setIsTerminalOpen(false)}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
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

      {/* --- 亮色极简状态栏 --- */}
      <div className="h-6 bg-white border-t border-gray-200 text-gray-500 text-[11px] flex items-center px-4 justify-between shrink-0 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            已连接房间: {roomId}
          </span>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <span className="hover:bg-gray-100 hover:text-gray-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors">UTF-8</span>
          <span className="hover:bg-gray-100 hover:text-gray-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors">JavaScript</span>
          <span className="hover:bg-gray-100 hover:text-gray-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors">Prettier</span>
        </div>
      </div>

    </div>
  );
}

export default App;
