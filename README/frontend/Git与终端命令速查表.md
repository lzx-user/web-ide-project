# Web IDE 开发文档 - 终端与 Git 命令速查表 (T-01 至 T-04)

## 🎯 核心目标

汇总第一阶段（T-01 至 T-04）开发过程中使用到的所有终端（Terminal）命令，涵盖依赖安装、项目运行、本地 Git 存档以及 GitHub 云端同步，方便未来快速查阅。

------

## 📦 一、 NPM 依赖与项目运行命令

这些命令主要用于安装项目所需要的“零件”（第三方库），以及控制本地开发服务器的开关。

### 1. 安装项目核心依赖

Bash

```react
# 安装 Tailwind CSS v4 的 Vite 核心插件
npm install @tailwindcss/vite

# 安装微软开源的 Monaco Editor (VS Code 核心编辑器组件)
npm install @monaco-editor/react
```

### 2. 控制本地服务器

Bash

```react
# 启动本地开发服务器 (启动后可通过 http://localhost:5173 预览)
npm run dev
```

> **💡 快捷键提示：** 当服务器正在运行时，如果想输入新的 npm 或 git 命令，必须先将光标点进终端，按下 `Ctrl + C`，然后输入 `Y` 并回车，以终止当前运行的服务器。

------

## 💾 二、 Git 本地版本控制命令 (单机存档)

这些命令用于将代码的修改进度安全地保存在自己电脑的硬盘里。每次完成一个阶段性小任务，都必须完整执行 `add` 和 `commit`。

### 1. 初始化仓库 (仅新建项目时执行一次)

Bash

```react
# 在当前文件夹内创建一个隐藏的 .git 目录，正式开启版本监控
git init
```

### 2. 存档标准动作 (高频使用：暂存 + 提交)

Bash

```react
# 第一步：把当前目录下所有修改过或新建的文件，放入暂存区 (购物车)
# 注意：add 后面有一个空格和一个英文句号
git add .

# 第二步：正式提交存档，并附带一条清晰的说明信息
# 格式规范：通常以 feat (新功能)、fix (修复)、refactor (重构) 开头
git commit -m "feat: 完成阶段一 T-02与T-03，实现 IDE 核心界面与 Monaco Editor 集成"

git commit -m "refactor: 完成核心界面组件拆分，建立 Sidebar 等独立模块"
```

------

## ☁️ 三、 GitHub 远程同步命令 (云端备份)

这些命令用于将本地存好档的代码，推送到 GitHub 上的远程仓库中。

### 1. 首次关联并推送到云端 (仅首次关联时执行)

Bash

```react
# 将本地默认的主分支名称规范化为企业通用的 main
git branch -M main

# 给本地 Git 绑定一个名为 origin 的远程云端仓库地址
# (这里的 URL 需替换为你在 GitHub 上创建的真实空仓库地址)
git remote add origin https://github.com/lzx-user/web-ide-project.git

# 将本地的 main 分支代码首次推送到云端的 origin，并绑定追踪关系 (-u)
git push -u origin main
```

### 2. 日常推送动作 (高频使用)

Bash

```react
# 因为首次推送已经使用了 -u 绑定了关系，以后每次本地 commit 存档后，只需要敲这极其简短的两个单词即可
git push
```

------

## 🛠️ 四、 Git 网络排错命令 (国内网络特供)

在国内直连 GitHub 时，经常会遇到 `Connection was reset` 或 `Failed to connect to github.com` 等报错。以下是常用的网络环境清理命令。

### 清理代理缓存 (解决玄学网络拦截)

如果你的终端报错无法推送，可以尝试执行以下两行命令，清除 Git 中可能残留的错误网络代理配置，然后再次尝试 `git push`：

Bash

```react
git config --global --unset http.proxy
git config --global --unset https.proxy
```