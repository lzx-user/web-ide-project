export const STORAGE_KEYS = {
  TOKEN: 'ide_token',
  ROOM_ID: 'ide_roomId',
  IS_JOINED: 'ide_isJoined',
  ACTIVE_FILE: 'ide_activeFile',
  USERNAME: 'ide_username',
  ROLE: 'ide_role',
  // 使用函数生成动态的草稿 Key
  getDraftKey: (roomId: string, filename: string) => `draft-${roomId}-${filename}`,
  getOpenFilesKey: (roomId: string) => `ide-open-files-${roomId}`,
  getSaveStateKey: (roomId: string) => `ide-save-state-${roomId}`,
};
