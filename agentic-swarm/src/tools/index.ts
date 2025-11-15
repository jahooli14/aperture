export { webSearchTool } from './web-search.js';
export { calculatorTool } from './calculator.js';
export { readFileTool, writeFileTool, listDirectoryTool } from './file-operations.js';

import { webSearchTool } from './web-search.js';
import { calculatorTool } from './calculator.js';
import { readFileTool, writeFileTool, listDirectoryTool } from './file-operations.js';

/**
 * Default toolkit with commonly used tools
 */
export const defaultTools = [
  webSearchTool,
  calculatorTool,
  readFileTool,
  writeFileTool,
  listDirectoryTool,
];
