import React, { useEffect, useState, useCallback } from 'react';
// ChevronRight (向右箭头) 和 ChevronDown (向下箭头) 用于文件夹折叠
import { FolderKanban, Plus, X, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { getFileIcon } from '../utils/iconMap';
import type { FileNode } from '../types/ide';

type CreatingState = {
  path: string | null;
  type: 'file' | 'folder' | null;
};

type FileTreeNodeProps = {
  node: FileNode;
  level?: number;
  activeFile: string;
  setActiveFile: (path: string) => void;
  handleDeleteFile: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void;
  creatingState: CreatingState;
  setCreatingState: React.Dispatch<React.SetStateAction<CreatingState>>;
  handleCreateFile: (data: { path: string; isFolder: boolean }) => void;
};

/**
 * 1. 使用 React.memo 包裹递归子组件
 * 职责：只有当自身的 Props（如 node, activeFile, creatingState）发生本质变化时才触发重绘，
 * 彻底切断因父组件打字导致的无效连带渲染。
 */

// 定义递归组件
const FileTreeNode = React.memo(({
  node,
  level = 0,
  activeFile,
  setActiveFile,
  handleDeleteFile,
  onContextMenu,
  creatingState,  // “正在创建”的指针状态
  setCreatingState,  // 修改指针的方法
  handleCreateFile  // 发送给后端的创建方法 
}: FileTreeNodeProps) => {
  // 只有文件夹才需要“展开/折叠”状态，默认我们让它展开
  const [isOpen, setIsOpen] = useState(true);
  const isActive = activeFile === node.path;  // node.path 来判断唯一性

  const shouldForceOpen = creatingState.path === node.path;
  const isFolderOpen = isOpen || shouldForceOpen;

  // 动态计算缩进：层级越深，向右偏移越多
  const indentStyle = { paddingLeft: `${level * 12 + 16}px` };

  // 1. 如果它是文件
  if (node.type === 'file') {
    return (
      <div
        style={indentStyle}
        onClick={() => setActiveFile(node.path)}
        onContextMenu={(e) => onContextMenu(e, node)}  // 绑定右键事件
        className={`group cursor-pointer flex items-center justify-between py-2 pr-4 text-sm transition-all ${isActive
          ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
          : 'text-gray-600 border-l-2 border-transparent hover:bg-gray-100 hover:text-gray-900'
          }`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {getFileIcon(node.name, false, isActive)}
          <span className="truncate">{node.name}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteFile(node.path);  // 删除时也传 path
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 transition-all rounded hover:bg-gray-200 shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  // 2. 如果它是文件夹
  return (
    <div>
      <div
        style={indentStyle}
        onClick={() => setIsOpen(!isOpen)}
        onContextMenu={(e) => onContextMenu(e, node)} // 绑定右键事件
        className="group cursor-pointer flex items-center py-2 pr-4 text-sm text-gray-700 hover:bg-gray-100 transition-all border-l-2 border-transparent"
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {isFolderOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          {getFileIcon(node.name, true, false)}
          <span className="truncate font-medium">{node.name}</span>
        </div>
      </div>

      {/* 渲染子节点区域 */}
      {isFolderOpen && (
        <div>
          {/* 🌟 核心魔法：如果指针指向我，就在真实的子节点最上面，渲染一个输入框！ */}
          {creatingState.path === node.path && (
            <div
              key={`${node.path}-creating`}
              style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }} // 比当前文件夹再深一层
              className="flex items-center gap-2.5 py-1.5 pr-4 text-sm"
            >
              {/* 根据要建的是文件还是文件夹，显示不同的假图标 */}
              {getFileIcon('temp', creatingState.type === 'folder', false)}
              <input
                autoFocus
                type="text"
                className="w-full bg-white text-gray-800 px-2 py-0.5 text-xs rounded border border-blue-400 outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={`新建${creatingState.type === 'folder' ? '文件夹' : '文件'}...`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const inputVal = e.currentTarget.value.trim();
                    if (inputVal === '') return;
                    // 拼接全路径：父级路径 + / + 新名字
                    const fullPath = `${node.path}/${inputVal}`;
                    // 改成对象，显示告诉上层我们要建的是什么
                    handleCreateFile({
                      path: fullPath, // 使用拼接好的完整路径
                      isFolder: creatingState.type === 'folder'
                    });
                    setCreatingState({ path: null, type: null }); // 收工，隐藏输入框
                  }
                  if (e.key === 'Escape') setCreatingState({ path: null, type: null });
                }}
                onBlur={() => setCreatingState({ path: null, type: null })}
              />
            </div>
          )}

          {/* 递归渲染真实的后代节点 */}
          {node.children && node.children.map((childNode) => (
            <FileTreeNode
              key={childNode.path}
              node={childNode}
              level={level + 1}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              handleDeleteFile={handleDeleteFile}
              onContextMenu={onContextMenu}
              creatingState={creatingState}
              setCreatingState={setCreatingState}
              handleCreateFile={handleCreateFile}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// 主组件 Sidebar
type SidebarProps = {
  activeFile: string;
  setActiveFile: (path: string) => void;
  fileList: FileNode[];
  handleCreateFile: (data: { path: string; isFolder: boolean }) => void;
  handleDeleteFile: (path: string) => void;
};

type MenuState = {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
};

export default function Sidebar({
  activeFile,
  setActiveFile,
  fileList,  // 现在变成了从后端传来的 JSON 树
  handleCreateFile,
  handleDeleteFile
}: SidebarProps) {
  // 全新的高阶状态：记录“当前正在哪里，创建什么类型”
  const [creatingState, setCreatingState] = useState<CreatingState>({ path: null, type: null });

  // 右键菜单状态
  const [menuState, setMenuState] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,  // 记录当前右键点击的是哪个文件/文件夹
  });

  // 全局点击监听：用户在屏幕任何地方点左键，右键菜单都要消失
  useEffect(() => {
    const closeMenu = () => setMenuState((prev) => ({ ...prev, visible: false }));
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  /**
   * 💡 【性能重构】使用 useCallback 固化右键菜单函数的内存地址。
   * 依赖项为空数组，意味着只要 Sidebar 不销毁，这个函数的内存引用永远不变，
   * 配合上面的 React.memo，彻底避免了深层文件树组件的无效重绘。
   */

  // 暴露给子节点的右键触发函数 触发右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();  // 拦截浏览器自带的极丑默认右键菜单
    e.stopPropagation();  // 阻止事件冒泡，防止点子文件时连带触发父文件夹的右键
    setMenuState({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node: node,
    });
  }, []);

  return (
    <div className="w-full h-full bg-[#f8f9fa] flex flex-col shrink-0">
      <div className="h-12 px-4 border-b border-gray-200 flex items-center text-gray-700 font-medium text-sm tracking-wide gap-2">
        <FolderKanban size={18} className="text-blue-600" />
        资源管理器
      </div>

      {/* 根目录新建区域 (兜底方案) */}
      <div className="p-3">
        {creatingState.path === 'root' ? (
          <div className="relative flex items-center">
            <input
              autoFocus
              type="text"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const inputVal = e.currentTarget.value.trim();
                  if (inputVal === '') return;

                  // 根目录创建时，直接将 inputVal 作为 path，移除了未定义的 fullPath
                  handleCreateFile({
                    path: inputVal,
                    isFolder: creatingState.type === 'folder'
                  });
                  setCreatingState({ path: null, type: null });
                }
                if (e.key === 'Escape') setCreatingState({ path: null, type: null });
              }}
              onBlur={() => setCreatingState({ path: null, type: null })}
              className="w-full bg-white text-gray-800 px-3 py-1.5 text-sm rounded-md border border-blue-400 outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
              placeholder={`新建${creatingState.type === 'folder' ? '文件夹' : '文件'} (如: src/app.js)`}
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setCreatingState({ path: null, type: null }); }}
              className="absolute right-2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setCreatingState({ path: 'root', type: 'file' })}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Plus size={14} /> 文件
            </button>
            <button
              onClick={() => setCreatingState({ path: 'root', type: 'folder' })}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Plus size={14} /> 文件夹
            </button>
          </div>
        )}
      </div>

      {/* 树形列表区域 */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileList.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            handleDeleteFile={handleDeleteFile}
            onContextMenu={handleContextMenu}  // 传递被缓存过的句柄
            creatingState={creatingState}
            setCreatingState={setCreatingState}
            handleCreateFile={handleCreateFile}
          />
        ))}
      </div>

      {/* 绝对定位的右键悬浮窗 */}
      {menuState.visible && menuState.node && (
        <div
          style={{ top: menuState.y, left: menuState.x }}
          className="fixed z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-sm text-gray-700 flex flex-col"
        >
          {/* 如果是文件夹，才显示“新建”选项 */}
          {menuState.node.type === 'folder' && (
            <>
              <button
                onClick={() => setCreatingState({ path: menuState.node!.path, type: 'file' })}
                className="flex items-center px-4 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
              >
                新建文件
              </button>
              <button
                onClick={() => setCreatingState({ path: menuState.node!.path, type: 'folder' })}
                className="flex items-center px-4 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
              >
                新建文件夹
              </button>
              <div className="h-px bg-gray-200 my-1 mx-2"></div>
            </>
          )}

          <button
            onClick={() => handleDeleteFile(menuState.node!.path)}
            className="flex items-center px-4 py-2 text-rose-500 hover:bg-rose-50 transition-colors text-left"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}
