import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import Sidebar from './Sidebar';
import Header from './Header';
import CodeEditor from './CodeEditor';
import BottomPanel from './BottomPanel';
import EmptyEditorState from './EmptyEditorState';
import WakeUpOverlay from './WakeUpOverlay';

import useIDEStore from '../store/useIDEStore';

// 主 IDE 布局
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
}) {
  const isTerminalOpen = useIDEStore((state) => state.isTerminalOpen);
  const setIsTerminalOpen = useIDEStore((state) => state.setIsTerminalOpen);

  const bottomTab = useIDEStore((state) => state.bottomTab);
  const setBottomTab = useIDEStore((state) => state.setBottomTab);

  const enableTerminal = import.meta.env.VITE_ENABLE_TERMINAL === 'true';

  return (
    <div className="h-screen w-screen bg-white text-gray-800 font-sans overflow-hidden flex flex-col">
      <WakeUpOverlay visible={isWakingUp && !isConnected} />

      <div className="flex-1 overflow-hidden">
        <Allotment>
          <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
            <Sidebar
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              fileList={fileList}
              handleCreateFile={onCreateFile}
              handleDeleteFile={onDeleteFile}
            />
          </Allotment.Pane>

          <Allotment.Pane>
            <Allotment vertical>
              <Allotment.Pane>
                <div className="flex flex-col h-full w-full">
                  <Header
                    activeFile={activeFile}
                    isSaving={isSaving}
                    isRunning={isRunning}
                    onSave={onSave}
                    onRun={onRun}
                    onLeave={onLeave}
                  />

                  {isActiveFile ? (
                    <CodeEditor onMount={onEditorMount} />
                  ) : (
                    <EmptyEditorState />
                  )}
                </div>
              </Allotment.Pane>

              <Allotment.Pane
                preferredSize={250}
                minSize={100}
                visible={isTerminalOpen}
              >
                <BottomPanel
                  bottomTab={bottomTab}
                  setBottomTab={setBottomTab}
                  setIsTerminalOpen={setIsTerminalOpen}
                  enableTerminal={enableTerminal}
                  currentSocket={currentSocket}
                />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>

      <div className="h-6 bg-white border-t border-gray-200 text-gray-500 text-[11px] flex items-center px-4 justify-between shrink-0 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            已连接房间: {roomId}
          </span>
        </div>

        <div className="flex items-center gap-4 text-gray-400">
          <span className="hover:bg-gray-100 hover:text-gray-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            UTF-8
          </span>
          <span className="hover:bg-gray-100 hover:text-gray-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            JavaScript
          </span>
          <span className="hover:bg-gray-100 hover:text-gray-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            Prettier
          </span>
        </div>
      </div>
    </div>
  );
}