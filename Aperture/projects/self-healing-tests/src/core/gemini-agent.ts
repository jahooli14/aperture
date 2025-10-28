import { GoogleGenerativeAI } from '@google/generative-ai';
import { TestFailure, GeminiResponse, HealingAction, TestConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GeminiAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (this.config.geminiApiKey) {
        // Using AI Studio API with Computer Use model
        this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({
          model: this.config.model || 'gemini-2.5-computer-use-preview-10-2025',
          tools: [{
            computer_use: {
              environment: 'ENVIRONMENT_BROWSER',
            },
          }],
        });
        logger.info('Initialized Gemini Computer Use model with AI Studio API');
      } else if (this.config.vertexProject) {
        // Using Vertex AI (requires authentication)
        logger.info('Vertex AI integration not yet implemented - use AI Studio API key');
        throw new Error('Vertex AI support coming soon. Please use GEMINI_API_KEY for now.');
      } else {
        throw new Error('No Gemini API configuration found');
      }
    } catch (error) {
      logger.error('Failed to initialize Gemini Agent:', error);
      throw error;
    }
  }

  async analyzeFailure(failure: TestFailure): Promise<GeminiResponse> {
    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    logger.healing(`Analyzing test failure: ${failure.testName}`);

    const prompt = this.buildAnalysisPrompt(failure);
    const imageParts = failure.screenshot ? [this.prepareScreenshot(failure.screenshot)] : [];

    try {
      const result = await this.model.generateContent([
        prompt,
        ...imageParts
      ]);

      const response = await result.response;
      const text = response.text();

      logger.debug('Raw Gemini response:', text);

      return this.parseGeminiResponse(text);
    } catch (error) {
      logger.error('Failed to analyze failure with Gemini:', error);
      throw new Error(`Gemini analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildAnalysisPrompt(failure: TestFailure): string {
    return `
You are an expert test automation engineer with computer use capabilities specializing in self-healing test frameworks.
You can visually analyze browser screenshots to understand UI changes and generate precise healing actions.
Analyze this test failure and provide specific, actionable fixes.

## Test Failure Details:
- **Test Name**: ${failure.testName}
- **Test File**: ${failure.testPath}
- **Error**: ${failure.error.message}
- **Stack Trace**: ${failure.stackTrace || 'Not available'}
- **Failed Selector**: ${failure.selector || 'Not specified'}
- **Action**: ${failure.action || 'Unknown'}
- **URL**: ${failure.context?.url || 'Not available'}
- **Timestamp**: ${failure.timestamp.toISOString()}

${failure.context ? `
## Context Information:
- **Viewport**: ${failure.context.viewport.width}x${failure.context.viewport.height}
- **User Agent**: ${failure.context.userAgent}
- **Console Logs**: ${failure.context.console?.join('\\n') || 'None'}
` : ''}

## Your Task:
1. **Analyze** the failure and screenshot (if provided)
2. **Identify** the root cause (selector changed, timing issue, element moved, etc.)
3. **Propose** specific healing actions with confidence scores
4. **Explain** your reasoning for each proposed fix

## Response Format:
Provide a JSON response with this exact structure:

\`\`\`json
{
  "healingActions": [
    {
      "type": "selector_fix|wait_adjustment|assertion_update|flow_modification|element_alternative|timing_fix",
      "description": "Clear description of what this fix does",
      "confidence": 0.85,
      "oldValue": "current problematic value",
      "newValue": "proposed new value",
      "reasoning": "Why this fix should work"
    }
  ],
  "reasoning": "Overall analysis of the failure and why these fixes are recommended",
  "confidence": 0.80,
  "requiresHumanReview": false
}
\`\`\`

## Important Guidelines:
- **Be specific**: Provide exact selectors, values, and code changes
- **Consider alternatives**: If one selector fails, suggest backup strategies
- **Confidence scoring**:
  - 0.9+ = Very confident, can auto-apply
  - 0.7-0.9 = Confident, minor human review
  - 0.5-0.7 = Moderate, needs human review
  - <0.5 = Low confidence, manual intervention needed
- **Context awareness**: Visually analyze screenshots to identify UI elements, their positions, and changes
- **Common patterns**: Look for typical UI framework patterns (React, Angular, etc.)
- **Visual understanding**: Use your computer use capabilities to identify elements by their visual appearance

Focus on practical, implementable solutions that will make the test more robust.
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

  private parseGeminiResponse(text: string): GeminiResponse {
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        throw new Error('No valid JSON found in Gemini response');
      }

      const jsonStr = jsonMatch[1];
      if (!jsonStr) {
        throw new Error('No JSON content found');
      }
      const parsed = JSON.parse(jsonStr);

      // Validate the response structure
      if (!parsed.healingActions || !Array.isArray(parsed.healingActions)) {
        throw new Error('Invalid response structure: missing healingActions array');
      }

      // Set defaults and validate healing actions
      const healingActions: HealingAction[] = parsed.healingActions.map((action: any) => ({
        type: action.type,
        description: action.description || '',
        confidence: Math.max(0, Math.min(1, action.confidence || 0.5)),
        oldValue: action.oldValue || '',
        newValue: action.newValue || '',
        reasoning: action.reasoning || '',
        applied: false
      }));

      return {
        healingActions,
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        requiresHumanReview: parsed.requiresHumanReview ?? true
      };

    } catch (error) {
      logger.error('Failed to parse Gemini response:', error);
      logger.debug('Raw response:', text);

      // Return a fallback response
      return {
        healingActions: [{
          type: 'selector_fix',
          description: 'Manual review required - failed to parse AI response',
          confidence: 0.1,
          oldValue: '',
          newValue: '',
          reasoning: 'Could not parse AI response, manual intervention needed',
          applied: false
        }],
        reasoning: 'Failed to parse AI response. Manual review required.',
        confidence: 0.1,
        requiresHumanReview: true
      };
    }
  }

  async estimateCost(failure: TestFailure): Promise<{ tokens: number; usd: number }> {
    // Rough estimation based on content size for Computer Use model
    const baseTokens = 1000; // Base prompt
    const errorTokens = Math.ceil(failure.error.message.length / 4);
    const contextTokens = failure.context ? 500 : 0;
    const screenshotTokens = failure.screenshot ? 2500 : 0; // Computer Use model optimized for visual analysis

    const totalTokens = baseTokens + errorTokens + contextTokens + screenshotTokens;
    const usd = totalTokens * 0.0000035; // Approximate cost per token for Gemini Computer Use

    return { tokens: totalTokens, usd };
  }
}