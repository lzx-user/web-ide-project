// 引入刚刚装的拨号盘
import { io } from 'socket.io-client';

/**
 * Socket 服务层
 * 核心逻辑：
 * 1. 初始导出一个可变的 socket 变量，默认为空。
 * 2. 提供 connectSocket 函数，由登录/进房逻辑触发，实现带凭据的动态拨号。
 */

// 1. 初始化为空的socket变量，等用户加入房间后才真正建立连接并赋值
export let socket = null;

/**
 * 建立长连接的核心函数
 * @param {string} roomId - 目标房间号
 * @param {string} token - 身份验证 Token
 */

// 2. 用户在大厅输入完毕并拿到Token 后，再调用这个函数去连接
export const connectSocket = (roomId, token) => {
  // 携带凭据和房间号，向后端 3000 端口发起长连接
  // 关键：必须指定后端的具体地址和端口
  socket = io('http://localhost:3000', {
    auth: { token: token }, // 注入JWT凭据 (对应后端的 socket.handshake.auth)
    query: { roomId: roomId }, // 注入房间信息 (对应后端的 socket.handshake.query)
  });

  // 3. 全局错误监听：捕获鉴权失败或连接异常
  socket.on('connect_error', (err) => {
    console.log('连接失败详情:', err.message);
    alert('连接服务器失败，可能是登录已过期，请刷新页面重新进入。');
  });

  return socket;
};
