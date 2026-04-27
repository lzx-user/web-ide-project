import React, { useState } from 'react';

/**
 * Login 组件 (登录与协作大厅)
 * 职责：负责收集用户的身份信息与目标房间号，将表单数据向上传递。
 * * @param {Object} props
 * @param {Function} props.onJoinRoom - 点击进入房间的回调，签名: (username, roomId) => void
 * @param {string} props.initialRoomId - 从 URL 中解析出的初始房间号，用于分享链接的自动填充
 */

function Login({ onJoinRoom, initialRoomId }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');

  /**
   * 提交表单逻辑
   * 拦截空输入，非空时触发外层 App 组件的回调，处理后续的 JWT 获取和 Socket 连接。
   */
  const handleJoin = () => {
    if (!username || !roomId) {
      alert('请输入昵称和房间号');
      return;
    }
    onJoinRoom(username, roomId);
  }

  return (
    // 登录页面容器：全屏居中布局，明亮背景
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-800">
      {/* 登录卡片 */}
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-96">
        {/* 标题 */}
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Web IDE 协作空间</h1>
        {/* 表单内容 */}
        <div className="flex flex-col gap-4">
          {/* 昵称输入框 */}
          <input
            type="text"
            placeholder="你的昵称"
            className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {/* 房间号输入框 */}
          <input
            type="text"
            placeholder="房间号"
            className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          {/* 进入房间按钮 - 触发handleJoin函数 */}
          <button
            onClick={handleJoin}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold shadow-md transition-colors"
          >
            进入房间
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;