import assert from 'node:assert/strict';
import test from 'node:test';

import { createAIAssistanceRequester } from './services/aiService.js';

const input = {
  action: 'generate' as const,
  filename: 'src/example.ts',
  language: 'typescript',
  code: 'export const value = 1;',
  prompt: '增加类型说明',
};

test('AI 请求只向配置的兼容接口发送后端密钥和代码上下文', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const request = createAIAssistanceRequester(
    {
      apiKey: 'test-secret',
      baseUrl: 'https://provider.example/v1/',
      model: 'test-model',
      timeoutMs: 1_000,
    },
    async (url, init) => {
      requestedUrl = String(url);
      requestedInit = init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"answer":"完成","code":"export const value: number = 1;"}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  );

  const result = await request(input);
  const body = JSON.parse(String(requestedInit?.body)) as {
    model: string;
    messages: Array<{ content: string }>;
  };

  assert.equal(requestedUrl, 'https://provider.example/v1/chat/completions');
  assert.equal(new Headers(requestedInit?.headers).get('Authorization'), 'Bearer test-secret');
  assert.equal(body.model, 'test-model');
  assert.match(body.messages[1]!.content, /src\/example\.ts/);
  assert.deepEqual(result, { answer: '完成', code: 'export const value: number = 1;' });
});

test('AI 服务将上游 HTTP 错误转换为可识别错误', async () => {
  const request = createAIAssistanceRequester(
    { apiKey: 'test-secret', baseUrl: 'https://provider.example/v1', model: 'test-model', timeoutMs: 1_000 },
    async () => new Response('', { status: 429 }),
  );

  await assert.rejects(() => request(input), /HTTP 429/);
});

test('AI 服务拒绝非 JSON 或缺少 answer 的模型响应', async () => {
  const malformed = createAIAssistanceRequester(
    { apiKey: 'test-secret', baseUrl: 'https://provider.example/v1', model: 'test-model', timeoutMs: 1_000 },
    async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }), { status: 200 }),
  );
  const missingAnswer = createAIAssistanceRequester(
    { apiKey: 'test-secret', baseUrl: 'https://provider.example/v1', model: 'test-model', timeoutMs: 1_000 },
    async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"code":"const a = 1"}' } }] }), { status: 200 }),
  );

  await assert.rejects(() => malformed(input), /返回格式不正确/);
  await assert.rejects(() => missingAnswer(input), /返回格式不正确/);
});
