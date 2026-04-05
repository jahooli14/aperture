import { OrchestratorAgent } from '../src/agents/orchestrator.js';
import { defaultTools } from '../src/tools/index.js';
import type { Tool } from '../src/types/index.js';

/**
 * Example: Creating and using custom tools
 */

// Custom tool: Weather lookup (simulated)
const weatherTool: Tool = {
  name: 'get_weather',
  description: `Get current weather information for a location. Returns temperature, conditions, and forecast.

Best practices:
- Use city names or coordinates
- Specify units (celsius/fahrenheit) if needed
- Handle invalid locations gracefully`,
  input_schema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or coordinates (lat,lon)',
      },
      units: {
        type: 'string',
        description: 'Temperature units: "celsius" or "fahrenheit". Default: celsius',
      },
    },
    required: ['location'],
  },
  execute: async (input: { location: string; units?: string }) => {
    // Simulated weather data
    // In production, integrate with a real weather API
    return {
      location: input.location,
      temperature: input.units === 'fahrenheit' ? 72 : 22,
      units: input.units || 'celsius',
      conditions: 'Partly cloudy',
      humidity: 65,
      wind_speed: 12,
      forecast: [
        { day: 'Today', high: 24, low: 18, conditions: 'Partly cloudy' },
        { day: 'Tomorrow', high: 26, low: 19, conditions: 'Sunny' },
        { day: 'Day after', high: 23, low: 17, conditions: 'Rainy' },
      ],
      note: 'This is simulated data. Integrate with real weather API for production use.',
    };
  },
};

// Custom tool: Data analysis
const analyzeDataTool: Tool = {
  name: 'analyze_data',
  description: `Analyze a dataset and return statistics. Supports basic statistical analysis.

Returns: mean, median, min, max, standard deviation, and distribution insights.`,
  input_schema: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of numbers to analyze',
      },
    },
    required: ['data'],
  },
  execute: async (input: { data: number[] }) => {
    const sorted = [...input.data].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / sorted.length;

    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: sorted.length,
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      std_dev: stdDev.toFixed(2),
      range: sorted[sorted.length - 1] - sorted[0],
    };
  },
};

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    process.exit(1);
  }

  // Create orchestrator with default tools + custom tools
  const customTools = [...defaultTools, weatherTool, analyzeDataTool];

  const orchestrator = new OrchestratorAgent(apiKey, customTools, {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
  });

  console.log('=== Agentic Swarm - Custom Tools Example ===\n');

  // Use custom weather tool
  console.log('Task: Plan activities based on weather forecast');
  const result = await orchestrator.execute(
    `Check the weather for San Francisco and suggest 3 outdoor activities
    that would be suitable given the current conditions and forecast.`
  );

  console.log('\nResult:', result);

  // Use custom data analysis tool
  console.log('\n---\n');
  console.log('Task: Analyze dataset and provide insights');
  const result2 = await orchestrator.execute(
    `Analyze this dataset: [23, 45, 67, 34, 89, 12, 56, 78, 90, 34, 45, 67, 23, 56].
    Provide insights about the distribution and any notable patterns.`
  );

  console.log('\nResult:', result2);
}

main().catch(console.error);
