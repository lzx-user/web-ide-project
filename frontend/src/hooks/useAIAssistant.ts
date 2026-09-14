import { useCallback, useState } from 'react';
import type { AIAction } from '../components/AIAssistantPanel';
import { requestAIAssistance, type AIRequest } from '../services/ai';

type Options = { getContext: () => Omit<AIRequest, 'action' | 'prompt'> | null };

type AIAssistantState = {
  isLoading: boolean;
  error: string;
  answer: string;
  suggestedCode: string;
  requestAI: (action: AIAction, prompt: string) => Promise<void>;
  rejectSuggestion: () => void;
};

// 把请求状态集中在 hook 中，面板只需要根据这些字段渲染 loading、错误和建议代码。
export default function useAIAssistant({ getContext }: Options): AIAssistantState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [suggestedCode, setSuggestedCode] = useState('');

  const requestAI = useCallback(async (action: AIAction, prompt: string) => {
    const context = getContext();
    if (!context) {
      setError('请先打开一个代码文件');
      return;
    }
    setIsLoading(true);
    setError('');
    setAnswer('');
    setSuggestedCode('');
    try {
      const response = await requestAIAssistance({ ...context, action, prompt });
      setAnswer(response.answer);
      setSuggestedCode(response.code || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI 请求失败');
    } finally {
      setIsLoading(false);
    }
  }, [getContext]);

  const rejectSuggestion = useCallback(() => {
    setAnswer('');
    setSuggestedCode('');
    setError('');
  }, []);

  return { isLoading, error, answer, suggestedCode, requestAI, rejectSuggestion };
}
