import Editor from '@monaco-editor/react';
// T-08 T-08服务器广播代码，实现多端同步
import { useEffect, useRef } from 'react';
// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。


// 接收父组件 (App.jsx) 传过来的 socket 实例
export default function CodeEditor({ socket, onMount, code, setCode }) {
  // 使用父组件传入的代码状态（而非本地状态）


  // 8.2 拦截：用于区分本地手动输入 还是 远程Socket 推送的代码更新
  // 默认为 false, 代表本地输入
  const isRemoteUpdate = useRef(false);

  // 8.3 监听服务器广播的代码变更(接收端)
  useEffect(() => {
    if (!socket) return;  // 如果还没有连接成功，先不监听

    const handleReceiveChange = (newCode) => {
      // 代码更新来自于其他人推送
      isRemoteUpdate.current = true; // 标记这是一个远程更新
      // 更新本地编辑器显示的内容 触发下方 Monaco 的 onChange 事件
      setCode(newCode);
    }

    // 监听服务器广播的 'codeChange' 消息
    socket.on('codeChange', handleReceiveChange);

    // 清理函数：组件卸载时取消监听，避免内存泄漏和重复监听
    return () => {
      socket.off('codeChange', handleReceiveChange);
    }
  }, [socket, setCode])  // 依赖 socket 和 setCode 变化

  // 处理本地编辑器的onChange事件(发送端)
  const handleEditorChange = (value) => {
    // 检查锁状态
    if (isRemoteUpdate.current) {
      // 如果锁是闭合的（true），说明这个 onChange 是刚才上面 setCode(newCode) 被动触发的。
      // 我们直接拦截，不再向服务器发回数据（打破死循环）。
      // 拦截完毕后，把锁打开，准备迎接下一次用户的真实手动输入。
      isRemoteUpdate.current = false; // 打开锁，准备迎接下一次用户输入
      return; // 直接返回，不发送消息
    }

    // 如果锁是打开的（false），说明这是用户的手动输入，我们正常处理，调用父组件的 setCode。
    // 发送给后端由父组件 App.jsx 的 handleCodeChange 统一处理
    setCode(value); //  实时更新父组件的代码状态，并通过 handleCodeChange 发送给后端
  }

  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language="javascript"  // 开启 JS 语法高亮，让代码变彩色。
        theme="vs-dark"
        value={code}
        // 第三步实现：Monaco Editor 一旦发现内容变了，立刻执行 setCode
        // 这里的 value 就是用户刚打进去的最新的那一串代码
        onChange={handleEditorChange} // 监听编辑器内容变化事件，触发 handleEditorChange 函数
        onMount={onMount}  /* 关键：将内部的 onMount 暴露给父组件 App.jsx */
        options={{
          fontSize: 16,
          minimap: { enabled: false },   // 关掉右侧小地图，小屏幕下节省空间。
          wordWrap: 'on',   // 自动折行，代码太长时不用拉横向滚动条。
          padding: { top: 16 }
        }}
      />
    </div>
  );
}
