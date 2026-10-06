import { create } from 'zustand';

import type { IDEStore } from '../types/ide';

function appendBoundedLog(
  logs: IDEStore['outputLogs'],
  entry: IDEStore['outputLogs'][number],
): IDEStore['outputLogs'] {
  const next = [...logs, entry].slice(-200);
  let total = 0;
  const kept = [] as IDEStore['outputLogs'];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const item = next[index];
    if (!item || total + item.text.length > 50_000) break;
    kept.unshift(item);
    total += item.text.length;
  }
  return kept;
}

// Store 使用统一接口后，组件选择 state 时不再被推断为 unknown。
const useIDEStore = create<IDEStore>((set) => ({
  isJoined: false,
  roomId: '',
  socket: null,
  activeFile: '',
  username: '',
  role: 'editor',
  fileList: [],
  bottomTab: 'terminal',
  outputLogs: [],
  isTerminalOpen: false,
  terminalOutput: '',
  isDirty: false,
  savedAt: null,
  saveError: '',

  setBottomTab: (bottomTab) => set({ bottomTab }),
  addOutputLog: (type, text) =>
    set((state) => ({
      outputLogs: appendBoundedLog(state.outputLogs, { id: Date.now(), type, text: text.slice(0, 4000) }),
    })),
  clearOutputLogs: () => set({ outputLogs: [] }),
  setFileList: (fileList) => set({ fileList }),
  toggleTerminal: () =>
    set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
  setIsTerminalOpen: (isTerminalOpen) => set({ isTerminalOpen }),
  setJoined: (isJoined) => set({ isJoined }),
  setRoomId: (roomId) => set({ roomId }),
  setSocket: (socket) => set({ socket }),
  setActiveFile: (activeFile) => set({ activeFile }),
  setUsername: (username) => set({ username }),
  setRole: (role) => set({ role }),
  appendTerminalOutput: (text) => set((state) => ({
    terminalOutput: `${state.terminalOutput}${text}`.slice(-20000),
  })),
  clearTerminalOutput: () => set({ terminalOutput: '' }),
  setDirty: (isDirty) => set({ isDirty, ...(isDirty ? { saveError: '' } : {}) }),
  setSaveResult: (savedAt, saveError = '') => set({ savedAt, saveError, isDirty: Boolean(saveError) }),
}));

export default useIDEStore;
