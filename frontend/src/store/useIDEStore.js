import { create } from 'zustand';

// 创建一个全局的 Store
const useIDEStore = create((set, get) => ({
  // ================= 1. 存放所有全局状态 (State) =================
  isJoined: false, // 是否已登录
  roomId: '', // 房间号
  socket: null, // WebSocket 实例
  activeFile: '', // 当前选中的文件
  fileList: [], // 存放后端发来的整棵树
  terminalLogsMap: {},  // 防止第一次打印日志时解构出 undefined 导致白屏

  // 底部面板状态管理
  // 1. 记录当前处于哪个Tab, 默认显示 terminal
  bottomTab: 'terminal',  // 可选值: 'terminal' | 'output'
  setBottomTab: (tab) => set({ bottomTab: tab }),

  // 2. 专门存储代码运行结果的数组（不再跟终端日志混在一起）
  outputLogs: [],
  // 追加运行结果
  addOutputLog: (type, text) =>
    set((state) => ({
      outputLogs: [...state.outputLogs, { id: Date.now(), type, text }],
    })),
  // 每次重新运行前，清空上一次的结果
  clearOutputLogs: () => set({ outputLogs: [] }),

  setFileList: (newTree) => set({ fileList: newTree }), // 只保留这一个全量覆盖的方法

  isTerminalOpen: false, // 终端默认关闭
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
  setIsTerminalOpen: (status) => set({ isTerminalOpen: status }),

  // ================= 2. 修改状态的方法 (Actions) =================
  setJoined: (status) => set({ isJoined: status }),
  setRoomId: (id) => set({ roomId: id }),
  setSocket: (socketInstance) => set({ socket: socketInstance }),
  setActiveFile: (filename) => set({ activeFile: filename }),

  // 追加日志：直接在 Store 里处理复杂的对象合并逻辑
  addLog: (filename, type, text) =>
    set((state) => {
      const currentLogs = state.terminalLogsMap[filename] || [];
      return {
        terminalLogsMap: {
          ...state.terminalLogsMap,
          [filename]: [...currentLogs, { id: Date.now(), type, text }],
        },
      };
    }),
}));

export default useIDEStore;
