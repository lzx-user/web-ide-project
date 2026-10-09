import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from 'react';
import type { WebsocketProvider } from 'y-websocket';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';

import { getFileIcon } from '../utils/iconMap';
import type {
  FileNode,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSocket,
  WorkspaceVersionSummary,
} from '../types/ide';

type CreatingState = {
  path: string | null;
  type: 'file' | 'folder' | null;
};

type FileTreeNodeProps = {
  node: FileNode;
  level?: number;
  activeFile: string;
  setActiveFile: (path: string) => void;
  handleDeleteFile: (path: string) => void;
  onContextMenu: (event: MouseEvent, node: FileNode) => void;
  creatingState: CreatingState;
  setCreatingState: Dispatch<SetStateAction<CreatingState>>;
  handleCreateFile: (data: { path: string; isFolder: boolean }) => void;
  draggingPath: string | null;
  dropTargetPath: string | null;
  onDragStart: (event: DragEvent, node: FileNode) => void;
  onDragEnd: () => void;
  onDragOverFolder: (event: DragEvent, path: string) => void;
  onDropIntoFolder: (event: DragEvent, path: string) => void;
  canEdit: boolean;
};

/** 文件树只负责展示真实的服务端节点，创建和删除仍然交给 Socket action。 */
const FileTreeNode = memo(({
  node,
  level = 0,
  activeFile,
  setActiveFile,
  handleDeleteFile,
  onContextMenu,
  creatingState,
  setCreatingState,
  handleCreateFile,
  draggingPath,
  dropTargetPath,
  onDragStart,
  onDragEnd,
  onDragOverFolder,
  onDropIntoFolder,
  canEdit,
}: FileTreeNodeProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = activeFile === node.path;
  const isFolderOpen = isOpen || creatingState.path === node.path;
  const indentStyle = { paddingLeft: `${level * 12 + 16}px` };

  if (node.type === 'file') {
    return (
      <div
        style={indentStyle}
        draggable={canEdit}
        aria-grabbed={draggingPath === node.path}
        onDragStart={(event) => onDragStart(event, node)}
        onDragEnd={onDragEnd}
        onClick={() => setActiveFile(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
        className={`group flex cursor-pointer items-center justify-between border-l-2 py-2 pr-3 text-sm transition-all ${draggingPath === node.path ? 'opacity-50' : ''} ${isActive
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {getFileIcon(node.name, false, isActive)}
          <span className="sidebar-label truncate">{node.name}</span>
        </div>
        {canEdit ? <button
          type="button"
          onClick={(event) => { event.stopPropagation(); handleDeleteFile(node.path); }}
          className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition-all hover:bg-slate-200 hover:text-rose-500 group-hover:opacity-100"
          aria-label={`删除 ${node.path}`}
        >
          <Trash2 size={14} />
        </button> : null}
      </div>
    );
  }

  return (
    <div>
      <div
        style={indentStyle}
        draggable={canEdit}
        aria-grabbed={draggingPath === node.path}
        onDragStart={(event) => onDragStart(event, node)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => onDragOverFolder(event, node.path)}
        onDrop={(event) => onDropIntoFolder(event, node.path)}
        onClick={() => setIsOpen((open) => !open)}
        onContextMenu={(event) => onContextMenu(event, node)}
        className={`group flex cursor-pointer items-center border-l-2 py-2 pr-3 text-sm text-slate-700 transition-all hover:bg-slate-100 ${dropTargetPath === node.path ? 'border-blue-500 bg-blue-100' : 'border-transparent'} ${draggingPath === node.path ? 'opacity-50' : ''}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {isFolderOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {getFileIcon(node.name, true, false)}
          <span className="sidebar-label truncate font-medium">{node.name}</span>
        </div>
      </div>

      {isFolderOpen && (
        <div>
          {creatingState.path === node.path && (
            <div style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }} className="flex items-center gap-2.5 py-1.5 pr-3 text-sm">
              {getFileIcon('temp', creatingState.type === 'folder', false)}
              <input
                autoFocus
                type="text"
                className="w-full rounded border border-blue-400 bg-white px-2 py-0.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={`新建${creatingState.type === 'folder' ? '文件夹' : '文件'}...`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const value = event.currentTarget.value.trim();
                    if (value) handleCreateFile({ path: `${node.path}/${value}`, isFolder: creatingState.type === 'folder' });
                    setCreatingState({ path: null, type: null });
                  }
                  if (event.key === 'Escape') setCreatingState({ path: null, type: null });
                }}
                onBlur={() => setCreatingState({ path: null, type: null })}
              />
            </div>
          )}
          {node.children?.map((childNode) => (
            <FileTreeNode
              key={childNode.path}
              node={childNode}
              level={level + 1}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              handleDeleteFile={handleDeleteFile}
              onContextMenu={onContextMenu}
              creatingState={creatingState}
              setCreatingState={setCreatingState}
              handleCreateFile={handleCreateFile}
              draggingPath={draggingPath}
              dropTargetPath={dropTargetPath}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverFolder={onDragOverFolder}
              onDropIntoFolder={onDropIntoFolder}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
});

type SidebarProps = {
  activeFile: string;
  setActiveFile: (path: string) => void;
  fileList: FileNode[];
  handleCreateFile: (data: { path: string; isFolder: boolean }) => void;
  handleDeleteFile: (path: string) => void;
  handleMoveFile: (sourcePath: string, targetPath: string) => void;
  onOpenSearchResult: (path: string, line: number) => void;
  provider: WebsocketProvider | null;
  currentSocket: WorkspaceSocket | null;
  role: WorkspaceRole;
  members: WorkspaceMember[];
  isAIOpen: boolean;
  onToggleAI: () => void;
  aiEnabled: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  canEdit: boolean;
};

type MenuState = {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
};

type SearchResult = {
  key: string;
  path: string;
  line: number;
  preview: string;
  kind: '文件' | '内容';
};

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...flattenFiles(node.children ?? [])]);
}

export default function Sidebar({
  activeFile,
  setActiveFile,
  fileList,
  handleCreateFile,
  handleDeleteFile,
  handleMoveFile,
  onOpenSearchResult,
  provider,
  currentSocket,
  role,
  members,
  isAIOpen,
  onToggleAI,
  aiEnabled,
  isCollapsed,
  onToggleCollapsed,
  canEdit,
}: SidebarProps) {
  const [creatingState, setCreatingState] = useState<CreatingState>({ path: null, type: null });
  const [menuState, setMenuState] = useState<MenuState>({ visible: false, x: 0, y: 0, node: null });
  const [sidebarView, setSidebarView] = useState<'files' | 'search' | 'versions'>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRevision, setSearchRevision] = useState(0);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [versions, setVersions] = useState<WorkspaceVersionSummary[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState('');

  useEffect(() => {
    const closeMenu = () => setMenuState((previous) => ({ ...previous, visible: false }));
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const doc = provider?.doc;
    if (!doc) return;
    const handleUpdate = () => setSearchRevision((revision) => revision + 1);
    doc.on('update', handleUpdate);
    return () => doc.off('update', handleUpdate);
  }, [provider]);

  const loadVersions = useCallback(() => {
    if (!currentSocket) return;
    setVersionLoading(true);
    setVersionError('');
    currentSocket.emit('listVersions', (response) => {
      setVersionLoading(false);
      if (!response.success) {
        setVersionError(response.msg ?? '版本列表加载失败');
        return;
      }
      setVersions(response.versions ?? []);
    });
  }, [currentSocket]);

  useEffect(() => {
    if (!currentSocket) return;
    const handleVersionHistoryChanged = (nextVersions: WorkspaceVersionSummary[]) => setVersions(nextVersions);
    currentSocket.on('versionHistoryChanged', handleVersionHistoryChanged);
    return () => {
      currentSocket.off('versionHistoryChanged', handleVersionHistoryChanged);
    };
  }, [currentSocket]);

  useEffect(() => {
    if (sidebarView === 'versions') loadVersions();
  }, [loadVersions, sidebarView]);

  const createVersion = useCallback(() => {
    if (!currentSocket || !canEdit) return;
    const label = window.prompt('输入版本说明（可留空）', '')?.trim();
    if (label === undefined) return;
    setVersionLoading(true);
    setVersionError('');
    currentSocket.emit('createVersion', { label }, (response) => {
      setVersionLoading(false);
      if (!response.success) {
        setVersionError(response.msg ?? '创建版本失败');
        return;
      }
      setVersions(response.versions ?? []);
    });
  }, [canEdit, currentSocket]);

  const restoreVersion = useCallback((version: WorkspaceVersionSummary) => {
    if (!currentSocket || role !== 'owner') return;
    if (!window.confirm(`确认恢复版本“${version.label}”吗？当前未保存内容会被覆盖。`)) return;
    setVersionLoading(true);
    setVersionError('');
    currentSocket.emit('restoreVersion', { versionId: version.id }, (response) => {
      setVersionLoading(false);
      if (!response.success) {
        setVersionError(response.msg ?? '恢复版本失败');
      }
    });
  }, [currentSocket, role]);

  const searchResults = useMemo<SearchResult[]>(() => {
    // Y.Doc 内容变化时通过 revision 触发重新计算。
    void searchRevision;
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const files = flattenFiles(fileList).filter((node) => node.type === 'file');
    const texts = provider?.doc.getMap<{ toString: () => string }>('files');
    const results: SearchResult[] = [];
    for (const file of files) {
      if (file.path.toLocaleLowerCase().includes(query)) {
        results.push({ key: `file:${file.path}`, path: file.path, line: 1, preview: file.path, kind: '文件' });
      }
      if (!file.documentKey) continue;
      const content = texts?.get(file.documentKey)?.toString() ?? '';
      content.split('\n').forEach((line, index) => {
        if (results.length >= 100 || !line.toLocaleLowerCase().includes(query)) return;
        results.push({ key: `content:${file.path}:${index}`, path: file.path, line: index + 1, preview: line.trim() || '空行', kind: '内容' });
      });
      if (results.length >= 100) break;
    }
    return results;
  }, [fileList, provider, searchQuery, searchRevision]);

  const handleContextMenu = useCallback((event: MouseEvent, node: FileNode) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuState({ visible: true, x: event.clientX, y: event.clientY, node });
  }, []);

  const handleDragStart = useCallback((event: DragEvent, node: FileNode) => {
    if (!canEdit) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.path);
    setDraggingPath(node.path);
  }, [canEdit]);

  const handleDragEnd = useCallback(() => {
    setDraggingPath(null);
    setDropTargetPath(null);
  }, []);

  const handleDragOverFolder = useCallback((event: DragEvent, path: string) => {
    if (!canEdit || !draggingPath) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetPath(path);
  }, [canEdit, draggingPath]);

  const moveDraggedNode = useCallback((targetFolderPath: string | null) => {
    if (!draggingPath) return;
    const sourceNode = flattenFiles(fileList).find((node) => node.path === draggingPath);
    if (!sourceNode) return;
    const targetPath = targetFolderPath
      ? `${targetFolderPath}/${sourceNode.name}`
      : sourceNode.name;
    if (targetPath !== sourceNode.path) handleMoveFile(sourceNode.path, targetPath);
    handleDragEnd();
  }, [draggingPath, fileList, handleDragEnd, handleMoveFile]);

  const handleDropIntoFolder = useCallback((event: DragEvent, path: string) => {
    event.preventDefault();
    event.stopPropagation();
    moveDraggedNode(path);
  }, [moveDraggedNode]);

  const startCreate = (type: 'file' | 'folder') => setCreatingState({ path: 'root', type });
  const navClass = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors';

  return (
    <div className={`workspace-sidebar flex h-full w-full shrink-0 flex-col ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar-nav" aria-label="工作区导航">
        <div className="sidebar-workspace-row">
          <button type="button" onClick={() => setSidebarView('files')} className={`${navClass} min-w-0 flex-1 ${sidebarView === 'files' ? 'bg-blue-50 text-blue-600' : ''}`} aria-current={sidebarView === 'files' ? 'page' : undefined} title="工作空间">
            <LayoutDashboard size={17} /><span className="sidebar-label">工作空间</span>
          </button>
          <button type="button" className="sidebar-inline-collapse" onClick={onToggleCollapsed} aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'} title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}>
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        {aiEnabled ? <button type="button" onClick={onToggleAI} data-active={isAIOpen} className={navClass}>
          <Bot size={17} /><span className="sidebar-label">AI 助手</span>
          <span className="sidebar-label ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[9px] text-blue-600">Beta</span>
        </button> : null}
        <button type="button" onClick={() => setSidebarView('search')} className={`${navClass} ${sidebarView === 'search' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <Search size={17} /><span className="sidebar-label">搜索</span>
        </button>
        <button type="button" onClick={() => setSidebarView('versions')} className={`${navClass} ${sidebarView === 'versions' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <GitBranch size={17} /><span className="sidebar-label">版本历史</span>
        </button>
        <button type="button" disabled className={`${navClass} sidebar-disabled`}>
          <Settings size={17} /><span className="sidebar-label">设置中心</span>
        </button>
      </nav>

      {sidebarView === 'search' ? (
        <div className="sidebar-detail flex min-h-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-4 text-sm font-semibold tracking-wide text-slate-700">
            <Search size={18} className="text-blue-600" />全局搜索
          </div>
          <div className="border-b border-slate-200 p-3">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="搜索文件名或代码内容"
            />
            <p className="mt-2 text-[10px] text-slate-400">最多显示 100 条结果</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {searchQuery.trim() && searchResults.length === 0 ? <p className="px-4 py-6 text-center text-xs text-slate-400">没有找到匹配内容</p> : null}
            {searchResults.map((result) => (
              <button
                type="button"
                key={result.key}
                onClick={() => onOpenSearchResult(result.path, result.line)}
                className="block w-full border-b border-slate-100 px-4 py-2 text-left hover:bg-blue-50"
              >
                <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700"><span className="truncate">{result.path}</span><small className="shrink-0 text-slate-400">{result.kind}{result.kind === '内容' ? ` · ${result.line}` : ''}</small></span>
                <span className="mt-1 block truncate text-[11px] text-slate-500">{result.preview}</span>
              </button>
            ))}
          </div>
        </div>
      ) : sidebarView === 'versions' ? (
        <div className="sidebar-detail flex min-h-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-4 text-sm font-semibold tracking-wide text-slate-700">
            <GitBranch size={18} className="text-blue-600" />版本历史
          </div>
          <div className="border-b border-slate-200 p-3">
            {canEdit ? (
              <button type="button" onClick={createVersion} disabled={versionLoading} className="sidebar-create-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={14} />创建当前版本
              </button>
            ) : (
              <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-500">只读成员可以查看版本，不能创建或恢复。</p>
            )}
            {versionError ? <p role="alert" className="mt-2 text-xs text-rose-600">{versionError}</p> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {versionLoading && versions.length === 0 ? <p className="px-4 py-6 text-center text-xs text-slate-400">正在加载版本…</p> : null}
            {!versionLoading && versions.length === 0 ? <p className="px-4 py-6 text-center text-xs text-slate-400">还没有手动版本</p> : null}
            {versions.map((version) => (
              <div key={version.id} className="border-b border-slate-100 px-4 py-3">
                <div className="text-xs font-semibold text-slate-700">{version.label}</div>
                <div className="mt-1 text-[10px] text-slate-400">{version.createdBy} · {new Date(version.createdAt).toLocaleString()}</div>
                {role === 'owner' ? (
                  <button type="button" onClick={() => restoreVersion(version)} disabled={versionLoading} className="mt-2 text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">恢复此版本</button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : <div className="sidebar-detail flex min-h-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-4 text-sm font-semibold tracking-wide text-slate-700">
          <FolderKanban size={18} className="text-blue-600" />文件管理
        </div>

        <div className="p-3">
          {!canEdit ? (
            <div className="rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">只读模式：可浏览和跟随协作内容</div>
          ) : creatingState.path === 'root' ? (
            <div className="relative flex items-center">
              <input
                autoFocus
                type="text"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const value = event.currentTarget.value.trim();
                    if (value) handleCreateFile({ path: value, isFolder: creatingState.type === 'folder' });
                    setCreatingState({ path: null, type: null });
                  }
                  if (event.key === 'Escape') setCreatingState({ path: null, type: null });
                }}
                onBlur={() => setCreatingState({ path: null, type: null })}
                className="w-full rounded-md border border-blue-400 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition-all focus:ring-2 focus:ring-blue-100"
                placeholder={creatingState.type === 'folder'
                  ? '文件夹路径（例如 src/components）'
                  : '文件路径（例如 src/app.ts）'}
              />
              <button type="button" onMouseDown={(event) => { event.preventDefault(); setCreatingState({ path: null, type: null }); }} className="absolute right-2 text-slate-400 hover:text-slate-600" aria-label="取消新建">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => startCreate('file')} className="sidebar-create-button"><Plus size={14} />文件</button>
              <button type="button" onClick={() => startCreate('folder')} className="sidebar-create-button"><Plus size={14} />文件夹</button>
            </div>
          )}
        </div>

        <div
          className={`flex-1 overflow-y-auto py-1 transition-colors ${dropTargetPath === 'root' ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : ''}`}
          onDragOver={(event) => {
            if (!canEdit || !draggingPath) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropTargetPath('root');
          }}
          onDrop={(event) => {
            event.preventDefault();
            moveDraggedNode(null);
          }}
        >
          {fileList.length > 0 ? fileList.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              handleDeleteFile={handleDeleteFile}
              onContextMenu={handleContextMenu}
              creatingState={creatingState}
              setCreatingState={setCreatingState}
              handleCreateFile={handleCreateFile}
              draggingPath={draggingPath}
              dropTargetPath={dropTargetPath}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOverFolder={handleDragOverFolder}
              onDropIntoFolder={handleDropIntoFolder}
              canEdit={canEdit}
            />
          )) : <p className="px-4 py-6 text-center text-xs leading-5 text-slate-400">当前房间暂无文件</p>}
        </div>

        <div className="sidebar-members">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-2"><UsersRound size={15} className="text-blue-600" />在线成员</span>
            <span className="text-slate-400">{members.length}</span>
          </div>
          {members.length > 0 ? members.slice(0, 8).map((member) => (
            <div className="sidebar-member-row" key={member.id}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{member.name.trim().slice(0, 1).toUpperCase() || '协'}</span>
              <span className="min-w-0 flex-1 truncate">{member.name}</span>
              <span className="text-[9px] text-slate-400">{member.role === 'owner' ? '房主' : member.role === 'viewer' ? '只读' : '编辑'}</span>
              <span className="sidebar-member-dot" />
            </div>
          )) : <p className="pt-2 text-[11px] text-slate-400">正在同步成员状态…</p>}
        </div>
      </div>}

      {menuState.visible && menuState.node && (
        <div style={{ top: menuState.y, left: menuState.x }} className="fixed z-50 flex w-48 flex-col rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl">
          {canEdit && menuState.node.type === 'folder' && (
            <>
              <button type="button" onClick={() => setCreatingState({ path: menuState.node!.path, type: 'file' })} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">新建文件</button>
              <button type="button" onClick={() => setCreatingState({ path: menuState.node!.path, type: 'folder' })} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">新建文件夹</button>
              <div className="mx-2 my-1 h-px bg-slate-200" />
            </>
          )}
          {canEdit ? <>
            <button type="button" onClick={() => {
              const node = menuState.node!;
              const nextName = window.prompt(`重命名 ${node.name}`, node.name)?.trim();
              if (!nextName || nextName === node.name) return;
              const parent = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '';
              handleMoveFile(node.path, parent ? `${parent}/${nextName}` : nextName);
            }} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">重命名</button>
            <button type="button" onClick={() => {
              const node = menuState.node!;
              const targetPath = window.prompt('输入目标完整路径', node.path)?.trim();
              if (targetPath && targetPath !== node.path) handleMoveFile(node.path, targetPath);
            }} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">移动到…</button>
            <div className="mx-2 my-1 h-px bg-slate-200" />
          </> : null}
          <button type="button" onClick={() => {
            void navigator.clipboard.writeText(menuState.node!.path);
          }} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">复制路径</button>
          {canEdit ? <button type="button" onClick={() => handleDeleteFile(menuState.node!.path)} className="px-4 py-2 text-left text-rose-500 hover:bg-rose-50">删除</button> : <span className="px-4 py-2 text-slate-400">只读成员无修改权限</span>}
        </div>
      )}
    </div>
  );
}
