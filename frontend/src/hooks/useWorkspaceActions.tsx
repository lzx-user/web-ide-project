import { useState } from 'react';
import type { MutableRefObject } from 'react';
import type { OnMount } from '@monaco-editor/react';
import toast from 'react-hot-toast';
import request from '../services/request';
import { STORAGE_KEYS } from '../utils/constants';
import type { EditorCacheEntry, WorkspaceSocket } from '../types/ide';
import useIDEStore from '../store/useIDEStore';

type WorkspaceActionsOptions = {
  currentSocket: WorkspaceSocket | null;
  roomId: string;
  activeFile: string;
  isActiveFile: boolean;
  editorRef: MutableRefObject<Parameters<OnMount>[0] | null>;
  fileCacheMap: MutableRefObject<Map<string, EditorCacheEntry>>;
  setActiveFile: (filename: string) => void;
};

// 创建、删除、保存、运行
export default function useWorkspaceActions({
  currentSocket,
  roomId,
  activeFile,
  isActiveFile,
  editorRef,
  fileCacheMap,
  setActiveFile,
}: WorkspaceActionsOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const setSaveResult = useIDEStore((state) => state.setSaveResult);

  // 创建文件逻辑 只管emit事件，具体文件创建和同步逻辑由后端处理
  const handleCreateFile = ({ path, isFolder }: { path: string; isFolder: boolean }) => {
    if (!currentSocket) {
      toast.error('Socket 未连接， 无法创建');
      return;
    }

    // 像后端发送创建请求 第 3 个参数传入一个回调函数，用来接收后端的点对点确认
    currentSocket.emit('createFile', { filename: path, isFolder }, (response) => {
      if (!response) return;

      // 建立完整响应生命周期分支
      if (response.success) {
        // 创建成功，但路径被系统自动净化过
        if (response.isSanitized) {
          toast(
            () => (
              <div className="text-xs text-gray-600">
                <p className="font-bold text-amber-500 mb-0.5">⚠️ 系统已自动规范路径</p>
                <p>由于检测到不规范输入，已将：</p>
                <code className="bg-gray-100 px-1 py-0.5 rounded text-rose-500 line-through block my-0.5 truncate">
                  {response.original}
                </code>
                <p>自动修正为标准路径：</p>
                <code className="bg-gray-50 px-1 py-0.5 rounded text-emerald-600 block my-0.5 font-medium truncate">
                  {response.cleaned}
                </code>
              </div>
            ),
            {
              duration: 5000,
              icon: '⚙️',
              style: {
                border: '1px solid #f59e0b',
                padding: '12px',
                background: '#fff',
              },
            }
          );
        }

        return;
      }

      // 创建失败（如黑客越界攻击、重名、非法路径），弹出醒目的红色错误提示！
      toast.error(`创建文件失败: ${response.msg}`, {
        id: 'create-file-fail',  // 设置唯一id，防止连击时弹出重叠的堆叠层
        duration: 4000,
        style: {
          border: '1px solid #f43f5e',
          padding: '10px',
          color: '#9f1239',
          fontWeight: '500',
        }
      });
    });
  };

  // 删除文件逻辑
  const handleDeleteFile = (filename: string) => {
    // 拦截确认，防止手滑误删
    if (!window.confirm(`确定要删除${filename}`)) return;

    if (!currentSocket) {
      toast.error('Socket 未连接，无法删除');
      return;
    }

    currentSocket.emit('deleteFile', { filename }, (response) => {
      if (!response) {
        toast.error('删除失败：服务无响应');
        return;
      }

      if (!response.success) {
        toast.error(`删除失败: ${response.msg}`);
        return;
      }

      toast.success('删除成功');

      for (const deletedPath of response.deletedPaths ?? [filename]) {
        fileCacheMap.current.get(deletedPath)?.model.dispose();
        fileCacheMap.current.delete(deletedPath);
      }

      // 只有后端确认删除成功后，才清空当前文件
      if (activeFile === filename) {
        setActiveFile('');
        // 同步清除本地记忆，否则刷新会炸尸
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE);
      }
    });
  };

  // 保存代码逻辑
  const handleSave = async () => {
    // 如果没有房间号，直接拦截，不让它往后端发瞎请求
    if (!editorRef.current || isSaving || !roomId || !isActiveFile) {
      toast.error('请选择一个文件后再保存');
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading('正在保存代码...');

    try {
      const { data } = await request.post('/save');

      toast.success('保存成功', { id: loadingToast });
      setSaveResult(data.savedAt ?? new Date().toISOString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`保存失败: ${message}`, { id: loadingToast });
      setSaveResult(null, message);
    } finally {
      setIsSaving(false);
    }
  };

  // 运行代码逻辑
  const handleRun = async () => {
    if (import.meta.env.VITE_ENABLE_CODE_EXECUTION !== 'true') {
      toast.error('演示环境已关闭代码执行');
      return;
    }
    if (!editorRef.current || isRunning || !roomId || !isActiveFile) {
      toast.error('请选择一个文件后再运行代码');
      return;
    }

    const code = editorRef.current.getValue(); // 提取纯文本

    // 通过 Socket 向后端发送执行请求，携带当前代码和文件名
    if (currentSocket) {
      currentSocket.emit('executeCode', { code, filename: activeFile });
    }
  };

  return {
    isSaving,
    isRunning,
    setIsRunning,
    handleCreateFile,
    handleDeleteFile,
    handleSave,
    handleRun,
  };
}
