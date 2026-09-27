import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Cloud,
  Code2,
  Globe2,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import request from '../services/request';

type LoginProps = {
  onJoinRoom: (username: string, roomId: string, accessCode: string) => Promise<void> | void;
  initialRoomId?: string;
};

const features = [
  { icon: Users, title: '多人协作', description: '实时同步，高效协同' },
  { icon: Sparkles, title: 'AI 辅助', description: '可配置、需确认后应用' },
  { icon: Cloud, title: '断线恢复', description: '本地草稿，重连后合并' },
  { icon: LockKeyhole, title: '访问控制', description: '房间口令与统一鉴权' },
];

function IDEPreview() {
  return (
    <div className="ide-preview" aria-hidden="true">
      <div className="ide-preview-toolbar">
        <span className="flex items-center gap-2"><Code2 size={13} className="text-blue-600" />资源管理器</span>
        <span className="ide-preview-tab">JS&nbsp;&nbsp; index.js&nbsp;&nbsp; ×</span>
        <span className="ml-auto text-slate-400">运行已关闭</span>
        <span>♙ 分享</span>
      </div>
      <div className="ide-preview-body">
        <div className="ide-preview-tree">
          <span className="font-medium text-slate-600">打开的文件</span>
          <span className="rounded bg-blue-50 px-2 py-1 text-blue-600">JS&nbsp; index.js</span>
          <span className="mt-2 font-medium text-slate-600">文件</span>
          <span>📁 src</span>
          <span className="pl-3">JS&nbsp; index.js</span>
          <span className="pl-3">TS&nbsp; app.ts</span>
          <span>{'{ }'} package.json</span>
        </div>
        <div className="ide-preview-code">
          <div><i>1</i><b>function</b> greet(name) {'{'}</div>
          <div><i>2</i>&nbsp;&nbsp;console.log(`Hello, ${'{'}name{'}'}! 👋`);</div>
          <div><i>3</i>{'}'}</div>
          <div><i>4</i></div>
          <div><i>5</i>greet(<em>'Web IDE'</em>);</div>
          <div className="ide-preview-terminal">
            <span>终端</span><span>输出</span><span>问题</span>
            <code>&gt; node src/index.js<br />Hello, Web IDE! 👋</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function Login({ onJoinRoom, initialRoomId }: LoginProps) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [accessCode, setAccessCode] = useState('');
  const [isLoggingIn, setLoggingIn] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleJoin = async () => {
    const normalizedUsername = username.trim();
    const normalizedRoomId = roomId.trim();

    if (!normalizedUsername || !normalizedRoomId || !accessCode) {
      setValidationError('请输入昵称、房间 ID 和访问口令');
      return;
    }

    setValidationError('');
    setLoggingIn(true);
    try {
      await onJoinRoom(normalizedUsername, normalizedRoomId, accessCode);
    } catch (error) {
      console.error('加入房间失败:', error);
      setValidationError('加入房间失败，请检查本地服务后重试');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCreateRoom = async () => {
    setLoggingIn(true);
    try {
      const response = await request.post('/rooms');
      const data = response.data as { success: boolean; roomId?: string; accessCode?: string; message?: string };
      if (!data.roomId || !data.accessCode) throw new Error(data.message || '创建失败');
      setRoomId(data.roomId);
      setAccessCode(data.accessCode);
      setValidationError('房间已创建，请立即保存访问口令；服务端不会保存明文。');
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : '创建房间失败');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <main className="join-page flex min-h-screen flex-col overflow-x-hidden">
      <header className="join-header mx-auto flex w-full max-w-[1480px] items-center justify-between px-7 lg:px-12">
        <div className="flex items-center gap-3 text-slate-950">
          <div className="brand-mark"><Code2 size={23} /></div>
          <span className="text-[22px] font-bold tracking-tight">Web IDE</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-slate-600 sm:flex" aria-label="页面导航">
          <span>使用指南</span>
          <span>帮助中心</span>
          <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
            <Globe2 size={15} />简体中文<ChevronDown size={14} />
          </span>
        </nav>
      </header>

      <section className="join-hero mx-auto grid w-full max-w-[1480px] flex-1 gap-10 px-7 pb-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.9fr)] lg:items-center lg:px-12">
        <div className="join-copy min-w-0">
          <div className="join-badge">
            <Sparkles size={16} />新一代 AI 协作编程平台
          </div>
          <h1 className="join-title">
            <span>实时协作，</span>智能开发
          </h1>
          <p className="join-description">
            与团队成员实时协作编写代码，AI 助手随时提供智能建议，<br className="hidden xl:block" />
            通过房间权限、CRDT 协同和持久化快照，让协作过程可恢复、可验证。
          </p>

          <div className="join-features">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="join-feature">
                <div className="feature-icon"><Icon size={21} /></div>
                <p>{title}</p>
                <span>{description}</span>
              </div>
            ))}
          </div>

          <IDEPreview />
        </div>

        <section className="join-card w-full" aria-labelledby="join-title">
          <div className="mb-6 text-center">
            <div className="join-card-icon"><Code2 size={29} /></div>
            <h2 id="join-title" className="text-[26px] font-bold text-slate-950">加入协作空间</h2>
            <p className="mt-2 text-sm text-slate-400">输入房间 ID，加入团队的实时协作空间</p>
          </div>

          <div className="space-y-4">
            <label className="field-label">
              <span className="flex items-center justify-between">你的昵称 <small>{username.length}/20</small></span>
              <input
                value={username}
                onChange={(event) => { setUsername(event.target.value); setValidationError(''); }}
                onKeyDown={(event) => event.key === 'Enter' && void handleJoin()}
                placeholder="例如：小明、开发者007"
                maxLength={20}
                disabled={isLoggingIn}
              />
              <span className="field-hint">建议使用真实昵称，便于团队成员识别</span>
            </label>

            <label className="field-label">
              <span>访问口令</span>
              <input
                value={accessCode}
                onChange={(event) => { setAccessCode(event.target.value); setValidationError(''); }}
                onKeyDown={(event) => event.key === 'Enter' && void handleJoin()}
                placeholder="创建房间时仅显示一次"
                autoComplete="off"
                disabled={isLoggingIn}
              />
            </label>

            <label className="field-label">
              <span className="flex items-center justify-between">房间 ID <small>{roomId.length}/64</small></span>
              <input
                value={roomId}
                onChange={(event) => { setRoomId(event.target.value); setValidationError(''); }}
                onKeyDown={(event) => event.key === 'Enter' && void handleJoin()}
                placeholder="输入 1-64 位房间 ID"
                maxLength={64}
                disabled={isLoggingIn}
              />
              <span className="field-hint">可向团队成员获取房间 ID</span>
            </label>

            {validationError && <p className="form-error" role="alert">{validationError}</p>}

            <button className="primary-action" onClick={() => void handleJoin()} disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="animate-spin" size={18} /> : null}
              {isLoggingIn ? '正在连接…' : '进入编辑器'}
              {!isLoggingIn && <ArrowRight size={19} />}
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /><span>或</span><span className="h-px flex-1 bg-slate-200" />
            </div>

            <button className="secondary-action" onClick={() => void handleCreateRoom()} disabled={isLoggingIn}>
              <Plus size={18} />创建新房间
            </button>
          </div>

          <p className="join-security-note">
            <ShieldCheck size={14} />所有内容仅在协作成员间共享
          </p>
        </section>
      </section>

      <footer className="join-footer">
        <span>© 2026 Web IDE. 保留所有权利。</span>
        <span>隐私政策</span><span>服务条款</span><span>联系我们</span>
      </footer>
    </main>
  );
}

export default Login;
