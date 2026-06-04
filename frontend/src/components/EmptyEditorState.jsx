import { Code2 } from 'lucide-react';

// 未选中文件占位
export default function EmptyEditorState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
      <div className="w-24 h-24 mb-4 opacity-20">
        <Code2 size={96} />
      </div>
      <p className="text-lg font-medium tracking-widest text-gray-500">
        Web IDE 协作空间
      </p>
      <p className="text-sm mt-2">
        请在左侧资源管理器中选择一个文件进行编辑
      </p>
    </div>
  );
}