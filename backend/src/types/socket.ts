import type { FileTreeNode } from '../repositories/fileRepository.js';
import type { WorkspaceRole } from '../auth/roles.js';
import type { WorkspaceVersionSummary } from '../repositories/workspaceVersionRepository.js';

export type SocketAck = (result: {
  success: boolean;
  msg?: string;
  cleaned?: string;
  deletedPaths?: string[];
  movedPaths?: Array<{ oldPath: string; newPath: string }>;
  version?: WorkspaceVersionSummary;
  versions?: WorkspaceVersionSummary[];
}) => void;

export interface ClientToServerEvents {
  createFile: (
    data: { filename: string; isFolder: boolean },
    callback?: SocketAck,
  ) => void;
  deleteFile: (data: { filename: string }, callback?: SocketAck) => void;
  moveFile: (data: { sourcePath: string; targetPath: string }, callback?: SocketAck) => void;
  listVersions: (callback?: SocketAck) => void;
  createVersion: (data: { label?: string }, callback?: SocketAck) => void;
  restoreVersion: (data: { versionId: string }, callback?: SocketAck) => void;
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
  versionHistoryChanged: (versions: WorkspaceVersionSummary[]) => void;
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
