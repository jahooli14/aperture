/**
 * Builder Types - Define interfaces for code generation and building
 */

export interface BuildRequest {
  type: 'cli' | 'api' | 'web-app' | 'library' | 'full-stack';
  description: string;
  requirements: string[];
  language?: string;
  framework?: string;
  features?: string[];
}

export interface BuildTask {
  id: string;
  type: 'code' | 'test' | 'docs' | 'config' | 'schema';
  specialty: 'backend' | 'frontend' | 'testing' | 'docs' | 'devops';
  description: string;
  language: string;
  requirements: string[];
  context?: string;
  dependencies: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface BuildResult {
  taskId: string;
  files: GeneratedFile[];
  dependencies: PackageDependency[];
  documentation: string;
  tests?: GeneratedFile[];
  errors?: BuildError[];
}

export interface PackageDependency {
  name: string;
  version: string;
  type: 'production' | 'dev';
}

export interface BuildError {
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface TestResult {
  passed: boolean;
  total: number;
  failed: number;
  output: string;
  errors: BuildError[];
}

export interface ProjectContext {
  projectName: string;
  projectType: string;
  existingFiles: string[];
  existingDependencies: PackageDependency[];
  architecture: string;
}

export interface BuildPlan {
  projectName: string;
  projectType: string;
  phases: BuildPhase[];
  estimatedCost: number;
  estimatedDuration: number;
}

export interface BuildPhase {
  name: string;
  tasks: BuildTask[];
  dependencies: string[]; // IDs of phases that must complete first
}

export interface CodeSpec {
  language: string;
  description: string;
  requirements: string[];
  style: 'functional' | 'oop' | 'mixed';
  testing: boolean;
  framework?: string;
}

export interface CodeReview {
  files: string[];
  issues: CodeIssue[];
  suggestions: string[];
  approved: boolean;
}

export interface CodeIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface FixedCode {
  files: GeneratedFile[];
  changesSummary: string;
}

export interface OptimizedCode {
  files: GeneratedFile[];
  improvements: string[];
  performanceGain?: string;
}
