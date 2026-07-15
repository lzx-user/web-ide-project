import { useEffect } from 'react';
import { MonacoBinding } from 'y-monaco';
import useIDEStore from '../store/useIDEStore';
import { STORAGE_KEYS } from '../utils/constants';
import { getLanguageByFilename } from '../utils/editorLanguage';

// Monaco + Yjs 文件绑定
export default function useEditorBinding({
  editorRef,
  monacoRef,
  fileCacheMap,
  prevFileRef,
  bindingRef,
  activeFile,
  isActiveFile,
  ydoc,
  provider,
  isEditorMounted,
}) {
  // 监听切换文件: 解绑旧文件，绑定新文件
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // 底层核心实例还没准备好时，直接退出 (注意：这里把 !activeFile 删掉了)
    if (!editor || !monaco || !ydoc || !provider) return;

    // 如果当前没有选中任何文件（例如刚删除了当前文件）
    if (!activeFile || !isActiveFile) {
      // 撕掉可能存在的旧协同绑定
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      return; // 直接终止，不再往下走
    }

    const targetFile = activeFile;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_FILE, targetFile);  // 每次文件真正切换时，存入本地记忆

    // 1. 整理旧现场：保存上一个文件的光标视图，并撕掉旧胶水
    if (prevFileRef.current && fileCacheMap.current.has(prevFileRef.current)) {
      fileCacheMap.current.get(prevFileRef.current).viewState = editor.saveViewState();
    }

    // 撕掉旧文件的 Yjs 绑定，防止你在 index.js 里打字，却同步到了上一个文件里
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // 2. 找新文件模型：如果没有，就用空字符串创建一个
    let targetCache = fileCacheMap.current.get(targetFile);
    if (!targetCache) {
      const newModel = monaco.editor.createModel(
        '', // 初始给空字符串即可，Yjs 连上后会自动把服务器的真实内容塞进来
        getLanguageByFilename(targetFile),
        monaco.Uri.parse(`file://${targetFile}`) // 根据targetFile的后缀判断是css还是json
      );
      targetCache = { model: newModel, viewState: null };
      fileCacheMap.current.set(targetFile, targetCache); // 存入缓存
    }

    // 3. 切换编辑器模型并恢复视图
    editor.setModel(targetCache.model);
    if (targetCache.viewState) {
      editor.restoreViewState(targetCache.viewState); // 恢复上次的光标位置
    }

    // 4. 建立全新绑定
    // 根据当前文件名，向 Yjs 索要一个专属的共享文本类型。比如 ydoc.getText('index.js')
    const ytext = ydoc.getText(targetFile);

    // 向 Awareness 协议注入自定义身份（用于渲染别人屏幕上的光标名字）
    provider.awareness.setLocalStateField('user', {
      name: useIDEStore.getState().username || '前端开发工程师',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16)  // 随机生成一个十六进制颜色  
    });

    // 涂胶水：把当前文件的 Yjs 数据、Monaco 模型、以及光标同步绑定在一起
    bindingRef.current = new MonacoBinding(
      ytext,
      targetCache.model,
      new Set([editor]),
      provider.awareness
    );

    prevFileRef.current = targetFile;

  }, [
    activeFile,
    isActiveFile,
    ydoc,
    provider,
    isEditorMounted,
    editorRef,
    monacoRef,
    fileCacheMap,
    prevFileRef,
    bindingRef,
  ]);
}