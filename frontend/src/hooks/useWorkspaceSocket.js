import { useEffect, useRef, useState } from "react";
import useIDEStore from "../store/useIDEStore";
import { STORAGE_KEYS } from "../utils/constants";
// Yjs 核心三剑客
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// 引入原生的 IndexedDB 离线持久化工具
import { IndexeddbPersistence } from 'y-indexeddb';

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
  hasInitializedRef,  // 防重复初始化侧边栏
  setIsRunning,
  setJoined,
  clearPersistedState  // 持久化缓存清理函数
}) {
  const setFileList = useIDEStore((state) => state.setFileList);
  const setActiveFile = useIDEStore((state) => state.setActiveFile);
  const isJoined = useIDEStore((state) => state.isJoined);
  const [isConnected, setIsConnected] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false); // 核心状态：标记后端是否在冷启动
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);

  // 使用 useRef 持久化保存 Yjs 相关的实例，防止重绘丢失
  const ydocRef = useRef(null);  // 创建本地数学链表
  const providerRef = useRef(null);

  // 1. Yjs数据面的初始化
  useEffect(() => {
    // 只有在用户成功加入房间后，才启动数据同步隧道
    if (!isJoined || !roomId) return;

    // 1. 初始化本地微型数据库(每个房间一个 Doc)
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    setYdoc(ydoc);

    // 2. 注入离线：将当前房间的 ydoc 绑定到浏览器的本地数据库
    // 挂载浏览器本地数据库，做离线历史合并树
    const indexeddbProvider = new IndexeddbPersistence(`room-${roomId}`, ydoc);

    indexeddbProvider.on('synced', () => {
      console.log('[Yjs] 📦 本地离线草稿加载完毕，且保留了完美的历史合并树');
    });

    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!token) {
      console.warn('[Yjs] 缺少 token, 取消数据面连接');
      ydoc.destroy();
      return;
    }

    // 3. 建立与后端 1234 端口的高速公路
    // 建立 wss:// 协同专线 连接数据面
    const provider = new WebsocketProvider(
      import.meta.env.VITE_YJS_URL,
      roomId,
      ydoc,
      {
        params: {
          token,  // 携带 JWT 作为鉴权凭据
        },
      }
    );
    providerRef.current = provider;
    setProvider(provider);

    console.log('[Yjs] 🔗 数据面连接已建立，准备接管代码同步');

    // 清理函数：离开房间时断开连接
    return () => {
      provider.destroy();
      ydoc.destroy();
      console.log('[Yjs] 🛑 数据面连接已销毁');
    };
  }, [roomId, isJoined]);

  // 2. Socket.io 控制面的监听与卸载
  useEffect(() => {
    // 门控检查 (Guard Clause)：如果没有建立连接，直接跳出，防止空指针异常
    if (!currentSocket) return;

    // 终端执行相关事件
    // 当进程执行完毕，不仅要打日志，还要把运行状态解锁，允许用户再次点击运行
    const handleFinish = (exitCode) => {
      useIDEStore.getState().addOutputLog('info', `\n[进程执行完毕，退出码 ${exitCode}]`);
      setIsRunning(false);
    };

    // 点击运行时，自动切到 output 面板并清空旧日志 
    const handleExecutionStarted = () => {
      setIsRunning(true);
      // 直接调用 Store 的方法
      useIDEStore.getState().setBottomTab('output');
      useIDEStore.getState().clearOutputLogs();
    };

    // 新增针对独立执行通道的事件处理
    const handleCodeOutput = (data) => {
      useIDEStore.getState().addOutputLog('info', data);
    };
    const handleCodeError = (data) => {
      useIDEStore.getState().addOutputLog('error', data);
    };

    // 现在这个方法全权接管了文件的 初始化、新建、删除 的 UI 更新
    const handleInitCodePackage = (codeTree) => {
      // 1. 直接把后端发来的树存进 Zustand
      setFileList(codeTree);

      const currentActive = useIDEStore.getState().activeFile;

      // 修复幽灵文件 Bug：拍平树结构，检查当前 activeFile 是否还在服务器的物理磁盘上
      const flattenPaths = (nodes) => {
        let paths = [];
        nodes.forEach(node => {
          paths.push(node.path);
          if (node.children) paths.push(...flattenPaths(node.children));
        });
        return paths;
      };

      const findFirstFile = (nodes) => {
        for (const node of nodes) {
          if (node.type === 'file') return node;
          if (node.children) {
            const found = findFirstFile(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const allPaths = flattenPaths(codeTree);

      if (currentActive && !allPaths.includes(currentActive)) {
        // 如果本地记得有个文件，但后端发来的树里没这个文件了（被云端清空或被队友删了）
        // 必须立刻清空本地认知，防止渲染“幽灵路径”
        setActiveFile('');
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
      } else if (codeTree.length > 0 && !currentActive) {
        const firstFile = findFirstFile(codeTree);
        if (firstFile) {
          setActiveFile(firstFile.path);
        }
      }
    };

    // --- 事件绑定 ---
    currentSocket.on('codeOutput', handleCodeOutput);
    currentSocket.on('codeError', handleCodeError);
    currentSocket.on('executionStarted', handleExecutionStarted);
    currentSocket.on('executionFinished', handleFinish);
    // 监听树更新广播
    currentSocket.on('initCodePackage', handleInitCodePackage);

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
      currentSocket.off('codeOutput', handleCodeOutput);
      currentSocket.off('codeError', handleCodeError);
      currentSocket.off('executionFinished', handleFinish);
      currentSocket.off('executionStarted', handleExecutionStarted);
      currentSocket.off('initCodePackage', handleInitCodePackage);
      currentSocket.off('connect_error');
    };
  }, [currentSocket, roomId]);  // 依赖数组：只有当 socket 实例或房间号发生本质变化时，才重新绑定

  // 3. 监听 Render 冷启动与连接状态
  useEffect(() => {
    // 如果还没生成 socket 实例，直接退出
    if (!currentSocket) return;

    // 设定 3 秒定时器，检测是否遭遇 Render 冷启动休眠
    const wakeUpTimer = setTimeout(() => {
      if (!currentSocket.connected) {
        setIsWakingUp(true);
      }
    }, 3000);

    // 成功连接时的处理
    const handleConnect = () => {
      setIsConnected(true);
      setIsWakingUp(false); // 唤醒成功，关闭 Loading
      clearTimeout(wakeUpTimer);
    };

    // 断开连接时的处理
    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // 绑定事件
    currentSocket.on('connect', handleConnect);
    currentSocket.on('disconnect', handleDisconnect);

    // 边缘情况兜底：如果执行到这里时，socket 瞬间就已经连上了
    if (currentSocket.connected) {
      handleConnect();
    }

    // 清理函数：当 socket 实例改变或组件卸载时，精确拔掉监听器
    return () => {
      clearTimeout(wakeUpTimer);
      currentSocket.off('connect', handleConnect);
      currentSocket.off('disconnect', handleDisconnect);
    };
  }, [currentSocket]); // 依赖现成的 currentSocket

  // 把 Yjs 的实例暴露出去，给外面的 App.jsx 用
  return {
    ydoc,
    provider,
    isConnected,
    isWakingUp
  }
}