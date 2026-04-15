// 6.1 引入刚刚装的拨号盘
import { io } from 'socket.io-client';

// 建立连接并导出
// 6.2 创建一个全局的 Socket 实例 也就是拨号！目标地址是你后端的 3000 端口
const socket = io('http://localhost:3000');
export default socket;