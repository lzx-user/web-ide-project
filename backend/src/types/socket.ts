import type { FileTreeNode } from '../services/fileService.js';

export type SocketAck = (result: {
  success: boolean;
  msg?: string;
  cleaned?: string;
}) => void;

export interface ClientToServerEvents {
  createFile: (
    data: { filename: string; isFolder: boolean },
    callback?: SocketAck,
  ) => void;
  deleteFile: (data: { filename: string }, callback?: SocketAck) => void;
  executeCode: (data: { code: string; filename: string }) => void;
  'terminal-resize': (data: { cols: number; rows: number }) => void;
  'terminal-in': (data: string) => void;
}

export interface ServerToClientEvents {
  initCodePackage: (tree: FileTreeNode[]) => void;
  executionStarted: () => void;
  codeOutput: (output: string) => void;
  codeError: (error: string) => void;
  executionFinished: (exitCode: number) => void;
  'terminal-out': (data: string) => void;
}

export interface SocketData {
  user: {
    username: string;
    roomId: string;
  };
}
