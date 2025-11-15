/**
 * Builder Orchestrator - Coordinates multiple builder workers to create complete projects
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { BaseProvider } from '../providers/index.js';
import type { CostGuard } from '../utils/cost-guard.js';
import { BuilderWorker } from './builder-worker.js';
import {
  BuildRequest,
  BuildResult,
  BuildTask,
  BuildPlan,
  BuildPhase,
  GeneratedFile,
} from './builder-types.js';

export class BuilderOrchestrator {
  private workers: Map<string, BuilderWorker> = new Map();

  constructor(
    private provider: BaseProvider,
    private costGuard: CostGuard,
    private outputDir: string = './builder-output'
  ) {
    // Initialize specialized workers
    this.workers.set('backend', new BuilderWorker('backend', provider, costGuard));
    this.workers.set('frontend', new BuilderWorker('frontend', provider, costGuard));
    this.workers.set('testing', new BuilderWorker('testing', provider, costGuard));
    this.workers.set('docs', new BuilderWorker('docs', provider, costGuard));
    this.workers.set('devops', new BuilderWorker('devops', provider, costGuard));
  }

  /**
   * Build a complete project from a request
   */
  async buildProject(request: BuildRequest): Promise<BuildResult[]> {
    console.log('\n🏗️  BUILDER ORCHESTRATOR - Starting Build');
    console.log('═'.repeat(60));
    console.log(`Project: ${request.description}`);
    console.log(`Type: ${request.type}`);
    console.log('═'.repeat(60));
    console.log('');

    // Step 1: Create build plan
    console.log('📋 Creating build plan...');
    const plan = await this.createBuildPlan(request);
    console.log(`   ✅ Plan created: ${plan.phases.length} phases, ${this.countTasks(plan)} tasks`);
    console.log('');

    // Step 2: Execute phases in order
    const allResults: BuildResult[] = [];

    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      console.log(`🎯 Phase ${i + 1}/${plan.phases.length}: ${phase.name}`);
      console.log(`   Tasks: ${phase.tasks.length}`);

      const phaseResults = await this.executePhase(phase, allResults);
      allResults.push(...phaseResults);

      console.log(`   ✅ Phase complete: ${phaseResults.length} results`);
      console.log('');
    }

    // Step 3: Write all files to disk
    console.log('💾 Writing files to disk...');
    await this.writeAllFiles(allResults, request.description);
    console.log('   ✅ Files written');
    console.log('');

    // Step 4: Generate project summary
    console.log('📊 Build Summary');
    console.log('═'.repeat(60));
    this.printBuildSummary(allResults);
    console.log('═'.repeat(60));

    return allResults;
  }

  /**
   * Create a build plan from the request
   */
  private async createBuildPlan(request: BuildRequest): Promise<BuildPlan> {
    const planPrompt = `Create a detailed build plan for the following project:

Type: ${request.type}
Description: ${request.description}
Language: ${request.language || 'auto-detect'}
Framework: ${request.framework || 'auto-detect'}

Requirements:
${request.requirements.map((r) => `- ${r}`).join('\n')}

Features:
${request.features ? request.features.map((f) => `- ${f}`).join('\n') : 'Standard features for this project type'}

Generate a structured build plan with phases and tasks. Break the project into:
1. Core implementation tasks
2. Testing tasks (if needed)
3. Documentation tasks (if needed)
4. Configuration tasks (if needed)

For each task, specify:
- Task ID (e.g., "backend-1", "frontend-1")
- Type: code, test, docs, config
- Specialty: backend, frontend, testing, docs, devops
- Description: What to build
- Language: Programming language
- Requirements: Specific requirements for this task
- Dependencies: Task IDs that must complete first

Use the 'create_build_plan' function to provide the structured plan.`;

    // Define function calling tool for structured plan generation
    const planTools = [
      {
        name: 'create_build_plan',
        description: 'Create a structured build plan with phases and tasks',
        input_schema: {
          type: 'object',
          properties: {
            projectName: { type: 'string', description: 'Name of the project' },
            projectType: {
              type: 'string',
              description: 'Type: cli, api, web-app, library, or full-stack'
            },
            phases: {
              type: 'array',
              description: 'Build phases in execution order',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Phase name' },
                  tasks: {
                    type: 'array',
                    description: 'Tasks in this phase',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Unique task ID (e.g., "backend-1")' },
                        type: { type: 'string', description: 'Type: code, test, docs, or config' },
                        specialty: { type: 'string', description: 'backend, frontend, testing, docs, or devops' },
                        description: { type: 'string', description: 'What to build' },
                        language: { type: 'string', description: 'Programming language' },
                        requirements: {
                          type: 'array',
                          description: 'Specific requirements',
                          items: { type: 'string' },
                        },
                        dependencies: {
                          type: 'array',
                          description: 'Task IDs that must complete first',
                          items: { type: 'string' },
                        },
                      },
                      required: ['id', 'type', 'specialty', 'description', 'language', 'requirements', 'dependencies'],
                    },
                  },
                  dependencies: {
                    type: 'array',
                    description: 'Phase dependencies',
                    items: { type: 'string' },
                  },
                },
                required: ['name', 'tasks', 'dependencies'],
              },
            },
          },
          required: ['projectName', 'projectType', 'phases'],
        },
      },
    ];

    try {
      const response = await this.provider.sendMessage(
        [{ role: 'user', content: planPrompt }],
        planTools,
        'You are a software architect creating detailed build plans. Use the create_build_plan function to return structured data.'
      );

      // Check for function call
      const functionCall = response.content.find((block: any) => block.type === 'tool_use');

      if (functionCall && functionCall.name === 'create_build_plan') {
        console.log('   ℹ️  Plan created using function calling');
        const plan = functionCall.input;

        // Validate plan has required fields
        if (!plan.phases || !Array.isArray(plan.phases)) {
          console.warn('   ⚠️  AI plan missing phases, using fallback');
          return this.createFallbackPlan(request);
        }

        return {
          ...plan,
          estimatedCost: 0.5, // Rough estimate
          estimatedDuration: 30, // minutes
        };
      }

      // Fallback to text parsing if function calling wasn't used
      const textBlock = response.content.find((block: any) => block.type === 'text');
      if (textBlock) {
        console.warn('   ⚠️  Function calling not used, falling back to text parsing');
        let planText = textBlock.text.trim();

        // Remove markdown code blocks if present
        if (planText.startsWith('```')) {
          const match = planText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (match) {
            planText = match[1].trim();
          } else {
            planText = planText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
          }
        }

        const plan = JSON.parse(planText);

        if (!plan.phases || !Array.isArray(plan.phases)) {
          console.warn('   ⚠️  AI plan missing phases, using fallback');
          return this.createFallbackPlan(request);
        }

        return {
          ...plan,
          estimatedCost: 0.5,
          estimatedDuration: 30,
        };
      }

      // No valid response
      console.warn('   ⚠️  No valid plan response, using fallback');
      return this.createFallbackPlan(request);
    } catch (error) {
      console.error('   ⚠️  Failed to create build plan:', error);
      return this.createFallbackPlan(request);
    }
  }

  /**
   * Create a simple fallback plan if AI planning fails
   */
  private createFallbackPlan(request: BuildRequest): BuildPlan {
    const tasks: BuildTask[] = [];

    if (request.type === 'cli') {
      tasks.push({
        id: 'cli-1',
        type: 'code',
        specialty: 'backend',
        description: request.description,
        language: request.language || 'typescript',
        requirements: request.requirements,
        dependencies: [],
      });
    }

    return {
      projectName: 'generated-project',
      projectType: request.type,
      phases: [
        {
          name: 'Implementation',
          tasks,
          dependencies: [],
        },
      ],
      estimatedCost: 0.3,
      estimatedDuration: 20,
    };
  }

  /**
   * Execute a single build phase
   */
  private async executePhase(
    phase: BuildPhase,
    previousResults: BuildResult[]
  ): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    for (const task of phase.tasks) {
      // Get context from dependent tasks
      const context = this.buildTaskContext(task, previousResults);
      const taskWithContext = { ...task, context };

      // Assign to appropriate worker
      const worker = this.workers.get(task.specialty);
      if (!worker) {
        console.warn(`   ⚠️  No worker for specialty: ${task.specialty}`);
        continue;
      }

      console.log(`   → ${task.id}: ${task.description.substring(0, 50)}...`);
      const result = await worker.executeTask(taskWithContext);
      results.push(result);

      if (result.errors && result.errors.length > 0) {
        console.log(`   ⚠️  Task completed with ${result.errors.length} errors`);
      } else {
        console.log(`   ✓ ${result.files.length} files generated`);
      }
    }

    return results;
  }

  /**
   * Build context for a task from its dependencies
   */
  private buildTaskContext(task: BuildTask, previousResults: BuildResult[]): string {
    if (task.dependencies.length === 0) {
      return '';
    }

    const dependentResults = previousResults.filter((r) =>
      task.dependencies.includes(r.taskId)
    );

    if (dependentResults.length === 0) {
      return '';
    }

    let context = '## Context from Previous Tasks\n\n';

    for (const result of dependentResults) {
      context += `### Task: ${result.taskId}\n\n`;
      context += `Files generated:\n`;
      for (const file of result.files) {
        context += `- ${file.path}\n`;
      }
      context += '\n';

      if (result.dependencies.length > 0) {
        context += `Dependencies:\n`;
        for (const dep of result.dependencies) {
          context += `- ${dep.name}@${dep.version}\n`;
        }
        context += '\n';
      }
    }

    return context;
  }

  /**
   * Write all generated files to disk
   */
  private async writeAllFiles(results: BuildResult[], projectName: string): Promise<void> {
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const projectDir = join(this.outputDir, safeName);

    // Collect all files
    const allFiles: GeneratedFile[] = [];
    for (const result of results) {
      allFiles.push(...result.files);
      if (result.tests) {
        allFiles.push(...result.tests);
      }
    }

    // Write each file
    for (const file of allFiles) {
      const filePath = join(projectDir, file.path);
      const fileDir = dirname(filePath);

      // Create directory if needed
      await mkdir(fileDir, { recursive: true });

      // Write file
      await writeFile(filePath, file.content, 'utf-8');
    }

    // Write combined documentation
    const allDocs = results.map((r) => r.documentation).join('\n\n---\n\n');
    await writeFile(join(projectDir, 'README.md'), allDocs, 'utf-8');

    // Write package.json if there are dependencies
    const allDeps = results.flatMap((r) => r.dependencies);
    if (allDeps.length > 0) {
      const packageJson = this.createPackageJson(projectName, allDeps);
      await writeFile(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
    }

    console.log(`   📁 Project written to: ${projectDir}`);
  }

  /**
   * Create package.json from dependencies
   */
  private createPackageJson(projectName: string, deps: any[]): any {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {};

    for (const dep of deps) {
      if (dep.type === 'production') {
        dependencies[dep.name] = dep.version;
      } else {
        devDependencies[dep.name] = dep.version;
      }
    }

    return {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      description: `Generated by Builder Swarm`,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        test: 'echo "No tests yet"',
      },
      dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
      devDependencies: Object.keys(devDependencies).length > 0 ? devDependencies : undefined,
    };
  }

  /**
   * Count total tasks in plan
   */
  private countTasks(plan: BuildPlan): number {
    return plan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
  }

  /**
   * Print build summary
   */
  private printBuildSummary(results: BuildResult[]): void {
    const totalFiles = results.reduce((sum, r) => sum + r.files.length, 0);
    const totalErrors = results.reduce(
      (sum, r) => sum + (r.errors?.length || 0),
      0
    );
    const totalDeps = [
      ...new Set(results.flatMap((r) => r.dependencies.map((d) => d.name))),
    ].length;

    console.log(`   Files Generated: ${totalFiles}`);
    console.log(`   Dependencies: ${totalDeps}`);
    console.log(`   Tasks: ${results.length}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Cost: $${this.costGuard.getStatus().currentCost.toFixed(3)}`);
  }
}
