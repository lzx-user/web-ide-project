import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cloneDeep, debounce } from 'lodash'; // 防抖
import axios from 'axios';
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import toast, { Toaster } from 'react-hot-toast';
import { STORAGE_KEYS } from './utils/constants';
import useWorkspaceSocket from './hooks/useWorkspaceSocket';
import { MonacoBinding } from 'y-monaco';
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
  // 防断线重连覆盖锁
  const hasInitializedRef = useRef(false);
  // 用来存放 Yjs 和 Monaco 之间 胶水 容器
  const bindingRef = useRef(null);

  // 3. 局部 UI 状态
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // 清除持久化状态的函数
  const clearPersistedState = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
    localStorage.removeItem(STORAGE_KEYS.IS_JOINED);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
  };

  // 接收 Yjs 实例，并且删掉 setCurrentCode 传参
  const { ydoc, provider } = useWorkspaceSocket({
    currentSocket,
    roomId,
    fileCacheMap,
    hasInitializedRef,
    setIsRunning,
    setJoined,
    clearPersistedState
  });

  // 4. 核心业务处理器

  // 只负责存下实例，模型创建交给后面的文件切换逻辑去统一处理
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor; // 将实例装进 ref 容器
    monacoRef.current = monaco; // 记录 monaco 核心对象，一会创建 Model 时会用到
    console.log('Monaco Editor 挂载成功，等待绑定文件...');
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
    // 如果没有房间号，直接拦截，不让它往后端发瞎请求
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
    hasInitializedRef,
    setIsRunning,
    setJoined,
    clearPersistedState
  });

  // 监听切换文件: 解绑旧文件，绑定新文化
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // 如果底层的三大件（编辑器、Yjs 文档、WebSocket 通道）还没准备好，或者没有选中文件，就退出
    if (!editor || !monaco || !activeFile || !ydoc || !provider) return;

    const targetFile = activeFile;
    localStorage.setItem('ide_activeFile', targetFile);  // 每次文件真正切换时，存入本地记忆

    // 1. 整理旧现场：保存上一个文件的光标视图，并撕掉旧胶水
    if (prevFileRef.current && fileCacheMap.current.has(prevFileRef.current)) {
      fileCacheMap.current.get(prevFileRef.current).viewState = editor.saveViewState();
    }

    // 撕掉旧文件的 Yjs 绑定，防止你在 index.js 里打字，却同步到了上一个文件里
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // 2. 找新文件模型：如果没有，就用空字符串创建一个
    let targetCache = fileCacheMap.current.get(targetFile);
    if (!targetCache) {
      const newModel = monaco.editor.createModel(
        '', // 初始给空字符串即可，Yjs 连上后会自动把服务器的真实内容塞进来
        'javascript',
        monaco.Uri.parse(`file://${targetFile}`) // 根据targetFile的后缀判断是css还是json
      );
      targetCache = { model: newModel, viewState: null };
      fileCacheMap.current.set(targetFile, targetCache); // 存入缓存
    }

    // 3. 切换编辑器模型并恢复视图
    editor.setModel(targetCache.model);
    if (targetCache.viewState) {
      editor.restoreViewState(targetCache.viewState); // 恢复上次的光标位置
    }

    // 4. 建立全新绑定
    // 根据当前文件名，向 Yjs 索要一个专属的共享文本类型。比如 ydoc.getText('index.js')
    const ytext = ydoc.getText(targetFile);

    // 给光标涂上颜色和名字（面试超级加分项：Awareness 协议）
    provider.awareness.setLocalStateField('user', {
      name: useIDEStore.getState().username || '前端开发工程师',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16)  // 随机生成一个十六进制颜色  
    });

    // 涂胶水：把当前文件的 Yjs 数据、Monaco 模型、以及光标同步绑定在一起
    bindingRef.current = new MonacoBinding(
      ytext,
      targetCache.model,
      new Set([editor]),
      provider.awareness
    );

    prevFileRef.current = targetFile;

  }, [activeFile, ydoc, provider]); // 依赖加入了 ydoc 和 provider，确保通道建立后自动触发绑定

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
