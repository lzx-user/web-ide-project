import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { STORAGE_KEYS } from '../utils/constants';
import request from '../services/request';
import { connectSocket } from '../services/socket';
import useIDEStore from '../store/useIDEStore';

// 登录、恢复登录、退出房间
export default function useAuthSession() {
  const roomId = useIDEStore((state) => state.roomId);
  const currentSocket = useIDEStore((state) => state.socket);

  const setJoined = useIDEStore((state) => state.setJoined);
  const setRoomId = useIDEStore((state) => state.setRoomId);
  const setActiveFile = useIDEStore((state) => state.setActiveFile);
  const setCurrentSocket = useIDEStore((state) => state.setSocket);
  const setUsername = useIDEStore((state) => state.setUsername);

  // 清除持久化状态的函数
  const clearPersistedState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
    localStorage.removeItem(STORAGE_KEYS.IS_JOINED);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
  }, []);

  // 登录/加入房间流程
  const handleJoinRoom = useCallback(
    async (usernameInput: string, roomIdInput: string, accessCodeInput: string) => {
      try {
        // 1. 调用 /api/join 后端接口，获取JWT Token
        const { data } = await request.post('/join', {
          username: usernameInput,
          roomId: roomIdInput,
          accessCode: accessCodeInput,
        });

        if (data.success) {
          // 2. 持久化Token到 localStorage 并在 URL 中记录 roomId
          localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
          localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomIdInput);
          localStorage.setItem(STORAGE_KEYS.IS_JOINED, 'true');   // 持久化登陆状态
          window.history.pushState({}, '', `?roomId=${roomIdInput}`);  // 用户刷新页面时能自动恢复到该房间

          // 更新 Zustand 全局状态
          setRoomId(roomIdInput);
          // 昵称只写入内存状态，供 Yjs Awareness 展示真实成员，不改变现有持久化键。
          setUsername(usernameInput);
          localStorage.setItem(STORAGE_KEYS.USERNAME, usernameInput);

          // 3. 使用获取到的Token和房间号建立WebSocket连接
          const s = connectSocket(roomIdInput, data.token);
          setCurrentSocket(s); // 赋值给 state，去触发底下的 useEffect

          // 4. 进入 IDE 编辑器界面
          setJoined(true);
        } else {
          alert(data.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '无法建立连接';
        console.log('加入房间失败:', message);
        toast.error('加入失败，请检查房间 ID 和访问口令');
      }
    },
    [setRoomId, setCurrentSocket, setJoined, setUsername]
  );

  // 退出房间
  const handleLeaveRoom = useCallback(() => {
    // 1. 清理浏览器的本地存储缓存
    clearPersistedState();

    // 2. 告诉后端我要断开了
    if (currentSocket) {
      currentSocket.disconnect();
    }

    // 3. 直接跳转回根路径，并刷新整个页面状态
    // 瞬间清空所有的 React 状态，内存缓存，并重新渲染 Login 页面
    window.location.href = '/';
  }, [clearPersistedState, currentSocket]);

  // 初始化：检查 URL 房间参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');

    // 检查本地存储是否有持久化状态
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
    const savedIsJoined = localStorage.getItem(STORAGE_KEYS.IS_JOINED) === 'true';

    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }

    // 如果有持久化状态且token有效，自动恢复登陆状态
    if (savedToken && savedRoomId && savedIsJoined) {
      setRoomId(savedRoomId);
      setUsername(localStorage.getItem(STORAGE_KEYS.USERNAME) ?? '协作者');
      setJoined(true);

      // 读取上次离开前正在看的文件
      const savedActiveFile = localStorage.getItem(STORAGE_KEYS.ACTIVE_FILE);
      if (savedActiveFile) {
        setActiveFile(savedActiveFile);
      }

      // 自动建立 Socket 连接
      const s = connectSocket(savedRoomId, savedToken);
      setCurrentSocket(s);
    }
  }, [setRoomId, setJoined, setActiveFile, setCurrentSocket, setUsername]);

  return {
    roomId,
    handleJoinRoom,
    handleLeaveRoom,
    clearPersistedState,
  };
}
