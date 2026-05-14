import React, { useState, useEffect } from 'react';
import { SquareTerminal, ArrowRight } from 'lucide-react';
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
  };

  return (
    // 全屏极暗背景
    <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117] text-gray-200 relative overflow-hidden">

      {/* 装饰性背景光晕 (极其提升逼格的小技巧) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* 登录卡片 */}
      <div className="bg-[#161b22] p-8 rounded-2xl shadow-2xl border border-[#30363d] w-[400px] z-10 relative">
        {/* 头部 Icon 和 标题 */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400 mb-4 ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <SquareTerminal size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-wide">
            Web IDE 协作空间
          </h1>
          <p className="text-gray-500 text-sm mt-2">加入实时房间，开始同步编码</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400 font-medium px-1">前端昵称</label>
            <input
              type="text"
              placeholder="例如: 尤雨溪"
              className="w-full bg-[#0d1117] text-gray-200 p-3 text-sm rounded-lg border border-[#30363d] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400 font-medium px-1">房间 ID</label>
            <input
              type="text"
              placeholder="输入共享房间号"
              className="w-full bg-[#0d1117] text-gray-200 p-3 text-sm rounded-lg border border-[#30363d] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <button
            onClick={handleJoin}
            className="mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            进入编辑器
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
