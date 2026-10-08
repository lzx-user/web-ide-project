import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EXECUTION_TIMEOUT_MS = 5_000;
export const MAX_EXECUTION_OUTPUT_BYTES = 100_000;

const RUNNABLE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);

export function isRunnableFile(filename: string): boolean {
  return RUNNABLE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

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
  const extension = path.extname(filename).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-ide-run-'));
  const tempFile = path.join(tempDir, `main${extension}`);
  fs.writeFileSync(tempFile, code, 'utf8');

  const args = /\.(?:jsx|[cm]?ts|tsx)$/i.test(extension)
    ? ['--import', require.resolve('tsx'), tempFile]
    : [tempFile];
  const child = spawn(process.execPath, args, {
    cwd: tempDir,
    shell: false,
  });

  let finished = false;
  let outputBytes = 0;
  let limitNotified = false;
  let timeout: NodeJS.Timeout | null = null;
  const finishOnce = (exitCode: number) => {
    if (finished) return;
    finished = true;
    if (timeout) clearTimeout(timeout);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* 清理失败不影响结果 */ }
    onFinish(exitCode);
  };

  const forwardOutput = (data: Buffer, send: (text: string) => void) => {
    const remaining = MAX_EXECUTION_OUTPUT_BYTES - outputBytes;
    if (remaining > 0) {
      const chunk = data.subarray(0, remaining);
      outputBytes += chunk.length;
      send(chunk.toString());
    }
    if (data.length > remaining && !limitNotified) {
      limitNotified = true;
      onError(`\n输出超过 ${MAX_EXECUTION_OUTPUT_BYTES / 1000} KB，运行已终止。\n`);
      child.kill('SIGKILL');
    }
  };

  // 本地 Runner 只用于开发演示；正式部署前仍应替换为容器隔离 Runner。
  child.stdout.on('data', (data: Buffer) => forwardOutput(data, onOutput));
  child.stderr.on('data', (data: Buffer) => forwardOutput(data, onError));
  child.once('close', (code) => finishOnce(code ?? 1));
  child.once('error', (error: Error) => {
    onError(`代码执行失败：${error.message}`);
    finishOnce(1);
  });
  timeout = setTimeout(() => {
    if (finished) return;
    onError(`\n运行超过 ${EXECUTION_TIMEOUT_MS / 1000} 秒，已自动终止。\n`);
    child.kill('SIGKILL');
  }, EXECUTION_TIMEOUT_MS);
}
