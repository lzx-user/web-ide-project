import { Router } from 'express';

import authMiddleware from '../middlewares/authMiddleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { requestAIAssistance } from '../services/aiService.js';
import type { AIAction, AIAssistRequest } from '../types/ai.js';

const router = Router();
const actions = new Set<AIAction>(['explain', 'terminal-error', 'fix', 'optimize', 'generate']);

router.post('/api/ai/assist', rateLimit({ windowMs: 60_000, max: 12, keyPrefix: 'ai' }), authMiddleware, async (req, res) => {
  const input = req.body as Partial<AIAssistRequest>;

  if (!input.action || !actions.has(input.action)) {
    res.status(400).json({ success: false, message: 'AI 操作类型无效' });
    return;
  }
  if (typeof input.code !== 'string' || input.code.length > 100_000) {
    res.status(400).json({ success: false, message: '代码内容无效或过长' });
    return;
  }
  if (typeof input.filename !== 'string' || input.filename.length > 260) {
    res.status(400).json({ success: false, message: '文件名无效' });
    return;
  }
  if (input.prompt && input.prompt.length > 2_000) {
    res.status(400).json({ success: false, message: '用户输入不能超过 2000 个字符' });
    return;
  }
  if (input.terminalOutput && input.terminalOutput.length > 20_000) {
    res.status(400).json({ success: false, message: '终端输出内容过长' });
    return;
  }

  try {
    const result = await requestAIAssistance({
      action: input.action,
      filename: input.filename,
      language: typeof input.language === 'string' ? input.language : 'plaintext',
      code: input.code,
      selection: input.selection,
      prompt: input.prompt,
      terminalOutput: input.terminalOutput,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 请求失败';
    const status = message.includes('AI_API_KEY') ? 503 : 502;
    res.status(status).json({ success: false, message });
  }
});

export default router;
