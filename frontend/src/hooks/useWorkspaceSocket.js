import { useEffect } from "react";
import useIDEStore from "../store/useIDEStore";
import { STORAGE_KEYS } from "../utils/constants";
import { icons } from "lucide-react";

/**
 * 核心自定义 Hook：接管工作区所有的 WebSocket 通信与底层协同逻辑
 * 职责：
 * 1. 集中处理长连接的生命周期（绑定与精确卸载）。
 * 2. 同步后端的广播事件，并调度 Zustand 状态或 Monaco 实例更新。
 * 3. 剥离通信逻辑，使 UI 组件 (App.jsx) 保持纯粹的渲染调度功能。
 */

export default function useWorkspaceSocket({
  currentSocket,  // 当前建立的 Socket 实例
  roomId,
  fileCacheMap,  // 跨组件透传的文件柜缓存(含monacoRef)
  lastReceivedCodeRef,  // 防死循环锁：记录最后一次收到的后端代码
  hasInitializedRef,  // 防重复执行锁：标记是否已接受过历史代码包
  setCurrentCode,  // 触发 UI 渲染当前代码的方法
  setIsRunning,
  setJoined,
  clearPersistedState  // 持久化缓存清理函数
}) {
  // 1. 从 Zustand 全局状态金库中订阅所需的方法
  const addFileToFileList = useIDEStore((state) => state.addFileToFileList);
  const setFileList = useIDEStore((state) => state.setFileList);
  const setActiveFile = useIDEStore((state) => state.setActiveFile);
  const addLog = useIDEStore((state) => state.addLog);

  // 2. 辅助函数：安全写入终端日志
  // 为什么不直接在 handleOutput 里写？因为闭包会导致拿到旧的 activeFile。
  // 每次调用 writeLog 时动态使用 getState() 保证获取绝对最新的全局状态。
  const writeLog = (type, text) => {
    const activeFile = useIDEStore.getState().activeFile;
    if (activeFile) {
      addLog(activeFile, type, text);
    }
  };

  // 3. Socket 监听与卸载
  useEffect(() => {
    // // 门控检查 (Guard Clause)：如果没有建立连接，直接跳出，防止空指针异常
    if (!currentSocket) return;

    // 终端执行相关事件
    const handleOutput = (data) => writeLog('info', data);
    const handleError = (data) => writeLog('error', data);
    const handleFinish = (exitCode) => writeLog('info', `\n[进程执行完毕，退出码: ${exitCode}]`);

    const handleExecutionStarted = () => {
      setIsRunning(true);
      writeLog('info', '正在运行代码...');
    }

    // 文件树与协同相关事件
    const handleFileCreated = (newFileObj) => {
      addFileToFileList(newFileObj);  // 广播新文件创建
    };

    // 核心：处理用户首次进入房间/断线重连时，后端下发的全量历史代码包
    const handleInitCodePackage = (codePackage) => {
      // 防御性编程：如果是断线重连触发的，拒绝二次初始化，保护用户当前正在编辑的现场
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;

      console.log('📦 收到房间历史代码包:', codePackage);

      // 这是一个空房间
      if (Object.keys(codePackage).length == 0) {
        setActiveFile('');
        setFileList([]);
        setCurrentCode('');
        return;
      }

      // 房间内有文件。优先处理当前活动文件的视图展示
      const targetFile = useIDEStore.getState().activeFile;
      if (codePackage[targetFile] !== undefined) {
        // 本地离线兜底策略：看看用户断网时有没有没来得及发出去的草稿
        const draftCode = localStorage.getItem(STORAGE_KEYS.getDraftKey(roomId, targetFile));
        setCurrentCode(draftCode !== null ? draftCode : codePackage[targetFile]);
      }

      // 批量创建底层 Monaco 模型 (Model)
      // 使用 optional chaining (?.) 安全获取深层嵌套的 monaco 实例
      const currentMonaco = fileCacheMap.current?.monacoRef?.current;
      if (currentMonaco) {
        Object.entries(codePackage).forEach(([filename, code]) => {
          // 登录历史底稿，防止 handleCodeChange 产生错误的回声
          lastReceivedCodeRef.current[filename] = code;
          let cache = fileCacheMap.current.get(filename);

          if (cache) {
            // 已存在模型：静默更新内容，防止光标乱跳
            if (cache.model.getValue() !== code) cache.model.setValue(code);
          } else {
            // 未存在模型：优先取本地草稿，次取服务器历史，创建新模型
            const draftCode = localStorage.getItem(STORAGE_KEYS.getDraftKey(roomId, filename));
            const finalCode = draftCode !== null ? draftCode : code;
            const newModel = currentMonaco.editor.createModel(
              finalCode,
              'javascript',
              currentMonaco.Uri.parse(`file://${filename}`)
            );
            fileCacheMap.current.set(filename, { model: newModel, viewState: null });
          }
        });
      }

      // 初始化左侧文化资源管理器
      const initFileList = Object.keys(codePackage).map((filename, index) => ({
        id: index,
        name: filename,
        type: 'file',
        icon: '📄',
      }));
      setFileList(initFileList);
    };

    // 核心：处理协同代码的高频注入
    const handleCodeChangeSocket = (payload) => {
      const { code, filename } = payload;
      // 类型断言防崩：防止网络包损坏或后端传错导致前端白屏
      if (typeof code !== 'string') return;

      // 更新最后收到的代码指纹
      lastReceivedCodeRef.current[filename] = code;
      const targetCache = fileCacheMap.current.get(filename);

      // 静默更新底层数据：绝对不能触发 setCurrentCode 引发 React 层面重绘
      if (targetCache && targetCache.model.getValue() !== code) {
        targetCache.model.setValue(code);
      }
    };

    // --- 事件绑定 ---
    currentSocket.on('fileCreated', handleFileCreated);
    currentSocket.on('terminalOutput', handleOutput);
    currentSocket.on('terminalError', handleError);
    currentSocket.on('executionStarted', handleExecutionStarted);
    currentSocket.on('executionFinished', handleFinish);
    currentSocket.on('initCodePackage', handleInitCodePackage);
    currentSocket.on('codeChange', handleCodeChangeSocket);

    // 异常处理
    currentSocket.on('connect_error', (err) => {
      console.log('连接失败详情:', err.message);
      clearPersistedState();  // 清除本地污染的凭证
      setJoined(false);  // 强制踢回登录页
      alert('连接服务器失败，可能是登录已过期， 请重新进入房间。');
    });

    // --- 组件卸载/Socket重连时的清理函数 (Cleanup) ---
    // 必须精确卸载指定的具名函数，防止误杀其他模块绑定的同名事件监听器，避免内存泄漏
    return () => {
      currentSocket.off('terminalOutput', handleOutput);
      currentSocket.off('terminalError', handleError);
      currentSocket.off('executionFinished', handleFinish);
      currentSocket.off('executionStarted', handleExecutionStarted);
      currentSocket.off('fileCreated', handleFileCreated);
      currentSocket.off('initCodePackage', handleInitCodePackage);
      currentSocket.off('codeChange', handleCodeChangeSocket);
      currentSocket.off('connect_error');
    };
  }, [currentSocket, roomId]);  // 依赖数组：只有当 socket 实例或房间号发生本质变化时，才重新绑定
}