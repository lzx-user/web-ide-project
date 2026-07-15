import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import useIDEStore from '../store/useIDEStore';
import type { FileNode, WorkspaceSocket } from '../types/ide';
import { getLanguageLabel } from '../utils/editorLanguage';
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
  onEditorMount: (editor: Parameters<NonNullable<React.ComponentProps<typeof CodeEditor>['onMount']>>[0], monaco: Parameters<NonNullable<React.ComponentProps<typeof CodeEditor>['onMount']>>[1]) => void;
  onSave: () => void;
  onRun: () => void;
  onLeave: () => void;
  onCreateFile: (data: { path: string; isFolder: boolean }) => void;
  onDeleteFile: (filename: string) => void;
};

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
}: WorkspaceLayoutProps) {
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
                    <CodeEditor filename={activeFile} onMount={onEditorMount} />
                  ) : (
                    <EmptyEditorState />
                  )}
                </div>
              </Allotment.Pane>

              <Allotment.Pane preferredSize={250} minSize={100} visible={isTerminalOpen}>
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
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          已连接房间 {roomId}
        </span>
        <div className="flex items-center gap-4 text-gray-400">
          <span>UTF-8</span>
          <span>{getLanguageLabel(activeFile)}</span>
          <span>Prettier</span>
        </div>
      </div>
    </div>
  );
}
