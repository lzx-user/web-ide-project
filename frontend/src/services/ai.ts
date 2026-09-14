import axios from 'axios';
import type { AIAction } from '../components/AIAssistantPanel';
import request from './request';

export type AISelection = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
};

export type AIRequest = {
  action: AIAction;
  filename: string;
  language: string;
  code: string;
  selection?: AISelection;
  prompt?: string;
  terminalOutput?: string;
};

export type AIResponse = { success: boolean; answer: string; code?: string };

// 浏览器只调用同源后端，密钥和模型请求细节不会进入 VITE_* 环境变量。
export async function requestAIAssistance(payload: AIRequest): Promise<AIResponse> {
  try {
    const { data } = await request.post<AIResponse>('/ai/assist', payload);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'AI 服务请求失败');
    }
    throw error;
  }
}
