# Frontier Modes: Implementation Patterns & Code Examples

This document provides production-ready code patterns to implement the prompt design strategy outlined in FRONTIER_MODES_PROMPT_REVIEW.md.

---

## 1. Frontier Mode Configuration & Orchestration

```typescript
// lib/frontier/frontier-modes.ts

export type FrontierMode =
  | 'Translate'
  | 'ToolTransfer'
  | 'AssumptionAudit'
  | 'AnalogyMine'
  | 'Compression'
  | 'Inversion'

export interface FrontierModeConfig {
  readonly mode: FrontierMode
  readonly operation: string
  readonly operation_description: string
  readonly temperature: number  // 0.7 (precise) to 1.5 (creative)
  readonly max_tokens: number
  readonly examples: readonly string[]
  readonly constraints: readonly string[]
  readonly success_criteria: readonly string[]
}

const FRONTIER_MODES_CONFIG: Record<FrontierMode, FrontierModeConfig> = {
  'Translate': {
    mode: 'Translate',
    operation: 'Metaphorical Transfer',
    operation_description: 'Express Domain A concept using Domain B vocabulary. Find the isomorphism.',
    temperature: 1.1,  // Creative, but not chaotic
    max_tokens: 1200,
    examples: [
      'Mycelium networks (decentralized nodes, no central authority) → Project management (emergence via local decisions)',
      'Jazz improvisation (constraint-response loop, listening to co-musicians) → Rapid prototyping (responsive iteration)',
      'Immune system (pattern recognition, memory, response calibration) → Organizational change management'
    ],
    constraints: [
      'The bridge must be structural, not superficial',
      'Both domains must share a deep isomorphism (not just aesthetic similarity)',
      'The translation should surprise: "I never thought about X that way"'
    ],
    success_criteria: [
      'Reasoning shows 2-3 specific parallels between domains',
      'The idea wouldn\'t work without this specific translation',
      'A non-expert could understand the analogy in 2 sentences'
    ]
  },

  'ToolTransfer': {
    mode: 'ToolTransfer',
    operation: 'Tool Repurposing',
    operation_description: 'A tool built for Domain A is underutilized. Find a novel application in Domain B.',
    temperature: 0.95,  // More practical
    max_tokens: 1100,
    examples: [
      'Git (software version control) → Design version control (pixel-level diffs, branching, merging)',
      'Pomodoro timer (time-box technique) → Conversation structuring (topic blocks, focus switching)',
      'Fermentation (microbial transformation) → Knowledge synthesis (idea fermentation before publication)'
    ],
    constraints: [
      'The tool must have proven efficacy in Domain A',
      'Domain B must have an analogous problem',
      'The constraints must be mappable (what\'s the "diff" in visual design?)'
    ],
    success_criteria: [
      'The tool solves a genuine pain point in Domain B',
      'Implementation path is clear (not purely theoretical)',
      'Users would recognize this as obvious in hindsight'
    ]
  },

  'AssumptionAudit': {
    mode: 'AssumptionAudit',
    operation: 'Assumption Inversion',
    operation_description: 'What if Domain A\'s core assumption were false in Domain B? What emerges?',
    temperature: 1.0,
    max_tokens: 1100,
    examples: [
      'Assumption: Music needs melody → What if we built music as pure kinetic & harmonic relationships?',
      'Assumption: Code must be deterministic → What if games were deterministic but felt chaotic?',
      'Assumption: Writing must be permanent → What if writing evaporated after being read once?'
    ],
    constraints: [
      'The assumption must be core to Domain A (not peripheral)',
      'Inverting it should feel slightly dangerous or wrong at first',
      'The inverted idea must be buildable (not purely philosophical)'
    ],
    success_criteria: [
      'The assumption is clearly stated',
      'Inverting it produces a novel constraint',
      'The idea is weird but not nonsensical'
    ]
  },

  'AnalogyMine': {
    mode: 'AnalogyMine',
    operation: 'Deep Structural Analogy',
    operation_description: 'Find the deepest structural parallel between domains. Generate an idea at that structural level.',
    temperature: 0.9,  // Needs careful reasoning
    max_tokens: 1200,
    examples: [
      'Predator-prey dynamics (oscillation, feedback loops, equilibrium) ↔ Conversation design (turn-taking, response dynamics, flow)',
      'Evolution (variation, selection, adaptation) ↔ Product design iteration (experiments, user feedback, refinement)',
      'Erosion patterns (water follows least resistance, creates channels, channels deepen) ↔ Organizational culture (decisions follow patterns, patterns reinforce)'
    ],
    constraints: [
      'The analogy must be structural (same dynamics), not superficial',
      'Avoid clichés (evolution, systems thinking are overused)',
      'The structure should be non-obvious'
    ],
    success_criteria: [
      'Reasoning shows 2+ specific structural parallels',
      'The analogy reveals something new about Domain B',
      'Someone working in Domain B might not see this connection'
    ]
  },

  'Compression': {
    mode: 'Compression',
    operation: 'Dimensionality Reduction',
    operation_description: 'Express Domain A using only Domain B\'s 3-4 core principles. What gets lost? What gets clarified?',
    temperature: 0.85,  // More systematic
    max_tokens: 1100,
    examples: [
      'Machine learning (thousands of techniques) → Human learning (pattern recognition, repetition, emotional salience)',
      'Urban planning (infrastructure, zoning, economy, culture) → Product design (form, function, delight)',
      'Jazz music (melody, harmony, rhythm, improvisation) → Business strategy (mission, execution, adaptation, creativity)'
    ],
    constraints: [
      'Choose exactly 3-4 principles; not more',
      'The principles must be orthogonal (non-redundant)',
      'All major ideas in Domain A should map to at least one principle'
    ],
    success_criteria: [
      'The 3-4 principles feel complete (nothing major is missing)',
      'The principles help someone unfamiliar with Domain B understand its core',
      'The compression reveals hidden patterns'
    ]
  },

  'Inversion': {
    mode: 'Inversion',
    operation: 'Constraint Reversal',
    operation_description: 'Invert Domain A\'s core constraints/values. What emerges in Domain B under these inverted constraints?',
    temperature: 1.15,  // Inverted constraints → more exploration
    max_tokens: 1200,
    examples: [
      'Domain A: Fast, cheap, low-quality. Inverted: Slow, expensive, high-quality → Luxury product design with artisanal status',
      'Domain A: Solitary, individual work. Inverted: Mandatory collaboration → What creative work looks like when you can\'t work alone?',
      'Domain A: Maximize scale. Inverted: Minimize scale → Hyper-local solutions, intimate products'
    ],
    constraints: [
      'The inversion must be meaningful (not just multiplying by -1)',
      'Inverted constraints should create tension with Domain B\'s defaults',
      'The result should feel novel, not contradictory'
    ],
    success_criteria: [
      'Reasoning shows how inverted constraints drive novelty',
      'The idea is surprising but coherent',
      'You could pitch this as "What if we did the opposite of [Domain A]?"'
    ]
  }
}

export function getFrontierModeConfig(mode: FrontierMode): FrontierModeConfig {
  return FRONTIER_MODES_CONFIG[mode]
}

export function selectRandomMode(): FrontierMode {
  const modes = Object.keys(FRONTIER_MODES_CONFIG) as FrontierMode[]
  return modes[Math.floor(Math.random() * modes.length)]
}
```

---

## 2. Feedback Summarizer

```typescript
// lib/frontier/feedback-summarizer.ts

export interface RejectionSignal {
  id: string
  idea_id: string
  mode: FrontierMode
  novelty_score: number
  rejection_reason:
    | 'unclear_reasoning'
    | 'too_incremental'
    | 'too_risky'
    | 'no_viable_path'
    | 'domain_too_similar'
    | 'diminishing_returns'
  created_at: Date
}

export interface AcceptanceSignal {
  id: string
  idea_id: string
  mode: FrontierMode
  status: 'sparked' | 'built' | 'shelved'
  user_energy_gain?: number  // -5 to +5
  created_at: Date
}

export class FeedbackSummarizer {
  /**
   * Compress up to 3 weeks of feedback into a prompt-friendly summary.
   * Target: 200-400 tokens.
   */
  summarizeFeedback(
    rejections: RejectionSignal[],
    acceptances: AcceptanceSignal[],
    period_days: number = 21,
    user_goals?: string[]
  ): string {
    const cutoff = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000)
    const recentRejections = rejections.filter(r => new Date(r.created_at) >= cutoff)
    const recentAcceptances = acceptances.filter(a => new Date(a.created_at) >= cutoff)

    // Aggregate by mode
    const rejectionsByMode = recentRejections.reduce((acc, r) => {
      acc[r.mode] = (acc[r.mode] || 0) + 1
      return acc
    }, {} as Record<FrontierMode, number>)

    const acceptancesByMode = recentAcceptances.reduce((acc, a) => {
      acc[a.mode] = (acc[a.mode] || 0) + 1
      return acc
    }, {} as Record<FrontierMode, number>)

    // Rejection reason distribution
    const rejectionReasons = recentRejections.reduce((acc, r) => {
      acc[r.rejection_reason] = (acc[r.rejection_reason] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Best-performing modes (high spark rate)
    const sparkRates = Object.entries(acceptancesByMode).map(([mode, acceptCount]) => ({
      mode,
      accept_count: acceptCount,
      reject_count: rejectionsByMode[mode as FrontierMode] || 0,
      spark_rate: acceptCount / ((rejectionsByMode[mode as FrontierMode] || 0) + acceptCount)
    }))

    const topModes = sparkRates
      .filter(m => m.accept_count + m.reject_count > 0)
      .sort((a, b) => b.spark_rate - a.spark_rate)
      .slice(0, 2)

    // Modes with diminishing returns (too many rejections)
    const problematicModes = sparkRates
      .filter(m => m.reject_count > 3 && m.spark_rate < 0.3)
      .map(m => m.mode)

    // Most common rejection reasons
    const topRejectionReason = Object.entries(rejectionReasons)
      .sort(([, a], [, b]) => b - a)[0]

    const summary = [
      `# FRONTIER FEEDBACK (Last ${period_days} days)`,
      '',
      `Acceptances: ${recentAcceptances.length} total`,
      `  - "Sparked": ${recentAcceptances.filter(a => a.status === 'sparked').length}`,
      `  - "Built": ${recentAcceptances.filter(a => a.status === 'built').length}`,
      recentAcceptances.length > 0 ? `  - Top mode: ${topModes[0]?.mode} (${topModes[0]?.accept_count} sparks)` : '  - No acceptances yet',
      '',
      `Rejections: ${recentRejections.length} total`,
      topRejectionReason ? `  - Most common reason: ${topRejectionReason[0]} (${topRejectionReason[1]}x)` : '  - None',
      problematicModes.length > 0 ? `  - Modes to rest: ${problematicModes.join(', ')}` : '  - Modes balanced',
      '',
      `GUIDANCE:`,
      topModes.length > 0 ? `  - Focus on ${topModes[0]?.mode} mode this week (${(topModes[0]?.spark_rate || 0).toFixed(0)}% spark rate)` : '  - Mix all modes',
      recentRejections.filter(r => r.rejection_reason === 'unclear_reasoning').length > 3 ? `  - Your reasoning clarity is slipping. Spend more time explaining the cognitive bridge.` : '  - Reasoning quality is good.',
      problematicModes.length > 0 ? `  - Rest these modes for 1-2 weeks: ${problematicModes.join(', ')}` : '',
      '',
      user_goals ? `User goals this quarter: ${user_goals.join(', ')}` : ''
    ]
      .filter(Boolean)
      .join('\n')

    return summary.trim()
  }

  /**
   * Detect if the system is in "exploration mode" override.
   * 30% of runs should ignore feedback and explore freely.
   */
  shouldExploreFreely(): boolean {
    return Math.random() < 0.3
  }
}
```

---

## 3. Pre-Filter Scorer

```typescript
// lib/frontier/pre-filter-scorer.ts

export interface IdeaForScoring {
  title: string
  description: string
  reasoning: string
  tractability_estimate: {
    score: number  // 0-10
    reasoning: string
  }
  novelty_category: 'incremental' | 'lateral' | 'paradigm-shifting'
  source_domain: string
  target_domain: string
  mode: FrontierMode
}

export interface PreFilterScore {
  novelty_score: number         // 0-1
  cross_domain_distance: number // 0-1
  tractability_score: number    // 0-1 (inverted: 1.0 = easy, 0.0 = impossible)
  overall_frontier_score: number
  should_reject: boolean
  rejection_reason?: string
  notes: string
}

export class PreFilterScorer {
  /**
   * Score an idea on three dimensions, then decide if it passes frontier validation.
   *
   * Note: This is intended to be called by an LLM (Gemini), not computed algorithmically.
   * The LLM uses the rubric below, then returns structured scores.
   */

  async scoreIdea(
    idea: IdeaForScoring,
    recentRejections: RejectionSignal[] = []
  ): Promise<PreFilterScore> {
    const prompt = this.buildPreFilterPrompt(idea, recentRejections)
    const response = await this.callLLM(prompt)
    const parsed = this.parsePreFilterResponse(response)

    // Override: apply hard rejection criteria
    if (this.shouldHardReject(idea, parsed, recentRejections)) {
      parsed.should_reject = true
      parsed.rejection_reason = parsed.rejection_reason || 'Hard rejection criteria'
    }

    return parsed
  }

  private buildPreFilterPrompt(idea: IdeaForScoring, recentRejections: RejectionSignal[]): string {
    const recentRejectionContext = recentRejections
      .slice(0, 5)
      .map(r => `- ${r.rejection_reason}: ${r.mode}`)
      .join('\n')

    return `You are a frontier idea quality gate.

Your job: Score this idea on three dimensions, then determine if it passes frontier validation.

**SCORING DIMENSIONS:**

## 1. NOVELTY (0-1)
- 0.0-0.3: "I've seen this before" or "Minor tweak"
- 0.4-0.6: "Different framing of familiar territory"
- 0.7-0.9: "Genuinely new angle or combination"
- 1.0: "Completely unprecedented"

SCORING RULES:
- novelty_category is 'incremental'? Cap at 0.5
- novelty_category is 'paradigm-shifting' AND user hasn't rejected similar ideas? Boost to 0.8+
- Reasoning is hand-wavy? Reduce by 0.2

## 2. CROSS-DOMAIN DISTANCE (0-1)
- 0.0-0.2: "Domains tightly related"
- 0.3-0.5: "Domains have some connection"
- 0.6-0.8: "Domains quite distant"
- 0.9-1.0: "Domains seem unrelated at first"

SCORING RULE:
- Higher distance is GOOD (this is frontier work)
- Ask: "Can I explain why these domains are relevant in 1 sentence?" If yes, subtract 0.2

## 3. TRACTABILITY (0-1)
[Inverted scale: 1.0 = easy start this week, 0.0 = requires breakthroughs]
- 0.0-0.3: "Breakthroughs needed; foundational research required"
- 0.4-0.6: "6-12 months; several unknowns; needs exploration"
- 0.7-0.9: "3-6 months; clear MVP path"
- 1.0: "Start this week with existing skills"

SCORING RULES:
- Requires >3 new skills? Subtract 0.2
- Clear MVP path visible? Add 0.1
- Depends on external factors (funding, partnerships)? Cap at 0.6

## 4. FRONTIER VALIDITY (Pass/Fail)
HARD REJECT if:
- Reasoning is hand-wavy (no domain bridge shown)
- novelty 0-0.3 AND tractability <0.7 (low-risk, low-reward)
- cross_domain_distance <0.2 AND novelty <0.5 (too incremental)
- Similar ideas rejected 3+ times in past 2 weeks (diminishing returns)

---

IDEA TO SCORE:

Title: ${idea.title}
Description: ${idea.description}
Reasoning: ${idea.reasoning}
Mode: ${idea.mode}
Source domain: ${idea.source_domain}
Target domain: ${idea.target_domain}
Novelty category: ${idea.novelty_category}
Tractability estimate: ${idea.tractability_estimate.score}/10 (${idea.tractability_estimate.reasoning})

${recentRejectionContext ? `RECENT REJECTION PATTERNS:\n${recentRejectionContext}` : ''}

---

RESPOND WITH VALID JSON:
{
  "novelty_score": 0.72,
  "cross_domain_distance": 0.68,
  "tractability_score": 0.65,
  "overall_frontier_score": 0.68,
  "should_reject": false,
  "rejection_reason": null,
  "notes": "Strong domain bridge. Tractability unclear but plausible."
}
`
  }

  private async callLLM(prompt: string): Promise<string> {
    // TODO: Implement with your LLM provider (Gemini, Claude, etc.)
    // For now, placeholder
    throw new Error('Implement LLM call')
  }

  private parsePreFilterResponse(response: string): PreFilterScore {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')

      const parsed = JSON.parse(jsonMatch[0])

      // Compute overall score if not provided
      if (!parsed.overall_frontier_score) {
        parsed.overall_frontier_score = (
          parsed.novelty_score * 0.35 +
          parsed.cross_domain_distance * 0.30 +
          parsed.tractability_score * 0.35
        )
      }

      return parsed as PreFilterScore
    } catch (e) {
      console.error('Failed to parse pre-filter response', e)
      throw new Error('Pre-filter scoring failed')
    }
  }

  private shouldHardReject(
    idea: IdeaForScoring,
    scores: Partial<PreFilterScore>,
    recentRejections: RejectionSignal[]
  ): boolean {
    // Hand-wavy reasoning check
    if (idea.reasoning.includes('because') && idea.reasoning.split('.').length < 2) {
      return true
    }

    // Low-risk, low-reward
    if ((scores.novelty_score || 0) < 0.3 && (scores.tractability_score || 0) < 0.7) {
      return true
    }

    // Too incremental
    if ((scores.cross_domain_distance || 0) < 0.2 && (scores.novelty_score || 0) < 0.5) {
      return true
    }

    // Diminishing returns
    const similarRejections = recentRejections.filter(r =>
      r.mode === idea.mode &&
      r.rejection_reason === 'diminishing_returns'
    )
    if (similarRejections.length >= 3) {
      return true
    }

    return false
  }
}
```

---

## 4. Frontier Agent Orchestrator

```typescript
// api/frontier/generate-ideas.ts

import { FrontierMode, getFrontierModeConfig, selectRandomMode } from '@/lib/frontier/frontier-modes'
import { FeedbackSummarizer } from '@/lib/frontier/feedback-summarizer'
import { PreFilterScorer } from '@/lib/frontier/pre-filter-scorer'

export interface FrontierGenerationRequest {
  userId: string
  mode?: FrontierMode  // If null, select randomly
  forceExploration?: boolean  // Ignore feedback
  domainA?: string
  domainB?: string
}

export interface FrontierGenerationResult {
  ideas: Array<{
    id: string
    title: string
    description: string
    reasoning: string
    mode: FrontierMode
    source_domain: string
    target_domain: string
    pre_filter_scores: PreFilterScore
    status: 'accepted' | 'rejected'
  }>
  feedback_summary: string
  is_exploration_run: boolean
}

export async function generateFrontierIdeas(
  request: FrontierGenerationRequest
): Promise<FrontierGenerationResult> {
  const { userId, domainA, domainB } = request

  // 1. Load user context and feedback
  const [userContext, recentRejections, recentAcceptances] = await Promise.all([
    loadUserContext(userId),
    loadRecentRejections(userId, 21),
    loadRecentAcceptances(userId, 21)
  ])

  // 2. Summarize feedback
  const summarizer = new FeedbackSummarizer()
  const isExplorationRun = request.forceExploration || summarizer.shouldExploreFreely()
  const feedbackSummary = isExplorationRun
    ? 'EXPLORATION MODE: Generate freely, ignore past feedback.'
    : summarizer.summarizeFeedback(recentRejections, recentAcceptances, 21, userContext.goals)

  // 3. Select frontier mode
  const mode = request.mode || selectRandomMode()
  const modeConfig = getFrontierModeConfig(mode)

  // 4. Generate 3-4 ideas using this mode
  const generatedIdeas = await generateIdeasForMode({
    userId,
    mode,
    modeConfig,
    feedbackSummary: isExplorationRun ? '' : feedbackSummary,
    userContext,
    domainA,
    domainB,
    count: 4
  })

  // 5. Pre-filter each idea
  const scorer = new PreFilterScorer()
  const scoredIdeas = await Promise.all(
    generatedIdeas.map(async (idea) => ({
      ...idea,
      pre_filter_scores: await scorer.scoreIdea(idea, recentRejections)
    }))
  )

  // 6. Partition into accepted/rejected
  const acceptedIdeas = scoredIdeas.filter(i => !i.pre_filter_scores.should_reject)
  const rejectedIdeas = scoredIdeas.filter(i => i.pre_filter_scores.should_reject)

  // 7. Log results
  await logFrontierGeneration(userId, {
    mode,
    generated: generatedIdeas.length,
    accepted: acceptedIdeas.length,
    rejected: rejectedIdeas.length,
    is_exploration: isExplorationRun
  })

  return {
    ideas: scoredIdeas.map(idea => ({
      id: generateId(),
      title: idea.title,
      description: idea.description,
      reasoning: idea.reasoning,
      mode: idea.mode,
      source_domain: idea.source_domain,
      target_domain: idea.target_domain,
      pre_filter_scores: idea.pre_filter_scores,
      status: idea.pre_filter_scores.should_reject ? 'rejected' : 'accepted'
    })),
    feedback_summary: feedbackSummary,
    is_exploration_run: isExplorationRun
  }
}

async function generateIdeasForMode(params: {
  userId: string
  mode: FrontierMode
  modeConfig: FrontierModeConfig
  feedbackSummary: string
  userContext: any
  domainA?: string
  domainB?: string
  count: number
}): Promise<any[]> {
  const modeConfig = params.modeConfig

  const prompt = `
You are a frontier-crossing idea engineer specializing in the ${params.mode} mode.

**MODE: ${params.mode}**
**Operation: ${modeConfig.operation}**
**${modeConfig.operation_description}**

**EXAMPLES OF THIS MODE:**
${modeConfig.examples.map(e => `- ${e}`).join('\n')}

**CONSTRAINTS:**
${modeConfig.constraints.map(c => `- ${c}`).join('\n')}

**SUCCESS CRITERIA:**
${modeConfig.success_criteria.map(s => `- ${s}`).join('\n')}

${params.feedbackSummary ? `\n**FEEDBACK FROM PREVIOUS RUNS:**\n${params.feedbackSummary}` : ''}

**USER CONTEXT:**
- Capabilities: ${params.userContext.capabilities.slice(0, 5).join(', ')}
- Recent interests: ${params.userContext.interests.slice(0, 5).join(', ')}
- Goals: ${params.userContext.goals.join(', ') || 'Open-ended exploration'}

${params.domainA && params.domainB ? `
**DOMAIN ASSIGNMENT:**
- Source domain (Domain A): ${params.domainA}
- Target domain (Domain B): ${params.domainB}
` : `
**DOMAIN ASSIGNMENT:**
Choose two domains for this run. Prefer combinations you haven't tried before.
`}

**TASK:**
Generate ${params.count} ideas using this frontier mode. For each:
1. Clearly state the cognitive operation (the bridge)
2. Show why this specific domain pair matters
3. Estimate tractability (1-10 scale with reasoning)
4. Note novelty category: incremental, lateral, or paradigm-shifting

**OUTPUT:**
Return a JSON array (no markdown, just raw JSON):
[
  {
    "title": "Short, memorable name",
    "description": "One sentence: what problem or opportunity?",
    "reasoning": "How does ${params.domainA} apply to ${params.domainB}? Show the bridge.",
    "source_domain": "...",
    "target_domain": "...",
    "mode": "${params.mode}",
    "tractability_estimate": {
      "score": 7,
      "reasoning": "Why this score? What's the MVP?"
    },
    "novelty_category": "lateral"
  }
]
`

  // Call LLM with appropriate temperature
  const response = await callLLM(prompt, {
    temperature: params.modeConfig.temperature,
    max_tokens: params.modeConfig.max_tokens
  })

  // Parse and validate
  const ideas = parseIdeasFromResponse(response)
  return ideas
}

function parseIdeasFromResponse(response: string): any[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Failed to parse ideas', e)
    return []
  }
}

async function callLLM(prompt: string, options: { temperature: number; max_tokens: number }): Promise<string> {
  // TODO: Implement with your LLM provider
  throw new Error('Implement LLM call')
}

async function loadUserContext(userId: string): Promise<any> {
  // TODO: Load from database
  throw new Error('Implement')
}

async function loadRecentRejections(userId: string, days: number): Promise<RejectionSignal[]> {
  // TODO: Load from database
  throw new Error('Implement')
}

async function loadRecentAcceptances(userId: string, days: number): Promise<AcceptanceSignal[]> {
  // TODO: Load from database
  throw new Error('Implement')
}

async function logFrontierGeneration(userId: string, data: any): Promise<void> {
  // TODO: Log to analytics/database
}

function generateId(): string {
  return `idea_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}
```

---

## 5. Integration with Existing Polymath Systems

```typescript
// api/frontier-synthesis.ts
// Endpoint: POST /api/frontier/generate

import { NextApiRequest, NextApiResponse } from 'next'
import { generateFrontierIdeas } from './frontier/generate-ideas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, mode, forceExploration } = req.body

  try {
    const result = await generateFrontierIdeas({
      userId,
      mode,
      forceExploration
    })

    // Store ideas in Supabase
    const { data, error } = await supabase
      .from('project_suggestions')
      .insert(result.ideas.map(idea => ({
        user_id: userId,
        title: idea.title,
        description: idea.description,
        reasoning: idea.reasoning,
        novelty_score: idea.pre_filter_scores.novelty_score,
        feasibility_score: idea.pre_filter_scores.tractability_score,
        interest_score: 0.5,  // Placeholder
        mode: idea.mode,
        frontier_mode: true
      })))

    if (error) throw error

    return res.status(200).json({
      success: true,
      ideas: result.ideas,
      feedback_summary: result.feedback_summary,
      is_exploration_run: result.is_exploration_run
    })
  } catch (error) {
    console.error('Frontier generation failed:', error)
    return res.status(500).json({ error: 'Generation failed' })
  }
}
```

---

## 6. Database Schema Additions

```sql
-- Add to existing Polymath schema

-- Rejection signals
CREATE TABLE frontier_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  idea_id UUID REFERENCES project_suggestions,
  mode TEXT NOT NULL,
  novelty_score FLOAT NOT NULL,
  rejection_reason TEXT NOT NULL CHECK (rejection_reason IN (
    'unclear_reasoning',
    'too_incremental',
    'too_risky',
    'no_viable_path',
    'domain_too_similar',
    'diminishing_returns'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Acceptance signals
CREATE TABLE frontier_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  idea_id UUID REFERENCES project_suggestions,
  mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sparked', 'built', 'shelved')),
  user_energy_gain INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Frontier generation logs
CREATE TABLE frontier_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  mode TEXT NOT NULL,
  generated_count INT NOT NULL,
  accepted_count INT NOT NULL,
  rejected_count INT NOT NULL,
  is_exploration_run BOOLEAN DEFAULT false,
  feedback_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to project_suggestions
ALTER TABLE project_suggestions ADD COLUMN frontier_mode BOOLEAN DEFAULT false;
ALTER TABLE project_suggestions ADD COLUMN source_domain TEXT;
ALTER TABLE project_suggestions ADD COLUMN target_domain TEXT;
ALTER TABLE project_suggestions ADD COLUMN cross_domain_distance FLOAT;
```

---

## 7. Weekly Opus Review Scheduler

```typescript
// api/cron/weekly-opus-review.ts

import { CronRequest, CronResponse } from '@vercel/functions'
import { supabase } from '@/lib/frontier/supabase'
import { OpusReviewer } from '@/lib/frontier/opus-reviewer'

export default async function handler(req: CronRequest): Promise<CronResponse> {
  // Run once per week (Monday morning)
  const now = new Date()
  if (now.getDay() !== 1) {
    return new Response('Not Monday, skipping', { status: 200 })
  }

  // Load all ideas from past week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const { data: ideas, error } = await supabase
    .from('project_suggestions')
    .select('*')
    .eq('frontier_mode', true)
    .gte('created_at', weekAgo.toISOString())

  if (error) {
    console.error('Failed to load ideas for Opus review', error)
    return new Response('Error', { status: 500 })
  }

  // Group by user
  const ideasByUser = ideas.reduce((acc, idea) => {
    if (!acc[idea.user_id]) acc[idea.user_id] = []
    acc[idea.user_id].push(idea)
    return acc
  }, {} as Record<string, any[]>)

  // Run Opus review for each user
  const reviewer = new OpusReviewer()
  for (const [userId, userIdeas] of Object.entries(ideasByUser)) {
    try {
      await reviewer.reviewIdeas(userId, userIdeas)
    } catch (e) {
      console.error(`Opus review failed for user ${userId}`, e)
    }
  }

  return new Response('Weekly Opus review complete', { status: 200 })
}
```

---

## Integration Checklist

- [ ] Create frontier modes config file
- [ ] Implement FeedbackSummarizer
- [ ] Implement PreFilterScorer with LLM integration
- [ ] Create frontier agent orchestrator
- [ ] Add API endpoint for idea generation
- [ ] Migrate database schema
- [ ] Wire up weekly Opus review scheduler
- [ ] Build UI components for idea display
- [ ] Add rejection/acceptance tracking to UI
- [ ] Implement mode collapse detection
- [ ] Set up analytics dashboard for frontier metrics
- [ ] Create onboarding flow showing seed examples

