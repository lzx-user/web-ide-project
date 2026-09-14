import type { editor } from 'monaco-editor';
import type { Socket } from 'socket.io-client';

export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
};

export type BottomTab = 'terminal' | 'output';
export type OutputLogType = 'stdout' | 'stderr' | 'system' | 'error' | 'info';

export type OutputLog = {
  id: number;
  type: OutputLogType;
  text: string;
};

// 状态栏只需要展示当前光标位置，因此把行列收敛成一个小而明确的类型。
export type CursorPosition = {
  line: number;
  column: number;
};

export type SocketActionResult = {
  success: boolean;
  msg?: string;
  cleaned?: string;
  original?: string;
  isSanitized?: boolean;
};

export interface ServerToClientEvents {
  initCodePackage: (tree: FileNode[]) => void;
  executionStarted: () => void;
  codeOutput: (output: string) => void;
  codeError: (error: string) => void;
  executionFinished: (exitCode: number) => void;
  'terminal-out': (data: string) => void;
}

export interface ClientToServerEvents {
  createFile: (
    data: { filename: string; isFolder: boolean },
    callback?: (result: SocketActionResult) => void,
  ) => void;
  deleteFile: (
    data: { filename: string },
    callback?: (result: SocketActionResult) => void,
  ) => void;
  executeCode: (data: { code: string; filename: string }) => void;
  'terminal-in': (data: string) => void;
  'terminal-resize': (data: { cols: number; rows: number }) => void;
}

export type WorkspaceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type EditorCacheEntry = {
  model: editor.ITextModel;
  viewState: editor.ICodeEditorViewState | null;
};

export type IDEStore = {
  isJoined: boolean;
  roomId: string;
  socket: WorkspaceSocket | null;
  activeFile: string;
  username: string;
  fileList: FileNode[];
  bottomTab: BottomTab;
  outputLogs: OutputLog[];
  isTerminalOpen: boolean;
  terminalOutput: string;
  setBottomTab: (tab: BottomTab) => void;
  addOutputLog: (type: OutputLogType, text: string) => void;
  clearOutputLogs: () => void;
  setFileList: (files: FileNode[]) => void;
  toggleTerminal: () => void;
  setIsTerminalOpen: (open: boolean) => void;
  setJoined: (joined: boolean) => void;
  setRoomId: (roomId: string) => void;
  setSocket: (socket: WorkspaceSocket | null) => void;
  setActiveFile: (filename: string) => void;
  setUsername: (username: string) => void;
  appendTerminalOutput: (text: string) => void;
  clearTerminalOutput: () => void;
};
