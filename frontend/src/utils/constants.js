export const STORAGE_KEYS = {
  TOKEN: 'ide_token',
  ROOM_ID: 'ide_roomId',
  IS_JOINED: 'ide_isJoined',
  ACTIVE_FILE: 'ide_activeFile',
  // 使用函数生成动态的草稿 Key
  getDraftKey: (roomId, filename) => `draft-${roomId}-${filename}`,
};