import XTerminal from './XTerminal';
import OutputPanel from './OutputPanel';

// 底部 Terminal / Output
export default function BottomPanel({
  bottomTab,
  setBottomTab,
  setIsTerminalOpen,
  enableTerminal,
  currentSocket,
}) {
  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="h-9 flex items-center bg-[#f8f9fa] border-t border-b border-gray-200 shrink-0 justify-between px-2">
        <div className="flex h-full">
          <button
            onClick={() => setBottomTab('terminal')}
            className={`px-4 text-[12px] font-mono uppercase tracking-widest h-full flex items-center transition-colors ${bottomTab === 'terminal'
              ? 'text-gray-800 border-b-2 border-blue-500 bg-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-b-2 border-transparent'
              }`}
          >
            Terminal
          </button>

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

        <button
          onClick={() => setIsTerminalOpen(false)}
          className="text-gray-400 hover:text-gray-700 transition-colors"
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
  );
}
