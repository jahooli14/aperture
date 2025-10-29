/**
 * Builder Worker - Specialized agent that generates code, tests, and documentation
 */

import type { BaseProvider } from '../providers/index.js';
import type { CostGuard } from '../utils/cost-guard.js';
import {
  BuildTask,
  BuildResult,
  GeneratedFile,
  PackageDependency,
  CodeSpec,
} from './builder-types.js';

export class BuilderWorker {
  constructor(
    private specialty: 'backend' | 'frontend' | 'testing' | 'docs' | 'devops',
    private provider: BaseProvider,
    private costGuard: CostGuard
  ) {}

  /**
   * Execute a build task and generate code
   */
  async executeTask(task: BuildTask): Promise<BuildResult> {
    console.log(`[${this.specialty.toUpperCase()}] Starting task: ${task.description}`);

    const prompt = this.createBuilderPrompt(task);

    // Check cost before proceeding
    const estimatedInput = Math.ceil(prompt.length / 4);
    const estimatedOutput = 4000; // Larger for code generation

    const costCheck = await this.costGuard.checkBeforeCall(
      estimatedInput,
      estimatedOutput,
      'gemini'
    );

    if (!costCheck.allowed) {
      return {
        taskId: task.id,
        files: [],
        dependencies: [],
        documentation: `[Task skipped: ${costCheck.reason}]`,
        errors: [
          {
            file: 'system',
            message: costCheck.reason || 'Budget limit reached',
            severity: 'error',
          },
        ],
      };
    }

    try {
      // Define function calling tools for structured code generation
      const tools = this.createCodeGenerationTools();

      const response = await this.provider.sendMessage(
        [{ role: 'user', content: prompt }],
        tools,
        this.getSystemPrompt()
      );

      // Record usage
      this.costGuard.recordUsage({
        inputTokens: response.usage?.inputTokens || estimatedInput,
        outputTokens: response.usage?.outputTokens || estimatedOutput,
        provider: 'gemini',
      });

      // Parse response - check for function calls first (structured output)
      const result = this.parseStructuredResponse(response, task);

      console.log(`[${this.specialty.toUpperCase()}] Completed: ${result.files.length} files generated`);

      return result;
    } catch (error) {
      console.error(`[${this.specialty.toUpperCase()}] Failed:`, error);
      return {
        taskId: task.id,
        files: [],
        dependencies: [],
        documentation: `[Task failed: ${error}]`,
        errors: [
          {
            file: 'system',
            message: String(error),
            severity: 'error',
          },
        ],
      };
    }
  }

  /**
   * Create function calling tools for structured code generation
   * This uses Gemini's native function calling instead of prompting for JSON
   */
  private createCodeGenerationTools(): any[] {
    return [
      {
        name: 'generate_project_files',
        description: 'Generate multiple code files with their complete content, dependencies, and documentation',
        input_schema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              description: 'Array of files to generate',
              items: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Relative file path (e.g., "src/index.ts", "config/settings.json")',
                  },
                  content: {
                    type: 'string',
                    description: 'Complete file content with proper formatting and newlines',
                  },
                },
                required: ['path', 'content'],
              },
            },
            dependencies: {
              type: 'object',
              description: 'Project dependencies',
              properties: {
                production: {
                  type: 'array',
                  description: 'Production dependencies',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Package name' },
                      version: { type: 'string', description: 'Version (e.g., "^1.0.0")' },
                    },
                    required: ['name', 'version'],
                  },
                },
                dev: {
                  type: 'array',
                  description: 'Development dependencies',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Package name' },
                      version: { type: 'string', description: 'Version (e.g., "^1.0.0")' },
                    },
                    required: ['name', 'version'],
                  },
                },
              },
            },
            documentation: {
              type: 'string',
              description: 'Markdown documentation explaining the code, setup instructions, and usage',
            },
          },
          required: ['files', 'dependencies', 'documentation'],
        },
      },
    ];
  }

  /**
   * Parse structured response from function calling
   */
  private parseStructuredResponse(response: any, task: BuildTask): BuildResult {
    // Check for function calls (structured output)
    const functionCall = response.content.find((block: any) => block.type === 'tool_use');

    if (functionCall && functionCall.name === 'generate_project_files') {
      console.log(`   ℹ️  Parsed using function calling (structured output)`);
      const input = functionCall.input;

      const files: GeneratedFile[] = (input.files || []).map((f: any) => ({
        path: f.path,
        content: f.content,
        language: task.language,
      }));

      const dependencies: PackageDependency[] = [];
      if (input.dependencies) {
        if (input.dependencies.production) {
          dependencies.push(
            ...input.dependencies.production.map((dep: any) => ({
              name: dep.name,
              version: dep.version,
              type: 'production' as const,
            }))
          );
        }
        if (input.dependencies.dev) {
          dependencies.push(
            ...input.dependencies.dev.map((dep: any) => ({
              name: dep.name,
              version: dep.version,
              type: 'dev' as const,
            }))
          );
        }
      }

      return {
        taskId: task.id,
        files,
        dependencies,
        documentation: input.documentation || '',
      };
    }

    // Fallback to text parsing if function calling wasn't used
    const textBlock = response.content.find((block: any) => block.type === 'text');
    if (textBlock) {
      return this.parseBuilderOutput(textBlock.text, task);
    }

    // No content at all
    return {
      taskId: task.id,
      files: [],
      dependencies: [],
      documentation: '[No content generated]',
    };
  }

  /**
   * Create the builder prompt based on specialty and task
   */
  private createBuilderPrompt(task: BuildTask): string {
    const basePrompt = `You are a ${this.specialty} specialist building a software component.

## Task
${task.description}

## Language
${task.language}

## Requirements
${task.requirements.map((r) => `- ${r}`).join('\n')}

${task.context ? `## Context from Other Teams\n${task.context}\n` : ''}

## Your Mission

Generate production-quality code with:

1. **Clean, Working Code**
   - Follow ${task.language} best practices
   - Use clear variable/function names
   - Add helpful comments
   - Handle errors appropriately

2. **Project Structure**
   - Proper file organization
   - Clear module boundaries
   - Logical separation of concerns

3. **Dependencies**
   - List all required packages
   - Specify versions
   - Separate production vs dev dependencies

4. **Tests** (if applicable)
   - Unit tests for key functions
   - Integration tests for APIs
   - Clear test descriptions

5. **Documentation**
   - README with setup instructions
   - API documentation (if applicable)
   - Code comments for complex logic

## How to Respond

Use the 'generate_project_files' function to provide structured output with:
- **files**: Array of file objects with path and complete content
- **dependencies**: Object with production and dev dependency arrays
- **documentation**: Markdown documentation string

Generate complete, working code - no placeholders or TODOs. Make it production-ready.`;

    return basePrompt;
  }

  /**
   * Get system prompt based on specialty
   */
  private getSystemPrompt(): string {
    const basePrompt = `You are a code generation specialist using structured function calling.

CRITICAL RULES:
1. Always use the 'generate_project_files' function to return your results
2. Generate complete, working code - no placeholders, TODOs, or stub implementations
3. Include all necessary files for a working project
4. Provide comprehensive documentation with setup instructions
5. List all required dependencies with specific versions`;

    const specialtyNotes = {
      backend: ' Focus on APIs, databases, and server architecture. Write secure, scalable code.',
      frontend: ' Focus on UI frameworks, responsive design, and user experience. Write accessible, performant interfaces.',
      testing: ' Focus on comprehensive test coverage and edge cases. Write thorough, maintainable tests.',
      docs: ' Focus on clear, comprehensive documentation. Write documentation that developers love.',
      devops: ' Focus on deployment, CI/CD, and infrastructure. Write robust automation.',
    };

    return basePrompt + specialtyNotes[this.specialty];
  }

  /**
   * Parse the builder output to extract structured results
   * Tries multiple parsing strategies with fallbacks
   */
  private parseBuilderOutput(output: string, task: BuildTask): BuildResult {
    // Strategy 1: Try JSON parsing (primary)
    const jsonResult = this.tryJSONParse(output, task);
    if (jsonResult.files.length > 0 || jsonResult.dependencies.length > 0) {
      console.log(`   ℹ️  Parsed using JSON format`);
      return jsonResult;
    }

    // Strategy 2: Try markdown format (fallback)
    const markdownResult = this.tryMarkdownParse(output, task);
    if (markdownResult.files.length > 0) {
      console.log(`   ℹ️  Parsed using markdown format`);
      return markdownResult;
    }

    // Strategy 3: Extract any code blocks (desperate fallback)
    const codeBlockResult = this.tryCodeBlockExtraction(output, task);
    if (codeBlockResult.files.length > 0) {
      console.log(`   ℹ️  Extracted code blocks`);
      return codeBlockResult;
    }

    // Strategy 4: Complete failure - return documentation only
    console.warn(`   ⚠️  Could not parse code, returning documentation only`);
    return {
      taskId: task.id,
      files: [],
      dependencies: [],
      documentation: output,
    };
  }

  /**
   * Try to parse output as pure JSON
   */
  private tryJSONParse(output: string, task: BuildTask): BuildResult {
    try {
      // Remove markdown code blocks if present
      let jsonText = output.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonText);

      const files: GeneratedFile[] = (parsed.files || []).map((f: any) => ({
        path: f.path,
        content: f.content,
        language: task.language,
      }));

      const dependencies: PackageDependency[] = [];
      if (parsed.dependencies) {
        if (parsed.dependencies.production) {
          dependencies.push(
            ...parsed.dependencies.production.map((dep: any) => ({
              name: dep.name,
              version: dep.version,
              type: 'production' as const,
            }))
          );
        }
        if (parsed.dependencies.dev) {
          dependencies.push(
            ...parsed.dependencies.dev.map((dep: any) => ({
              name: dep.name,
              version: dep.version,
              type: 'dev' as const,
            }))
          );
        }
      }

      return {
        taskId: task.id,
        files,
        dependencies,
        documentation: parsed.documentation || '',
      };
    } catch (error) {
      return {
        taskId: task.id,
        files: [],
        dependencies: [],
        documentation: '',
      };
    }
  }

  /**
   * Try to parse old markdown format
   */
  private tryMarkdownParse(output: string, task: BuildTask): BuildResult {
    const files: GeneratedFile[] = [];
    const dependencies: PackageDependency[] = [];

    // Extract files from markdown format
    const filesMatch = output.match(/```FILES\s*([\s\S]*?)```/);
    if (filesMatch) {
      const filesContent = filesMatch[1];
      const fileBlocks = filesContent.split(/FILE:\s*/g).filter((block) => block.trim());

      for (const block of fileBlocks) {
        const lines = block.split('\n');
        const filePath = lines[0].trim();

        const startIdx = block.indexOf('---');
        const endIdx = block.lastIndexOf('---');

        if (startIdx !== -1 && endIdx !== -1 && startIdx !== endIdx) {
          const content = block.substring(startIdx + 3, endIdx).trim();
          files.push({ path: filePath, content, language: task.language });
        }
      }
    }

    // Extract dependencies from markdown format
    const depsMatch = output.match(/```DEPENDENCIES\s*([\s\S]*?)```/);
    if (depsMatch) {
      try {
        const depsJson = JSON.parse(depsMatch[1]);
        if (depsJson.production) {
          dependencies.push(...depsJson.production.map((dep: any) => ({ ...dep, type: 'production' as const })));
        }
        if (depsJson.dev) {
          dependencies.push(...depsJson.dev.map((dep: any) => ({ ...dep, type: 'dev' as const })));
        }
      } catch (error) {
        // Ignore parse errors
      }
    }

    const docsMatch = output.match(/```DOCUMENTATION\s*([\s\S]*?)```/);
    const documentation = docsMatch ? docsMatch[1].trim() : '';

    return { taskId: task.id, files, dependencies, documentation };
  }

  /**
   * Extract any code blocks as files (last resort)
   */
  private tryCodeBlockExtraction(output: string, task: BuildTask): BuildResult {
    const files: GeneratedFile[] = [];

    // Find all code blocks
    const codeBlockRegex = /```(?:typescript|javascript|ts|js)?\s*\n([\s\S]*?)```/g;
    let match;
    let fileIndex = 0;

    while ((match = codeBlockRegex.exec(output)) !== null) {
      const content = match[1].trim();
      if (content.length > 0) {
        // Try to extract filename from comments
        const filenameMatch = content.match(/^\/\/\s*([^\n]+\.(?:ts|js|tsx|jsx))/);
        const filename = filenameMatch ? filenameMatch[1].trim() : `generated-${fileIndex}.${task.language === 'typescript' ? 'ts' : 'js'}`;

        files.push({
          path: `src/${filename}`,
          content,
          language: task.language,
        });
        fileIndex++;
      }
    }

    return {
      taskId: task.id,
      files,
      dependencies: [],
      documentation: output,
    };
  }

  getSpecialty(): string {
    return this.specialty;
  }
}
