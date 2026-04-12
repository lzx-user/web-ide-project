### 📦 核心概念笔记：彻底搞懂 React 的 Props

#### 1. 🤔 怎么理解 Props？（生活中的比喻）

Props 是 Properties（属性）的简写。如果把 React 组件看作是一个个真实的人：

- **父组件（App.jsx）** 就像是 **老板**。
- **子组件（Header, Sidebar）** 就像是 **员工**。
- **Props** 就是老板派发给员工的 **任务说明书 / 快递包裹**。

**核心铁律：**

1. **单向传递**：包裹只能由老板（父组件）发给员工（子组件），员工不能把包裹原路退回，也不能偷偷修改包裹里的东西（Props 是只读的）。
2. **拿钱办事**：员工（子组件）不用关心包裹里的数据是怎么算出来的，只要拿到包裹，照着里面的说明书把活儿干完（渲染出 UI）就行了。

------

#### 2. 📝 Props 编写与传递的“三步曲”

我们以你的 Web IDE 项目中，`App` 把 `activeFile`（当前文件名）传给 `Header` 为例。

**🟢 第一步：父组件准备数据（老板准备包裹）** 在父组件 `App.jsx` 中，数据无论是写死的字符串，还是动态的 `useState`，都要先准备好。

```react
function App() {
  // 1. 准备数据：当前选中的文件名
  const [activeFile, setActiveFile] = useState('index.js'); 
  // ...
```

**🔵 第二步：父组件传递数据（老板发快递）** 在父组件的 `return` 也就是写类似 HTML 标签的地方，通过 **“自定义属性”** 的方式把数据挂载到子组件上。

```react
  return (
    <div>
      {/* 2. 发快递：
          包裹的名字叫 activeFile (左边)
          包裹里装的内容是变量 activeFile 的值 'index.js' (右边花括号)
      */}
      <Header activeFile={activeFile} /> 
    </div>
  );
}
```

**🟠 第三步：子组件接收并使用（员工拆包裹干活）** 在子组件 `Header.jsx` 中，函数的第一个参数永远是用来接收 Props 的。React 会自动把刚才传递的所有属性打包成一个对象。

- **传统写法（不推荐，稍显繁琐）：**

```react
export default function Header(props) {
  // props 就像一个大箱子，里面装了 { activeFile: 'index.js' }
  return (
    <div>
      当前文件：{props.activeFile} 
    </div>
  );
}
```

- **现代写法（强烈推荐，你代码里用的就是这个：解构赋值）：** 在函数括号里直接用 `{}` 把包裹拆开，精准拿出自己想要的东西。

```react
// 直接在参数里拆开包裹，拿出 activeFile
export default function Header({ activeFile }) { 
  return (
    <div>
      当前文件：{activeFile} 
    </div>
  );
}
```

------

#### 3. 🧠 进阶思考：为什么要用 Props？

你可能会问：*为什么不直接在 `Header` 里写死或者让 `Header` 自己去管理这个状态？*

这就回到了“状态提升”的思路： 如果 `Header` 自己管理 `activeFile`，那 `Sidebar` 怎么知道当前高亮哪个文件？`CodeEditor` 怎么知道把代码保存到哪个文件？ 只有让最外层的 `App`（老板）去统管全局状态，然后通过 **Props** 像树根一样把水分（数据）向下输送给所有的叶子（子组件），整个网页才能保持步调一致、不会乱套。