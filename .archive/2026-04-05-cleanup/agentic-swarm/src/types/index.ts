import Anthropic from '@anthropic-ai/sdk';

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (input: any) => Promise<any>;
}

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
  systemPrompt?: string;
}

export interface TaskDescription {
  id: string;
  objective: string;
  outputFormat: string;
  toolGuidance?: string;
  boundaries?: string;
  context?: string;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output: string;
  tokensUsed: number;
  iterations: number;
  error?: string;
}

export interface Memory {
  save(key: string, value: any): Promise<void>;
  load(key: string): Promise<any>;
  clear(key: string): Promise<void>;
}

export type MessageContent = Anthropic.MessageParam['content'];
export type Message = Anthropic.MessageParam;
export type ToolUseBlock = Extract<Anthropic.ContentBlock, { type: 'tool_use' }>;
export type TextBlock = Extract<Anthropic.ContentBlock, { type: 'text' }>;
