/**
 * Computer Use Agent - Uses Gemini 2.5 Computer Use Model
 *
 * This agent uses visual understanding to interact with web pages
 * WITHOUT needing CSS selectors. It can "see" the page and generate
 * click coordinates and actions.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { TestConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ComputerUseAction {
  type: 'click' | 'type' | 'scroll' | 'wait';
  description: string;
  confidence: number;
  coordinates?: { x: number; y: number }; // Normalized 0-1000 coordinates
  text?: string; // For type actions
  reasoning: string;
}

export interface ComputerUseResponse {
  actions: ComputerUseAction[];
  reasoning: string;
  confidence: number;
  completed: boolean;
}

export class ComputerUseAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (!this.config.geminiApiKey) {
        throw new Error('No Gemini API key provided');
      }

      this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);

      // Initialize with Computer Use model
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-computer-use-preview-10-2025',
        tools: [{
          // @ts-ignore - computer_use is a preview feature
          computer_use: {
            environment: 'ENVIRONMENT_BROWSER',
          },
        }],
      });

      logger.info('✅ Initialized Gemini 2.5 Computer Use model');
    } catch (error) {
      logger.error('Failed to initialize Computer Use agent:', error);
      throw error;
    }
  }

  /**
   * Analyze a page visually and determine actions to complete a task
   */
  async analyzeAndAct(
    screenshot: Buffer,
    task: string,
    pageUrl: string,
    viewport: { width: number; height: number }
  ): Promise<ComputerUseResponse> {
    if (!this.model) {
      throw new Error('Computer Use model not initialized');
    }

    logger.info(`🤖 Computer Use analyzing task: ${task}`);

    const prompt = this.buildComputerUsePrompt(task, pageUrl, viewport);
    const imageParts = [this.prepareScreenshot(screenshot)];

    try {
      const result = await this.model.generateContent([
        prompt,
        ...imageParts
      ]);

      const response = await result.response;

      // Log everything we can about the response
      logger.info('🔍 Inspecting Computer Use response...');

      try {
        const text = response.text();
        logger.info('📝 Response text (first 500 chars):', text.substring(0, 500));
        console.log('\n📄 FULL AI RESPONSE TEXT:\n');
        console.log(text);
        console.log('\n' + '='.repeat(70) + '\n');
      } catch (e) {
        logger.warn('No text() method available');
      }

      // Check for function calls
      try {
        if (typeof response.functionCalls === 'function') {
          const calls = response.functionCalls();
          logger.info('🔧 Function calls found:', calls?.length || 0);
          if (calls && calls.length > 0) {
            console.log('\n🔧 FUNCTION CALLS:\n', JSON.stringify(calls, null, 2));
          }
        }
      } catch (e) {
        logger.warn('No functionCalls() method available');
      }

      // Log response structure
      logger.debug('Response keys:', Object.keys(response));
      logger.debug('Response proto:', Object.getPrototypeOf(response));

      // Parse the response
      return this.parseComputerUseResponse(response, task);

    } catch (error) {
      logger.error('Computer Use analysis failed:', error);
      logger.error('Full error:', error);
      throw error;
    }
  }

  private buildComputerUsePrompt(task: string, pageUrl: string, viewport: { width: number; height: number }): string {
    return `
You are a Computer Use AI that can visually understand web pages and generate precise actions.

TASK: ${task}
PAGE URL: ${pageUrl}
VIEWPORT: ${viewport.width}x${viewport.height}

You can see the screenshot of the page. Your job is to:
1. Visually identify the elements needed to complete the task
2. Generate precise click coordinates (in normalized 0-1000 coordinate system)
3. Provide a sequence of actions to complete the task

IMPORTANT:
- Look at the ACTUAL visual elements on the page
- Identify article links, buttons, or interactive elements by their VISUAL appearance
- Do NOT try to guess CSS selectors - use your visual understanding
- Generate normalized coordinates (0-1000 scale) for click actions
- Be specific about what you see and where it is located

Respond with a JSON structure describing the actions:
{
  "actions": [
    {
      "type": "click",
      "description": "Click on the first football article headline",
      "confidence": 0.95,
      "coordinates": { "x": 500, "y": 300 },
      "reasoning": "I can see an article headline about football at this position"
    }
  ],
  "reasoning": "Overall strategy for completing the task",
  "confidence": 0.90,
  "completed": false
}

ACTION TYPES:
- "click": Click at specific coordinates
- "type": Type text into a field
- "scroll": Scroll the page
- "wait": Wait for page to load

Analyze the screenshot and tell me EXACTLY what actions to take to complete: ${task}
`;
  }

  private prepareScreenshot(screenshot: Buffer): any {
    return {
      inlineData: {
        data: screenshot.toString('base64'),
        mimeType: 'image/png'
      }
    };
  }

  private parseComputerUseResponse(response: any, task: string): ComputerUseResponse {
    try {
      // Log the full response structure for debugging
      logger.debug('Full response structure:', JSON.stringify(response, null, 2));

      // Check if response has function calls (Computer Use model format)
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        logger.info('Computer Use model returned function calls');

        // Parse function calls into actions
        const actions: ComputerUseAction[] = functionCalls.map((call: any) => {
          logger.debug('Function call:', JSON.stringify(call, null, 2));

          return {
            type: this.mapFunctionToActionType(call.name),
            description: `Computer Use action: ${call.name}`,
            confidence: 0.8,
            coordinates: call.args?.coordinates || call.args?.location,
            text: call.args?.text,
            reasoning: 'Generated by Computer Use model'
          };
        });

        return {
          actions,
          reasoning: 'Computer Use model generated browser interaction actions',
          confidence: 0.8,
          completed: false
        };
      }

      // Try to get text response as fallback
      let text = '';
      try {
        text = response.text();
        logger.debug('Computer Use text response:', text.substring(0, 500));
      } catch (e) {
        logger.warn('No text response available');
      }

      if (!text) {
        logger.warn('No text or function calls in response');
        return this.createFallbackResponse(task);
      }

      // Try to extract JSON from text
      let jsonStr: string | null = null;

      const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/) ||
                       text.match(/```\s*(\{[\s\S]*?\})\s*```/) ||
                       text.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = text.substring(firstBrace, lastBrace + 1);
        }
      }

      if (!jsonStr) {
        logger.warn('No JSON found in text response');

        // Try to create actions from the text description
        return this.extractActionsFromText(text, task);
      }

      const parsed = JSON.parse(jsonStr);

      return {
        actions: parsed.actions || [],
        reasoning: parsed.reasoning || 'Computer Use analysis completed',
        confidence: parsed.confidence || 0.5,
        completed: parsed.completed || false
      };

    } catch (error) {
      logger.error('Failed to parse Computer Use response:', error);
      logger.error('Error details:', error);
      return this.createFallbackResponse(task);
    }
  }

  private mapFunctionToActionType(functionName: string): 'click' | 'type' | 'scroll' | 'wait' {
    if (functionName.includes('click')) return 'click';
    if (functionName.includes('type') || functionName.includes('input')) return 'type';
    if (functionName.includes('scroll')) return 'scroll';
    return 'wait';
  }

  private extractActionsFromText(text: string, _task: string): ComputerUseResponse {
    // Try to extract useful information from natural language response
    logger.info('Attempting to extract actions from natural language response');

    // For now, return a descriptive fallback
    return {
      actions: [],
      reasoning: `Computer Use model provided description: ${text.substring(0, 200)}...`,
      confidence: 0.3,
      completed: false
    };
  }

  private createFallbackResponse(task: string): ComputerUseResponse {
    return {
      actions: [],
      reasoning: `Unable to parse Computer Use response for task: ${task}`,
      confidence: 0.1,
      completed: false
    };
  }

  /**
   * Convert normalized coordinates (0-1000) to actual pixel coordinates
   */
  convertCoordinates(
    normalized: { x: number; y: number },
    viewport: { width: number; height: number }
  ): { x: number; y: number } {
    return {
      x: (normalized.x / 1000) * viewport.width,
      y: (normalized.y / 1000) * viewport.height
    };
  }
}
