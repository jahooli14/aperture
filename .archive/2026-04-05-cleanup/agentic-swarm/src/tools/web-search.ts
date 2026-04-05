import type { Tool } from '../types/index.js';

/**
 * Web search tool - simulated for demo purposes
 * In production, integrate with a real search API (Google, Bing, etc.)
 */
export const webSearchTool: Tool = {
  name: 'web_search',
  description: `Search the web for information. Returns relevant search results with titles, snippets, and URLs. Use this when you need current information or facts not in your training data.

Best practices:
- Use specific, focused search queries
- Include relevant keywords and context
- Use quotes for exact phrase matching
- Combine with other tools for comprehensive research`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific and use relevant keywords.',
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return (1-10). Default: 5',
      },
    },
    required: ['query'],
  },
  execute: async (input: { query: string; num_results?: number }) => {
    // Simulated search results
    // In production, replace with actual API call
    const numResults = input.num_results || 5;

    return {
      query: input.query,
      results: Array.from({ length: Math.min(numResults, 5) }, (_, i) => ({
        title: `Search Result ${i + 1} for "${input.query}"`,
        snippet: `This is a simulated search result snippet related to ${input.query}. In production, this would contain actual web content.`,
        url: `https://example.com/result-${i + 1}`,
      })),
      note: 'This is a simulated search tool. Replace with real API integration.',
    };
  },
};
