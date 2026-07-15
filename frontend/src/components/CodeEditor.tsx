import Editor, { type OnMount } from '@monaco-editor/react';
import { getLanguageByFilename } from '../utils/editorLanguage';

type CodeEditorProps = {
  filename: string;
  onMount: OnMount;
};

export default function CodeEditor({
  filename,
  onMount,
}: CodeEditorProps) {
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        language={getLanguageByFilename(filename)}
        theme="light"
        onMount={onMount}
        options={{
          fontSize: 15,
          minimap: { enabled: false },
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}