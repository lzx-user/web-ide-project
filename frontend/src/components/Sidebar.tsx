import { memo, useCallback, useEffect, useState } from 'react';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
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
import type { FileNode, WorkspaceMember } from '../types/ide';

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
        onClick={() => setActiveFile(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
        className={`group flex cursor-pointer items-center justify-between border-l-2 py-2 pr-3 text-sm transition-all ${isActive
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
        onClick={() => setIsOpen((open) => !open)}
        onContextMenu={(event) => onContextMenu(event, node)}
        className="group flex cursor-pointer items-center border-l-2 border-transparent py-2 pr-3 text-sm text-slate-700 transition-all hover:bg-slate-100"
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

export default function Sidebar({
  activeFile,
  setActiveFile,
  fileList,
  handleCreateFile,
  handleDeleteFile,
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

  useEffect(() => {
    const closeMenu = () => setMenuState((previous) => ({ ...previous, visible: false }));
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const handleContextMenu = useCallback((event: MouseEvent, node: FileNode) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuState({ visible: true, x: event.clientX, y: event.clientY, node });
  }, []);

  const startCreate = (type: 'file' | 'folder') => setCreatingState({ path: 'root', type });
  const navClass = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors';

  return (
    <div className={`workspace-sidebar flex h-full w-full shrink-0 flex-col ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar-nav" aria-label="工作区导航">
        <div className={`${navClass} bg-blue-50 text-blue-600`} aria-current="page">
          <LayoutDashboard size={17} /><span className="sidebar-label">工作空间</span>
        </div>
        {aiEnabled ? <button type="button" onClick={onToggleAI} data-active={isAIOpen} className={navClass}>
          <Bot size={17} /><span className="sidebar-label">AI 助手</span>
          <span className="sidebar-label ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[9px] text-blue-600">Beta</span>
        </button> : null}
        <button type="button" disabled className={`${navClass} sidebar-disabled`}>
          <Search size={17} /><span className="sidebar-label">搜索</span>
        </button>
        <button type="button" disabled className={`${navClass} sidebar-disabled`}>
          <GitBranch size={17} /><span className="sidebar-label">Git 管理</span>
        </button>
        <button type="button" disabled className={`${navClass} sidebar-disabled`}>
          <Settings size={17} /><span className="sidebar-label">设置中心</span>
        </button>
      </nav>

      <div className="sidebar-detail flex min-h-0 flex-1 flex-col">
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
                placeholder={`新建${creatingState.type === 'folder' ? '文件夹' : '文件'}（例如 src/app.js）`}
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

        <div className="flex-1 overflow-y-auto py-1">
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
              canEdit={canEdit}
            />
          )) : <p className="px-4 py-6 text-center text-xs leading-5 text-slate-400">当前房间暂无文件</p>}
        </div>

        <div className="sidebar-members">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-2"><UsersRound size={15} className="text-blue-600" />在线成员</span>
            <span className="text-slate-400">{members.length}</span>
          </div>
          {members.length > 0 ? members.slice(0, 8).map((member, index) => (
            <div className="sidebar-member-row" key={`${member.name}-${index}`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{member.name.trim().slice(0, 1).toUpperCase() || '协'}</span>
              <span className="min-w-0 flex-1 truncate">{member.name}</span>
              <span className="text-[9px] text-slate-400">{member.role === 'owner' ? '房主' : member.role === 'viewer' ? '只读' : '编辑'}</span>
              <span className="sidebar-member-dot" />
            </div>
          )) : <p className="pt-2 text-[11px] text-slate-400">正在同步成员状态…</p>}
        </div>
      </div>

      <button type="button" className="sidebar-collapse-button" onClick={onToggleCollapsed}>
        {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        <span className="sidebar-label">{isCollapsed ? '展开侧边栏' : '收起侧边栏'}</span>
      </button>

      {menuState.visible && menuState.node && (
        <div style={{ top: menuState.y, left: menuState.x }} className="fixed z-50 flex w-48 flex-col rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl">
          {canEdit && menuState.node.type === 'folder' && (
            <>
              <button type="button" onClick={() => setCreatingState({ path: menuState.node!.path, type: 'file' })} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">新建文件</button>
              <button type="button" onClick={() => setCreatingState({ path: menuState.node!.path, type: 'folder' })} className="px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-600">新建文件夹</button>
              <div className="mx-2 my-1 h-px bg-slate-200" />
            </>
          )}
          {canEdit ? <button type="button" onClick={() => handleDeleteFile(menuState.node!.path)} className="px-4 py-2 text-left text-rose-500 hover:bg-rose-50">删除</button> : <span className="px-4 py-2 text-slate-400">只读成员无修改权限</span>}
        </div>
      )}
    </div>
  );
}
