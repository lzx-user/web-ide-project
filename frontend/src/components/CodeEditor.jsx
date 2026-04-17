import Editor from '@monaco-editor/react';
// T-08 T-08服务器广播代码，实现多端同步
// 8.1 定义一个全局标志位，默认为false(代表是手动输入)
import { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';
import { socket } from '../socket'; // 引入我们刚刚建立的 Socket 连接实例
// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。



// 这里的 { setCode } 就是接收总部传下来的那个 handleCodeChange 方法的引用，
export default function CodeEditor({ socket }) {
  // 本地存储代码的状态
  const [code, setCode] = useState('// 请在此输入代码...');

  // 8.2 拦截：用于区分本地手动输入 还是 远程Socket 推送的代码更新
  // 默认为 false, 代表本地输入
  const isRemoteUpdate = useRef(false);

  // 8.3 定义防抖发送函数(延迟400ms发送)
  // 使用 useCallback 包裹，确保组件在重新渲染时，防抖函数不会被重置而失效。
  const emitCodeChange = useCallback(
    debounce((newCode) => {
      if (socket) {
        socket.emit('codeChange', newCode);
      }
    }, 500),
    []
  )

  // 8.4 监听服务器广播的代码变更(接收端)
  useEffect(() => {
    if (!token) return;

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
  }, [])

  // 处理编辑器的onChange事件(发送端)
  const handleEditorChange = (value) => {
    // 检查锁状态
    if (isRemoteUpdate.current) {
      // 如果锁是闭合的（true），说明这个 onChange 是刚才上面 setCode(newCode) 被动触发的。
      // 我们直接拦截，不再向服务器发回数据（打破死循环）。
      // 拦截完毕后，把锁打开，准备迎接下一次用户的真实手动输入。
      isRemoteUpdate.current = false; // 打开锁，准备迎接下一次用户输入
      return; // 直接返回，不发送消息
    }

    // 如果锁是打开的（false），说明这是用户的手动输入，我们正常处理，发送给服务器。
    setCode(value); //  实时更新本地 React状态，保证打字的流畅性和编辑器内容一致。
    emitCodeChange(value); // 调用防抖函数，400ms 后发送给服务器。如果在这400ms内用户继续输入，之前的发送会被取消，直到用户停下来超过400ms才真正发送一次。这样可以大幅减少网络请求次数，提高性能。
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
