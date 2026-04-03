import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { FrontierMode, GeminiResponse, PreFilterScore } from './types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontierModes = JSON.parse(readFileSync(join(__dirname, 'frontier-modes.json'), 'utf-8'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

function getAgentModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });
}

function getFilterModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${i + 1} failed:`, error);

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Generate an idea using Gemini Flash-Lite
 */
export async function generateIdea(
  domainA: string,
  domainB: string,
  frontierMode: FrontierMode,
  feedbackContext?: string
): Promise<GeminiResponse> {
  const mode = frontierModes.modes.find((m) => m.id === frontierMode);

  if (!mode) {
    throw new Error(`Unknown frontier mode: ${frontierMode}`);
  }

  // Build prompt from template
  let prompt = mode.prompt_template
    .replace(/{domain_a}/g, domainA)
    .replace(/{domain_b}/g, domainB);

  // Inject feedback context if provided
  if (feedbackContext) {
    prompt += `\n\n**Learned Context (from past reviews):**\n${feedbackContext}\n\nUse this context to avoid patterns that have been rejected before.`;
  }

  // Call Gemini with retry logic
  const response = await retryWithBackoff(async () => {
    const result = await getAgentModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: mode.temperature,
        maxOutputTokens: 500,
      },
    });

    const text = result.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Response does not contain valid JSON block');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    // Validate required fields
    if (!parsed.title || !parsed.description || !parsed.reasoning) {
      throw new Error('Response missing required fields');
    }

    return {
      title: parsed.title,
      description: parsed.description,
      reasoning: parsed.reasoning,
      tractability_estimate: parsed.tractability_estimate || '3',
    };
  });

  return response;
}

/**
 * Pre-filter scoring: assess novelty, cross-domain distance, tractability
 */
export async function scoreIdea(
  idea: {
    title: string;
    description: string;
    reasoning: string;
    domain_pair: [string, string];
    frontier_mode: FrontierMode;
  },
  existingIdeas: Array<{ title: string; description: string }>
): Promise<PreFilterScore> {
  const prompt = `You are a pre-filter scorer for an idea generation system. Assess this idea on three dimensions:

**Idea:**
Title: ${idea.title}
Description: ${idea.description}
Reasoning: ${idea.reasoning}
Domain Pair: ${idea.domain_pair.join(' × ')}
Frontier Mode: ${idea.frontier_mode}

**Existing ideas (for novelty comparison):**
${existingIdeas.slice(0, 10).map((e) => `- ${e.title}`).join('\n')}

**Score on:**
1. **Novelty** (0-1): How different is this from existing ideas? Look for conceptual distance, not just wording.
2. **Cross-Domain Distance** (0-1): How far apart are the domains being connected? Higher = more unexpected connection.
3. **Tractability** (0-1): Can this be built/tested within 1 year without requiring new fundamental discoveries?

**Output format (JSON only, no explanation):**
\`\`\`json
{
  "novelty": 0.85,
  "cross_domain_distance": 0.90,
  "tractability": 0.70,
  "reasoning": "Brief 1-sentence justification for scores"
}
\`\`\``;

  const response = await retryWithBackoff(async () => {
    const result = await getFilterModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, // Low temperature for consistent scoring
        maxOutputTokens: 200,
      },
    });

    const text = result.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Scorer response does not contain valid JSON block');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    // Validate scores
    if (
      typeof parsed.novelty !== 'number' ||
      typeof parsed.cross_domain_distance !== 'number' ||
      typeof parsed.tractability !== 'number'
    ) {
      throw new Error('Invalid score format');
    }

    return {
      novelty: parsed.novelty,
      cross_domain_distance: parsed.cross_domain_distance,
      tractability: parsed.tractability,
      overall:
        parsed.novelty * 0.4 +
        parsed.cross_domain_distance * 0.3 +
        parsed.tractability * 0.3,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  });

  return response;
}

/**
 * Extract abstract pattern from an idea (for frontier blocks)
 */
export async function extractAbstractPattern(idea: {
  title: string;
  description: string;
  reasoning: string;
}): Promise<string> {
  const prompt = `Extract the abstract, generalizable pattern from this idea. Focus on the *method* or *principle*, not the specific domains.

**Idea:**
Title: ${idea.title}
Description: ${idea.description}
Reasoning: ${idea.reasoning}

**Output:** 1-2 sentences describing the abstract pattern that could be applied to other domain pairs.

Example:
Input: "Dendritic Computation as Multi-Head Attention"
Output: "Map biological multi-pathway computation to neural network architecture components, looking for structural isomorphisms in how information is integrated."

Your turn (no JSON, just the pattern text):`;

  const response = await retryWithBackoff(async () => {
    const result = await getFilterModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 150,
      },
    });

    return result.response.text().trim();
  });

  return response;
}
