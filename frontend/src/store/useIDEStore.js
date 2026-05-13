import { create } from 'zustand';

// 创建一个全局的 Store
const useIDEStore = create((set, get) => ({
  // ================= 1. 存放所有全局状态 (State) =================
  isJoined: false,        // 是否已登录
  roomId: '',             // 房间号
  socket: null,           // WebSocket 实例
  activeFile: '', // 当前选中的文件
  fileList: [],           // 文件列表
  setFileList: (newList) => set({ fileList: newList }),  // 全量覆盖列表的方法 (用于初始化历史代码包)
  // 追加单个文件的方法 (Zustand 的优雅写法)
  // 相比于在组件里去拼数组，把逻辑封装在 Store 里更符合外企规范
  addFileToFileList: (newFileObj) => set((state) => ({
    fileList: [...state.fileList, newFileObj]
  })),

  // 终端日志 (以文件名为 key 隔离)
  terminalLogsMap: {
    'index.js': [{ id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }]
  },

  // ================= 2. 修改状态的方法 (Actions) =================
  setJoined: (status) => set({ isJoined: status }),
  setRoomId: (id) => set({ roomId: id }),
  setSocket: (socketInstance) => set({ socket: socketInstance }),
  setActiveFile: (filename) => set({ activeFile: filename }),

  // 追加日志：直接在 Store 里处理复杂的对象合并逻辑
  addLog: (filename, type, text) => set((state) => {
    const currentLogs = state.terminalLogsMap[filename] || [];
    return {
      terminalLogsMap: {
        ...state.terminalLogsMap,
        [filename]: [...currentLogs, { id: Date.now(), type, text }]
      }
    };
  }),
}));

export default useIDEStore;