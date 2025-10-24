# Project Tracking Enhancements

> Making projects actionable, realistic, and failure-aware

## Overview

These enhancements shift projects from passive status tracking to **active daily guidance**. Focus on helping users answer: "What should I work on today?" while embracing the reality of abandoned projects and decaying skills.

---

## 1. Project Graveyard with Learnings

**Problem:** Most projects fail/get abandoned, but there's no place to acknowledge this or capture why.

**Solution:** Dedicated "graveyard" view with mandatory post-mortems that become valuable learning data.

### Data Model

```typescript
interface AbandonedProject extends Project {
  status: 'abandoned'
  abandoned_at: Date
  abandoned_reason: 'time' | 'energy' | 'interest' | 'external' | 'wrong_goal'
  post_mortem: {
    what_killed_it: string // Free text
    lessons_learned: string // What NOT to do next time
    was_goal_wrong: boolean
    what_was_achieved: string // Even "failed" projects achieve something
    would_restart: boolean
  }
  decay_pattern: {
    initial_activity: number // Days of active work
    dormant_period: number // Days before abandonment
    last_momentum: number // Activity score before death
  }
}
```

### UI Implementation

**Abandonment Flow:**
```
┌──────────────────────────────────────────────┐
│  Mark Project as Abandoned                    │
│                                               │
│  Project: "AI Image Classifier"               │
│                                               │
│  Why did this project die?                    │
│  ○ Ran out of time                           │
│  ○ Lost energy/motivation                    │
│  ○ Interest shifted elsewhere                │
│  ○ External blocker I couldn't solve         │
│  ● Original goal was wrong                   │
│                                               │
│  What killed it? (be honest)                  │
│  ┌────────────────────────────────────────┐  │
│  │ Realized I don't actually care about   │  │
│  │ image classification - was chasing     │  │
│  │ trendy tech instead of real problem    │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  What should you NOT do next time?            │
│  ┌────────────────────────────────────────┐  │
│  │ Don't start ML projects without a real │  │
│  │ use case. Tech-first thinking fails.   │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  What DID you achieve? (even if "failed")     │
│  ┌────────────────────────────────────────┐  │
│  │ Learned Python ML libraries, understood│  │
│  │ training data requirements             │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  Would you restart this if circumstances      │
│  changed?                                     │
│  ○ Yes  ● No                                 │
│                                               │
│  [Move to Graveyard]  [Cancel]                │
└──────────────────────────────────────────────┘
```

**Graveyard View:**
```
┌──────────────────────────────────────────────┐
│  🪦 Project Graveyard                         │
│                                               │
│  "Where good intentions come to rest"         │
│                                               │
│  Filter: [All] [Time] [Interest] [Wrong Goal]│
│                                               │
│  ┌────────────────────────────────────────┐  │
│  │ 🪦 AI Image Classifier                  │  │
│  │    Lived: 14 days  Dormant: 60 days     │  │
│  │    Died: Jan 15, 2025                    │  │
│  │                                          │  │
│  │    Cause of Death: Wrong goal            │  │
│  │    "Chasing trendy tech without use case"│  │
│  │                                          │  │
│  │    What Was Learned:                     │  │
│  │    • Don't start tech-first projects     │  │
│  │    • Learned Python ML basics            │  │
│  │                                          │  │
│  │    [View Full Post-Mortem]               │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ┌────────────────────────────────────────┐  │
│  │ 🪦 Meditation App                        │  │
│  │    Lived: 7 days  Dormant: 90 days      │  │
│  │    Died: Dec 10, 2024                    │  │
│  │    Cause: Ran out of time                │  │
│  │    [View Post-Mortem]                    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Graveyard Insights (Aggregated Patterns):**
```
┌──────────────────────────────────────────────┐
│  📊 Your Failure Patterns                     │
│                                               │
│  Most Common Cause of Death:                  │
│  🥇 "Wrong goal" - 40% of abandoned projects  │
│  🥈 "Lost interest" - 30%                     │
│  🥉 "Ran out of time" - 20%                   │
│                                               │
│  Typical Project Lifespan Before Abandonment: │
│  → 12 days of active work                     │
│  → 45 days dormant before declared dead       │
│                                               │
│  Most Valuable Lesson (repeated 3x):          │
│  "Don't start projects without clear goal"    │
│                                               │
│  Projects You'd Restart:                      │
│  • Voice Journal App (external blocker lifted)│
│  • Woodworking Bench (seasonal - winter killed│
│                        it, restart in spring) │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Graveyard is **opt-in view** (not shown by default in projects list)
- Post-mortem required but can be brief (min 1 sentence per field)
- Can skip "would restart" question
- Graveyard shows max 10 most recent (older archived)
- Option to "truly delete" after 1 year in graveyard

---

## 2. Capability Decay Tracking

**Problem:** Technical skills atrophy when unused, but system doesn't track this or alert user.

**Solution:** Track capability freshness and alert when skills get rusty.

### Decay Algorithm

```typescript
interface CapabilityFreshness {
  capability_id: string
  last_used: Date
  days_since_use: number
  freshness_score: number // 0-100
  decay_rate: number // How fast this skill decays (language-specific)
  status: 'fresh' | 'stable' | 'rusty' | 'stale'
}

function calculateFreshness(capability: Capability): number {
  const daysSinceUse = daysBetween(capability.last_used, now())
  const decayRate = DECAY_RATES[capability.category] || 0.5

  // Fresh period (no decay): 0-14 days
  if (daysSinceUse <= 14) return 100

  // Decay formula: exponential with category-specific rate
  const decayPeriod = daysSinceUse - 14
  const freshness = 100 * Math.exp(-decayRate * decayPeriod / 30)

  return Math.max(0, Math.min(100, freshness))
}

const DECAY_RATES = {
  'language': 0.8, // Programming languages decay fast (syntax, APIs change)
  'framework': 1.0, // Frameworks decay fastest (rapid ecosystem changes)
  'concept': 0.3, // Concepts decay slow (fundamentals are stable)
  'tool': 0.6, // Tools decay medium (features added, but core stable)
}
```

### Freshness Categories
- **Fresh** (85-100%): Used within 14 days
- **Stable** (60-84%): Used within 30 days, still sharp
- **Rusty** (30-59%): 30-60 days unused, needs refresh
- **Stale** (<30%): 60+ days unused, significant refresh needed

### UI Implementation

**Capability Health Dashboard:**
```
┌──────────────────────────────────────────────┐
│  🛠️ Capability Health Monitor                 │
│                                               │
│  Fresh (7 capabilities)                       │
│  ✅ React          Last used: 2 days ago      │
│  ✅ TypeScript     Last used: 3 days ago      │
│  ✅ Git            Last used: 1 day ago       │
│  [View all 7]                                 │
│                                               │
│  ⚠️ Getting Rusty (3 capabilities)            │
│  🟡 Python         42% fresh - 45 days idle   │
│  🟡 Docker         38% fresh - 50 days idle   │
│  🟡 PostgreSQL     35% fresh - 55 days idle   │
│  [Refresh These]                              │
│                                               │
│  ⚠️ Stale (2 capabilities)                    │
│  🔴 Go             12% fresh - 90 days idle   │
│  🔴 Kubernetes     8% fresh - 120 days idle   │
│  [Major Refresh Needed]                       │
└──────────────────────────────────────────────┘
```

**Decay Alert (Contextual):**
```
When user opens Projects page:

┌──────────────────────────────────────────────┐
│  ⚠️ Skill Decay Alert                         │
│                                               │
│  Python is getting rusty (42% fresh)          │
│  Last used: 45 days ago                       │
│                                               │
│  Quick refresh project:                       │
│  "Build a CLI tool for [your use case]"       │
│  Est. time: 2 hours                           │
│                                               │
│  [Start Refresh] [Ignore] [Remind Later]      │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Only alert for 1 rusty capability at a time (not all)
- Alerts shown max once per week
- User can mark capability as "ok to decay" (pausing alerts)
- Only track capabilities user has actually used (not all possible skills)

---

## 3. Capability Freshness Alerts with Refresh Recipes

**Problem:** Decay alerts are good, but what do you DO about it?

**Solution:** AI-generated "refresh recipes" - micro-projects specifically designed to restore skill freshness.

### Refresh Recipe Structure

```typescript
interface RefreshRecipe {
  id: string
  capability_id: string
  capability_name: string
  current_freshness: number
  target_freshness: number // After completing recipe
  estimated_time: string // "2 hours", "1 day", "1 week"
  difficulty: 'trivial' | 'easy' | 'moderate'
  recipe: {
    title: string
    description: string
    tasks: string[] // Step-by-step checklist
    success_criteria: string
  }
  personalized: boolean // Tailored to user's context vs. generic
}
```

### AI Recipe Generation

**Prompt Template:**
```typescript
`Generate a skill refresh micro-project for:

Capability: ${capability.name}
Last used: ${daysSinceUse} days ago
User's other capabilities: ${relatedCapabilities}
User's interests: ${userInterests}

Requirements:
- Must be completable in 2-4 hours
- Should feel useful, not like homework
- Should touch core concepts of ${capability.name}
- Bonus: Connect to user's interests if possible

Generate:
1. Project title (engaging, not "Python Tutorial")
2. Brief description (2 sentences)
3. 5-7 step checklist
4. Success criteria (how to know you're done)
`
```

**Example Generated Recipes:**

```typescript
// Python refresh (generic)
{
  title: "Build a CLI Todo Manager",
  description: "Create a command-line todo app with file persistence. Covers Python basics: file I/O, CLI args, data structures.",
  tasks: [
    "Set up project with argparse for CLI interface",
    "Implement add/list/complete commands",
    "Add JSON file persistence",
    "Write unit tests for core functions",
    "Package with setup.py"
  ],
  estimated_time: "3 hours",
  difficulty: "easy"
}

// Python refresh (personalized - user has memory system)
{
  title: "Voice Note Summary CLI",
  description: "Build a CLI that takes voice note transcripts and generates summaries. Combines your memory system interest with Python refresh.",
  tasks: [
    "Set up CLI to accept file input",
    "Integrate OpenAI API for summarization",
    "Add keyword extraction",
    "Output formatted summary",
    "Test with your actual voice notes"
  ],
  estimated_time: "2 hours",
  difficulty: "easy"
}
```

### UI Implementation

**Refresh Recipe Suggestion:**
```
┌──────────────────────────────────────────────┐
│  🔧 Python Refresh Recipe                     │
│                                               │
│  Your Python skills are 42% fresh (rusty)     │
│                                               │
│  Recommended Refresh:                         │
│  "Voice Note Summary CLI"                     │
│                                               │
│  Build a CLI that summarizes voice notes -    │
│  combines your memory system interest with    │
│  Python refresh. Perfect fit!                 │
│                                               │
│  ⏱️ Est. time: 2 hours                        │
│  📈 Will restore Python to ~80% fresh         │
│                                               │
│  Checklist:                                   │
│  ☐ Set up CLI to accept file input           │
│  ☐ Integrate OpenAI API for summarization    │
│  ☐ Add keyword extraction                    │
│  ☐ Output formatted summary                  │
│  ☐ Test with your actual voice notes         │
│                                               │
│  [Start Refresh Project] [Try Different Recipe]│
└──────────────────────────────────────────────┘
```

**"Try Different Recipe" generates alternative:**
```
Alternative Recipe:
"Data Cleaning Script for CSV Files"
(more generic, still valid Python refresh)
```

**Refresh Project Creation:**
```
When user clicks "Start Refresh Project":

1. Create new project with:
   - Title: "Python Refresh: Voice Note Summary CLI"
   - Type: 'learning'
   - Tasks: Pre-populated from recipe checklist
   - Linked to capability: Python
   - Tagged: refresh=true

2. Show in Daily Actionable Queue as:
   "🔧 Skill Refresh - Python (2 hours)"
```

### Anti-Overwhelm Design
- Only suggest refresh for 1 capability at a time
- User can dismiss and won't be nagged for 30 days
- Recipes are **short** (2-4 hours max, not multi-day projects)
- Pre-populated checklist reduces activation energy
- Option to "Accept Decay" - mark skill as "ok to fade"

---

## 4. Daily Actionable Queue

**Problem:** Project list shows WHAT exists, not WHAT TO DO TODAY.

**Solution:** Smart daily view that surfaces the right project based on momentum, staleness, energy, time, and context.

### Scoring Algorithm

```typescript
interface DailyScore {
  project_id: string
  total_score: number
  breakdown: {
    momentum_score: number // Keep streak going
    staleness_score: number // Needs attention
    freshness_score: number // New and exciting
    alignment_score: number // Matches current energy/time/context
    unlock_score: number // Recently unblocked
  }
}

function calculateDailyScore(project: Project, context: UserContext): DailyScore {
  const momentum = calculateMomentum(project) // 0-30 points
  const staleness = calculateStaleness(project) // 0-25 points
  const freshness = calculateFreshness(project) // 0-20 points
  const alignment = calculateAlignment(project, context) // 0-20 points
  const unlock = calculateUnlockBonus(project) // 0-5 points

  return {
    project_id: project.id,
    total_score: momentum + staleness + freshness + alignment + unlock,
    breakdown: { momentum, staleness, freshness, alignment, unlock }
  }
}

function calculateMomentum(project: Project): number {
  const daysSinceActive = daysBetween(project.last_active, now())

  // Hot streak bonus: worked on yesterday or day before
  if (daysSinceActive <= 1) return 30
  if (daysSinceActive === 2) return 25
  if (daysSinceActive <= 7) return 15
  return 0
}

function calculateStaleness(project: Project): number {
  const daysSinceActive = daysBetween(project.last_active, now())

  // Projects getting stale need attention
  if (daysSinceActive >= 14 && daysSinceActive <= 30) return 25
  if (daysSinceActive >= 7 && daysSinceActive < 14) return 15
  if (daysSinceActive >= 30) return 10 // Too stale = lower priority
  return 0
}

function calculateFreshness(project: Project): number {
  const age = daysBetween(project.created_at, now())

  // New projects are exciting
  if (age <= 3) return 20
  if (age <= 7) return 15
  if (age <= 14) return 10
  return 0
}

function calculateAlignment(project: Project, context: UserContext): number {
  let score = 0

  // Energy match
  if (project.energy_level === context.current_energy) score += 10

  // Time match
  const estimatedTime = project.estimated_next_step_time || 60
  if (estimatedTime <= context.available_time) score += 5

  // Context match (location, tools available)
  if (project.context_requirements?.every(req => context.available.includes(req))) {
    score += 5
  }

  return score
}

function calculateUnlockBonus(project: Project): number {
  // Recently unblocked projects get priority
  if (project.blockers?.length === 0 && project.recently_unblocked) {
    return 5
  }
  return 0
}
```

### Daily Queue UI

**Main View:**
```
┌──────────────────────────────────────────────┐
│  Today's Focus                    Jan 24, Fri │
│                                               │
│  Available time: 2 hours                      │
│  Energy: Moderate                             │
│  Context: Desk + Tools                        │
│  [Edit Context]                               │
│                                               │
│  🔥 Hot Streak (keep momentum)                │
│  ┌────────────────────────────────────────┐  │
│  │ Portfolio Website                       │  │
│  │ Worked on yesterday - keep it going!    │  │
│  │                                          │  │
│  │ Next: Deploy contact form                │  │
│  │ ⏱️ 45 min  💪 Moderate energy            │  │
│  │                                          │  │
│  │ [Continue] [Skip Today]                  │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ⚠️ Needs Attention (getting stale)           │
│  ┌────────────────────────────────────────┐  │
│  │ Meditation Practice                      │  │
│  │ 14 days idle - quick session?            │  │
│  │                                          │  │
│  │ Next: 10 minute session                  │  │
│  │ ⏱️ 10 min  💪 Low energy                 │  │
│  │                                          │  │
│  │ [Quick Win] [Later]                      │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ✨ Fresh Energy (new/exciting)               │
│  ┌────────────────────────────────────────┐  │
│  │ Image Classifier                         │  │
│  │ New from suggestion - explore?           │  │
│  │                                          │  │
│  │ Next: Set up training data               │  │
│  │ ⏱️ 2 hours  💪 High energy               │  │
│  │                                          │  │
│  │ [Explore] [Not Today]                    │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  💡 Also Available (3 more projects)          │
│  [Show All Projects]                          │
└──────────────────────────────────────────────┘
```

### Context Input

**Edit Context Dialog:**
```
┌──────────────────────────────────────────────┐
│  Set Today's Context                          │
│                                               │
│  How much time do you have?                   │
│  ○ Quick (< 30 min)                          │
│  ○ Moderate (30 min - 2 hours)               │
│  ● Deep (2+ hours)                           │
│                                               │
│  What's your energy level?                    │
│  ○ Low (tired, maintenance tasks only)       │
│  ● Moderate (normal work)                    │
│  ○ High (flow state, creative)               │
│                                               │
│  Where are you / what's available?            │
│  ☑ Desk + Computer                           │
│  ☑ Dev tools (IDE, terminal)                 │
│  ☐ Workshop + Tools                          │
│  ☐ On the go (mobile only)                   │
│                                               │
│  [Update Queue]                               │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- **Max 3 projects** shown in daily queue (not overwhelming)
- Clear categories (Hot Streak, Needs Attention, Fresh Energy)
- "Also Available" collapsed by default (not shown unless clicked)
- Context can be set once and persists until changed
- Can skip days entirely ("Take a break - see you tomorrow!")
- Option to view "All Projects" list if queue doesn't resonate

---

## Database Schema Changes

```sql
-- Project Graveyard
ALTER TABLE projects ADD COLUMN abandoned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN abandoned_reason TEXT;
ALTER TABLE projects ADD COLUMN post_mortem JSONB;
ALTER TABLE projects ADD COLUMN would_restart BOOLEAN;

CREATE INDEX idx_projects_abandoned ON projects(status) WHERE status = 'abandoned';

-- Capability Freshness
CREATE TABLE capability_freshness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES capabilities(id),
  user_id UUID NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE NOT NULL,
  days_since_use INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (now() - last_used))
  ) STORED,
  freshness_score FLOAT NOT NULL DEFAULT 100.0,
  decay_rate FLOAT NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'fresh',
  alerts_paused BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_freshness_status ON capability_freshness(status);
CREATE INDEX idx_freshness_rusty ON capability_freshness(freshness_score) WHERE freshness_score < 60;

-- Refresh Recipes
CREATE TABLE refresh_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES capabilities(id),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tasks JSONB NOT NULL, -- Array of task strings
  estimated_time TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  success_criteria TEXT,
  personalized BOOLEAN DEFAULT false,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Project Energy/Time Metadata
ALTER TABLE projects ADD COLUMN energy_level TEXT; -- 'low' | 'moderate' | 'high'
ALTER TABLE projects ADD COLUMN estimated_next_step_time INTEGER; -- minutes
ALTER TABLE projects ADD COLUMN context_requirements TEXT[]; -- ['desk', 'tools', etc.]
ALTER TABLE projects ADD COLUMN blockers JSONB; -- Array of blocker objects
ALTER TABLE projects ADD COLUMN recently_unblocked BOOLEAN DEFAULT false;

-- Daily Context (user preferences)
CREATE TABLE user_daily_context (
  user_id UUID PRIMARY KEY,
  available_time TEXT, -- 'quick' | 'moderate' | 'deep'
  current_energy TEXT, -- 'low' | 'moderate' | 'high'
  available_context TEXT[], -- ['desk', 'tools', 'mobile', etc.]
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## API Endpoints

```typescript
// Graveyard
POST /api/projects/:id/abandon
  body: { reason, post_mortem, would_restart }
GET  /api/projects/graveyard
GET  /api/projects/graveyard/insights

// Capability Freshness
GET  /api/capabilities/freshness
GET  /api/capabilities/freshness/alerts
POST /api/capabilities/:id/pause-alerts
POST /api/capabilities/:id/mark-used

// Refresh Recipes
POST /api/capabilities/:id/generate-recipe
GET  /api/refresh-recipes
POST /api/refresh-recipes/:id/start
POST /api/refresh-recipes/:id/complete

// Daily Queue
GET  /api/projects/daily-queue
POST /api/projects/daily-context
  body: { available_time, current_energy, available_context }
POST /api/projects/:id/skip-today
```

---

## Success Metrics

- **Graveyard:** 70%+ of users create post-mortem when abandoning
- **Decay Tracking:** 50%+ of rusty capabilities get refreshed within 60 days
- **Refresh Recipes:** 40%+ of suggested recipes actually started
- **Daily Queue:** 60%+ of users work on top suggested project when opening app
- **Anti-Overwhelm:** Queue shows max 3 projects, users report reduced decision fatigue

---

**Status:** Ready for implementation
**Dependencies:** Core project system, capability tracking, AI recipe generation
