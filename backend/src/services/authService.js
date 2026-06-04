const jwt = require('jsonwebtoken');
const config = require('../../config');

/**
 * 签发房间访问 Token
 *
 * 为什么单独抽 authService：
 * 1. roomRoutes.js 不应该直接关心 JWT 怎么签。
 * 2. 以后 Socket.io、Yjs、HTTP 都要依赖同一套 token 规则。
 * 3. 如果以后要加用户角色、权限、过期时间，只改这里就行。
 */
function signRoomToken({ username, roomId }) {
  return jwt.sign(
    {
      username,
      roomId,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
}

module.exports = {
  signRoomToken,
};