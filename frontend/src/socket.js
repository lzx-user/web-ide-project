// 6.1 引入刚刚装的拨号盘
import { io } from 'socket.io-client';

// 建立连接并导出
// 6.2 创建一个全局的 Socket 实例 也就是拨号！目标地址是你后端的 3000 端口
// const socket = io('http://localhost:3000');
// export default socket;

// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 大步骤 3：前端携带凭据发起连接
// 1. 初始化为空的socket变量，等用户加入房间后才真正建立连接并赋值
export let socket = null;

// 2. 用户在大厅输入完毕并拿到Token 后，再调用这个函数去连接
export const connectSocket = (roomId, token) => {
  // 携带凭据和房间号，向后端 3000 端口发起长连接
  // 关键：必须指定后端的具体地址和端口
  socket = io('http://localhost:3000', {
    auth: { token: token },  // 塞入凭据 (对应后端的 socket.handshake.auth)
    query: { roomId: roomId },  // 塞入房间号 (对应后端的 socket.handshake.query)
  });

  // 监听可能发生的鉴权失败
  socket.on('connect_error', (err) => {
    console.log(err.message);
    alert("连接服务器失败，可能是登录已过期，请刷新页面重新进入。");
  });

  return socket;
};
