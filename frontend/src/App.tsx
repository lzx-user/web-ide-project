import { useCallback, useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { OnMount } from '@monaco-editor/react';
import Login from './components/Login';
import WorkspaceLayout from './components/WorkspaceLayout';
import useIDEStore from './store/useIDEStore';  // 引入全新状态引擎
import useWorkspaceSocket from './hooks/useWorkspaceSocket';
import useAuthSession from './hooks/useAuthSession';
import useWorkspaceActions from './hooks/useWorkspaceActions.js';
import useEditorBinding from './hooks/useEditorBinding';
import { findNodeByPath } from './utils/fileTree';
import { getLanguageByFilename } from './utils/editorLanguage';
import useAIAssistant from './hooks/useAIAssistant';
import type { CursorPosition, EditorCacheEntry } from './types/ide';
import type { MonacoBinding } from 'y-monaco';

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
  const outputLogs = useIDEStore((state) => state.outputLogs);

  // 目录树状态
  const fileList = useIDEStore((state) => state.fileList);

  // 2. 底层实例缓存(依然需要保留)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null); // 保持 Monaco 实例跨 UI 重渲染稳定
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null); // 缓存 Monaco API，供模型和安全编辑使用
  const fileCacheMap = useRef(new Map<string, EditorCacheEntry>());
  const prevFileRef = useRef<string | null>(null);

  // 防断线重连覆盖锁：避免 Socket 重连后重复初始化 activeFile
  const hasInitializedRef = useRef(false);

  // 用来存放 Yjs 和 Monaco 之间 胶水 容器
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);

  const [isEditorMounted, setIsEditorMounted] = useState(false); // 新增：记录编辑器是否挂载完毕
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  const [selectionLabel, setSelectionLabel] = useState('未选择代码');
  const terminalOutput = useIDEStore((state) => state.terminalOutput);

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
  const { ydoc, provider, isConnected, isYjsConnected, isYjsSynced, isWakingUp } = useWorkspaceSocket({
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
    activeDocumentKey: activeNode?.documentKey,
    isActiveFile,
    ydoc,
    provider,
    isEditorMounted,
  });

  // useCallback 保持上下文读取函数稳定，避免 AI hook 因父组件渲染而重复创建请求函数。
  const getAIContext = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !activeFile) return null;

    const selection = editor.getSelection();
    const selectedText = selection ? model.getValueInRange(selection) : '';
    return {
      filename: activeFile,
      language: getLanguageByFilename(activeFile),
      code: model.getValue(),
      selection: selection && selectedText ? {
        startLine: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLine: selection.endLineNumber,
        endColumn: selection.endColumn,
        text: selectedText,
      } : undefined,
      terminalOutput,
    };
  }, [activeFile, terminalOutput]);

  const ai = useAIAssistant({ getContext: getAIContext });

  const applyAISuggestion = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !ai.suggestedCode) return;
    if (!window.confirm('确认将 AI 建议应用到当前代码吗？')) return;
    const selection = editor.getSelection();
    const range = selection && !selection.isEmpty() ? selection : model.getFullModelRange();
    editor.executeEdits('ai-assistant', [{ range, text: ai.suggestedCode, forceMoveMarkers: true }]);
    editor.focus();
    toast.success('AI 建议已应用，尚未自动保存或运行');
  }, [ai.suggestedCode]);

  const insertAISuggestion = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = editor?.getPosition();
    if (!editor || !monaco || !position || !ai.suggestedCode) return;
    if (!window.confirm('确认将 AI 代码插入当前光标位置吗？')) return;
    const Range = monaco.Range;
    const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
    editor.executeEdits('ai-assistant', [{ range, text: ai.suggestedCode, forceMoveMarkers: true }]);
    editor.focus();
    toast.success('代码已插入，尚未自动保存或运行');
  }, [ai.suggestedCode]);

  const copyAISuggestion = useCallback(() => {
    if (!ai.suggestedCode) return;
    void navigator.clipboard.writeText(ai.suggestedCode).then(
      () => toast.success('代码已复制'),
      () => toast.error('复制失败，请手动复制'),
    );
  }, [ai.suggestedCode]);


  // 只负责存下实例，模型创建交给后面的文件切换逻辑去统一处理
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor; // 将实例装进 ref 容器
    monacoRef.current = monaco; // 记录 monaco 核心对象，一会创建 Model 时会用到
    setIsEditorMounted(true);  // 新增：触发组件重绘
    editorDisposablesRef.current.push(editor.onDidChangeCursorSelection(({ selection }) => {
      setSelectionLabel(
        selection.isEmpty()
          ? '未选择代码'
          : `第 ${selection.startLineNumber}-${selection.endLineNumber} 行`,
      );
    }));
    // 光标位置来自 Monaco，因此状态栏能反映真实的行列，而不是静态占位值。
    editorDisposablesRef.current.push(editor.onDidChangeCursorPosition(({ position }) => {
      setCursorPosition({ line: position.lineNumber, column: position.column });
    }));
    console.log('Monaco Editor 挂载成功，准备绑定文件...');
  };

  useEffect(() => () => {
    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
    editorDisposablesRef.current = [];
    bindingRef.current?.destroy();
    fileCacheMap.current.forEach(({ model }) => model.dispose());
    fileCacheMap.current.clear();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useIDEStore.getState().isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleSave]);


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
        isYjsConnected={isYjsConnected}
        isYjsSynced={isYjsSynced}
        isWakingUp={isWakingUp}
        isSaving={isSaving}
        isRunning={isRunning}
        onEditorMount={handleEditorDidMount}
        onSave={handleSave}
        onRun={handleRun}
        onLeave={handleLeaveRoom}
        onCreateFile={handleCreateFile}
        onDeleteFile={handleDeleteFile}
        provider={provider}
        selectionLabel={selectionLabel}
        onAIRequest={ai.requestAI}
        aiLoading={ai.isLoading}
        aiError={ai.error}
        aiAnswer={ai.answer}
        aiSuggestedCode={ai.suggestedCode}
        onApplyAI={applyAISuggestion}
        onInsertAI={insertAISuggestion}
        onCopyAI={copyAISuggestion}
        onRejectAI={ai.rejectSuggestion}
        cursorPosition={cursorPosition}
        outputLogs={outputLogs}
      />
    </>
  );
}

export default App;
