import Editor, { type OnMount } from '@monaco-editor/react';
import { getLanguageByFilename } from '../utils/editorLanguage';

type CodeEditorProps = {
  filename: string;
  onMount: OnMount;
  readOnly?: boolean;
};

// Monaco 的 model 由上层 hook 按文件缓存；组件本身只负责把编辑器挂载到当前容器。
export default function CodeEditor({
  filename,
  onMount,
  readOnly = false,
}: CodeEditorProps) {
  return (
    // Monaco 的百分比高度需要沿父级一直拥有明确高度，否则编辑区会塌缩成一条细线。
    <div className="h-full min-h-0 w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={getLanguageByFilename(filename)}
        theme="vs-dark"
        onMount={onMount}
        options={{
          // automaticLayout 让编辑器跟随 Allotment 面板尺寸变化，避免切换 AI 面板后输入区塌陷。
          fontSize: 15,
          minimap: { enabled: true, scale: 0.75, showSlider: 'mouseover' },
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          lineHeight: 24,
          padding: { top: 12 },
          readOnly,
          readOnlyMessage: { value: '当前以只读成员身份加入，无法修改代码。' },
        }}
      />
    </div>
  );
}
