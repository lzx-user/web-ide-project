import { useEffect, useMemo, useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { OnMount } from '@monaco-editor/react';
import type { WebsocketProvider } from 'y-websocket';
import { Bell, GitBranch, Plus, X } from 'lucide-react';

import useIDEStore from '../store/useIDEStore';
import type { CursorPosition, FileNode, OutputLog, WorkspaceSocket } from '../types/ide';
import { findNodeByPath } from '../utils/fileTree';
import { getFileIcon } from '../utils/iconMap';
import { getLanguageLabel } from '../utils/editorLanguage';
import AIAssistantPanel, { type AIAction } from './AIAssistantPanel';
import BottomPanel from './BottomPanel';
import CodeEditor from './CodeEditor';
import EmptyEditorState from './EmptyEditorState';
import Header from './Header';
import Sidebar from './Sidebar';
import WakeUpOverlay from './WakeUpOverlay';

type WorkspaceLayoutProps = {
  roomId: string;
  currentSocket: WorkspaceSocket | null;
  activeFile: string;
  setActiveFile: (file: string) => void;
  fileList: FileNode[];
  isActiveFile: boolean;
  isConnected: boolean;
  isWakingUp: boolean;
  isSaving: boolean;
  isRunning: boolean;
  onEditorMount: OnMount;
  onSave: () => void;
  onRun: () => void;
  onLeave: () => void;
  onCreateFile: (data: { path: string; isFolder: boolean }) => void;
  onDeleteFile: (filename: string) => void;
  provider: WebsocketProvider | null;
  onAIRequest: (action: AIAction, prompt: string) => Promise<void>;
  aiLoading: boolean;
  aiError: string;
  aiAnswer: string;
  aiSuggestedCode: string;
  onApplyAI: () => void;
  onInsertAI: () => void;
  onCopyAI: () => void;
  onRejectAI: () => void;
  selectionLabel: string;
  cursorPosition: CursorPosition;
  outputLogs: OutputLog[];
};

/** 把嵌套文件树摊平成标签栏需要的“文件路径列表”。 */
function flattenFiles(nodes: FileNode[]): string[] {
  return nodes.flatMap((node) => (
    node.type === 'file' ? [node.path] : flattenFiles(node.children ?? [])
  ));
}

export default function WorkspaceLayout({
  roomId,
  currentSocket,
  activeFile,
  setActiveFile,
  fileList,
  isActiveFile,
  isConnected,
  isWakingUp,
  isSaving,
  isRunning,
  onEditorMount,
  onSave,
  onRun,
  onLeave,
  onCreateFile,
  onDeleteFile,
  provider,
  onAIRequest,
  aiLoading,
  aiError,
  aiAnswer,
  aiSuggestedCode,
  onApplyAI,
  onInsertAI,
  onCopyAI,
  onRejectAI,
  selectionLabel,
  cursorPosition,
  outputLogs,
}: WorkspaceLayoutProps) {
  const isTerminalOpen = useIDEStore((state) => state.isTerminalOpen);
  const setIsTerminalOpen = useIDEStore((state) => state.setIsTerminalOpen);
  const bottomTab = useIDEStore((state) => state.bottomTab);
  const setBottomTab = useIDEStore((state) => state.setBottomTab);
  const [isAIOpen, setIsAIOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  // Awareness 会持续变化；useEffect 在 provider 更换时同步解绑旧监听，避免成员重复出现。
  useEffect(() => {
    if (!provider) {
      setMembers([]);
      return;
    }

    const updateMembers = () => {
      const names = Array.from(provider.awareness.getStates().values()).map((state) => {
        const user = (state as { user?: { name?: string } }).user;
        return user?.name?.trim() || '协作者';
      });
      setMembers(names);
    };

    updateMembers();
    provider.awareness.on('change', updateMembers);
    return () => provider.awareness.off('change', updateMembers);
  }, [provider]);

  useEffect(() => {
    if (!activeFile || findNodeByPath(fileList, activeFile)?.type !== 'file') return;
    // 只有用户真正打开过的文件才进入标签栏，避免把整个文件树伪装成“已打开”。
    setOpenFiles((current) => current.includes(activeFile) ? current : [...current, activeFile]);
  }, [activeFile, fileList]);

  // 文件树和日志未变化时复用计算结果，减少拖动面板时的重复遍历。
  const availableFiles = useMemo(() => flattenFiles(fileList), [fileList]);
  const visibleTabs = useMemo(
    () => openFiles.filter((path) => availableFiles.includes(path)),
    [availableFiles, openFiles],
  );
  const statusCounts = useMemo(() => ({
    errors: outputLogs.filter((log) => log.type === 'error' || log.type === 'stderr').length,
    warnings: outputLogs.filter((log) => log.type === 'system').length,
  }), [outputLogs]);

  const closeTab = (path: string) => {
    setOpenFiles((current) => {
      const next = current.filter((file) => file !== path);
      if (path === activeFile) {
        setActiveFile(next.at(-1) ?? '');
      }
      return next;
    });
  };

  const enableTerminal = import.meta.env.VITE_ENABLE_TERMINAL === 'true';

  return (
    <div className="workspace-shell flex h-screen w-screen flex-col overflow-hidden text-slate-800">
      <WakeUpOverlay visible={isWakingUp && !isConnected} />

      <Header
        roomId={roomId}
        activeFile={activeFile}
        isConnected={isConnected}
        isSaving={isSaving}
        isRunning={isRunning}
        onSave={onSave}
        onRun={onRun}
        onLeave={onLeave}
        isAIOpen={isAIOpen}
        onToggleAI={() => setIsAIOpen((open) => !open)}
        members={members}
      />

      <div className="workspace-body flex-1 overflow-hidden">
        <Allotment>
          <Allotment.Pane
            preferredSize={isSidebarCollapsed ? 70 : 224}
            minSize={isSidebarCollapsed ? 64 : 205}
            maxSize={isSidebarCollapsed ? 80 : 300}
          >
            <div className="workspace-surface mr-2">
              <Sidebar
                activeFile={activeFile}
                setActiveFile={setActiveFile}
                fileList={fileList}
                handleCreateFile={onCreateFile}
                handleDeleteFile={onDeleteFile}
                members={members}
                isAIOpen={isAIOpen}
                onToggleAI={() => setIsAIOpen((open) => !open)}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              />
            </div>
          </Allotment.Pane>

          <Allotment.Pane>
            <div className="workspace-center mx-1">
              <Allotment vertical>
                <Allotment.Pane>
                  <div className="flex h-full w-full flex-col overflow-hidden bg-white">
                    <div className="editor-tabbar">
                      {visibleTabs.length > 0 ? visibleTabs.map((path) => (
                        <button
                          type="button"
                          key={path}
                          className={`editor-tab ${activeFile === path ? 'is-active' : ''}`}
                          onClick={() => setActiveFile(path)}
                          title={path}
                        >
                          {getFileIcon(path, false, activeFile === path)}
                          <span className="editor-tab-label">{path}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            className="editor-tab-close"
                            onClick={(event) => { event.stopPropagation(); closeTab(path); }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') closeTab(path);
                            }}
                            aria-label={`关闭 ${path}`}
                          >
                            <X size={13} />
                          </span>
                        </button>
                      )) : (
                        <span className="px-3 text-xs text-slate-400">未打开文件</span>
                      )}
                      <button type="button" className="editor-tab-add" disabled title="请通过左侧文件管理新建文件">
                        <Plus size={15} />
                      </button>
                      <span className="editor-tab-more" aria-label="更多编辑器操作">⋮</span>
                      <span className="editor-connection-status">
                        <span className={`workspace-status-dot ${isConnected ? '' : '!bg-amber-400'}`} />
                        {isConnected ? '实时协作已连接' : '正在连接'}
                      </span>
                    </div>
                    <div className="editor-workspace relative">
                      {isActiveFile ? <CodeEditor filename={activeFile} onMount={onEditorMount} /> : <EmptyEditorState />}
                    </div>
                  </div>
                </Allotment.Pane>

                <Allotment.Pane preferredSize={285} minSize={180} visible={isTerminalOpen}>
                  <BottomPanel
                    bottomTab={bottomTab}
                    setBottomTab={setBottomTab}
                    setIsTerminalOpen={setIsTerminalOpen}
                    enableTerminal={enableTerminal}
                    currentSocket={currentSocket}
                  />
                </Allotment.Pane>
              </Allotment>
            </div>
          </Allotment.Pane>

          {isAIOpen && (
            <Allotment.Pane preferredSize={500} minSize={390} maxSize={560}>
              <div className="workspace-surface ml-2">
                <AIAssistantPanel
                  roomId={roomId}
                  members={members}
                  activeFile={activeFile}
                  selectionLabel={selectionLabel}
                  onClose={() => setIsAIOpen(false)}
                  onRequest={onAIRequest}
                  isLoading={aiLoading}
                  error={aiError}
                  answer={aiAnswer}
                  suggestedCode={aiSuggestedCode}
                  onApply={onApplyAI}
                  onInsert={onInsertAI}
                  onCopy={onCopyAI}
                  onReject={onRejectAI}
                />
              </div>
            </Allotment.Pane>
          )}
        </Allotment>
      </div>

      <footer className="workspace-statusbar" aria-label="编辑器状态栏">
        <div className="statusbar-group">
          <span className="statusbar-item"><GitBranch size={13} />main</span>
          <span className="statusbar-item"><span className="statusbar-symbol">×</span>{statusCounts.errors}</span>
          <span className="statusbar-item"><span className="statusbar-symbol">△</span>{statusCounts.warnings}</span>
          <span className="statusbar-connection"><span className={`workspace-status-dot ${isConnected ? '' : '!bg-amber-400'}`} />{isConnected ? '已连接' : '连接中'}</span>
        </div>
        <div className="statusbar-group">
          <span className="statusbar-item">行 {cursorPosition.line}，列 {cursorPosition.column}</span>
          <span className="statusbar-item">Spaces: 2</span>
          <span className="statusbar-item">UTF-8</span>
          <span className="statusbar-item">LF</span>
          <span className="statusbar-item">{getLanguageLabel(activeFile)}</span>
        </div>
        <span className="statusbar-bell" title={`房间 ${roomId}`}><Bell size={14} /></span>
      </footer>
    </div>
  );
}
