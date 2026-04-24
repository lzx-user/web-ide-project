# T-10：前后端数据交互闭环与物理文件落盘 (方案 B)

## 一、开发思路

在之前的任务中，我们的 Web IDE 已经具备了精美的 UI 和基于 WebSocket 的实时同步能力。但在 T-10 阶段，我们要解决一个核心的业务诉求：**如何让浏览器里的代码，穿越网线，安全地存放到服务器的硬盘上？** 只有完成了这一步，后续的 T-11（运行代码）才有可能实现。

为了实现这个目标，我们确立了以下三个核心逻辑步骤：

### **1、前端状态提升 (Lifting State Up)**

由于我们的“保存/运行按钮”在 `Header` 组件，而“编辑器”在 `CodeEditor` 组件，它们是兄弟关系。我们需要在它们的父组件 `App.jsx` 中建立“指挥中心”。利用 `useRef` 跨组件捕获 Monaco 实例，利用 `useState` 统筹全局的 Loading 状态和终端输出。

#### 1.1：在 App.jsx 建立“全局指挥中心” (统筹变量)

App.jsx 作为父组件，需要把所有跨组件共享的变量“集中管理”。

1. **准备一个“保险箱” (useRef)**：专门用来安全地存放 Monaco 编辑器的底层实例对象。因为这个实例不需要展示在页面上，也不希望它的变化引起页面闪烁，所以用 Ref 最合适。
2. **准备几个“状态指示灯” (useState)**：用来控制页面的视觉反馈。比如准备一个记录终端输出文字的状态，再准备两个记录“是否正在保存”和“是否正在运行”的布尔值状态（Loading 状态）。

#### 1.2：在 App.jsx 制定“作战计划” (定义核心业务函数)

所有的核心动作（点击保存、点击运行）都必须在父组件 App.jsx 里统一定义，因为只有在这里，才能同时拿到代码数据和控制页面状态。

1. **定义捕获函数**：写一个专门用来接收编辑器实例的函数。它的逻辑很简单：一旦有人把编辑器实例传过来，就立刻把它锁进第一步准备好的“保险箱”里。
2. **定义保存/运行函数**：写出核心的网络请求逻辑。在这个函数里，首先点亮“Loading 指示灯”，然后从“保险箱”里掏出最新的代码，打包发送给后端。收到后端响应后，更新“终端文字状态”，最后熄灭“Loading 指示灯”。

#### 1.3：向 CodeEditor 铺设“数据回传线” (获取代码)

CodeEditor 组件的职责需要变得非常纯粹：它只管渲染编辑器。

1. 在 App.jsx 中，将第二步写好的“捕获函数”，当作一个属性（Prop）传递给 CodeEditor 组件。
2. 在 CodeEditor 内部，当 Monaco 编辑器加载完成的那一瞬间（生命周期触发），调用这个传进来的函数，把原生的 Monaco 实例当作礼物“上交”给父组件。

#### 1.4：向 Header 下发“遥控器”与“信号灯” (触发动作)

Header 组件的职责也需要极度简化：它不需要知道代码是怎么保存的，它只负责挨点和变色。

1. 在 App.jsx 中，把第二步写好的“保存函数”和“运行函数”（遥控器），以及“是否正在 Loading”的状态（信号灯），当作属性（Props）传递给 Header 组件。
2. 在 Header 内部，把收到的函数绑定到对应按钮的点击事件上；把收到的 Loading 状态绑定到按钮的禁用属性（disabled）和颜色样式的切换上。

#### 1.5：向 Terminal 接入“显示屏” (展示结果)

Terminal 组件是最被动的组件，属于“喂到嘴里什么就吃什么”。

1. 在 App.jsx 中，把第一步准备好的“终端文字状态”，当作属性（Prop）传递给 Terminal 组件。
2. Terminal 内部直接把接收到的这串文字渲染到屏幕上。

### **2、：前端数据组装与发射 (Fetch API)**

网络传输不认识 JavaScript 对象，只认识纯文本。我们从 Monaco 实例中提取纯代码字符串后，必须将其与 `roomId` 等信息打包，使用 `JSON.stringify()` 序列化，并通过现代的 `fetch` 发起一个标准的 HTTP POST 请求。

### **3、：后端开门接客与文件落盘 (Node.js FS)**

后端 Express 服务默认读不懂前端发来的 JSON 数据，必须配置 `express.json()` 中间件（翻译官）。接收到数据后，我们采用 **“方案 B（写入物理文件）”**，利用 Node.js 的 `fs` 模块，在服务器本地 `temp` 目录下动态生成按 `roomId` 命名的 `.js` 临时文件，为后续的子进程执行做好物理准备。

------

## 二、核心代码实现

### 前端：`App.jsx` 全局状态管理与发包逻辑

```jsx
//状态管理：控制 UI 交互和终端显示
  const [currentCode, setCurrentCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([
    { id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }
  ]);

// 1. 准备窃听器容器：存放 Monaco 原生实例
const editorRef = useRef(null);
const roomId = "project_1024"; 

// 捕获编辑器实例的回调函数 (传给 CodeEditor)  将实例装进 ref 容器
const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;  // 将实例装进 ref 容器
    console.log("Monaco Editor 挂载成功，实例已捕获！");
}

// 2. 核心保存逻辑
const handleSave = async () => {
  if (!editorRef.current || isSaving) return;
  
  setIsSaving(true); // 开启防抖和按钮 Loading
  setTerminalOutput('正在保存代码...');

  try {
    // 从底层实例提取原汁原味的代码文本
    const currentCode = editorRef.current.getValue(); 

    // 发起 POST 请求
    const response = await fetch('http://localhost:3000/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // 极其关键的信封标签
      body: JSON.stringify({ // 必须序列化为 JSON 字符串
        roomId: roomId, 
        code: currentCode, 
        language: 'javascript' 
      })
    });

    if (!response.ok) throw new Error('网络请求失败');
    setTerminalOutput(`[系统提示] 代码保存成功！时间: ${new Date().toLocaleTimeString()}`);
    
  } catch (error) {
    setTerminalOutput(`[错误] 保存失败: ${error.message}`);
  } finally {
    setIsSaving(false); // 无论成功失败，必须解除 Loading 状态
  }
};
// 3. 核心执行逻辑
const handleRun = async () => {
    if (!editorRef.current || isRunning) return;
    setIsRunning(true);
    addLog('info', '正在运行代码');

    try {
      const currentCode = editorRef.current.getValue();  // 提前纯文本
      // 用 fetch 方法像后端发送代码，请求执行
      const response = await fetch('http://localhost:3000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomId,
          code: currentCode,
          language: 'javascript'
        })
      })
    } catch (err) {
      console.log(err.message);
    } finally {
      setIsRunning(false);
    }
  }


// App -> Header
<Header
  activeFile={activeFile}
  isSaving={isSaving}
  isRunning={isRunning}
  onSave={handleSave}
  onRun={handleRun}
/>

// App -> CodeEditor
{/* 传入挂载拦截器 handleEditorDidMount */}
<CodeEditor
  code={currentCode}
  setCode={handleCodeChange}
  roomId={initialRoomId}
  socket={currentSocket}
  onMount={handleEditorDidMount}
/>

// App -> Terminal
{/* 下方：终端（显示运行结果和日志） */}
<Terminal logs={terminalLogs} />
```

### 后端：`server/index.js` 接收与落盘逻辑

```jsx
const fs = require('fs');
const path = require('path');

// 1. 挂载 JSON 解析中间件 (翻译官)
app.use(express.json()); 

// 2. 开启 /api/save 路由大门
app.post('/api/save', (req, res) => {
  const { roomId, code, language } = req.body;

  // 防御性编程：校验参数
  if (!code) return res.status(400).json({ error: '代码不能为空' });

  // 3. 规划物理文件路径
  const tempDir = path.join(__dirname, 'temp');
  // 如果 temp 这个文件夹还不存在，就让 Node.js 自动建一个
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir); // 如果没有 temp 文件夹，自动创建
  }
  const filePath = path.join(tempDir, `${roomId}.js`);

  try {
    // 4. 核心落盘动作：强制同步写入物理硬盘
    fs.writeFileSync(filePath, code, 'utf8');
    
    // 形成 HTTP 闭环，返回 200 成功状态
    res.status(200).json({ success: true, message: '代码已安全落盘' });
  } catch (error) {
    console.error('文件保存失败:', error);
    res.status(500).json({ error: '服务器保存文件失败' });
  }
});


// 核心执行接口
app.post('/api/run', (req, res) => {
  const { roomId, code, language } = req.body;

  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).json({ error: '代码不能为空' });
  }

  // // 目前仅支持 JavaScript 的执行演示
  // if (language !== 'javascript') {
  //   return res.status(400).json({ error: 'Unsupported language' });
  // }

  // 1. 生成临时文件路径
  const tempFilePath = path.join(__dirname, 'temp.js');

  // 2. 将前端传来的代码写入临时文件
  fs.writeFileSync(tempFilePath, code);

  // 3. 创建子进程，执行该临时文件
  exec(`node ${tempFilePath}`, (error, stdout, stderr) => {
    // 执行完毕后，无论成功失败，都清理掉临时文件
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // 如果执行过程中有语法或运行错误
    if (error || stderr) {
      return res.json({
        success: false,
        output: stderr || error.message
      });
    }

    // 执行成功，返回标准输出
    return res.json({
      success: true,
      output: stdout
    });
  });
});
```

------

## 三、全部实现代码

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\App.jsx

// import { useState } from 'react'; // 引入 React 的状态魔法
import Sidebar from './components/Sidebar'; // 引入侧边栏组件
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
import Login from './components/Login';
// T-06 后端的地址（比如 `http://localhost:3000`）发起连接请求。
// 6.1 引入刚刚装的拨号盘
import React, { useRef, useState, useEffect } from 'react';
import { socket, connectSocket } from './socket';
import { Editor } from '@monaco-editor/react';

/**
 * ================================================================
 * 【Web IDE 前端应用 - 完整执行流程说明】
 * ================================================================
 * 
 * 【初始化阶段】
 * 1. App组件挂载时，useEffect从URL获取roomId（如果有的话）
 * 2. 页面显示Login组件（登录大厅）
 * 
 * 【登录流程】
 * 1. 用户在Login组件输入昵称和房间号
 * 2. 点击"进入房间"按钮，调用handleJoinRoom(username, roomId)
 * 3. handleJoinRoom流程：
 *    (1) 调用 /api/join 后端接口，获取JWT Token
 *    (2) Token保存到localStorage（用于WebSocket认证）
 *    (3) 修改浏览器URL加入roomId参数
 *    (4) 调用connectSocket建立WebSocket长连接
 *    (5) 设置isJoined=true，界面切换到IDE编辑器
 * 
 * 【IDE编辑器运行】
 * 1. isJoined=true后，显示IDE主界面
 * 2. 用户在代码编辑器中输入代码 → handleCodeChange
 * 3. handleCodeChange：更新状态 + 通过WebSocket发送给后端
 * 4. 后端会广播给房间内的其他客户端（实时协作）
 * 5. 点击运行按钮 → handleRunCode
 * 6. handleRunCode：向后端发送代码 → 等待执行结果 → 终端显示输出
 * 
 * ================================================================
 */

/**
 * T-10 后端开发接收并保存前端代码字符串的 API
 * 前端：
 * 1. 确定触发时机
 * 2. 提取核心数据
 *    2.1 核心容器：存放编辑器底层实例 使用 useRef 钩子来创建一个引用容器。  状态管理：控制 UI 交互和终端显示
 *    2.2 捕获编辑器实例的回调函数 (传给 CodeEditor)  将实例装进 ref 容器
 *    2.3 保存逻辑 handleSave(传给 Header)   editorRef.current.getValue() 提取纯文本
 *    2.4 运行逻辑 handleRun(传给 Header)    editorRef.current.getValue() 提取纯文本
 *    2.5 App -> Header, CodeEditor, Terminal
 */

function App() {
  // 2.1 核心容器：存放编辑器底层实例 使用 useRef 钩子来创建一个引用容器。
  const editorRef = useRef(null);

  const [activeFile, setActiveFile] = useState('index.js');
  // 新增：保存当前编辑器里的代码
  const [currentCode, setCurrentCode] = useState('');
  // 新增：防抖状态，标记是否正在请求后端
  // 状态管理：控制 UI 交互和终端显示
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  // 新增：终端日志状态变更为可变状态
  const [terminalLogs, setTerminalLogs] = useState([
    { id: Date.now(), type: 'info', text: '# 终端已就绪。点击顶部运行按钮执行代码。' }
  ]);

  // 9.4 控制页面是显示“登录大厅”还是“IDE 编辑器”
  const [isJoined, setJoined] = useState(false);
  // 用于WebSocket连接，确保子组件能更新
  const [currentSocket, setCurrentSocket] = useState(null);
  // 从URL中获取roomId（用于快速进入指定房间）
  const [initialRoomId, setInitialRoomId] = useState('');

  // 模拟roomId
  const roomId = 'A2026';

  // 2.2 捕获编辑器实例的回调函数 (传给 CodeEditor) 
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;  // 将实例装进 ref 容器
    console.log("Monaco Editor 挂载成功，实例已捕获！");
  }

  // 2.3 保存逻辑 handleSave(传给 Header)   editorRef.current.getValue() 提取纯文本
  const handleSave = async () => {
    // console.log("🟢 按钮被点击了！当前状态检测:", {
    //   hasEditor: !!editorRef.current,
    //   isSaving: isSaving
    // });


    // 如果容器里有值就挂载 没有就返回
    if (!editorRef.current || isSaving) return;
    setIsSaving(true);
    addLog('info', '正在保存代码');

    try {
      const currentCode = editorRef.current.getValue();  // 提取纯文本
      // 也可以写成payload
      // const payload = {
      //   roomId: "project_1024",
      //   code: currentCode,
      //   language: 'javascript'
      // };
      // 用 fetch 方法像后端发送代码，请求执行
      const response = await fetch('http://localhost:3000/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // body: JSON.stringify(payload)
        body: JSON.stringify({
          roomId: roomId,
          code: currentCode,
          language: 'javascript'
        })
      })
    } catch (err) {
      console.log(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  // 2.4 运行逻辑 handleRun(传给 Header)
  const handleRun = async () => {
    if (!editorRef.current || isRunning) return;
    setIsRunning(true);
    addLog('info', '正在运行代码');

    try {
      const currentCode = editorRef.current.getValue();  // 提前纯文本
      // 用 fetch 方法像后端发送代码，请求执行
      const response = await fetch('http://localhost:3000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomId,
          code: currentCode,
          language: 'javascript'
        })
      })
    } catch (err) {
      console.log(err.message);
    } finally {
      setIsRunning(false);
    }
  }

  // 6.3 使用 useEffect 来监听 Socket 的消息  保证只在页面刚打开时打一次电话
  useEffect(() => {
    // 9.5 页面加载时，检查 URL 中是否有 roomId 参数
    // 这样用户可以通过分享链接 (?roomId=123) 快速进入房间
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('roomId');
    if (roomFromUrl) {
      setInitialRoomId(roomFromUrl);
      console.log('从URL获取到roomId:', roomFromUrl);
    }

    // 监听前端自己是否连上了
    if (socket) {
      socket.on('connect', () => {
        console.log('我成功打通后端的电话了！');
      })
    }
    // 当组件卸载(比如关闭页面)时，主动挂断电话
    return () => {
      // socket.disconnect();
    }
  }, [])  // 空依赖数组表示仅在组件挂载时执行一次

  // 9.6 加入房间的函数
  // 接收来自Login组件的用户名和房间号参数
  const handleJoinRoom = async (usernameInput, roomIdInput) => {
    // 注：Login组件已经验证过用户名和房间号不为空，这里无需再验证

    try {
      // ========== 【第1步】调用后端HTTP接口获取JWT Token ==========
      // 后端 /api/join 接口会：
      // 1. 验证roomId是否存在
      // 2. 生成JWT Token（包含用户信息）
      // 3. 返回Token给前端
      const res = await fetch('http://localhost:3000/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, roomId: roomIdInput })
      });
      const data = await res.json()

      if (data.success) {
        // ========== 【第2步】保存Token到localStorage ==========
        // Token会用于建立WebSocket长连接时进行身份验证
        localStorage.setItem('ide_token', data.token);

        // ========== 【第3步】更新浏览器URL，记录roomId ==========
        // 用户刷新页面时能自动恢复到该房间
        window.history.pushState({}, '', `?roomId=${roomIdInput}`);

        // ========== 【第4步】建立WebSocket长连接 ==========
        // connectSocket会：
        // 1. 创建socket连接到后端
        // 2. 携带roomId和Token进行身份验证
        // 3. 返回连接实例保存到状态
        const s = connectSocket(roomIdInput, data.token);
        setCurrentSocket(s);

        // ========== 【第5步】切换界面状态 ==========
        // isJoined变为true，触发App组件重新渲染
        // 页面从Login组件切换到真正的IDE编辑器界面
        setJoined(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.log('加入房间失败!', err.message);
    }
  }

  // T-07 前端监听编辑器内容并向服务器发送变更
  /**
   * 处理编辑器内容变化
   * 流程：
   * 1. 更新本地 currentCode 状态（保持UI和状态同步）
   * 2. 通过 WebSocket 向后端发送代码变更
   * 3. 后端会广播给房间内其他所有客户端，实现实时协作
   */
  const handleCodeChange = (newCode) => {
    // 同步更新状态
    setCurrentCode(newCode);
    // 如果WebSocket已连接，发送代码变更给后端
    if (currentSocket) {
      currentSocket.emit('codeChange', newCode);
    }
  }

  /**
   * 执行代码
   * 流程：
   * 1. 校验编辑器有内容
   * 2. 设置运行状态为true（禁用按钮，防止重复点击）
   * 3. 向后端发送代码和语言类型
   * 4. 等待后端执行结果
   * 5. 根据执行结果在终端中输出相应颜色的日志
   * 6. 最后设置运行状态为false，恢复按钮
   */
  // const handleRunCode = async () => {
  //   if (!currentCode.trim()) return;

  //   setIsRunning(true);
  //   // 在终端打印开始执行的提示
  //   addLog('info', `> 正在执行 ${activeFile} ...`);

  //   try {
  //     // 向后端的 /api/run 接口发送代码，请求执行
  //     const response = await fetch('http://localhost:3000/api/run', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         code: currentCode,
  //         language: 'javascript'
  //       })
  //     });

  //     const result = await response.json();

  //     // 根据后端返回的 success 字段决定输出颜色（成功绿色，错误红色）
  //     if (result.success) {
  //       addLog('success', result.output || '(无输出结果)');
  //     } else {
  //       addLog('error', result.output);
  //     }
  //   } catch (err) {
  //     addLog('error', '❌ 连接后端服务器失败，请检查 Server 是否已启动 (端口3000)。');
  //   } finally {
  //     setIsRunning(false);
  //   }
  // };



  // 辅助函数：往终端追加日志
  /**
   * 向终端中添加新的日志消息
   * @param {string} type - 日志类型：'info'(蓝色)、'success'(绿色)、'error'(红色)
   * @param {string} text - 日志内容
   */
  const addLog = (type, text) => {
    setTerminalLogs(prev => [...prev, { id: Date.now(), type, text }]);
  };

  // ========== 【主要渲染逻辑】==========
  // 根据 isJoined 状态决定显示什么界面

  // 如果 isJoined = false，显示Login组件（登录/进入房间）
  if (!isJoined) {
    return <Login onJoinRoom={handleJoinRoom} initialRoomId={initialRoomId} />;
  };

  // 如果 isJoined = true，显示IDE编辑器界面
  // 整体布局：侧边栏 + 编辑器区域（上：代码编辑器 + 下：终端）
  return (
    // 最外层容器：撑满全屏，暗色背景
    <div className="h-screen w-screen flex bg-gray-900 text-white font-sans">
      {/* 左侧：侧边栏（文件导航） */}
      <Sidebar activeFile={activeFile} setActiveFile={setActiveFile} />

      {/* 右侧：编辑器区域（flex-1占满剩余空间） */}
      <div className="flex-1 flex flex-col">

        {/* 顶部：Header（显示文件名、运行按钮） */}
        <Header
          activeFile={activeFile}
          isSaving={isSaving}
          isRunning={isRunning}
          onSave={handleSave}
          onRun={handleRun}
        />

        {/* 中间：代码编辑器（Monaco编辑器） */}
        {/* 
          Props说明：
          - code: 当前代码内容
          - setCode: 代码变更回调（会同步状态并广播给其他客户端）
          - roomId: 房间ID
          - socket: WebSocket实例（用于接收其他用户的代码变更）
        */}

        {/* 传入挂载拦截器 handleEditorDidMount */}
        <CodeEditor
          code={currentCode}
          setCode={handleCodeChange}
          roomId={initialRoomId}
          socket={currentSocket}
          onMount={handleEditorDidMount}
        />

        {/* 下方：终端（显示运行结果和日志） */}
        <Terminal logs={terminalLogs} />
      </div>
    </div>
  );
}

export default App;
```

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\components\Header.jsx

// 顶部战区
// 职责： 专注展示标题、当前文件名和“运行”按钮。
// 需要接收的数据 (Props)： 只需要知道当前选中的文件是谁（用来展示名字）。


// 1. 定义组件，并接收总部传来的“快递包裹”
export default function Header({ activeFile, isRunning, onRun, onSave, isSaving }) {
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
      <span className="font-semibold text-gray-400 flex items-center gap-2">
        Web IDE <span className="text-gray-600">/</span>
        <span className="text-gray-200">{activeFile}</span>
      </span>

      {/* 保存按钮 */}
      <button
        onClick={onSave}
        disabled={isSaving || isRunning}  // 如果正在运行也禁用保存
        className={`px-4 py-2 rounded ${isSaving ? 'bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
      >
        {isSaving ? '保存中...' : '💾 保存 (Save)'}
      </button>
      {/* 绑定执行事件，运行时禁用按钮防止重复点击 */}
      <button
        // 3. 点击事件：用户一点，立刻按响总部给的“对讲机” (onRunCode)
        onClick={onRun}
        // 4. 禁用逻辑：如果总部说正在运行 (isRunning)，按钮就锁死，不让点
        disabled={isRunning || isSaving} // 如果正在保存，也禁用运行
        className={`px-4 py-2 rounded ${isRunning ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'} transition-colors`}
      >
        {/* 6. 动态文字：根据状态显示是“运行中”还是“运行”按钮 */}
        {isRunning ? '⏳ 运行中...' : '▶ 运行 (Run)'}
      </button>
    </div>
  );
}
```

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\components\CodeEditor.jsx

import Editor from '@monaco-editor/react';
// T-08 T-08服务器广播代码，实现多端同步
// 8.1 定义一个全局标志位，默认为false(代表是手动输入)
import { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';
import { socket } from '../socket'; // 引入我们刚刚建立的 Socket 连接实例
// 中间战区
// 职责： 封装 Monaco Editor，处理代码输入。
// 内部逻辑： 它未来需要把写好的代码发送给后端。


// 接收父组件 (App.jsx) 传过来的 socket 实例
export default function CodeEditor({ socket, onMount }) {
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
    }, 500),  // 500毫秒防抖
    [socket]
  )

  // 8.4 监听服务器广播的代码变更(接收端)
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
  }, [socket])  // 依赖 socket 变化

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
        onClick={() => setEditorMode(EditorMode.Editor)}
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

```

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\frontend\src\components\Terminal.jsx

// 底部战区
// 职责： 专注显示系统日志和代码运行结果。

export default function Terminal({ logs }) {
  return (
    <div className="h-64 bg-[#0d1117] border-t border-gray-700 p-4 font-mono text-sm overflow-y-auto">
      {logs.map(log => (
        <p
          key={log.id}
          className={`mb-1 ${log.type === 'error' ? 'text-red-400' :
            log.type === 'success' ? 'text-green-400' :
              'text-gray-500'
            }`}
        >
          {log.text}
        </p>
      ))}
    </div>
  );
}

```

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\server\index.js

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const http = require('http'); // Node.js 自带的模块，不用 npm install
// 6. 后端引入 socket.io 建立长连接服务
// 6.1 导入socket.io
const { Server } = require('socket.io');
// T-09 引入 JWT 与 Room 机制，实现房间隔离
// 9.1 引入 JWT 库
const jwt = require('jsonwebtoken');


const app = express();
// 开启跨域允许前端 (5173端口) 访问
app.use(cors());
// 解析 application/json 格式的请求体 (JSON 解析中间件)
app.use(express.json());

// 6.2 改造地基：用原生的http模块包装express应用
const server = http.createServer(app);
// 6.3 把socket.io服务器绑定到这个http服务器上
const io = new Server(server, {
  cors: {
    // 允许跨域（因为前端 Vite 通常是 5173 端口，后端是 3000，必须允许跨域“来电”）
    origin: '*',
  }
})

// 9.2 定义一个密钥，用于 JWT 的签名和验证（实际项目中请使用更安全的方式管理密钥）
const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_here';

// 大步骤 1：开发后端发卡接口 (HTTP API)
app.post('/api/join', (req, res) => {
  // 1. 从请求体 (req.body) 中获取前端传来的 用户名(username) 和 房间号(roomId)
  const { username, roomId } = req.body;
  // 2. 检查参数是否为空，为空则返回 400 错误提示并终止
  if (!username || !roomId) {
    return res.status(400).json({
      success: false,
      message: '用户名和房间号不能为空'
    });
  }
  // 3. 把用户名和房间号打包成一个对象，作为 JWT 的载荷 (Payload)
  const payload = {
    username,
    roomId,
  }
  // 4. 使用你的专属密钥 (SECRET_KEY) 和 jsonwebtoken 库，签发一个 Token
  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: '24h' // 这个 Token 24小时后过期，过期后需要重新获取
  })
  console.log('生成的 JWT:', token);
  // 5. 把生成的 Token 和成功状态，通过 res.json() 返回给前端
  res.json({
    success: true,
    token: token,
    payload: payload
  })
});

// 大步骤 4：后端设立保安检查 (Socket 中间件)
io.use((socket, next) => {
  // 1. 从客户端的 auth 选项中提取 token
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("拒绝访问：未提供Token"));
  }

  // 2. 验证 Token 的合法性
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return next(new Error("拒绝访问：Token无效或已过期"));
    }

    // 3. 验证通过！把解码后的用户信息挂载到 socket 对象上, 方便后续使用
    socket.user = decoded;
    next();  // 放行，允许建立长连接
  });
})

// 6.4 监听客户端连接事件
io.on('connection', (socket) => {
  // 大步骤 5：后端分配房间与广播改造
  // 此时能进来的，一定是通过了上方 io.use 中间件的合法用户!
  // 5.1 从握手 query 中提取前端想进的房间号
  const { roomId, username } = socket.user;
  // 5.2 将该 socket拉入专属房间
  socket.join(roomId);
  console.log(`[房间 ${roomId}] 用户 ${username} 已连接`);

  console.log('A user connected:', socket.id); // 打印连接的用户ID，方便调试
  // 7.1 监听前端刚才发出的 'codeChange' 频道的消息
  socket.on('codeChange', (newCode) => {
    // console.log(newCode); // 这里我们先简单地在后端控制台打印一下收到的代码，确认通信正常。
    // 8.1 使用socket.broadcast.emit来把这个消息广播给除了自己以外的所有连接到这个服务器的客户端
    // 5.3 不再使用 socket.broadcast.emit(全网广播)
    // 而是使用 socket.to(roomId).emit，只发给同房间的其他人
    // socket.broadcast.emit('codeChange', newCode);
    socket.to(roomId).emit('codeChange', newCode);
  })


  // 6.4.1 监听挂断事件
  socket.on('disconnect', () => {
    // console.log('user disconnected', socket.id);
    console.log(`[房间 ${roomId}] 用户 ${username} 已离开`);
  })
})

// T-10 保存接口
app.post('/api/save', (req, res) => {
  // 1. 拿到从前端body中传过来的数据
  const { roomId, code, language } = req.body;
  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).join({ error: '代码不能为空' });
  }

  // 3. 生成一个 `.js` 临时文件并写入
  // 把文件存在 server 目录下的 temp 文件夹里
  const tempDir = path.join(__dirname, 'temp');
  // 如果 temp 这个文件夹还不存在，就让 Node.js 自动建一个
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  // 拼接出最终的文件名，例如: project_1024.js
  const filePath = path.join(tempDir, `${roomId}.js`);

  // 4. 执行写入
  try {
    // 强制同步写入物理硬盘 (utf8 编码)
    fs.writeFileSync(filePath, code, 'utf8');
    // 在后端 Node 控制台打印一下，方便你观察
    console.log(`${filePath}`);
    // 5. 必须给前端返回一个成功的 200 响应，形成闭环
    res.status(200).json({
      success: true,
      message: '代码已安全落盘'
    })
  } catch (error) {
    console.log('写入失败', error);
    // 如果硬盘满了或者没权限，返回 500 服务器错误
    res.status(500).json({ error: '服务器保存文件失败' })
  }
})

// 核心执行接口
app.post('/api/run', (req, res) => {
  const { roomId, code, language } = req.body;

  // 2. 简单安全的校验
  if (!code) {
    return res.status(400).join({ error: '代码不能为空' });
  }

  // // 目前仅支持 JavaScript 的执行演示
  // if (language !== 'javascript') {
  //   return res.status(400).json({ error: 'Unsupported language' });
  // }

  // 1. 生成临时文件路径
  const tempFilePath = path.join(__dirname, 'temp.js');

  // 2. 将前端传来的代码写入临时文件
  fs.writeFileSync(tempFilePath, code);

  // 3. 创建子进程，执行该临时文件
  exec(`node ${tempFilePath}`, (error, stdout, stderr) => {
    // 执行完毕后，无论成功失败，都清理掉临时文件
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // 如果执行过程中有语法或运行错误
    if (error || stderr) {
      return res.json({
        success: false,
        output: stderr || error.message
      });
    }

    // 执行成功，返回标准输出
    return res.json({
      success: true,
      output: stdout
    });
  });
});

const PORT = 3000;
// 6.5 启动服务（非常重要：把原来的 app.listen 删掉或注释掉，换成 server.listen）
server.listen(PORT, () => {
  console.log(`🚀 后端服务器已启动，监听端口: ${PORT}`);
});
```

```jsx
// C:\Users\林子霞\Desktop\web-ide-project\server\temp\A2026.js

// 请在此输入代码...
// day
console.log(111)
```



## 四、🚧 全栈联调排坑记录 (Debug Logs)

在今天的前后端联调中，我们通过 **F12 Network (网络) 面板** 斩获了三大经典 Bug 并成功修复：

- **点击按钮毫无反应**：发现原因是组件拆分时，父组件 `App.jsx` 漏传了 `onSave={handleSave}` 这个 Props 给子组件 `Header`，导致“遥控器失灵”。
- **🔴 404 (Not Found)**：前端发出了完美的请求，但后端没有写对应的路由接口。此时证明**前端代码 100% 正确**，属于后端“没开门”。
- **🔴 400 (Bad Request)**：请求成功到达后端，但触发了后端的安全拦截。检查 Payload 发现是前端漏写了 `const roomId = "project_1024"` 导致变量 `undefined`。

------

## 💡 面试必杀技

**👨‍💼 面试官提问 1：**

> “在前端使用 Fetch API 发送 POST 请求时，为什么要调用 `JSON.stringify()`？如果不加 `Content-Type: application/json` 请求头会发生什么？”

**👩‍💻 你的满分回答：**

> “因为 HTTP 协议在网络传输时底层只认纯文本比特流，它不认识 JavaScript 的 Object 对象。如果不使用 `JSON.stringify()` 进行**序列化**，发出去的数据会变成 `[object Object]` 这种无效字符串。 而 `Content-Type` 则是快递盒上的标签，如果不显式声明它是 JSON，后端的 Express `express.json()` 中间件就不知道该用什么规则去解析它，通常会直接拒收或者解析成一个空对象 `{}`, 导致后端拿不到前端传来的任何参数。”

**👨‍💼 面试官提问 2：**

> “在处理用户传来的代码时，你为什么选择利用 `fs.writeFileSync` 把它写成服务器上的一个临时 `.js` 物理文件，而不是直接把代码字符串存在 Node.js 的内存变量里去执行？”

**👩‍💻 你的满分回答：**

> “主要出于**执行安全**和**转义地狱**的考量。 如果存在内存里直接通过命令拼接到 Node 中执行，一旦用户的代码里包含各种复杂的单引号、双引号或特殊字符，极容易引发命令注入漏洞或语法崩溃。 将其写入独立的物理文件，是实现**沙箱隔离执行 (Sandbox)** 的最稳妥雏形。这样后续我可以直接利用 `child_process` 子进程模块，像普通脚本一样通过 `node filePath.js` 来安全执行它，执行完毕后再用 `fs.unlinkSync` 将文件无痕清理掉，既保证了隔离性，又不会撑爆服务器硬盘。”
