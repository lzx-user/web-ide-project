import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Code2, LogOut, Play, Save, Terminal } from 'lucide-react';
import useIDEStore from '../store/useIDEStore';
import type { WorkspaceMember, WorkspaceRole } from '../types/ide';

type HeaderProps = {
  roomId: string;
  activeFile: string;
  isConnected: boolean;
  isYjsConnected: boolean;
  isYjsSynced: boolean;
  isRunning: boolean;
  onRun: () => void;
  onSave: () => void;
  isSaving: boolean;
  onLeave: () => void;
  isAIOpen: boolean;
  onToggleAI: () => void;
  members: WorkspaceMember[];
  isDirty: boolean;
  savedAt: string | null;
  aiEnabled: boolean;
  role: WorkspaceRole;
};

/** 顶部只展示连接和操作状态，真正的保存/运行逻辑仍由 App 传入。 */
export default function Header({
  roomId,
  activeFile,
  isConnected,
  isYjsConnected,
  isYjsSynced,
  isRunning,
  onRun,
  onSave,
  isSaving,
  onLeave,
  isAIOpen,
  onToggleAI,
  members,
  isDirty,
  savedAt,
  aiEnabled,
  role,
}: HeaderProps) {
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const roomMenuRef = useRef<HTMLDivElement | null>(null);
  const isTerminalOpen = useIDEStore((state) => state.isTerminalOpen);
  const toggleTerminal = useIDEStore((state) => state.toggleTerminal);
  const hasActiveFile = Boolean(activeFile);
  const canEdit = role !== 'viewer';
  const roleLabel = role === 'owner' ? '房主' : role === 'editor' ? '编辑成员' : '只读成员';

  useEffect(() => {
    if (!isRoomMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!roomMenuRef.current?.contains(event.target as Node)) setIsRoomMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRoomMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isRoomMenuOpen]);

  return (
    <header className="workspace-header flex shrink-0 items-center justify-between gap-4 px-4 lg:px-7">
      <div className="flex min-w-0 items-center gap-4">
        <div className="workspace-brand shrink-0">
          <div className="brand-mark"><Code2 size={22} /></div>
          <div>
            <div className="text-base">Web IDE</div>
            <div className="text-[10px] font-medium text-slate-400">CRDT 实时协作</div>
          </div>
        </div>
        <div className="hidden h-8 w-px bg-slate-200 lg:block" />
        <div ref={roomMenuRef} className="relative min-w-0">
          <button type="button" className="room-chip min-w-0 text-left" onClick={() => setIsRoomMenuOpen((open) => !open)} aria-expanded={isRoomMenuOpen} aria-haspopup="dialog">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">房间：</span>
            <span className="max-w-40 truncate text-sm font-semibold text-slate-700">{roomId}</span>
            <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isRoomMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isRoomMenuOpen ? (
            <div role="dialog" aria-label="当前房间完整 ID" className="absolute left-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <p className="text-[11px] font-medium text-slate-400">当前房间 ID</p>
              <code className="mt-1.5 block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">{roomId}</code>
            </div>
          ) : null}
        </div>
        <div className="workspace-status hidden xl:inline-flex" title={`控制通道：${isConnected ? '已连接' : '重连中'}；Yjs：${isYjsConnected ? (isYjsSynced ? '已同步' : '同步中') : '离线'}`}>
          <span className={`workspace-status-dot ${isConnected ? '' : '!bg-amber-400'}`} />
          {!isConnected || !isYjsConnected ? '离线草稿，等待同步' : isYjsSynced ? '协同已同步' : '正在同步'}
        </div>
        <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 lg:inline">{roleLabel}</span>
        <div className="hidden items-center gap-2 xl:flex" aria-label={`在线成员 ${members.length} 人`}>
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((member) => (
              <span key={member.id} title={`${member.name} · ${member.role}`} className="member-avatar">
                {member.name.trim().slice(0, 1).toUpperCase() || '协'}
              </span>
            ))}
            {members.length > 4 && <span className="member-avatar member-avatar-more">+{members.length - 4}</span>}
          </div>
          <span className="text-xs text-slate-500">{members.length} 人在线</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {aiEnabled ? <button type="button" onClick={onToggleAI} className={`workspace-action ${isAIOpen ? 'workspace-action-primary' : ''}`} aria-label="打开或关闭 AI 助手">
          <Bot size={16} /><span className="hidden lg:inline">AI 助手</span>
        </button> : null}
        <button type="button" onClick={toggleTerminal} disabled={!canEdit} title={canEdit ? '打开或关闭终端' : '只读成员不能使用终端'} className={`workspace-action ${isTerminalOpen ? 'border-blue-200 bg-blue-50 text-blue-700' : ''}`}>
          <Terminal size={16} /><span className="hidden xl:inline">终端</span>
        </button>
        <button type="button" onClick={onSave} disabled={!canEdit || !hasActiveFile || isSaving || isRunning} className="workspace-action">
          <Save size={16} className={isSaving ? 'animate-pulse text-blue-500' : ''} />
          <span className="hidden lg:inline">{isSaving ? '保存中' : '保存'}</span>
        </button>
        <button type="button" onClick={onRun} disabled={!canEdit || import.meta.env.VITE_ENABLE_CODE_EXECUTION !== 'true' || !hasActiveFile || isRunning || isSaving} title={!canEdit ? '只读成员不能运行代码' : import.meta.env.VITE_ENABLE_CODE_EXECUTION === 'true' ? '运行当前文件' : '演示环境已关闭代码执行'} className="workspace-action workspace-action-run">
          <Play size={16} className={isRunning ? 'animate-pulse' : ''} />
          <span className="hidden lg:inline">{isRunning ? '运行中' : '运行'}</span>
        </button>
        <button type="button" onClick={onLeave} className="workspace-action workspace-action-leave" aria-label="退出房间">
          <LogOut size={16} /><span className="hidden 2xl:inline">退出房间</span>
        </button>
      </div>
      <span className="sr-only">{isDirty ? '有未持久化修改' : savedAt ? `上次保存 ${savedAt}` : '尚未手动保存'}</span>
    </header>
  );
}
