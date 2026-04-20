import React, { useState } from 'react';

/**
 * ================================================================
 * 【Login 组件 - 登录/进入房间】
 * ================================================================
 * 
 * 职责：显示登录界面，收集用户的昵称和房间号
 * 
 * 执行流程：
 * 1. 从App.jsx接收两个Props：
 *    - onJoinRoom: 加入房间的回调函数，接收(username, roomId)
 *    - initialRoomId: URL参数中获取的房间号（用于快速进入）
 * 
 * 2. 用户输入：
 *    - 输入框1：昵称（username）
 *    - 输入框2：房间号（预填充URL参数的值，可修改）
 * 
 * 3. 点击进入按钮：
 *    - 校验用户名和房间号不为空
 *    - 调用 onJoinRoom(username, roomId) 回调
 *    - 真正的加入逻辑在App.jsx的handleJoinRoom中处理
 * 
 * 组件状态：
 * - username: 用户昵称（初始为空）
 * - roomId: 房间号（初始为URL参数值或空）
 * 
 * ================================================================
 */
function Login({ onJoinRoom, initialRoomId }) {
  // 本地状态：用户昵称
  const [username, setUsername] = useState('');
  // 本地状态：房间号（如果URL中有roomId，则使用该值预填充）
  const [roomId, setRoomId] = useState(initialRoomId || '');

  /**
   * 处理进入房间的逻辑
   * 流程：
   * 1. 检查用户名和房间号是否为空
   * 2. 调用父组件的onJoinRoom回调，将数据传给App.jsx
   * 3. App.jsx会处理真正的登录逻辑（调用后端API、建立WebSocket等）
   */
  const handleJoin = async () => {
    if (!username || !roomId) {
      return alert('请输入昵称和房间号');
    }
    // 将用户输入传给父组件处理
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