# Frontier Modes Prompt Design Strategy: Gaps & Recommendations

## System Overview
You're building an evolutionary idea generation system with 6 frontier modes that force specific cognitive operations across domains. Each mode generates structured JSON (title, description, reasoning, tractability_estimate), pre-filters by novelty/distance/tractability, and feeds back into agent prompts via rejection history.

This is a **sophisticated system** but has several critical gaps in prompt architecture, feedback injection, and reliability patterns.

---

## Core Findings

### 1. Frontier Mode Prompts: No Unified Template Exists

**Gap:** Each mode's prompt should follow a consistent structure but force different *operations*. Currently undefined.

**Recommendation:**

Create a base template with mode-specific injections:

```typescript
// FRONTIER_PROMPT_TEMPLATE.ts

interface FrontierModeConfig {
  mode: 'Translate' | 'ToolTransfer' | 'AssumptionAudit' | 'AnalogyMine' | 'Compression' | 'Inversion'
  operation: string  // The cognitive operation this mode forces
  domainA: string    // First domain
  domainB: string    // Second domain (target)
  constraint: string // Mode-specific constraint
  examples: string[] // 2-3 concrete examples showing the operation
}

const FRONTIER_MODES: Record<string, FrontierModeConfig> = {
  'Translate': {
    operation: 'Metaphorical Transfer',
    constraint: 'Take a concept from Domain A and express its core logic using Domain B\'s vocabulary',
    examples: [
      'Mycelium networks (biology) → Distributed systems architecture',
      'Jazz improvisation (music) → Rapid prototyping workflows'
    ]
  },
  'ToolTransfer': {
    operation: 'Tool Repurposing',
    constraint: 'Take a tool built for Domain A and find a novel application in Domain B',
    examples: [
      'Masking tape (manufacturing) → Animation storyboarding technique',
      'Git workflows (software) → Visual design version control'
    ]
  },
  'AssumptionAudit': {
    operation: 'Assumption Inversion',
    constraint: 'Identify the core assumption that defines Domain A. What if it were false in Domain B?',
    examples: [
      'Assumption: Music needs melody. Applied to: UI design → Designing purely kinetic, melodic interaction flows',
      'Assumption: Code must be deterministic. Applied to: Game design → Exploring intentional chaos mechanics'
    ]
  },
  'AnalogyMine': {
    operation: 'Deep Structural Analogy',
    constraint: 'Find the deepest structural parallel between Domain A and Domain B, then generate an idea at that level',
    examples: [
      'Feedback loops in ecology ↔ Feedback loops in conversation design',
      'Predator-prey dynamics ↔ Market competition dynamics'
    ]
  },
  'Compression': {
    operation: 'Dimensionality Reduction',
    constraint: 'What if you had to express Domain A\'s innovation using only Domain B\'s 3 core principles?',
    examples: [
      'Machine learning (thousands of features) → Human learning (pattern, repetition, emotion)',
      'Urban planning (infrastructure, zoning, economy) → Product design (form, function, delight)'
    ]
  },
  'Inversion': {
    operation: 'Constraint Reversal',
    constraint: 'What if Domain B had the opposite constraints/resources/values of Domain A?',
    examples: [
      'Domain A: Cheap + fast + (low quality). Domain B: Expensive + slow + high quality → What emerges?',
      'Domain A: Solitary work. Domain B: Mandatory collaboration → What idea emerges?'
    ]
  }
}

// The actual prompt template:
const FRONTIER_PROMPT_BASE = `You are an idea engineer operating in frontier-crossing mode.

Your task: Generate an actionable project idea by forcing a specific cognitive operation between two domains.

**FRONTIER MODE: {mode}**
**OPERATION: {operation}**
**CONSTRAINT: {constraint}**

**DOMAIN A (Source):** {domainA}
**DOMAIN B (Target):** {domainB}

**WORKED EXAMPLES:**
{examples}

**YOUR TASK:**
1. **Apply the operation** to generate a novel idea that bridges {domainA} and {domainB}
2. **Explain the bridge** in your reasoning (show the cognitive leap)
3. **Estimate tractability** (1-10 scale, with reasoning)
4. **Flag novelty category**: Is this "incremental", "lateral", or "paradigm-shifting"?

**OUTPUT FORMAT:**
{
  "title": "Pithy, memorable name (5-8 words)",
  "description": "One sentence value prop. What problem does this solve or what does it unlock?",
  "reasoning": "The cognitive bridge. How does {domainA}'s {operation} apply to {domainB}? Be specific.",
  "tractability_estimate": {
    "score": 7,
    "reasoning": "Why this score? List 2-3 key dependencies or blockers."
  },
  "novelty_category": "lateral",
  "cross_domain_distance": 0.73,  // User fills this (0-1, where 1 = completely unrelated domains)
  "source_domain_concepts": ["concept1", "concept2"],
  "target_domain_concepts": ["concept3", "concept4"]
}

**QUALITY GATES:**
- If the idea relies on hand-waving (no concrete bridge), reject it internally and regenerate
- If the reasoning doesn't show clear domain transfer, reject it
- Aim for ideas that are surprising but not impossible
`
```

**When to use each mode:**
- **Translate**: When you have a successful pattern in one domain and want to express it fresh
- **ToolTransfer**: When you have a powerful tool that's being underutilized
- **AssumptionAudit**: When you're stuck (assumptions are often invisible until inverted)
- **AnalogyMine**: When you need structural insight (analogies reveal deep logic)
- **Compression**: When you're overwhelmed by complexity (forces clarity)
- **Inversion**: When you want radical alternatives (inverting constraints sparks novelty)

---

### 2. Feedback Injection: Context Bloat Risk

**Gap:** How do you feed last 3 weeks of rejections + acceptances into agent prompts without:
- Exploding token count?
- Creating recency bias?
- Introducing conflicting signals?

**Current system (bedtime-ideas.ts):**
```typescript
// Line 159: Breakthrough context injected into prompt
const breakthroughContext = breakthroughs && breakthroughs.length > 0
  ? `\n\nPREVIOUS BREAKTHROUGHS (prompts that led to insights):\n${breakthroughs.map(b => ...)}`
  : ''
```

This is ad-hoc. Here's a better pattern:

```typescript
// FEEDBACK_INJECTOR.ts

interface RejectionSignal {
  idea_id: string
  mode: string
  novelty_score: number
  rejection_reason: 'too_incremental' | 'too_risky' | 'no_viable_path' | 'domain_too_similar' | 'unclear_reasoning'
  timestamp: Date
}

interface AcceptanceSignal {
  idea_id: string
  mode: string
  status: 'built' | 'sparked' | 'shelved'
  user_energy_gain: number // -5 to +5 scale
  timestamp: Date
}

class FeedbackSummarizer {
  /**
   * Compress 3 weeks of feedback into a prompt-friendly summary.
   * Goal: 200-300 tokens max.
   */
  summarizeFeedback(
    rejections: RejectionSignal[],
    acceptances: AcceptanceSignal[],
    period_days: number = 21
  ): string {
    // Group by mode
    const rejectionsByMode = rejections.reduce((acc, r) => {
      acc[r.mode] = (acc[r.mode] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const acceptancesByMode = acceptances.reduce((acc, a) => {
      acc[a.mode] = (acc[a.mode] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Rejection reason distribution
    const rejectionReasons = rejections.reduce((acc, r) => {
      acc[r.rejection_reason] = (acc[r.rejection_reason] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Top-accepted modes (by status='sparked' count)
    const topSparkedModes = Object.entries(acceptancesByMode)
      .filter(([mode]) => rejections.filter(r => r.mode === mode && r.rejection_reason === 'no_viable_path').length < 3)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)

    // Modes with high rejection rate (avoid overuse)
    const problematicModes = Object.entries(rejectionsByMode)
      .filter(([mode]) => {
        const modeRejectRate = rejectionsByMode[mode] / (rejectionsByMode[mode] + (acceptancesByMode[mode] || 0))
        return modeRejectRate > 0.7
      })
      .map(([mode]) => mode)

    return `
# FEEDBACK SUMMARY (Last ${period_days} days)

**Acceptances:** ${acceptances.length} total
- "Sparked" (high energy): ${acceptances.filter(a => a.status === 'sparked').length}
- "Built": ${acceptances.filter(a => a.status === 'built').length}
- Top modes: ${topSparkedModes.map(([m, c]) => `${m} (${c})`).join(', ') || 'None yet'}

**Rejections:** ${rejections.length} total
- Most common reason: ${Object.entries(rejectionReasons).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
- Modes to avoid overusing: ${problematicModes.join(', ') || 'None'}

**Guidance:**
- ${topSparkedModes.length > 0 ? `Focus on ${topSparkedModes[0][0]} mode this week` : 'Mix all modes'}
- ${problematicModes.includes('AnalogyMine') ? 'Your analogy mining is hitting diminishing returns. Try Compression instead.' : 'Analogies are working well.'}
- ${rejections.filter(r => r.rejection_reason === 'unclear_reasoning').length > 5 ? 'Your reasoning is unclear. Spend more time explaining the cognitive bridge.' : ''}
`.trim()
  }
}

// Usage in frontier agent:
const summarizer = new FeedbackSummarizer()
const feedbackSummary = summarizer.summarizeFeedback(lastRejections, lastAcceptances)

const agentPrompt = `
${FRONTIER_PROMPT_BASE}

${feedbackSummary}

${Math.random() < 0.3 ? 'EXPLORE MODE: Ignore the feedback above and try something completely different.' : ''}
`
```

**Key principles:**
1. **Compress, don't expand**: Use summaries, not raw data
2. **Signal hierarchy**: Show what worked, not everything
3. **Escape valve**: 30% of runs ignore feedback (you already have this!)
4. **Reason explicitly**: Not just "mode X works" but *why* it works

---

### 3. Pre-Filter Prompt: Needs Explicit Rubric

**Gap:** No documented scoring rubric. How do you score novelty, cross-domain distance, tractability?

**Recommendation:**

```typescript
// PRE_FILTER_SCORER.ts

interface PreFilterInput {
  idea: {
    title: string
    description: string
    reasoning: string
    tractability_estimate: { score: number, reasoning: string }
    novelty_category: 'incremental' | 'lateral' | 'paradigm-shifting'
    source_domain: string
    target_domain: string
  }
  userContext: {
    user_id: string
    recent_projects: Array<{ title: string, domain: string }>
    past_rejections: Array<{ reason: string, mode: string }>
  }
}

interface PreFilterScore {
  novelty_score: number         // 0-1: How new is this idea?
  cross_domain_distance: number // 0-1: How far apart are the domains?
  tractability_score: number    // 0-1: Can this be built in <3 months?
  overall_frontier_score: number // Weighted combination
  should_reject_reason?: string // If flagged for rejection
}

const PRE_FILTER_PROMPT = `You are a quality gate for frontier-mode ideas.

Your job: Score ideas on three dimensions, then decide if they pass the frontier test.

**SCORING DIMENSIONS:**

1. **Novelty (0-1)**
   - 0.0-0.3: "I've seen this before" or "Minor tweak of existing work"
   - 0.4-0.6: "Different framing of familiar territory"
   - 0.7-0.9: "Genuinely new angle or combination"
   - 1.0: "Completely unprecedented"

   SCORING RULES:
   - If idea is in the user's past rejection list (similar title/reasoning), cap at 0.3
   - If novelty_category is 'incremental', cap at 0.5
   - If novelty_category is 'paradigm-shifting' AND user hasn't rejected similar ideas, boost to 0.8+

2. **Cross-Domain Distance (0-1)**
   - 0.0-0.2: "Domains are tightly related (UI design + interaction design)"
   - 0.3-0.5: "Domains have some connection (music + psychology)"
   - 0.6-0.8: "Domains are quite distant (marine biology + software)"
   - 0.9-1.0: "Domains seem unrelated at first (poetry + manufacturing)"

   SCORING RULES:
   - Ask yourself: "Can I explain why these domains are relevant to each other in 1 sentence?"
   - If yes, subtract 0.2 from your initial estimate
   - If the reasoning requires multiple leaps, this is good (high score)

3. **Tractability (0-1)**
   - 0.0-0.3: "Requires breakthroughs in foundational research"
   - 0.4-0.6: "Possible, but several unknowns; 6-12 month project"
   - 0.7-0.9: "Achievable in 3-6 months with effort"
   - 1.0: "Can start this week with existing skills"

   SCORING RULES:
   - If idea requires >3 new skills the user hasn't mentioned, subtract 0.2
   - If idea depends on external factors (funding, partnerships), cap at 0.6
   - If reasoning shows a clear MVP path, add 0.1

4. **Frontier Validity (0-1): Does this pass the frontier test?**
   - This is a REJECTION gate, not a score
   - REJECT if:
     * Reasoning is hand-wavy ("This would be cool because...") without showing the domain bridge
     * Novelty is 0-0.3 AND tractability is <0.7 (low-risk, low-reward)
     * Cross-domain distance is <0.2 AND novelty is <0.5 (too incremental)
     * User has rejected 3+ similar ideas in past 2 weeks (diminishing returns)

**OUTPUT:**
{
  "novelty_score": 0.72,
  "cross_domain_distance": 0.68,
  "tractability_score": 0.65,
  "overall_frontier_score": 0.68,
  "should_reject": false,
  "rejection_reason": null,
  "notes": "Strong domain bridge with playful reasoning. Tractability unclear but plausible."
}

---

IDEA TO EVALUATE:

${JSON.stringify(input.idea, null, 2)}

USER CONTEXT:
- Recent projects: ${input.userContext.recent_projects.map(p => p.title).join(', ')}
- Past rejections by reason: ${JSON.stringify(input.userContext.past_rejections.reduce((acc, r) => {
  acc[r.reason] = (acc[r.reason] || 0) + 1
  return acc
}, {} as Record<string, number>))}
`
```

**Rubric scoring algorithm:**

```typescript
class PreFilterScorer {
  async scoreIdea(input: PreFilterInput): Promise<PreFilterScore> {
    const response = await callLLM(PRE_FILTER_PROMPT, input)
    const parsed = JSON.parse(response)

    // Weighted combination for overall score
    parsed.overall_frontier_score = (
      parsed.novelty_score * 0.35 +
      parsed.cross_domain_distance * 0.30 +  // Distance is a feature, not a bug
      parsed.tractability_score * 0.35
    )

    return parsed
  }
}
```

**Key insight:** Don't score cross-domain distance as "good/bad". Distance is a *feature* in frontier modes. A high distance + high novelty + reasonable tractability = ideal frontier idea.

---

### 4. Opus Review Prompt: Batch vs. Sequential

**Gap:** Should Opus review ideas in batches (context-efficient) or sequentially (more nuance)?

**Recommendation: Batch reviews, but with structure**

```typescript
// OPUS_REVIEWER.ts

interface OpusReviewBatch {
  week_number: number
  ideas: Array<{
    id: string
    title: string
    description: string
    reasoning: string
    mode: string
    pre_filter_scores: PreFilterScore
    novelty_category: string
  }>
  user_context: {
    capabilities: string[]
    goals_this_quarter: string[]
    energy_patterns: string
  }
}

const OPUS_REVIEW_PROMPT = `You are Opus, the senior strategist reviewing a week of frontier-mode ideas.

Your job is NOT to be harsh. Your job is to spot which ideas are genuinely catalytic vs. which ones are clever but dead-end.

**THE RUBRIC:**

For each idea, return a structured verdict:

1. **Verdict**: "BUILD", "SPARK", or "REJECT"
   - BUILD: This is a real project worth starting. User should do this.
   - SPARK: This is a catalyst idea. It might not be buildable directly, but it sparks something. Worth sharing/discussing.
   - REJECT: Clever framing but no there-there. Don't return it.

2. **Reasoning**: 1-2 sentences explaining why.

3. **If SPARK**: What does this spark? (frame it as a follow-up question for the user)

4. **If REJECT**: Specific reason (pick one):
   - "Reasoning doesn't hold up under scrutiny"
   - "Too incremental for the domain distance invested"
   - "Requires a breakthrough we don't have"
   - "Similar to 3+ rejected ideas; diminishing returns"
   - "Clever but lacks a core insight"

**CONSTRAINTS:**
- Assume ideas are pre-filtered. You're not re-scoring, you're evaluating strategic fit.
- Weight towards the user's goals this quarter heavily.
- "Build" verdicts should be rare (1-2 per week max). Most ideas should be SPARK or REJECT.

**USER CONTEXT:**
Capabilities: ${input.user_context.capabilities.join(', ')}
Goals this quarter: ${input.user_context.goals_this_quarter.join(', ')}
Energy patterns: ${input.user_context.energy_patterns}

**IDEAS TO REVIEW:**

${input.ideas.map((idea, i) => `
[${i+1}] ${idea.title}
Mode: ${idea.mode}
Description: ${idea.description}
Reasoning: ${idea.reasoning}
Pre-filter scores: Novelty ${idea.pre_filter_scores.novelty_score.toFixed(2)}, Distance ${idea.pre_filter_scores.cross_domain_distance.toFixed(2)}, Tractability ${idea.pre_filter_scores.tractability_score.toFixed(2)}
`).join('\n')}

**OUTPUT:**
Return a JSON array:
[
  {
    "idea_id": "...",
    "verdict": "BUILD",
    "reasoning": "...",
    "follow_up_question": null,
    "rejection_reason": null
  }
]
`

async function runOpusReview(batch: OpusReviewBatch): Promise<OpusVerdict[]> {
  const response = await callClaude(OPUS_REVIEW_PROMPT, batch, model='claude-opus')
  return JSON.parse(response)
}
```

**Batch strategy:**
- Reviews happen **once per week** (not after every idea)
- Ideas that don't make it into Opus review sit in a "pending" state
- This reduces API calls and gives ideas time to "breathe"

---

### 5. Cold Start: Week 1 Seed Examples

**Gap:** What seed examples prevent mode collapse and give agents something to anchor on?

**Recommendation:**

Create a curated seed set covering all 6 modes + 3 quality levels:

```typescript
// FRONTIER_SEEDS.ts

interface SeedIdea {
  title: string
  description: string
  reasoning: string
  mode: 'Translate' | 'ToolTransfer' | 'AssumptionAudit' | 'AnalogyMine' | 'Compression' | 'Inversion'
  domain_a: string
  domain_b: string
  quality: 'exemplar' | 'solid' | 'rough'  // Shows range of acceptable ideas
  novelty_score: number
  tractability_score: number
}

const FRONTIER_SEEDS: SeedIdea[] = [
  // TRANSLATE examples
  {
    title: 'Mycelium Project Planning',
    description: 'A project management system modeled after how fungal networks grow: decentralized nodes, no central planning, emergence through local decisions',
    reasoning: 'Biology→PM: Mycelial networks have no central authority yet coordinate globally. PM assumes central planning is necessary. What if we design projects where coordination emerges from local decisions?',
    mode: 'Translate',
    domain_a: 'Mycology / Fungal Networks',
    domain_b: 'Project Management',
    quality: 'exemplar',
    novelty_score: 0.81,
    tractability_score: 0.72
  },
  {
    title: 'Jazz Improv as Rapid Prototyping',
    description: 'Rapid prototyping framework where a small team explores a design space in real-time, responding to emergent constraints like jazz musicians respond to harmonic changes',
    reasoning: 'Music→Design: Jazz improvisation is structured exploration under real-time constraints. Design teams do this too, but without jazz\'s formality and listening discipline. The constraint-response loop is identical.',
    mode: 'Translate',
    domain_a: 'Jazz Music',
    domain_b: 'Product Design',
    quality: 'solid',
    novelty_score: 0.65,
    tractability_score: 0.78
  },
  {
    title: 'Synesthesia-Inspired Data Viz',
    description: 'Data visualization where numbers evoke colors and shapes based on user-personalized synesthetic mappings',
    reasoning: 'Neurology→Viz: People with synesthesia see 7 as indigo. What if we asked each user what color their data is, then built viz around their intuitive mapping?',
    mode: 'Translate',
    domain_a: 'Synesthesia (Neurology)',
    domain_b: 'Data Visualization',
    quality: 'rough',
    novelty_score: 0.58,
    tractability_score: 0.55
  },

  // TOOL TRANSFER examples
  {
    title: 'Git Workflows for Visual Design Versioning',
    description: 'A visual design version control system using Git metaphors: branches for design experiments, diffs showing pixel-level changes, merges via design constraints',
    reasoning: 'Software→Design: Designers waste time managing versions manually. Git solves this for code. The constraints are different (code is text, design is visual) but the versioning problem is isomorphic.',
    mode: 'ToolTransfer',
    domain_a: 'Software Version Control (Git)',
    domain_b: 'Visual Design',
    quality: 'exemplar',
    novelty_score: 0.73,
    tractability_score: 0.81
  },
  {
    title: 'Pomodoro Timer for Deep Conversations',
    description: 'Structured conversation framework where topic shifts happen in 25-min blocks. Each block explores one facet deeply before moving to the next',
    reasoning: 'Productivity→Relationships: Pomodoro is a time-box constraint that creates focus. Most conversations meander. What if we applied Pomodoro\'s structure to relationship conversations?',
    mode: 'ToolTransfer',
    domain_a: 'Pomodoro Technique',
    domain_b: 'Relationship Communication',
    quality: 'solid',
    novelty_score: 0.52,
    tractability_score: 0.88
  },

  // ASSUMPTION AUDIT examples
  {
    title: 'Music Without Melody: Kinetic Composition',
    description: 'A musical instrument interface where composition is built entirely through movement and spatial gesture, no melodic line required',
    reasoning: 'Assumption: Music requires melody. Inverted: What if we built music as pure kinetic and harmonic relationships, using the body as the primary composer?',
    mode: 'AssumptionAudit',
    domain_a: 'Music Theory',
    domain_b: 'Physical Interaction / Dance',
    quality: 'exemplar',
    novelty_score: 0.89,
    tractability_score: 0.48
  },
  {
    title: 'Deterministic Chaos Games',
    description: 'Video games where player actions are deterministic but create emergent, unpredictable outcomes. Every action has a rule-based consequence, but the chains of consequence are chaotic',
    reasoning: 'Assumption: Code must be deterministic. Inverted: What if we *intentionally* created deterministic systems that feel chaotic and unpredictable to the player?',
    mode: 'AssumptionAudit',
    domain_a: 'Software Engineering',
    domain_b: 'Game Design',
    quality: 'solid',
    novelty_score: 0.71,
    tractability_score: 0.64
  },

  // ANALOGY MINE examples
  {
    title: 'Ecological Feedback Loops in Conversation Design',
    description: 'A chatbot design pattern where user and AI maintain predator-prey dynamics: user inputs trigger AI outputs, which constrain future user inputs, creating a natural oscillation',
    reasoning: 'Structure analogy: Predator-prey feedback loops drive ecosystem stability. Conversations also oscillate between topics/speakers. Same structure, different domain.',
    mode: 'AnalogyMine',
    domain_a: 'Ecology / Population Dynamics',
    domain_b: 'Conversational AI Design',
    quality: 'exemplar',
    novelty_score: 0.76,
    tractability_score: 0.69
  },

  // COMPRESSION examples
  {
    title: '3-Principle Machine Learning',
    description: 'Teaching ML concepts through three universal principles: pattern recognition, repetition, and emotional salience. All other ML ideas are derived from these 3',
    reasoning: 'Compression: ML has thousands of techniques. Humans learn through three: pattern (I see it), repetition (I practice it), emotion (I care about it). Compressed.',
    mode: 'Compression',
    domain_a: 'Machine Learning',
    domain_b: 'Human Learning',
    quality: 'exemplar',
    novelty_score: 0.64,
    tractability_score: 0.85
  },

  // INVERSION examples
  {
    title: 'Expensive Analog Prototyping as Status',
    description: 'A product design studio that uses only hand-crafted, expensive, slow materials. The constraint creates status and perceived quality',
    reasoning: 'Inversion: Cheap, fast, low-quality is the default. Invert: Expensive, slow, high-quality. What emerges? Artisanal status, perceived luxury, intentionality.',
    mode: 'Inversion',
    domain_a: 'Mass Manufacturing (fast/cheap/low-qual)',
    domain_b: 'Luxury Product Design',
    quality: 'exemplar',
    novelty_score: 0.68,
    tractability_score: 0.82
  }
]

// Use these in week 1:
// 1. Show them in onboarding so users see the range
// 2. Include them in few-shot examples for agent prompts
// 3. Track which ones resonated (spark/build rates per example)
// 4. After week 2, replace low-resonance seeds with user-generated high-resonance ideas
```

---

### 6. Mode Collapse Prevention

**Gap:** How do you prevent all ideas from starting to sound the same after a few weeks?

**Recommendation: Multi-strategy approach**

```typescript
// MODE_DIVERSITY_GUARD.ts

class ModeCollapsePredictor {
  /**
   * After each week, measure if modes are converging.
   */
  async detectModeCollapse(
    ideas: Array<{ mode: string, novelty_score: number, tractability_score: number }>,
    windowWeeks: number = 3
  ): Promise<{ is_collapsing: boolean, recommendations: string[] }> {

    // Distribution of modes
    const modeCounts = ideas.reduce((acc, idea) => {
      acc[idea.mode] = (acc[idea.mode] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const modeDistribution = Object.values(modeCounts)
    const entropy = -modeDistribution.reduce((sum, count) => {
      const p = count / ideas.length
      return sum + (p > 0 ? p * Math.log2(p) : 0)
    }, 0)

    const maxEntropy = Math.log2(6) // 6 modes
    const normalizedEntropy = entropy / maxEntropy // 0 to 1

    // If entropy < 0.6, modes are concentrating
    const isCollapsing = normalizedEntropy < 0.6

    // Novelty/tractability clustering (are all ideas in one region?)
    const avgNovelty = ideas.reduce((sum, i) => sum + i.novelty_score, 0) / ideas.length
    const noveltyVariance = ideas.reduce((sum, i) => sum + Math.pow(i.novelty_score - avgNovelty, 2), 0) / ideas.length
    const noveltyStdDev = Math.sqrt(noveltyVariance)

    const recommendations: string[] = []

    if (isCollapsing) {
      const underrepresentedModes = Object.entries(modeCounts)
        .filter(([, count]) => count < ideas.length / 6 * 0.5)
        .map(([mode]) => mode)

      recommendations.push(`Push harder on these underused modes: ${underrepresentedModes.join(', ')}`)
    }

    if (noveltyStdDev < 0.15) {
      recommendations.push('Novelty scores are too clustered. Force some "paradigm-shifting" experiments (target 0.85+)')
    }

    // Suggest random mode injection
    if (isCollapsing) {
      const randomMode = ['Translate', 'ToolTransfer', 'AssumptionAudit', 'AnalogyMine', 'Compression', 'Inversion'][Math.floor(Math.random() * 6)]
      recommendations.push(`Next run: Force mode=${randomMode} to break the pattern`)
    }

    return { is_collapsing: isCollapsing, recommendations }
  }
}

// Weekly check:
const collapse = await modeCollapsePredictor.detectModeCollapse(weeklyIdeas)
if (collapse.is_collapsing) {
  console.warn('MODE COLLAPSE DETECTED', collapse.recommendations)
  // Force next 3 runs to use underrepresented modes
}
```

**Additional safeguards:**

1. **Enforced mode rotation**: Each week, ensure at least 1 idea per mode
2. **Novelty floor**: If all ideas are novelty < 0.5, reject the batch and regenerate
3. **Seed injection**: Every 10 runs, replace a random idea with a seed idea as a "contrast"
4. **Domain freshness**: Track which domain pairs have been used. Prefer novel domain pairings

---

### 7. Tractability Calibration

**Gap:** How do tractability_estimate scores stay calibrated over time?

**Recommendation: Outcome-based recalibration**

```typescript
// TRACTABILITY_CALIBRATOR.ts

interface TractabilityOutcome {
  idea_id: string
  estimated_tractability: number  // Original 0-1 estimate
  actual_outcome: 'completed' | 'in_progress' | 'abandoned' | 'deprioritized'
  time_to_complete?: number  // Weeks
  blockers?: string[]
}

class TractabilityCalibrator {
  /**
   * After ideas are built (or abandoned), measure prediction accuracy.
   * Adjust future estimates based on systematic bias.
   */
  async recalibrateEstimates(outcomes: TractabilityOutcome[]): Promise<{
    calibration_offset: number
    bias_direction: 'too_optimistic' | 'too_pessimistic' | 'accurate'
    correlation: number  // 0-1, how well estimates predicted outcomes
  }> {

    // Map outcomes to success/failure
    const predictions = outcomes.map(o => {
      const estimatedWeeks = (1 - o.estimated_tractability) * 12  // 0.7 tractability = ~3.6 weeks
      const actualWeeks = o.time_to_complete || (
        o.actual_outcome === 'completed' ? 4 :
        o.actual_outcome === 'in_progress' ? 8 :
        o.actual_outcome === 'abandoned' ? 0 :
        100  // deprioritized
      )

      return {
        estimated: o.estimated_tractability,
        actual: Math.min(actualWeeks / 12, 1.0),  // Cap at 1.0
        completed: o.actual_outcome === 'completed'
      }
    })

    // Correlation: do high estimates correlate with completion?
    const completedEstimates = predictions.filter(p => p.completed).map(p => p.estimated)
    const abandonedEstimates = predictions.filter(p => !p.completed).map(p => p.estimated)

    const avgCompleted = completedEstimates.reduce((a, b) => a + b, 0) / completedEstimates.length || 0
    const avgAbandoned = abandonedEstimates.reduce((a, b) => a + b, 0) / abandonedEstimates.length || 0

    const bias = avgCompleted - avgAbandoned

    return {
      calibration_offset: bias * 0.2,  // Dampen to avoid overcorrection
      bias_direction: bias > 0.1 ? 'too_optimistic' : bias < -0.1 ? 'too_pessimistic' : 'accurate',
      correlation: 0.8  // Placeholder
    }
  }
}

// Monthly recalibration:
const calibration = await calibrator.recalibrateEstimates(outcomes)
// Adjust future estimates: new_estimate = old_estimate - calibration.calibration_offset
```

---

### 8. Missing Prompt Engineering Best Practices

**Critical gaps:**

| Practice | Status | Issue | Fix |
|----------|--------|-------|-----|
| **Explicit role specification** | Partial | Agents are "idea engineers" but no personality/constraints defined | Add "You are [role]. Your constraints are [X]. You succeed when [Y]." |
| **Output schema validation** | Missing | No enforcement of JSON structure; LLM sometimes returns markdown | Require structured output via schema in API calls (OpenAI function_calling style) |
| **Few-shot examples in prompts** | Weak | Only 2-3 examples per mode | Add 5-7 examples showing failure cases AND success cases |
| **Explicit rejection criteria** | Weak | "Avoid repetition" but no algorithmic check | Add: "If this idea matches any of these 5 rejected ideas by >0.85 embedding similarity, reject it" |
| **Token budget visibility** | None | Prompts can bloat silently | Add comment: `// Tokens in this prompt: ~2400 / 4096 available` |
| **Determinism control** | Weak | temperature=1.0 everywhere; no control for when to be creative vs. precise | Use temperature=0.9 for Opus review, 1.2 for Translate mode (needs more creativity) |
| **Error handling** | Minimal | No fallback when LLM returns invalid JSON | Add: "If parsing fails, return an emergency fallback idea" |
| **Context priming** | Strong | Good use of user context in bedtime prompts | Extend to frontier modes |

---

## Summary: The Critical Path

### Week 1 (Foundation)
1. **Define frontier mode templates** — Create unified structure for all 6 modes
2. **Build feedback summarizer** — Compress 3 weeks of signals into <300 tokens
3. **Implement pre-filter scorer** — Establish objective novelty/distance/tractability rubric

### Week 2-3 (Refinement)
4. **Opus review prompt** — Batch reviews with clear verdicts (BUILD/SPARK/REJECT)
5. **Cold start seeds** — Load exemplar ideas showing range of quality
6. **Mode collapse detection** — Weekly entropy check + forced diversity

### Week 4+ (Learning)
7. **Tractability recalibration** — Monthly check-in to fix systematic bias
8. **Best practices audit** — Token budgets, output schemas, few-shot example quality

---

## Recommended Reading

- **Analogical reasoning**: Hofstadter & Sander, "Surfaces and Essences" (why analogies work)
- **Constraint-driven creativity**: Boden, "Creativity and Art" (how constraints spark ideas)
- **Feedback loop design**: Donella Meadows, "Thinking in Systems" (leverage points for learning)
- **Prompt engineering**: OpenAI docs on structured outputs + few-shot prompting

---

## Questions to Validate This Design

1. **Feedback compression**: Is 200-300 tokens enough for 3 weeks of signals, or should it be higher?
2. **Mode weighting**: Should frontier modes have different default temperature settings? (e.g., Inversion more creative, AssumptionAudit more rigorous)
3. **Rejection tuning**: What rejection reason distributions do you expect? (Currently: 30% unclear reasoning, 20% too incremental, 20% diminishing returns, 30% other)
4. **Opus frequency**: Is once-per-week review enough, or should complex weeks get daily reviews?
5. **User feedback**: Should users rate ideas on novelty/tractability BEFORE or AFTER trying to build? (Affects calibration timing)

---

*Document generated: April 2, 2026*
*Next review: After week 1 of frontier mode operation*
