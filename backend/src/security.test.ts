import assert from 'node:assert/strict';
import test from 'node:test';

import config from '../config.js';
import { normalizeWorkspacePath } from './repositories/fileRepository.js';
import { signRoomToken, verifyRoomToken } from './services/authService.js';
import { safeResolve } from './utils/safePath.js';

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

test('危险功能默认关闭', () => {
  assert.equal(config.features.codeExecution, false);
  assert.equal(config.features.terminal, false);
});
