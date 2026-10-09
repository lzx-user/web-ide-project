import { useState } from 'react';
import {
  Ban,
  Bot,
  Bug,
  Check,
  Clipboard,
  CodeXml,
  CornerDownLeft,
  Lightbulb,
  Send,
  Sparkles,
  UsersRound,
  WandSparkles,
  X,
} from 'lucide-react';
import type { WorkspaceMember } from '../types/ide';

export type AIAction = 'explain' | 'terminal-error' | 'fix' | 'optimize' | 'generate';
type AITab = 'dialogue' | 'generate' | 'explain' | 'optimize' | 'room';

type AIAssistantPanelProps = {
  roomId: string;
  members: WorkspaceMember[];
  activeFile: string;
  selectionLabel: string;
  onClose: () => void;
  onRequest: (action: AIAction, prompt: string) => Promise<void>;
  isLoading: boolean;
  error: string;
  answer: string;
  suggestedCode: string;
  onApply: () => void;
  onInsert: () => void;
  onCopy: () => void;
  onReject: () => void;
};

const tabs: Array<{ id: AITab; label: string }> = [
  { id: 'dialogue', label: '对话' },
  { id: 'generate', label: '生成代码' },
  { id: 'explain', label: '代码解释' },
  { id: 'optimize', label: '优化建议' },
  { id: 'room', label: '房间信息' },
];

const actions: Array<{ id: AIAction; title: string; icon: typeof Sparkles }> = [
  { id: 'explain', title: '解释选中代码', icon: Lightbulb },
  { id: 'terminal-error', title: '分析终端错误', icon: Bug },
  { id: 'fix', title: '修复代码', icon: WandSparkles },
  { id: 'optimize', title: '优化代码', icon: Sparkles },
  { id: 'generate', title: '生成代码片段', icon: CodeXml },
];

const quickPrompts: Array<{ action: AIAction; title: string; description: string }> = [
  { action: 'generate', title: '帮我实现一个函数', description: '创建可复用的代码片段' },
  { action: 'explain', title: '解释一下这段代码', description: '逐行梳理代码逻辑' },
  { action: 'optimize', title: '帮我优化这段代码', description: '提升性能和可读性' },
  { action: 'terminal-error', title: '如何解决构建问题？', description: '分析最近一次运行输出' },
];

/** AI 面板只负责收集上下文和展示结果，实际请求仍通过后端受保护 API 完成。 */
export default function AIAssistantPanel({
  roomId,
  members,
  activeFile,
  selectionLabel,
  onClose,
  onRequest,
  isLoading,
  error,
  answer,
  suggestedCode,
  onApply,
  onInsert,
  onCopy,
  onReject,
}: AIAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<AITab>('dialogue');
  const [action, setAction] = useState<AIAction>('explain');
  const [prompt, setPrompt] = useState('');

  const selectTab = (tab: AITab) => {
    setActiveTab(tab);
    if (tab !== 'dialogue' && tab !== 'room') setAction(tab);
  };

  const submit = () => {
    if (isLoading || activeTab === 'room') return;
    void onRequest(action, prompt.trim());
  };

  const submitQuickPrompt = (nextAction: AIAction, nextPrompt: string) => {
    if (isLoading) return;
    setAction(nextAction);
    setActiveTab(nextAction === 'generate' ? 'generate' : nextAction === 'explain' ? 'explain' : nextAction === 'optimize' ? 'optimize' : 'dialogue');
    void onRequest(nextAction, nextPrompt);
  };

  return (
    <aside className="ai-panel flex h-full flex-col" aria-label="AI 助手">
      <div className="ai-panel-header flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Sparkles size={18} className="text-blue-600" />
          AI 助手
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">Beta</span>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="关闭 AI 助手">
          <X size={18} />
        </button>
      </div>

      <div className="ai-tabs" role="tablist" aria-label="AI 功能标签">
        {tabs.map((tab) => (
          <button type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => selectTab(tab.id)} className={activeTab === tab.id ? 'is-active' : ''}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'room' ? (
        <div className="ai-room-card m-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><UsersRound size={16} className="text-blue-600" />房间信息</div>
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt>房间 ID</dt>
              <dd className="group relative min-w-0 max-w-48 font-medium text-slate-800">
                <span tabIndex={0} aria-describedby="ai-room-id-tooltip" className="block cursor-text truncate outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-blue-200">{roomId}</span>
                <span id="ai-room-id-tooltip" role="tooltip" className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-40 w-72 max-w-[calc(100vw-3rem)] break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{roomId}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-3"><dt>在线成员</dt><dd className="font-medium text-slate-800">{members.length} 人</dd></div>
            <div className="flex justify-between gap-3"><dt>当前文件</dt><dd className="max-w-48 truncate font-medium text-slate-800">{activeFile || '未打开文件'}</dd></div>
          </dl>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
            <p className="truncate"><span className="font-semibold text-slate-700">当前文件：</span>{activeFile || '未打开文件'}</p>
            <p className="mt-1"><span className="font-semibold text-slate-700">选择范围：</span>{selectionLabel}</p>
          </div>

          {activeTab === 'dialogue' && (
            <div className="ai-welcome-card mx-4 mt-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600"><Bot size={24} /></div>
                <div><p className="text-sm font-semibold text-slate-900">你好，我是 AI 助手 👋</p><p className="mt-1 text-[11px] leading-5 text-slate-500">我可以帮你生成代码、解释代码、修复报错和优化实现。</p></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3">
            <label className="min-w-0 text-[11px] font-medium text-slate-500">
              快捷提问
              <select
                value=""
                onChange={(event) => {
                  const item = quickPrompts.find((promptItem) => promptItem.title === event.target.value);
                  if (item) submitQuickPrompt(item.action, item.title);
                }}
                disabled={isLoading}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="选择快捷提问"
              >
                <option value="">选择快捷提问</option>
                {quickPrompts.map((item) => <option key={item.title} value={item.title}>{item.title}</option>)}
              </select>
            </label>

            <label className="min-w-0 text-[11px] font-medium text-slate-500">
              能力选择
              <select
                value={action}
                onChange={(event) => setAction(event.target.value as AIAction)}
                disabled={isLoading}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="选择 AI 能力"
              >
                {actions.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!answer && !error && !isLoading && <div className="ai-empty-card"><Bot size={22} className="text-blue-500" /><p className="mt-2 text-sm font-semibold text-slate-800">选择一个能力开始</p><p className="mt-1 text-xs leading-5 text-slate-400">请求会发送到后端，AI 生成的修改不会自动覆盖代码。</p></div>}
            {isLoading && <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">AI 正在分析当前上下文…</div>}
            {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">{error}</div>}
            {answer && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                <div className="whitespace-pre-wrap">{answer}</div>
                {suggestedCode && <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100"><code>{suggestedCode}</code></pre>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestedCode && <button type="button" onClick={onApply} className="ai-result-action bg-blue-600 text-white hover:bg-blue-700"><Check size={14} />应用修改</button>}
                  {suggestedCode && <button type="button" onClick={onInsert} className="ai-result-action"><CornerDownLeft size={14} />插入到光标</button>}
                  {suggestedCode && <button type="button" onClick={onCopy} className="ai-result-action"><Clipboard size={14} />复制代码</button>}
                  <button type="button" onClick={onReject} className="ai-result-action text-rose-600"><Ban size={14} />拒绝修改</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab !== 'room' && (
        <div className="border-t border-slate-200 p-3">
          <div className="rounded-xl border border-slate-200 bg-white p-2 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="输入你的问题…" className="min-h-20 w-full resize-none border-0 p-2 text-sm text-slate-700 outline-none placeholder:text-slate-400" maxLength={2000} disabled={isLoading} />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[10px] text-slate-400">{prompt.length}/2000</span>
              <button type="button" onClick={submit} disabled={isLoading} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Send size={14} />发送</button>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">AI 内容仅供参考，应用代码前需要用户确认</p>
        </div>
      )}
    </aside>
  );
}
