import config from '../../config.js';
import type { AIAssistRequest, AIAssistResult } from '../types/ai.js';

const actionInstructions: Record<AIAssistRequest['action'], string> = {
  explain: '解释选中代码；没有选区时解释当前文件。不要修改代码。',
  'terminal-error': '结合终端或运行输出定位错误，并给出可执行的修复建议。',
  fix: '修复选中代码；没有选区时修复当前文件。',
  optimize: '优化选中代码的可读性和质量，保持原有行为。',
  generate: '根据用户要求生成适合当前文件和语言的代码片段。',
};

export async function requestAIAssistance(input: AIAssistRequest): Promise<AIAssistResult> {
  if (!config.ai.apiKey) {
    throw new Error('AI 服务尚未配置，请在后端环境变量中设置 AI_API_KEY');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  const context = [
    `操作：${actionInstructions[input.action]}`,
    `文件：${input.filename || '未命名文件'}`,
    `语言：${input.language || 'plaintext'}`,
    input.selection?.text ? `选中代码：\n${input.selection.text}` : '',
    input.terminalOutput ? `终端或运行输出：\n${input.terminalOutput}` : '',
    input.prompt ? `用户补充要求：${input.prompt}` : '',
    `当前文件内容：\n${input.code}`,
  ].filter(Boolean).join('\n\n');

  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '你是 Web IDE 的编程助手。只返回 JSON：{"answer":"说明","code":"可选的待确认代码"}。不要声称执行、保存或应用过代码。',
          },
          { role: 'user', content: context },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`模型服务请求失败（HTTP ${response.status}）`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('模型服务返回了空内容');

    const parsed = JSON.parse(content) as Partial<AIAssistResult>;
    if (typeof parsed.answer !== 'string' || !parsed.answer.trim()) {
      throw new Error('模型服务返回格式不正确');
    }

    return {
      answer: parsed.answer.trim(),
      code: typeof parsed.code === 'string' && parsed.code.trim() ? parsed.code : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI 请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
