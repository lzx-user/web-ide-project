import { FileJson, FileType2, FileCode2, Image, Folder, FileText } from 'lucide-react';

export const getFileIcon = (filename, isFolder = false, isActive = false) => {
  const size = 16;

  // 如果是文件夹，返回文件夹图标
  if (isFolder) {
    return <Folder size={size} className={isActive ? "text-blue-600" : "text-blue-400"} />;
  }

  // 根据文件后缀返回对应的彩色图标，如果 isActive 为 true，则强制覆盖为蓝色
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
    return <FileType2 size={16} className={isActive ? "text-blue-600" : "text-yellow-500"} />;
  }
  if (filename.endsWith('.css')) {
    return <FileCode2 size={size} className={isActive ? "text-blue-600" : "text-blue-500"} />;
  }
  if (filename.endsWith('.json')) {
    return <FileJson size={size} className={isActive ? "text-blue-600" : "text-green-500"} />;
  }

  // 默认文本图标
  return <FileText size={size} className={isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"} />;
}
