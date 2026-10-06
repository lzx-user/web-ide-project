import type { FileTreeNode } from '../repositories/fileRepository.js';
import type { WorkspaceRole } from '../auth/roles.js';

export type SocketAck = (result: {
  success: boolean;
  msg?: string;
  cleaned?: string;
  deletedPaths?: string[];
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
  workspaceError: (message: string) => void;
  'terminal-out': (data: string) => void;
}

export interface SocketData {
  user: {
    sessionId: string;
    username: string;
    roomId: string;
    role: WorkspaceRole;
  };
}
