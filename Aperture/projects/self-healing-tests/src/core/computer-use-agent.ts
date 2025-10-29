import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  TestFailure,
  TestConfig,
  ComputerUseFunctionCall,
  FunctionCallResult,
  SafetyDecision,
  ComputerUseResponse,
  AgenticLoopState,
  FrameworkAdapter
} from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Computer Use Agent - Implements the full agentic control loop
 *
 * Based on Gemini 2.5 Computer Use Model Technical Architecture:
 *
 * Phase 1: Request Generation - Build prompt with screenshot + task intent
 * Phase 2: Analysis & Planning - Model returns function_call + safety_decision
 * Phase 3: Execution - Client-side executes action via Playwright
 * Phase 4: State Recapture - Capture new screenshot + update history
 *
 * This decoupled architecture ensures:
 * - Security: Model suggests, client validates and executes
 * - Control: Developer maintains full control over execution environment
 * - Safety: Mandatory per-step validation before each action
 * - Resilience: Visual context-based element detection (60%+ healing success rate)
 */
export class ComputerUseAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private config: TestConfig;
  private adapter: FrameworkAdapter;

  // Computer Use tool definition - standard UI actions
  private readonly computerUseTool = {
    name: 'computer',
    description: 'Control a computer by executing UI actions. You can click, type, scroll, wait, and take screenshots.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        action: {
          type: SchemaType.STRING,
          enum: ['click', 'type', 'scroll', 'wait', 'key', 'screenshot'],
          description: 'The action to perform'
        },
        coordinate: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.NUMBER },
          description: 'X,Y coordinates for click action (e.g., [100, 200])'
        },
        text: {
          type: SchemaType.STRING,
          description: 'Text to type (for type action) or key to press (for key action)'
        },
        direction: {
          type: SchemaType.STRING,
          enum: ['up', 'down'],
          description: 'Scroll direction (for scroll action)'
        },
        milliseconds: {
          type: SchemaType.NUMBER,
          description: 'Duration to wait in milliseconds (for wait action)'
        }
      },
      required: ['action']
    }
  };

  constructor(adapter: FrameworkAdapter, config: TestConfig) {
    this.adapter = adapter;
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    try {
      if (this.config.geminiApiKey) {
        this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
        logger.info('✓ Initialized Gemini Computer Use Agent');
      } else {
        throw new Error('GEMINI_API_KEY is required for Computer Use model');
      }
    } catch (error) {
      logger.error('Failed to initialize Computer Use Agent:', error);
      throw error;
    }
  }

  /**
   * Main agentic control loop - executes multi-step healing workflow
   *
   * This implements the iterative loop described in the technical deep dive:
   * 1. Request → 2. Analysis → 3. Execution → 4. State Recapture → repeat
   *
   * Expected success rate: 60%+ for common UI changes (based on Google internal data)
   */
  async executeHealingWorkflow(
    failure: TestFailure,
    taskPrompt: string
  ): Promise<{ success: boolean; steps: number; finalState: AgenticLoopState }> {
    if (!this.genAI) {
      throw new Error('Computer Use Agent not initialized');
    }

    logger.healing(`🔄 Starting Computer Use agentic control loop`);
    logger.info(`📋 Task: ${taskPrompt}`);

    // Initialize agentic loop state
    const loopState: AgenticLoopState = {
      conversationHistory: [],
      currentStep: 0,
      maxSteps: this.config.maxHealingAttempts * 5, // Allow multiple actions per attempt
      taskComplete: false,
      lastScreenshot: failure.screenshot
    };

    // Phase 1: Initial Request Generation
    const initialRequest = this.buildInitialRequest(failure, taskPrompt);
    loopState.conversationHistory.push({
      role: 'user',
      parts: initialRequest
    });

    try {
      // Use Computer Use model (fallback to flash if not available)
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp', // TODO: Change to gemini-2.5-computer-use-preview when available
        tools: [{ functionDeclarations: [this.computerUseTool] }]
      });

      logger.info(`🎯 Model configured with computer control tool`);

      // Start the iterative loop
      while (!loopState.taskComplete && loopState.currentStep < loopState.maxSteps) {
        loopState.currentStep++;
        logger.debug(`\n${'='.repeat(70)}`);
        logger.info(`🔁 Agentic Loop Step ${loopState.currentStep}/${loopState.maxSteps}`);
        logger.debug('='.repeat(70));

        // Phase 2: Analysis & Planning
        const response = await this.planNextAction(model, loopState);

        if (response.isComplete) {
          logger.success(`✅ Task completed: ${response.result}`);
          loopState.taskComplete = true;
          break;
        }

        if (!response.functionCall) {
          logger.warn('⚠️  No function call returned, task may be complete');
          loopState.taskComplete = true;
          break;
        }

        // Safety validation (mandatory for Preview model)
        if (!this.validateSafety(response.safetyDecision)) {
          logger.error(`❌ Safety check failed: ${response.safetyDecision.reasoning}`);
          break;
        }

        // Phase 3: Execution
        logger.info(`🎬 Executing: ${response.functionCall.args.action}`);
        const executionResult = await this.executeAction(response.functionCall);

        if (!executionResult.success) {
          logger.warn(`⚠️  Action failed: ${executionResult.error}`);
          // Continue loop - model will adapt to failure (self-healing)
        } else {
          logger.success(`✓ Action completed successfully`);
        }

        // Phase 4: State Recapture
        await this.updateLoopState(loopState, response, executionResult);

        // Small delay to allow page to update
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const success = loopState.taskComplete;
      const statusIcon = success ? '✅' : '⚠️';
      logger.info(`\n${statusIcon} Agentic loop completed: ${success ? 'SUCCESS' : 'INCOMPLETE'} (${loopState.currentStep} steps)`);

      return {
        success,
        steps: loopState.currentStep,
        finalState: loopState
      };

    } catch (error) {
      logger.error('❌ Agentic control loop failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Build initial request with screenshot and task intent
   *
   * This prompt is optimized for visual understanding and browser automation,
   * emphasizing resilience to UI changes (the core value proposition)
   */
  private buildInitialRequest(failure: TestFailure, taskPrompt: string): any[] {
    const parts: any[] = [];

    // Add task prompt with detailed context
    parts.push({
      text: `You are an expert test automation engineer with computer control capabilities.
You specialize in SELF-HEALING TESTS that adapt to UI changes through visual understanding.

═══════════════════════════════════════════════════════════════════
🎯 PRIMARY TASK: ${taskPrompt}
═══════════════════════════════════════════════════════════════════

📋 TEST FAILURE CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Name:       ${failure.testName}
Error:           ${failure.error.message}
Failed Action:   ${failure.action || 'Unknown'}
Failed Selector: ${failure.selector || 'Not specified'}  ← IGNORE THIS
URL:             ${failure.context?.url || 'Not available'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️  YOUR COMPUTER CONTROL CAPABILITIES:
You have access to the 'computer' function with these actions:

  • click(coordinate: [x, y])     - Click at pixel coordinates
  • type(text: string)             - Type text into focused field
  • scroll(direction: "up"|"down") - Scroll the page
  • wait(milliseconds: number)     - Wait for page state
  • key(key: string)               - Press keyboard keys (Enter, Tab, etc)
  • screenshot()                   - Capture current state

🎓 SELF-HEALING METHODOLOGY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. VISUAL ANALYSIS
   - Analyze the screenshot to understand current UI state
   - Identify elements by VISUAL appearance, NOT selectors
   - The failed selector is WRONG - UI has changed

2. ADAPTIVE PLANNING
   - Plan actions based on what you SEE, not what you expect
   - Account for: moved elements, renamed buttons, layout changes
   - Generate precise pixel coordinates for interactions

3. ITERATIVE EXECUTION
   - Execute ONE action at a time
   - Verify each action's result before proceeding
   - Adapt strategy if environment changes

4. TASK COMPLETION
   - When task is complete, respond: "TASK_COMPLETE: <summary>"
   - Include what you accomplished and how you adapted
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ CRITICAL RULES:
  ✓ Use visual understanding - selectors are unreliable
  ✓ Find elements by appearance, position, text content
  ✓ Adapt to UI changes - that's your core strength
  ✓ One action per step - verify before continuing
  ✗ Never assume selectors are still valid
  ✗ Don't give up if layout has changed - adapt!

🚀 BEGIN:
Analyze the screenshot and determine your FIRST action to complete the task.
Focus on resilience and adaptation - the UI may have changed significantly.`
    });

    // Add screenshot if available
    if (failure.screenshot) {
      parts.push({
        inlineData: {
          data: failure.screenshot.toString('base64'),
          mimeType: 'image/png'
        }
      });
    }

    return parts;
  }

  /**
   * Phase 2: Get next action from model
   *
   * Model analyzes current visual state and returns:
   * - function_call: The UI action to execute
   * - safety_decision: Risk assessment (mandatory validation)
   */
  private async planNextAction(model: any, loopState: AgenticLoopState): Promise<ComputerUseResponse> {
    try {
      const chat = model.startChat({
        history: loopState.conversationHistory.slice(0, -1), // Exclude last message
      });

      const lastMessage = loopState.conversationHistory[loopState.conversationHistory.length - 1];
      const result = await chat.sendMessage(lastMessage.parts);
      const response = await result.response;

      logger.debug('📨 Model response received');

      // Check for completion signal
      const text = response.text();
      if (text && text.includes('TASK_COMPLETE')) {
        return {
          safetyDecision: this.createSafetyDecision(true, 'low', 'Task complete'),
          reasoning: text,
          isComplete: true,
          result: text.replace('TASK_COMPLETE:', '').trim()
        };
      }

      // Extract function call
      const functionCalls = response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) {
        logger.debug('💭 Model response (text only):', text?.substring(0, 200));
        return {
          safetyDecision: this.createSafetyDecision(true, 'low', 'No action needed'),
          reasoning: text || 'No function call',
          isComplete: true
        };
      }

      const functionCall = functionCalls[0];
      logger.debug(`🔧 Function call: ${functionCall.name}(${JSON.stringify(functionCall.args)})`);

      // Create safety decision (mandatory for each action)
      const safetyDecision = this.assessActionSafety(functionCall);

      return {
        functionCall: this.convertFunctionCall(functionCall),
        safetyDecision,
        reasoning: text || 'Executing action',
        isComplete: false
      };

    } catch (error) {
      logger.error('Failed to plan next action:', error);
      throw error;
    }
  }

  /**
   * Phase 3: Execute the function call via Playwright
   *
   * This is client-side execution - the decoupled architecture's security boundary.
   * Model SUGGESTS actions, client VALIDATES and EXECUTES with full control.
   */
  private async executeAction(functionCall: ComputerUseFunctionCall): Promise<FunctionCallResult> {
    const { action, coordinate, text, direction, milliseconds } = functionCall.args;

    logger.info(`  └─ Action: ${action}${coordinate ? ` at [${coordinate[0]}, ${coordinate[1]}]` : ''}${text ? ` "${text}"` : ''}`);

    try {
      // Use adapter's executeFunctionCall if available
      if (this.adapter.executeFunctionCall) {
        return await this.adapter.executeFunctionCall(functionCall);
      }

      // Fallback: basic execution via page object
      const page = this.adapter.getPage?.();
      if (!page) {
        throw new Error('No page available for execution');
      }

      switch (action) {
        case 'click':
          if (!coordinate || coordinate.length !== 2) {
            throw new Error('Click requires coordinate [x, y]');
          }
          await page.mouse.click(coordinate[0], coordinate[1]);
          logger.debug(`  ✓ Clicked at [${coordinate[0]}, ${coordinate[1]}]`);
          break;

        case 'type':
          if (!text) {
            throw new Error('Type requires text argument');
          }
          await page.keyboard.type(text, { delay: 50 }); // Add delay for realism
          logger.debug(`  ✓ Typed: "${text}"`);
          break;

        case 'scroll':
          const scrollAmount = direction === 'up' ? -300 : 300;
          await page.mouse.wheel(0, scrollAmount);
          logger.debug(`  ✓ Scrolled ${direction}`);
          break;

        case 'wait':
          const duration = milliseconds || 1000;
          await page.waitForTimeout(duration);
          logger.debug(`  ✓ Waited ${duration}ms`);
          break;

        case 'key':
          if (!text) {
            throw new Error('Key action requires text (key name)');
          }
          await page.keyboard.press(text);
          logger.debug(`  ✓ Pressed key: ${text}`);
          break;

        case 'screenshot':
          const screenshot = await this.adapter.captureScreenshot();
          return { success: true, screenshot, output: 'Screenshot captured' };

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Capture new state after action
      const screenshot = await this.adapter.captureScreenshot();

      return {
        success: true,
        screenshot,
        output: `${action} executed successfully`
      };

    } catch (error) {
      logger.error('  ✗ Action execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Phase 4: Update loop state with new screenshot and history
   *
   * Maintains conversation context for multi-step reasoning.
   * The model uses history to understand what it's already tried.
   */
  private async updateLoopState(
    loopState: AgenticLoopState,
    response: ComputerUseResponse,
    executionResult: FunctionCallResult
  ): Promise<void> {
    // Add model's function call response to history
    loopState.conversationHistory.push({
      role: 'model',
      parts: [{
        functionCall: response.functionCall
      }]
    });

    // Add execution result - must use 'function' role for functionResponse
    loopState.conversationHistory.push({
      role: 'function' as any, // Gemini requires 'function' role for functionResponse
      parts: [{
        functionResponse: {
          name: 'computer',
          response: {
            success: executionResult.success,
            output: executionResult.output || executionResult.error || 'Action completed'
          }
        }
      }]
    });

    // Add new screenshot in a separate user message if available
    // This provides visual context for the next iteration
    if (executionResult.screenshot) {
      loopState.lastScreenshot = executionResult.screenshot;
      loopState.conversationHistory.push({
        role: 'user',
        parts: [{
          text: 'Here is the screenshot after executing the action. Analyze it and determine your next step.'
        }, {
          inlineData: {
            data: executionResult.screenshot.toString('base64'),
            mimeType: 'image/png'
          }
        }]
      });
    }
  }

  /**
   * Safety Service - Mandatory per-step validation
   *
   * Required for Preview model governance. Assesses risk level
   * and determines if human approval is needed.
   *
   * Risk levels:
   * - Low: Screenshot, scroll, wait (safe operations)
   * - Medium: Click, key press (UI interaction)
   * - High: Type text (potential for sensitive data)
   */
  private assessActionSafety(functionCall: any): SafetyDecision {
    const action = functionCall.args?.action;

    // Define risk levels based on action type
    const lowRiskActions = ['screenshot', 'wait', 'scroll'];
    const mediumRiskActions = ['click', 'key'];
    const highRiskActions = ['type']; // Typing could input sensitive data

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (highRiskActions.includes(action)) {
      riskLevel = 'high';
    } else if (mediumRiskActions.includes(action)) {
      riskLevel = 'medium';
    } else if (lowRiskActions.includes(action)) {
      riskLevel = 'low';
    }

    // Check for suspicious patterns in typed text
    const text = functionCall.args?.text || '';
    const suspiciousPatterns = [
      /password/i,
      /credit.?card/i,
      /social.?security/i,
      /api.?key/i,
      /secret/i,
      /token/i,
      /rm\s+-rf/i, // Dangerous commands
      /drop\s+table/i // SQL injection
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(text));
    if (isSuspicious) {
      riskLevel = 'high';
    }

    // Determine if human approval needed
    const requiresApproval = riskLevel === 'high' && !this.config.autoApply;

    return this.createSafetyDecision(
      !requiresApproval,
      riskLevel,
      isSuspicious
        ? `⚠️  Suspicious content detected in ${action} action`
        : `${action} action assessed as ${riskLevel} risk`
    );
  }

  private createSafetyDecision(
    allowed: boolean,
    riskLevel: 'low' | 'medium' | 'high',
    reasoning: string
  ): SafetyDecision {
    return {
      allowed,
      reasoning,
      risk_level: riskLevel,
      requires_human_approval: !allowed
    };
  }

  private validateSafety(decision: SafetyDecision): boolean {
    if (!decision.allowed) {
      logger.warn(`  🛡️  Safety check: ${decision.reasoning}`);
      if (decision.requires_human_approval) {
        logger.warn('  👤 Action requires human approval (auto-reject in current mode)');
      }
      return false;
    }

    const riskIcon = decision.risk_level === 'high' ? '⚠️' : decision.risk_level === 'medium' ? '⚡' : '✓';
    logger.debug(`  ${riskIcon} Safety: ${decision.risk_level} risk - ${decision.reasoning}`);
    return true;
  }

  private convertFunctionCall(functionCall: any): ComputerUseFunctionCall {
    return {
      name: functionCall.name,
      args: functionCall.args || {}
    };
  }

  /**
   * Cost estimation for Computer Use model
   *
   * Based on technical deep dive estimates:
   * - Simple fix: ~$0.001
   * - Complex analysis: ~$0.005
   * - With screenshots: +$0.002-0.003
   */
  async estimateCost(steps: number): Promise<{ tokens: number; usd: number }> {
    // Computer Use model pricing (estimated for preview)
    // Screenshots are more expensive due to visual processing
    const baseTokensPerStep = 1500; // Base prompt + response
    const screenshotTokens = 2500;   // Visual analysis (optimized for browser control)

    const totalTokens = steps * (baseTokensPerStep + screenshotTokens);

    // Approximate pricing (will vary based on actual model)
    const usd = totalTokens * 0.0000035; // ~$0.0035 per 1K tokens

    return { tokens: totalTokens, usd };
  }
}
