const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { safeResolve } = require('../utils/safePath');

/**
 * 保存代码到指定文件
 *
 * 为什么放到 service：
 * /api/save 和以后可能的自动保存、版本保存，都属于“代码持久化”能力。
 * 路由只负责校验请求和返回响应，不应该直接操作文件系统。
 */
function saveCodeToFile({ roomDir, filename, code }) {
  if (!filename) {
    return {
      success: false,
      status: 400,
      message: '文件名不能为空',
    };
  }

  if (typeof code !== 'string') {
    return {
      success: false,
      status: 400,
      message: '内容格式不合法',
    };
  }

  const { resolvedPath } = safeResolve(roomDir, filename);
  const parentDir = path.dirname(resolvedPath);

  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, code, 'utf8');

  return {
    success: true,
    message: '保存成功',
  };
}

/**
 * 执行 JavaScript 代码
 *
 * 为什么这里不直接在 socket 文件里 spawn：
 * 代码执行属于业务能力，不属于 Socket 通信本身。
 * Socket 只负责收发事件，真正执行逻辑交给 service。
 */
function executeJavaScriptCode({ roomDir, code, onOutput, onError, onFinish }) {
  const tempFile = path.join(roomDir, `run-${Date.now()}.js`);

  fs.writeFileSync(tempFile, code, 'utf8');

  const child = spawn('node', [tempFile], {
    cwd: roomDir,
    shell: false,
  });

  child.stdout.on('data', (data) => {
    onOutput(data.toString());
  });

  child.stderr.on('data', (data) => {
    onError(data.toString());
  });

  child.on('close', (exitCode) => {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // 临时文件清理失败不影响主流程
    }

    onFinish(exitCode);
  });

  child.on('error', (err) => {
    onError(`代码执行失败: ${err.message}`);
    onFinish(1);
  });
}

module.exports = {
  saveCodeToFile,
  executeJavaScriptCode,
};