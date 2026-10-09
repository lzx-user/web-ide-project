import assert from 'node:assert/strict';
import test from 'node:test';

import config from '../config.js';
import { normalizeWorkspacePath } from './repositories/fileRepository.js';
import { signRoomToken, verifyRoomToken } from './services/authService.js';
import { safeResolve } from './utils/safePath.js';
import { canEditWorkspace } from './auth/roles.js';
import { isRunnableFile } from './services/codeService.js';
import { isYjsDocumentMutation } from './yjs/yjsServer.js';

test('路径规范化拒绝穿越和绝对路径', () => {
  assert.equal(normalizeWorkspacePath('src//app.ts'), 'src/app.ts');
  assert.throws(() => normalizeWorkspacePath('../secret'));
  assert.throws(() => normalizeWorkspacePath('/etc/passwd'));
  assert.throws(() => safeResolve('/tmp/room', '../../secret'));
});

test('房间 Token 保留会话边界且不能被当成其他房间', () => {
  const token = signRoomToken({
    sessionId: 'session-a',
    username: 'tester',
    roomId: 'room-a',
    role: 'editor',
  });
  const payload = verifyRoomToken(token);
  assert.equal(payload.roomId, 'room-a');
  assert.notEqual(payload.roomId, 'room-b');
  assert.equal(payload.sessionId, 'session-a');
});

test('危险功能不会在生产环境启用，终端默认关闭', () => {
  assert.equal(config.features.codeExecution && config.env.isProd, false);
  assert.equal(config.features.terminal, false);
  assert.equal(config.features.ai, false);
});

test('本地代码运行仅接受 JavaScript 和 TypeScript 文件', () => {
  assert.equal(isRunnableFile('src/index.js'), true);
  assert.equal(isRunnableFile('src/index.ts'), true);
  assert.equal(isRunnableFile('src/App.tsx'), true);
  assert.equal(isRunnableFile('package.json'), false);
  assert.equal(isRunnableFile('README.md'), false);
});

test('协作角色权限在服务端统一收敛', () => {
  assert.equal(canEditWorkspace('owner'), true);
  assert.equal(canEditWorkspace('editor'), true);
  assert.equal(canEditWorkspace('viewer'), false);
  const viewer = verifyRoomToken(signRoomToken({
    sessionId: 'session-viewer',
    username: 'reader',
    roomId: 'room-a',
    role: 'viewer',
  }));
  assert.equal(viewer.role, 'viewer');
});

test('只读 Yjs 连接只允许同步请求和 awareness', () => {
  assert.equal(isYjsDocumentMutation(Buffer.from([0, 0])), false);
  assert.equal(isYjsDocumentMutation(Buffer.from([0, 1])), true);
  assert.equal(isYjsDocumentMutation(Buffer.from([0, 2])), true);
  assert.equal(isYjsDocumentMutation(Buffer.from([1, 0])), false);
});
