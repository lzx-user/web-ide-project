import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

// Refs 状态控制 -> 远程副作用监听 -> 本地交互处理 -> UI 渲染配置。
/**
 * CodeEditor 组件
 * 职责：封装 Monaco Editor，实现代码实时编辑与多人协作同步。
 * * 核心设计思路：
 * 1. 状态同步：使用父组件 App 传入的 code 和 setCode，确保“单向数据流”，防止编辑器状态不一致。
 * 2. 冲突拦截：利用 useRef 实现一个“同步锁”，区分代码变更是来自“本地手动输入”还是“远程协作推送”。
 */

export default function CodeEditor({ socket, onMount, code, setCode }) {
  // 1. 核心变量控制(Refs)
  // 拦截锁: 默认为 false(代表本地输入)
  // 作用：当接收到远程代码更新时设为 true，防止本次更新再次被触发 onChange 发回服务器，从而导致无限死循环。
  const isRemoteUpdate = useRef(false);

  // 2. 远程同步监听 (Side Effects)
  useEffect(() => {
    // 防御性编程：如果 WebSocket 连接尚未建立，则不进行监听
    if (!socket) return;

    /**
     * 处理从服务器广播而来的其他用户代码变更
     */
    const handleReceiveChange = (newCode) => {
      // 第一步：开启拦截锁，标记接下来的变化属于远程推送
      isRemoteUpdate.current = true;
      // 第二步：通过父组件方法更新代码，这会触发下方 Editor 的 value 变化及相应的 onChange
      setCode(newCode);
    }

    // 绑定 Socket 监听事件
    socket.on('codeChange', handleReceiveChange);

    // 清理函数：组件卸载或 Socket 变化时移除监听，防止内存泄漏和重复绑定
    return () => {
      socket.off('codeChange', handleReceiveChange);
    }
  }, [socket, setCode])  // 依赖 socket 和 setCode 变化

  // --- 3. 本地交互处理 (Handlers) ---
  /**
   * 编辑器内容变化回调
   * @param {string} value - 编辑器当前最新的纯文本代码
   */
  const handleEditorChange = (value) => {
    // 逻辑检查：如果当前处于“远程更新模式”，则消费掉锁并拦截，不再向服务器发送
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false; // 锁重置，准备迎接下一次用户真实操作
      return;
    }
  }

  // 如果是用户真实的手动输入，则调用父组件方法。
  // 该方法在 App.jsx 中配合 lodash 的防抖逻辑，将代码变更广播给房间内其他人。
  setCode(value);

  // 4. UI 渲染
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language="javascript"  // 开启 JS 语法色彩增强
        theme="vs-dark"  // 采用深色 IDE 主题
        value={code}
        onChange={handleEditorChange} // 监听编辑器内容变化事件，触发 handleEditorChange 函数
        onMount={onMount}  // 将底层编辑器实例暴露给父组件（用于 getValue 等操作）
        options={{
          fontSize: 16,
          minimap: { enabled: false }, // 禁用右侧缩略地图以节省空间
          wordWrap: 'on',             // 自动折行，避免出现横向滚动条
          padding: { top: 16 },
          automaticLayout: true,      // 自动监听容器大小变化，解决 IDE 布局切换时的拉伸问题
          scrollBeyondLastLine: false, // 滚过最后一行不再留白
        }}
      />
    </div>
  );
}
