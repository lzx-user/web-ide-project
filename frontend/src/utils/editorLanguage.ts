/**
 * Monaco Editor 支持的语言名称。
 *
 * 这里使用联合类型限制返回值，防止不小心返回错误的字符串。
 * 例如返回 "typescript1" 时，TypeScript 会立即提示错误。
 */
export type EditorLanguage =
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'json'
  | 'html'
  | 'plaintext';

/**
 * 根据文件名后缀，判断 Monaco 应该使用哪种语言。
 *
 * 例如：
 * index.js  -> javascript
 * app.ts    -> typescript
 * App.tsx   -> typescript
 */
export function getLanguageByFilename(
  filename: string = '',
): EditorLanguage {
  // 转成小写，避免 App.TS 这样的文件无法识别
  const lowerFilename = filename.toLowerCase();

  if (
    lowerFilename.endsWith('.js') ||
    lowerFilename.endsWith('.jsx')
  ) {
    return 'javascript';
  }

  if (
    lowerFilename.endsWith('.ts') ||
    lowerFilename.endsWith('.tsx')
  ) {
    return 'typescript';
  }

  if (lowerFilename.endsWith('.css')) {
    return 'css';
  }

  if (lowerFilename.endsWith('.json')) {
    return 'json';
  }

  if (lowerFilename.endsWith('.html')) {
    return 'html';
  }

  // 无法识别的文件按普通文本显示
  return 'plaintext';
}

/**
 * 返回给用户看的语言名称。
 *
 * Monaco 使用小写的 "typescript"，
 * 但状态栏应该显示更友好的 "TypeScript"。
 */
export function getLanguageLabel(filename: string): string {
  const language = getLanguageByFilename(filename);

  const labels: Record<EditorLanguage, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    css: 'CSS',
    json: 'JSON',
    html: 'HTML',
    plaintext: 'Plain Text',
  };

  return labels[language];
}