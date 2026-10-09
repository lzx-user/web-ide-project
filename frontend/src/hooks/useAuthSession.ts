import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { STORAGE_KEYS } from '../utils/constants';
import request from '../services/request';
import { connectSocket } from '../services/socket';
import useIDEStore from '../store/useIDEStore';
import type { WorkspaceRole } from '../types/ide';

// 登录、恢复登录、退出房间
export default function useAuthSession() {
  const roomId = useIDEStore((state) => state.roomId);
  const currentSocket = useIDEStore((state) => state.socket);
  const setJoined = useIDEStore((state) => state.setJoined);
  const setRoomId = useIDEStore((state) => state.setRoomId);
  const setActiveFile = useIDEStore((state) => state.setActiveFile);
  const setCurrentSocket = useIDEStore((state) => state.setSocket);
  const setUsername = useIDEStore((state) => state.setUsername);
  const setRole = useIDEStore((state) => state.setRole);

  const clearPersistedState = useCallback(() => {
    const persistedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
    if (persistedRoomId) {
      localStorage.removeItem(STORAGE_KEYS.getSaveStateKey(persistedRoomId));
    }
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
    localStorage.removeItem(STORAGE_KEYS.IS_JOINED);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
    localStorage.removeItem(STORAGE_KEYS.ROLE);
  }, []);

  const handleJoinRoom = useCallback(async (usernameInput: string, roomIdInput: string, accessCodeInput: string) => {
    try {
      const { data } = await request.post('/join', {
        username: usernameInput,
        roomId: roomIdInput,
        accessCode: accessCodeInput,
      });
      if (!data.success) throw new Error(data.message || '加入失败');

      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomIdInput);
      localStorage.setItem(STORAGE_KEYS.IS_JOINED, 'true');
      localStorage.setItem(STORAGE_KEYS.USERNAME, usernameInput);
      window.history.pushState({}, '', `?roomId=${roomIdInput}`);
      setRoomId(roomIdInput);
      setUsername(usernameInput);
      const role: WorkspaceRole = data.role === 'owner' || data.role === 'viewer' ? data.role : 'editor';
      setRole(role);
      localStorage.setItem(STORAGE_KEYS.ROLE, role);
      const socket = connectSocket(roomIdInput, data.token);
      setCurrentSocket(socket);
      setJoined(true);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || '加入失败，请检查房间 ID 和访问口令');
      throw error;
    }
  }, [setRoomId, setCurrentSocket, setJoined, setUsername, setRole]);

  const handleLeaveRoom = useCallback(() => {
    clearPersistedState();
    currentSocket?.disconnect();
    window.location.href = '/';
  }, [clearPersistedState, currentSocket]);

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get('roomId');
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
    const savedIsJoined = localStorage.getItem(STORAGE_KEYS.IS_JOINED) === 'true';
    if (roomFromUrl) setRoomId(roomFromUrl);

    let restoredSocket: ReturnType<typeof connectSocket> | null = null;
    if (savedToken && savedRoomId && savedIsJoined) {
      setRoomId(savedRoomId);
      setUsername(localStorage.getItem(STORAGE_KEYS.USERNAME) ?? '协作者');
      const savedRole = localStorage.getItem(STORAGE_KEYS.ROLE);
      setRole(savedRole === 'owner' || savedRole === 'viewer' ? savedRole : 'editor');
      setJoined(true);
      const savedActiveFile = localStorage.getItem(STORAGE_KEYS.ACTIVE_FILE);
      if (savedActiveFile) setActiveFile(savedActiveFile);
      restoredSocket = connectSocket(savedRoomId, savedToken);
      setCurrentSocket(restoredSocket);
    }

    return () => {
      restoredSocket?.disconnect();
    };
  }, [setRoomId, setJoined, setActiveFile, setCurrentSocket, setUsername, setRole]);

  return { roomId, handleJoinRoom, handleLeaveRoom, clearPersistedState };
}
