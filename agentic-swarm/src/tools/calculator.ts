import type { Tool } from '../types/index.js';

/**
 * Calculator tool for mathematical operations
 * Demonstrates safe code execution for calculations
 */
export const calculatorTool: Tool = {
  name: 'calculator',
  description: `Perform mathematical calculations. Supports basic arithmetic, trigonometry, and common math functions.

Supported operations:
- Basic: +, -, *, /, %, **
- Functions: sqrt, abs, sin, cos, tan, log, exp
- Constants: PI, E

Examples:
- "2 + 2"
- "sqrt(16)"
- "sin(PI / 2)"
- "2 ** 8"

Note: Use standard JavaScript Math syntax.`,
  input_schema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate',
      },
    },
    required: ['expression'],
  },
  execute: async (input: { expression: string }) => {
    try {
      // Sanitize input - only allow safe math operations
      const sanitized = input.expression
        .replace(/[^0-9+\-*/.()%\s]/g, '')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log')
        .replace(/exp/g, 'Math.exp')
        .replace(/PI/g, 'Math.PI')
        .replace(/E/g, 'Math.E');

      // Evaluate safely
      const result = Function(`"use strict"; return (${sanitized})`)();

      return {
        expression: input.expression,
        result: result,
        formatted: `${input.expression} = ${result}`,
      };
    } catch (error) {
      return {
        expression: input.expression,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to evaluate expression. Check syntax and try again.',
      };
    }
  },
};
