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
    // 全屏改为极浅的灰白色背景 #f8f9fa
    <div className="flex flex-col items-center justify-center h-screen bg-[#f8f9fa] text-gray-800 relative overflow-hidden">

      {/* 装饰性背景光晕：在亮色模式下使用非常柔和的浅蓝，增加空间感 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-400/10 blur-[100px] rounded-full pointer-events-none"></div>

      {/* 登录卡片：纯白背景，加上轻盈的弥散阴影 */}
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-200 w-[400px] z-10 relative">

        {/* 头部 Icon 和 标题 */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600 mb-4 ring-1 ring-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <SquareTerminal size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-wide">
            Web IDE 协作空间
          </h1>
          <p className="text-gray-500 text-sm mt-2">加入实时房间，开始同步编码</p>
        </div>

        <div className="flex flex-col gap-5">
          {/* 昵称输入组 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600 font-medium px-1">前端昵称</label>
            <input
              type="text"
              placeholder="例如: 尤雨溪"
              // 输入框：默认浅灰底色，聚焦时变白底 + 蓝色精美光环
              className="w-full bg-gray-50 text-gray-900 p-3 text-sm rounded-lg border border-gray-200 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-gray-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* 房间ID输入组 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600 font-medium px-1">房间 ID</label>
            <input
              type="text"
              placeholder="输入共享房间号"
              className="w-full bg-gray-50 text-gray-900 p-3 text-sm rounded-lg border border-gray-200 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-gray-400"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {/* 提交按钮：主色调保持高对比度的蓝色 */}
          <button
            onClick={handleJoin}
            className="mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
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
