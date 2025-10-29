/**
 * Core types and interfaces for the self-healing testing framework
 */

export interface TestFailure {
  testName: string;
  testPath: string;
  error: Error;
  screenshot?: Buffer;
  timestamp: Date;
  stackTrace?: string;
  selector?: string;
  action?: TestAction;
  context?: TestContext;
}

export interface TestContext {
  url: string;
  html?: string;
  console?: string[];
  network?: NetworkRequest[];
  viewport: { width: number; height: number };
  userAgent: string;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  timestamp: Date;
}

export type TestAction =
  | 'click'
  | 'type'
  | 'select'
  | 'hover'
  | 'wait'
  | 'scroll'
  | 'navigate'
  | 'assertion';

export interface HealingAction {
  type: HealingActionType;
  description: string;
  confidence: number;
  oldValue: string;
  newValue: string;
  reasoning: string;
  applied: boolean;
}

export type HealingActionType =
  | 'selector_fix'
  | 'wait_adjustment'
  | 'assertion_update'
  | 'flow_modification'
  | 'element_alternative'
  | 'timing_fix';

export interface HealingResult {
  success: boolean;
  actions: HealingAction[];
  testCode: string;
  confidence: number;
  requiresApproval: boolean;
  cost?: {
    tokens: number;
    usd: number;
  };
}

export interface GeminiResponse {
  healingActions: HealingAction[];
  reasoning: string;
  confidence: number;
  requiresHumanReview: boolean;
}

export interface TestConfig {
  // Framework settings
  framework: 'playwright' | 'puppeteer' | 'cypress';
  testTimeout: number;
  retryCount: number;

  // Browser settings
  headless?: boolean;
  slowMo?: number;

  // Healing settings
  enableHealing: boolean;
  autoApply: boolean;
  confidenceThreshold: number;
  maxHealingAttempts: number;

  // Gemini settings
  geminiApiKey?: string;
  vertexProject?: string;
  vertexLocation?: string;
  model: string;

  // Output settings
  screenshotOnFailure: boolean;
  outputDir: string;
  verbose: boolean;
}

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'healed' | 'healing_failed';
  duration: number;
  failure?: TestFailure;
  healingResult?: HealingResult;
  attempts: number;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  healedTests: number;
  duration: number;
  timestamp: Date;
}

export interface SelectorInfo {
  selector: string;
  element?: string;
  attributes?: Record<string, string>;
  text?: string;
  position?: { x: number; y: number };
  visible: boolean;
}

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  function?: string;
}

export interface HealingHistory {
  testName: string;
  failures: TestFailure[];
  healingAttempts: HealingResult[];
  successfulFixes: HealingAction[];
  lastHealed: Date;
  healingRate: number;
}

export interface FrameworkAdapter {
  name: string;
  runTest(testPath: string, config: TestConfig): Promise<TestResult>;
  captureScreenshot(): Promise<Buffer>;
  getTestContext(): Promise<TestContext>;
  applyHealing(testPath: string, actions: HealingAction[]): Promise<boolean>;
}