import type { Message } from '../types/index.js';

/**
 * Context compaction utilities following Anthropic's best practices
 * Summarize conversation history when approaching context limits
 */

export interface CompactionConfig {
  maxMessages: number;
  keepRecentMessages: number;
  summaryPrompt?: string;
}

/**
 * Simple compaction: Keep first and last N messages, summarize middle
 */
export function compactMessages(
  messages: Message[],
  config: CompactionConfig
): Message[] {
  const { maxMessages, keepRecentMessages } = config;

  // If under limit, no compaction needed
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Keep first message (usually contains important context)
  const firstMessage = messages[0];

  // Keep recent messages (most relevant to current task)
  const recentMessages = messages.slice(-keepRecentMessages);

  // Create summary of middle messages
  const middleMessages = messages.slice(1, -keepRecentMessages);
  const summary = createSummary(middleMessages);

  return [
    firstMessage,
    {
      role: 'user' as const,
      content: `[Previous conversation summary: ${summary}]`,
    },
    ...recentMessages,
  ];
}

/**
 * Create a text summary of messages
 * In production, you could use Claude to generate better summaries
 */
function createSummary(messages: Message[]): string {
  const toolCalls = messages.filter(m =>
    typeof m.content !== 'string' &&
    Array.isArray(m.content) &&
    m.content.some(block => block.type === 'tool_use' || block.type === 'tool_result')
  ).length;

  const textMessages = messages.filter(m =>
    typeof m.content === 'string' ||
    (Array.isArray(m.content) && m.content.some(block => block.type === 'text'))
  ).length;

  return `${messages.length} messages exchanged (${toolCalls} tool interactions, ${textMessages} text responses). Key context preserved.`;
}

/**
 * Estimate token count (rough approximation)
 * In production, use tiktoken or similar for accurate counting
 */
export function estimateTokenCount(messages: Message[]): number {
  let totalChars = 0;

  for (const message of messages) {
    if (typeof message.content === 'string') {
      totalChars += message.content.length;
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text') {
          totalChars += block.text.length;
        } else if (block.type === 'tool_use') {
          totalChars += JSON.stringify(block.input).length;
        } else if (block.type === 'tool_result') {
          totalChars += typeof block.content === 'string'
            ? block.content.length
            : JSON.stringify(block.content).length;
        }
      }
    }
  }

  // Rough approximation: 4 characters per token
  return Math.ceil(totalChars / 4);
}

/**
 * Check if compaction is needed based on token estimate
 */
export function shouldCompact(
  messages: Message[],
  maxTokens: number = 180000 // Leave buffer for 200k context window
): boolean {
  const estimatedTokens = estimateTokenCount(messages);
  return estimatedTokens > maxTokens;
}
