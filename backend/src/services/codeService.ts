import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type ExecuteCodeOptions = {
  roomDir: string;
  filename: string;
  code: string;
  onOutput: (output: string) => void;
  onError: (error: string) => void;
  onFinish: (exitCode: number) => void;
};

export type SaveCodeOptions = {
  roomDir: string;
  filename: string;
  code: string;
};

import { safeResolve } from '../utils/safePath.js';

export function saveCodeToFile({ roomDir, filename, code }: SaveCodeOptions) {
  if (!filename || typeof code !== 'string') {
    return { success: false as const, status: 400, message: '文件名或代码内容无效' };
  }

  const { resolvedPath } = safeResolve(roomDir, filename);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, code, 'utf8');
  return { success: true as const, message: '保存成功' };
}

export function executeCode({
  roomDir,
  filename,
  code,
  onOutput,
  onError,
  onFinish,
}: ExecuteCodeOptions): void {
  const extension = /\.(ts|tsx)$/i.test(filename) ? '.ts' : '.js';
  const tempFile = path.join(roomDir, `run-${Date.now()}${extension}`);
  fs.writeFileSync(tempFile, code, 'utf8');

  const args = extension === '.ts'
    ? ['--import', 'tsx', tempFile]
    : [tempFile];
  const child = spawn(process.execPath, args, {
    cwd: roomDir,
    shell: false,
  });

  let finished = false;
  const finishOnce = (exitCode: number) => {
    if (finished) return;
    finished = true;
    try { fs.unlinkSync(tempFile); } catch { /* 临时文件清理失败不影响结果 */ }
    onFinish(exitCode);
  };

  // 当前项目仍保留原有运行能力；正式部署前应替换为隔离 Runner。
  child.stdout.on('data', (data: Buffer) => onOutput(data.toString()));
  child.stderr.on('data', (data: Buffer) => onError(data.toString()));
  child.once('close', (code) => finishOnce(code ?? 1));
  child.once('error', (error: Error) => {
    onError(`代码执行失败：${error.message}`);
    finishOnce(1);
  });
}
