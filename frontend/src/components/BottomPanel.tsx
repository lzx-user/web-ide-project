import XTerminal from './XTerminal';
import OutputPanel from './OutputPanel';
import type { BottomTab, WorkspaceSocket } from '../types/ide';

type BottomPanelProps = {
  bottomTab: BottomTab;
  setBottomTab: (tab: BottomTab) => void;
  setIsTerminalOpen: (open: boolean) => void;
  enableTerminal: boolean;
  currentSocket: WorkspaceSocket | null;
};

// 底部 Terminal / Output
export default function BottomPanel({
  bottomTab,
  setBottomTab,
  setIsTerminalOpen,
  enableTerminal,
  currentSocket,
}: BottomPanelProps) {
  return (
    <div className="bottom-panel-shell flex h-full w-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-2">
        <div className="flex h-full">
          <button
            onClick={() => setBottomTab('terminal')}
            className={`px-4 text-[12px] font-mono uppercase tracking-widest h-full flex items-center transition-colors ${bottomTab === 'terminal'
              ? 'text-white border-b-2 border-blue-400 bg-slate-800'
              : 'text-slate-400 hover:text-white hover:bg-slate-800 border-b-2 border-transparent'
              }`}
          >
            Terminal
          </button>

          <button
            onClick={() => setBottomTab('output')}
            className={`px-4 text-[12px] font-mono uppercase tracking-widest h-full flex items-center transition-colors ${bottomTab === 'output'
              ? 'text-white border-b-2 border-blue-400 bg-slate-800'
              : 'text-slate-400 hover:text-white hover:bg-slate-800 border-b-2 border-transparent'
              }`}
          >
            Output
          </button>
        </div>

        <button
          onClick={() => setIsTerminalOpen(false)}
          className="px-2 text-slate-400 transition-colors hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${bottomTab === 'terminal'
            ? 'z-10 opacity-100'
            : 'z-0 opacity-0 pointer-events-none'
            }`}
        >
          {enableTerminal && currentSocket ? (
            <XTerminal currentSocket={currentSocket} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 font-mono text-sm text-slate-400">
              <div className="mb-2 text-base font-semibold text-slate-200">
                Terminal Disabled in Public Demo
              </div>
              <div>Interactive shell is disabled for production security.</div>
              <div className="mt-1">Please use the Output panel to run JavaScript code.</div>
              <div className="mt-4 text-xs text-slate-500">
                Full terminal support requires Docker-based sandbox isolation.
              </div>
            </div>
          )}
        </div>

        <div
          className={`absolute inset-0 bg-slate-950 transition-opacity duration-200 ${bottomTab === 'output'
            ? 'z-10 opacity-100'
            : 'z-0 opacity-0 pointer-events-none'
            }`}
        >
          <OutputPanel />
        </div>
      </div>
    </div>
  );
}
