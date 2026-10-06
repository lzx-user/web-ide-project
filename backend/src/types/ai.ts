export type AIAction =
  | 'explain'
  | 'terminal-error'
  | 'fix'
  | 'optimize'
  | 'generate';

export type AISelection = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
};

export type AIAssistRequest = {
  action: AIAction;
  filename: string;
  language: string;
  code: string;
  selection?: AISelection;
  prompt?: string;
  terminalOutput?: string;
};

export type AIAssistResult = {
  answer: string;
  code?: string;
};
