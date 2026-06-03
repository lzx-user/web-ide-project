import React, { useRef, useState, useEffect } from 'react';
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
import OutputPanel from './components/OutputPanel';
import { connectSocket } from './services/socket';
import request from './services/request'; // 统一请求封装
import { Code2 } from 'lucide-react';
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

  const findNodeByPath = (nodes, targetPath) => {
    for (const node of nodes) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  const activeNode = findNodeByPath(fileList, activeFile);
  const isActiveFile = activeNode?.type === 'file';

  const isTerminalOpen = useIDEStore((state) => state.isTerminalOpen);
  const setIsTerminalOpen = useIDEStore((state) => state.setIsTerminalOpen);

  const bottomTab = useIDEStore((state) => state.bottomTab);
  const setBottomTab = useIDEStore((state) => state.setBottomTab);
  // 添加开关 用于条件选择
  const enableTerminal = import.meta.env.VITE_ENABLE_TERMINAL === 'true';

  const [isEditorMounted, setIsEditorMounted] = useState(false); // 新增：记录编辑器是否挂载完毕

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

  fileCacheMap.current.monacoRef = monacoRef;
  // 接收 Yjs 实例，并且删掉 setCurrentCode 传参
  const { ydoc, provider, isConnected, isWakingUp } = useWorkspaceSocket({
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
    setIsEditorMounted(true);  // 新增：触发组件重绘
    console.log('Monaco Editor 挂载成功，准备绑定文件...');
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
  const handleCreateFile = ({ path, isFolder }) => {
    if (currentSocket) {
      // 像后端发送创建请求 第 3 个参数传入一个回调函数，用来接收后端的点对点确认
      currentSocket.emit('createFile', { filename: path, isFolder }, (response) => {
        if (!response) return;

        // 建立完整响应生命周期分支
        if (response.success) {
          // 创建成功，但路径被系统自动净化过
          if (response.isSanitized) {
            toast(
              (t) => (
                <div className="text-xs text-gray-600">
                  <p className="font-bold text-amber-500 mb-0.5">⚠️ 系统已自动规范路径</p>
                  <p>由于检测到不规范输入，已将：</p>
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-rose-500 line-through block my-0.5 truncate">{response.original}</code>
                  <p>自动修正为标准路径：</p>
                  <code className="bg-gray-50 px-1 py-0.5 rounded text-emerald-600 block my-0.5 font-medium truncate">{response.cleaned}</code>
                </div>
              ),
              {
                duration: 5000,  // 停留5秒，给用户足够的阅读时间
                icon: '⚙️',
                style: {
                  border: '1px solid #f59e0b',
                  padding: '12px',
                  background: '#fff',
                },
              }
            );
          }
        } else {
          // 创建失败（如黑客越界攻击、重名、非法路径），弹出醒目的红色错误提示！
          toast.error(`创建文件失败: ${response.msg}`, {
            id: 'create-file-fail',  // 设置唯一id，防止连击时弹出重叠的堆叠层
            duration: 4000,
            style: {
              border: '1px solid #f43f5e',
              padding: '10px',
              color: '#9f1239',
              fontWeight: '500',
            }
          });
        }
      });
    }
  };

  // 删除文件逻辑
  const handleDeleteFile = (filename) => {
    // 拦截确认，防止手滑误删
    if (!window.confirm(`确定要删除${filename}`)) return;

    if (!currentSocket) {
      toast.error('Socket 未连接，无法删除');
      return;
    }

    currentSocket.emit('deleteFile', { filename }, (response) => {
      if (!response) {
        toast.error('删除失败：服务无响应');
        return;
      }

      if (!response.success) {
        toast.error(`删除失败: ${response.msg}`);
        return;
      }

      if (response.success) {
        toast.success('删除成功');

        const cached = fileCacheMap.current.get(filename);
        if (cached?.model) {
          cached.model.dispose(); // 销毁 Monaco 模型，释放内存
        }
        fileCacheMap.current.delete(filename); // 从缓存中移除

        // 只有后端确认删除成功后，才清空当前文件
        if (activeFile === filename) {
          setActiveFile('');
          // 同步清除本地记忆，否则刷新会炸尸
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
        }
      }
    });
  };

  // 保存代码逻辑
  const handleSave = async () => {
    // 如果没有房间号，直接拦截，不让它往后端发瞎请求
    if (!editorRef.current || isSaving || !roomId || !isActiveFile) {
      toast.error('请选择一个文件后再保存');
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
    if (!editorRef.current || isRunning || !roomId || !isActiveFile) {
      toast.error('请选择一个文件后再运行代码');
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

  // 监听切换文件: 解绑旧文件，绑定新文件
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // 底层核心实例还没准备好时，直接退出 (注意：这里把 !activeFile 删掉了)
    if (!editor || !monaco || !ydoc || !provider) return;

    // 如果当前没有选中任何文件（例如刚删除了当前文件）
    if (!activeFile || !isActiveFile) {
      // 撕掉可能存在的旧协同绑定
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      return; // 直接终止，不再往下走
    }

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

    // 工具函数
    const getLanguage = (filename) => {
      if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
      if (filename.endsWith('.css')) return 'css';
      if (filename.endsWith('.json')) return 'json';
      if (filename.endsWith('.html')) return 'html';
      if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
      return 'plaintext';
    };

    // 2. 找新文件模型：如果没有，就用空字符串创建一个
    let targetCache = fileCacheMap.current.get(targetFile);
    if (!targetCache) {
      const newModel = monaco.editor.createModel(
        '', // 初始给空字符串即可，Yjs 连上后会自动把服务器的真实内容塞进来
        getLanguage(targetFile),
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

    // 向 Awareness 协议注入自定义身份（用于渲染别人屏幕上的光标名字）
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

  }, [activeFile, ydoc, provider, isEditorMounted, isActiveFile]); // 依赖加入了 ydoc 和 provider，确保通道建立后自动触发绑定

  // 6. 渲染 UI

  if (!isJoined) {
    return <Login onJoinRoom={handleJoinRoom} initialRoomId={roomId} />;
  }

  return (
    // 最外层背景改为纯白
    <div className="h-screen w-screen bg-white text-gray-800 font-sans overflow-hidden flex flex-col">
      <Toaster position="top-center" reverseOrder={false} />

      {/* 🌟 核心拦截区：优雅的冷启动遮罩层 */}
      {isWakingUp && !isConnected && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          {/* 这里用 Tailwind 画一个简单的原生 CSS 旋转 Loading */}
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl font-bold text-gray-800 tracking-wide">正在唤醒云端协作服务...</h3>
          <p className="text-sm text-gray-500 mt-3 font-medium">由于免费实例限制，首次唤醒可能需要 30 ~ 50 秒，请耐心稍候 ☕️</p>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Allotment>
          <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
            <Sidebar
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              fileList={fileList}
              setFileList={setFileList}
              handleCreateFile={handleCreateFile}
              handleDeleteFile={handleDeleteFile}
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
                  {/* 如果有 activeFile，才渲染真实编辑器；否则，渲染一个漂亮的空状态占位图 */}
                  {isActiveFile ? (
                    <CodeEditor onMount={handleEditorDidMount} />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                      <div className="w-24 h-24 mb-4 opacity-20">
                        {/* 画一个巨大的代码图标作为水印 */}
                        <Code2 size={96} />
                      </div>
                      <p className="text-lg font-medium tracking-widest text-gray-500">Web IDE 协作空间</p>
                      <p className="text-sm mt-2">请在左侧资源管理器中选择一个文件进行编辑</p>
                    </div>
                  )}
                </div>
              </Allotment.Pane>

              <Allotment.Pane preferredSize={250} minSize={100} visible={isTerminalOpen}>
                <div className="h-full w-full flex flex-col bg-white">
                  {/* 终端 Tab 栏变浅色 */}
                  <div className="h-9 flex items-center bg-[#f8f9fa] border-t border-b border-gray-200 shrink-0 justify-between px-2">
                    <div className="flex h-full">
                      {/* 终端 Tab */}
                      <button
                        onClick={() => setBottomTab('terminal')}
                        className={`px-4 text-[12px] font-mono uppercase tracking-widest h-full flex items-center transition-colors ${bottomTab === 'terminal'
                          ? 'text-gray-800 border-b-2 border-blue-500 bg-white'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-b-2 border-transparent'
                          }`}
                      >
                        Terminal
                      </button>

                      {/* 输出 Tab */}
                      <button
                        onClick={() => setBottomTab('output')}
                        className={`px-4 text-[12px] font-mono uppercase tracking-widest h-full flex items-center transition-colors ${bottomTab === 'output'
                          ? 'text-gray-800 border-b-2 border-blue-500 bg-white'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-b-2 border-transparent'
                          }`}
                      >
                        Output
                      </button>
                    </div>

                    {/* 关闭按钮 */}
                    <button
                      onClick={() => setIsTerminalOpen(false)}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  {/* 替换成业界标准的【多重挂载 + CSS 显隐】架构： */}
                  {/* 将原来的那块替换为下面这段： */}
                  <div className="flex-1 overflow-hidden relative">

                    {/* 终端面板：绝对定位占满，选中时透明度为1，未选中时透明度为0且禁止点击 */}
                    <div
                      className={`absolute inset-0 transition-opacity duration-200 ${bottomTab === 'terminal'
                        ? 'z-10 opacity-100'
                        : 'z-0 opacity-0 pointer-events-none'
                        }`}
                    >
                      {enableTerminal && currentSocket ? (
                        <XTerminal currentSocket={currentSocket} />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 text-gray-500 font-mono text-sm">
                          <div className="text-lg font-semibold text-gray-700 mb-2">
                            Terminal Disabled in Public Demo
                          </div>
                          <div>Interactive shell is disabled for production security.</div>
                          <div className="mt-1">Please use the Output panel to run JavaScript code.</div>
                          <div className="mt-4 text-xs text-gray-400">
                            Full terminal support requires Docker-based sandbox isolation.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 输出面板：绝对定位占满 */}
                    <div
                      className={`absolute inset-0 bg-white transition-opacity duration-200 ${bottomTab === 'output'
                        ? 'z-10 opacity-100'
                        : 'z-0 opacity-0 pointer-events-none'
                        }`}
                    >
                      <OutputPanel />
                    </div>

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
