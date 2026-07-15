import { create } from 'zustand';

import type { IDEStore } from '../types/ide';

// Store 使用统一接口后，组件选择 state 时不再被推断为 unknown。
const useIDEStore = create<IDEStore>((set) => ({
  isJoined: false,
  roomId: '',
  socket: null,
  activeFile: '',
  username: '',
  fileList: [],
  bottomTab: 'terminal',
  outputLogs: [],
  isTerminalOpen: false,

  setBottomTab: (bottomTab) => set({ bottomTab }),
  addOutputLog: (type, text) =>
    set((state) => ({
      outputLogs: [...state.outputLogs, { id: Date.now(), type, text }],
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
}));

export default useIDEStore;
