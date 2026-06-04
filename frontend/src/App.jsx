import { useRef, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import WorkspaceLayout from './components/WorkspaceLayout';
import useIDEStore from './store/useIDEStore';  // 引入全新状态引擎
import useWorkspaceSocket from './hooks/useWorkspaceSocket';
import useAuthSession from './hooks/useAuthSession';
import useWorkspaceActions from './hooks/useWorkspaceActions.jsx';
import useEditorBinding from './hooks/useEditorBinding';
import { findNodeByPath } from './utils/fileTree';

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
  const currentSocket = useIDEStore((state) => state.socket);
  const activeFile = useIDEStore((state) => state.activeFile);
  const setActiveFile = useIDEStore((state) => state.setActiveFile);

  // 目录树状态
  const fileList = useIDEStore((state) => state.fileList);

  // 2. 底层实例缓存(依然需要保留)
  const editorRef = useRef(null); //  用于存放编辑器的 DOM 容器，确保实例捕获与 UI 渲染解耦，避免不必要的 re-render 导致实例丢失。
  const monacoRef = useRef(null); // 缓存 Monaco 实例，用来创建模型和其他编辑器相关的操作
  const fileCacheMap = useRef(new Map()); // 使用 useRef 缓存文件状态，格式 { [path]: { model, viewState } }
  const prevFileRef = useRef(null); // 记录上一个文件路径，便于切换时保存视图状态

  // 防断线重连覆盖锁：避免 Socket 重连后重复初始化 activeFile
  const hasInitializedRef = useRef(false);

  // 用来存放 Yjs 和 Monaco 之间 胶水 容器
  const bindingRef = useRef(null);

  const [isEditorMounted, setIsEditorMounted] = useState(false); // 新增：记录编辑器是否挂载完毕

  const {
    roomId,
    handleJoinRoom,
    handleLeaveRoom,
    clearPersistedState,
  } = useAuthSession();

  const activeNode = findNodeByPath(fileList, activeFile);
  const isActiveFile = activeNode?.type === 'file';

  const {
    isSaving,
    isRunning,
    setIsRunning,
    handleCreateFile,
    handleDeleteFile,
    handleSave,
    handleRun,
  } = useWorkspaceActions({
    currentSocket,
    roomId,
    activeFile,
    isActiveFile,
    editorRef,
    fileCacheMap,
    setActiveFile,
  });

  // 接收 Yjs 实例，并且删掉 setCurrentCode 传参
  const { ydoc, provider, isConnected, isWakingUp } = useWorkspaceSocket({
    currentSocket,
    roomId,
    hasInitializedRef,
    setIsRunning,
    clearPersistedState,
  });

  useEditorBinding({
    editorRef,
    monacoRef,
    fileCacheMap,
    prevFileRef,
    bindingRef,
    activeFile,
    isActiveFile,
    ydoc,
    provider,
    isEditorMounted,
  });


  // 只负责存下实例，模型创建交给后面的文件切换逻辑去统一处理
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor; // 将实例装进 ref 容器
    monacoRef.current = monaco; // 记录 monaco 核心对象，一会创建 Model 时会用到
    setIsEditorMounted(true);  // 新增：触发组件重绘
    console.log('Monaco Editor 挂载成功，准备绑定文件...');
  };


  if (!isJoined) {
    return (
      <>
        <Toaster position="top-center" reverseOrder={false} />
        <Login onJoinRoom={handleJoinRoom} initialRoomId={roomId} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />

      <WorkspaceLayout
        roomId={roomId}
        currentSocket={currentSocket}
        activeFile={activeFile}
        setActiveFile={setActiveFile}
        fileList={fileList}
        isActiveFile={isActiveFile}
        isConnected={isConnected}
        isWakingUp={isWakingUp}
        isSaving={isSaving}
        isRunning={isRunning}
        onEditorMount={handleEditorDidMount}
        onSave={handleSave}
        onRun={handleRun}
        onLeave={handleLeaveRoom}
        onCreateFile={handleCreateFile}
        onDeleteFile={handleDeleteFile}
      />
    </>
  );
}

export default App;
