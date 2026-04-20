import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type {
  FrontierBlock,
  FrontierMode,
  GeminiResponse,
  PreFilterScore,
} from './types.js';
import type { MutationType } from './block-sampler.js';
import { MODELS } from './models.js';
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
    model: MODELS.GENERATE,
  });
}

function getFilterModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: MODELS.FILTER,
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
  feedbackContext?: string,
  frontierGravity?: string
): Promise<GeminiResponse> {
  const mode = frontierModes.modes.find((m: { id: string }) => m.id === frontierMode);

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

  // Inject frontier gravity: top proven patterns the new idea should either
  // extend or deliberately break from — never retread.
  if (frontierGravity) {
    prompt += `\n\n**Current frontier (already-proven patterns):**\n${frontierGravity}\n\nYour idea must either (a) extend one of these patterns into new ground, or (b) break genuinely new territory they don't touch. Do NOT restate them in different words.`;
  }

  // Add clarity instructions - PLAIN ENGLISH IS THE NORTH STAR
  prompt += `\n\n**CRITICAL - PLAIN ENGLISH ONLY (YOU WILL BE REJECTED FOR JARGON):**

BANNED WORDS (do not use ANY of these): modular, paradigm, leverage, utilize, synergy, framework, cascading, systemic, polymorphic, entropy, robust, optimization, schema, methodology, holistic, utilize, facilitate, implement, infrastructure, architecture, ecosystem, metric, dynamic, strategic, innovative, scalable, iterative, synthesis, multifaceted

WRITE LIKE THIS:
- "How bee colonies decide where to build their hive - and what it means for how our brains pick restaurants"
- "Plants can't run away from danger, so they built a chemical alarm system. Can we copy it for cybersecurity?"
- "Why your immune system is terrible at specialization - and why that's actually genius"

NOT LIKE THIS:
- "Inverting [Complexity Requires Specialization] in evolutionary biology"
- "Leveraging phylogenetic stochasticity for neural architecture optimization"
- "Applying robust control theory to modular biological systems"

RULES:
1. Title must use words a 10-year-old knows
2. No square brackets or colons in titles
3. Use active voice and concrete examples
4. Sound excited, not academic
5. If you can't explain it simply, you don't understand it well enough`;

  // Call Gemini with retry logic
  const response = await retryWithBackoff(async () => {
    const result = await getAgentModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: mode.temperature,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
      systemInstruction: 'You are a JSON API. Return only valid JSON with no additional text, explanations, or formatting.',
    });

    const text = result.response.text();

    // Strip any text before first { and after last }
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      throw new Error(`Response does not contain JSON object: ${text.substring(0, 200)}`);
    }

    const jsonText = text.substring(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonText);

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
 * Spawn a child idea from a proven frontier block, applying a mutation
 * operator. This is how the frontier compounds: yesterday's breakthrough is
 * today's starting point, not a random seed.
 */
export async function generateIdeaFromBlock(
  parent: FrontierBlock,
  mutation: MutationType,
  childDomainA: string,
  childDomainB: string,
  feedbackContext?: string
): Promise<GeminiResponse> {
  const parentPattern =
    parent.abstracted_pattern || parent.concept_description;
  const parentPair = parent.domain_pair.join(' × ');

  const mutationInstruction =
    mutation === 'domain_shift'
      ? `**Mutation: domain shift.** The parent pattern was proven on ${parentPair}. Port it to ${childDomainA} × ${childDomainB}. Does the same structural move land here? Show the specific mechanism in the new domains — not a restatement of the parent.`
      : mutation === 'expansion'
        ? `**Mutation: expansion.** The parent pattern is already proven on ${parentPair}. Go one level deeper. What's the sharper, more specific follow-up that the parent points to but doesn't spell out? Don't restate — extend.`
        : `**Mutation: inversion.** The parent claims the pattern above holds. Flip it: what if the opposite were true in ${parentPair}? Find the concrete counter-case or symmetric move the parent missed.`;

  let prompt = `You are generating a follow-up idea from a proven parent idea. Build on it — don't restart from scratch.

**Parent idea:** ${parent.concept_name}
**Parent pattern (generalizable):** ${parentPattern}
**Parent domain pair:** ${parentPair}

${mutationInstruction}

**Output a JSON object with this exact shape:**
{
  "title": "Short, punchy title in plain English",
  "description": "2-3 sentences describing the new idea concretely",
  "reasoning": "1-2 sentences on how it extends/mutates the parent",
  "tractability_estimate": "1-5 (5 = buildable this quarter)"
}`;

  if (feedbackContext) {
    prompt += `\n\n**Learned Context (from past reviews):**\n${feedbackContext}\n\nUse this context to avoid patterns that have been rejected before.`;
  }

  prompt += `\n\n**CRITICAL - PLAIN ENGLISH ONLY (YOU WILL BE REJECTED FOR JARGON):**

BANNED WORDS (do not use ANY of these): modular, paradigm, leverage, utilize, synergy, framework, cascading, systemic, polymorphic, entropy, robust, optimization, schema, methodology, holistic, utilize, facilitate, implement, infrastructure, architecture, ecosystem, metric, dynamic, strategic, innovative, scalable, iterative, synthesis, multifaceted

RULES:
1. Title must use words a 10-year-old knows
2. No square brackets or colons in titles
3. Use active voice and concrete examples
4. Sound excited, not academic
5. The child must be genuinely different from the parent, not a rephrase`;

  const response = await retryWithBackoff(async () => {
    const result = await getAgentModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        // Slightly hotter than fresh generation: spawns should feel
        // surprising, not safe extrapolations of the parent.
        temperature: 1.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
      systemInstruction:
        'You are a JSON API. Return only valid JSON with no additional text, explanations, or formatting.',
    });

    const text = result.response.text();
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      throw new Error(`Spawn response does not contain JSON: ${text.substring(0, 200)}`);
    }

    const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));

    if (!parsed.title || !parsed.description || !parsed.reasoning) {
      throw new Error('Spawn response missing required fields');
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

**IMPORTANT: Respond with ONLY the JSON object below, no additional text:**
{
  "novelty": 0.85,
  "cross_domain_distance": 0.90,
  "tractability": 0.70,
  "reasoning": "Brief 1-sentence justification for scores"
}`;

  const response = await retryWithBackoff(async () => {
    const result = await getFilterModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text();

    // Strip any text before first { and after last }
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('[Scorer] No valid braces. startIdx:', startIdx, 'endIdx:', endIdx, 'text length:', text.length);
      console.error('[Scorer] First 500 chars:', text.substring(0, 500));
      throw new Error(`Scorer: No valid JSON braces (start: ${startIdx}, end: ${endIdx}, len: ${text.length})`);
    }

    const jsonText = text.substring(startIdx, endIdx + 1);
    console.log('[Scorer] Extracted JSON length:', jsonText.length, 'first 200:', jsonText.substring(0, 200));

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Scorer] Parse failed. JSON:', jsonText);
      throw new Error(`Scorer JSON parse failed: ${parseError instanceof Error ? parseError.message : 'unknown'}`);
    }

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
