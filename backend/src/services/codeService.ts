import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ExecuteCodeOptions = {
  filename: string;
  code: string;
  onOutput: (output: string) => void;
  onError: (error: string) => void;
  onFinish: (exitCode: number) => void;
};

export function executeCode({
  filename,
  code,
  onOutput,
  onError,
  onFinish,
}: ExecuteCodeOptions): void {
  const extension = /\.(ts|tsx)$/i.test(filename) ? '.ts' : '.js';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-ide-run-'));
  const tempFile = path.join(tempDir, `main${extension}`);
  fs.writeFileSync(tempFile, code, 'utf8');

  const args = extension === '.ts'
    ? ['--import', 'tsx', tempFile]
    : [tempFile];
  const child = spawn(process.execPath, args, {
    cwd: tempDir,
    shell: false,
  });

  let finished = false;
  const finishOnce = (exitCode: number) => {
    if (finished) return;
    finished = true;
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* 清理失败不影响结果 */ }
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
