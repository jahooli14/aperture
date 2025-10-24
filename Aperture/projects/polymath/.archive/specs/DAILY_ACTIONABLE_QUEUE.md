# Daily Actionable Queue

> The "What should I work on today?" problem solved

## Core Insight

Users don't want to see 50 projects. They want to open the app and immediately know: **"What can I work on right now given my time, energy, and context?"**

This spec details the daily queue algorithm and anti-overwhelm UX patterns.

---

## The Problem

Current project views show **everything**:
- 10 active projects
- 5 dormant projects
- 3 completed projects
- 2 refresh projects

**Decision paralysis.** User closes app without doing anything.

---

## The Solution

**Daily Actionable Queue** - Shows max 3 projects, intelligently selected based on:

1. **Momentum** - What you worked on recently (keep streak)
2. **Staleness** - What's been idle too long (needs attention)
3. **Freshness** - New projects (exciting energy)
4. **Alignment** - Matches today's time/energy/context
5. **Unlocking** - Recently unblocked projects

---

## Algorithm

### Input: User Context

```typescript
interface UserContext {
  available_time: 'quick' | 'moderate' | 'deep' // < 30min, 30min-2hr, 2hr+
  current_energy: 'low' | 'moderate' | 'high' // tired, normal, flow state
  available_context: string[] // ['desk', 'tools', 'mobile', 'workshop']
  date: Date
  day_of_week: string
}
```

### Scoring System

Each project gets scored across 5 dimensions:

```typescript
interface ProjectDailyScore {
  project_id: string
  total_score: number // Sum of all dimensions (0-100)
  category: 'hot_streak' | 'needs_attention' | 'fresh_energy' | 'available'
  match_reason: string // Human-readable explanation
  breakdown: {
    momentum: number // 0-30 points
    staleness: number // 0-25 points
    freshness: number // 0-20 points
    alignment: number // 0-20 points
    unlock_bonus: number // 0-5 points
  }
}
```

### Dimension 1: Momentum (0-30 points)

**Purpose:** Reward projects with recent activity (keep streaks alive)

```typescript
function calculateMomentum(project: Project): number {
  const daysSinceActive = daysBetween(project.last_active, now())

  if (daysSinceActive === 0) return 30 // Worked on today already
  if (daysSinceActive === 1) return 30 // Worked on yesterday
  if (daysSinceActive === 2) return 25 // Day before yesterday
  if (daysSinceActive <= 7) return 15 // Within last week
  return 0 // No momentum
}
```

**Why this matters:** Streaks create psychological momentum. "Worked on yesterday" = easy to continue today.

### Dimension 2: Staleness (0-25 points)

**Purpose:** Surface projects that need attention before they die

```typescript
function calculateStaleness(project: Project): number {
  const daysSinceActive = daysBetween(project.last_active, now())

  // Sweet spot: stale enough to need attention, not dead
  if (daysSinceActive >= 14 && daysSinceActive <= 30) return 25
  if (daysSinceActive >= 7 && daysSinceActive < 14) return 15

  // Too stale = probably dead, lower priority
  if (daysSinceActive > 30 && daysSinceActive <= 60) return 10
  if (daysSinceActive > 60) return 0 // Likely abandoned

  return 0 // Recent projects don't get staleness bonus
}
```

**Why this matters:** Prevents projects from slowly dying. 14-30 days = intervention window.

### Dimension 3: Freshness (0-20 points)

**Purpose:** Capitalize on "new project energy"

```typescript
function calculateFreshness(project: Project): number {
  const age = daysBetween(project.created_at, now())

  if (age <= 3) return 20 // Brand new, maximum excitement
  if (age <= 7) return 15 // Still fresh
  if (age <= 14) return 10 // Fading novelty
  return 0 // Not new anymore
}
```

**Why this matters:** New projects have energy boost. Capture it before it fades.

### Dimension 4: Alignment (0-20 points)

**Purpose:** Match project requirements to current context

```typescript
function calculateAlignment(project: Project, context: UserContext): number {
  let score = 0

  // Energy match (most important)
  if (project.energy_level === context.current_energy) {
    score += 10
  } else if (
    project.energy_level === 'low' && context.current_energy === 'moderate'
  ) {
    score += 5 // Low energy projects ok when moderate
  }

  // Time match
  const estimatedTime = project.estimated_next_step_time || 60 // default 1hr
  const timeMatches = (
    (context.available_time === 'quick' && estimatedTime <= 30) ||
    (context.available_time === 'moderate' && estimatedTime <= 120) ||
    (context.available_time === 'deep' && estimatedTime > 60)
  )
  if (timeMatches) score += 5

  // Context match (location, tools)
  const requirementsMet = project.context_requirements?.every(req =>
    context.available_context.includes(req)
  ) ?? true
  if (requirementsMet) score += 5

  return score
}
```

**Why this matters:** Don't suggest 3-hour projects when user has 30 minutes.

### Dimension 5: Unlock Bonus (0-5 points)

**Purpose:** Prioritize recently unblocked projects

```typescript
function calculateUnlockBonus(project: Project): number {
  if (project.recently_unblocked) return 5
  if (project.blockers?.length === 0 && project.had_blockers_before) return 3
  return 0
}
```

**Why this matters:** User cleared a blocker, momentum to act now.

---

## Queue Selection Logic

After scoring all projects:

```typescript
function selectDailyQueue(
  scores: ProjectDailyScore[],
  context: UserContext
): ProjectDailyScore[] {
  const queue: ProjectDailyScore[] = []

  // 1. Hot Streak (highest momentum score)
  const hotStreak = scores
    .filter(s => s.breakdown.momentum >= 25)
    .sort((a, b) => b.breakdown.momentum - a.breakdown.momentum)[0]
  if (hotStreak) {
    hotStreak.category = 'hot_streak'
    hotStreak.match_reason = `Worked on ${getActivityRecency(hotStreak.project_id)} - keep it going!`
    queue.push(hotStreak)
  }

  // 2. Needs Attention (highest staleness score, not in queue yet)
  const needsAttention = scores
    .filter(s =>
      s.breakdown.staleness >= 15 &&
      !queue.find(q => q.project_id === s.project_id)
    )
    .sort((a, b) => b.breakdown.staleness - a.breakdown.staleness)[0]
  if (needsAttention && queue.length < 3) {
    needsAttention.category = 'needs_attention'
    needsAttention.match_reason = `${getDaysIdle(needsAttention.project_id)} days idle - quick session?`
    queue.push(needsAttention)
  }

  // 3. Fresh Energy (highest freshness score, not in queue yet)
  const freshEnergy = scores
    .filter(s =>
      s.breakdown.freshness >= 10 &&
      !queue.find(q => q.project_id === s.project_id)
    )
    .sort((a, b) => b.breakdown.freshness - a.breakdown.freshness)[0]
  if (freshEnergy && queue.length < 3) {
    freshEnergy.category = 'fresh_energy'
    freshEnergy.match_reason = 'New from suggestion - explore?'
    queue.push(freshEnergy)
  }

  // 4. Fill remaining slots with highest total score (if queue < 3)
  while (queue.length < 3) {
    const next = scores
      .filter(s => !queue.find(q => q.project_id === s.project_id))
      .sort((a, b) => b.total_score - a.total_score)[0]

    if (!next) break

    next.category = 'available'
    next.match_reason = 'Good fit for today'
    queue.push(next)
  }

  return queue
}
```

**Key principles:**
- **Max 3 projects** (never more)
- **Diverse categories** (not all momentum or all fresh)
- **Clear reasons** (user understands WHY each is suggested)

---

## UI Design

### Main Queue View

```
┌──────────────────────────────────────────────┐
│  Today's Focus                    Jan 24, Fri │
│                                               │
│  ⏱️ Available: 2 hours                        │
│  💪 Energy: Moderate                          │
│  📍 Context: Desk + Tools                     │
│  [Edit Context]                               │
│                                               │
│  🔥 Hot Streak (keep momentum)                │
│  ┌────────────────────────────────────────┐  │
│  │ Portfolio Website                       │  │
│  │ 65% complete                             │  │
│  │                                          │  │
│  │ Worked on yesterday - keep it going!    │  │
│  │                                          │  │
│  │ Next step: Deploy contact form           │  │
│  │ ⏱️ 45 min  💪 Moderate energy            │  │
│  │                                          │  │
│  │ [Continue] [Skip Today]                  │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ⚠️ Needs Attention (getting stale)           │
│  ┌────────────────────────────────────────┐  │
│  │ Meditation Practice                      │  │
│  │ 40% complete                             │  │
│  │                                          │  │
│  │ 14 days idle - quick session?            │  │
│  │                                          │  │
│  │ Next step: 10 minute session             │  │
│  │ ⏱️ 10 min  💪 Low energy                 │  │
│  │                                          │  │
│  │ [Quick Win] [Later]                      │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ✨ Fresh Energy (new/exciting)               │
│  ┌────────────────────────────────────────┐  │
│  │ Image Classifier                         │  │
│  │ 80% complete                             │  │
│  │                                          │  │
│  │ New from suggestion - explore?           │  │
│  │                                          │  │
│  │ Next step: Set up training data          │  │
│  │ ⏱️ 2 hours  💪 High energy               │  │
│  │                                          │  │
│  │ [Explore] [Not Today]                    │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  💡 Also Available                            │
│     3 more projects ready to work on          │
│     [View All Projects]                       │
│                                               │
│  🚫 Not Today                                 │
│     Take a break - queue resets tomorrow      │
│     [Skip Day]                                │
└──────────────────────────────────────────────┘
```

### Project Card Design (in Queue)

```
┌────────────────────────────────────────┐
│ Portfolio Website                       │ <- Title
│ 65% complete                            │ <- Progress
│                                         │
│ Worked on yesterday - keep it going!   │ <- Match reason (why suggested)
│                                         │
│ Next step: Deploy contact form          │ <- Next action
│ ⏱️ 45 min  💪 Moderate energy           │ <- Requirements
│                                         │
│ [Continue] [Skip Today]                 │ <- Actions
└────────────────────────────────────────┘
```

**Card Components:**
1. **Title** - Clear project name
2. **Progress** - % complete (if tracked)
3. **Match Reason** - Why this is in today's queue
4. **Next Step** - Concrete action (not vague "work on it")
5. **Requirements** - Time + Energy estimate
6. **Actions** - Primary CTA + Skip option

---

## Context Input

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
│  ○ Low (tired, maintenance only)             │
│  ● Moderate (normal work)                    │
│  ○ High (flow state, creative)               │
│                                               │
│  Where are you / what's available?            │
│  ☑ Desk + Computer                           │
│  ☑ Dev tools (IDE, terminal)                 │
│  ☐ Workshop + Tools                          │
│  ☐ On the go (mobile only)                   │
│                                               │
│  [Update Queue]  [Save as Default]           │
└──────────────────────────────────────────────┘
```

**Context Persistence:**
- Saved per user
- Auto-resets daily at midnight (fresh context each day)
- "Save as Default" for typical workday setup
- Can edit anytime (queue updates immediately)

---

## Anti-Overwhelm Patterns

### 1. Max 3 Projects Rule

**Never show more than 3 projects in daily queue.**

If user needs more options: "View All Projects" → separate full list view.

### 2. Clear Categories

Projects grouped by **why** they're suggested:
- 🔥 Hot Streak = momentum
- ⚠️ Needs Attention = staleness
- ✨ Fresh Energy = novelty

User immediately understands selection logic.

### 3. Skip Options

Every project card has **"Skip Today"** or **"Later"** button.

Removes from queue without penalty. No guilt.

### 4. Queue Reset

Daily queue **resets every day** at midnight.

Yesterday's skipped projects might reappear (with different score), or not.

### 5. "Not Today" Escape Hatch

Big **"Skip Day"** button at bottom.

User can opt out of all work. No nagging. App respects "off days."

### 6. Collapsed "Also Available"

Don't show full project list unless requested.

"3 more projects available" → collapsed by default → [View All] to expand.

### 7. Smart Defaults

If user hasn't set context, use sensible defaults:
- Time: Moderate (1-2 hours)
- Energy: Moderate
- Context: Desk + Computer

Queue works without configuration.

---

## Edge Cases

### Empty Queue (No Projects)

```
┌──────────────────────────────────────────────┐
│  Today's Focus                    Jan 24, Fri │
│                                               │
│  🎯 No active projects yet                    │
│                                               │
│  Get started by:                              │
│  • Creating a new project                     │
│  • Building a suggested project               │
│  • Generating new AI suggestions              │
│                                               │
│  [View Suggestions]  [Create Project]         │
└──────────────────────────────────────────────┘
```

### All Projects Blocked

```
┌──────────────────────────────────────────────┐
│  Today's Focus                    Jan 24, Fri │
│                                               │
│  🚧 All projects are currently blocked        │
│                                               │
│  Top blockers:                                │
│  • Waiting for API access (2 projects)        │
│  • Need design review (1 project)             │
│                                               │
│  Consider:                                    │
│  • Clearing blockers                          │
│  • Starting a new unrelated project           │
│  • Exploring suggestions                      │
│                                               │
│  [View Blocked Projects]  [Suggestions]       │
└──────────────────────────────────────────────┘
```

### Context Mismatch (No Projects Fit)

```
┌──────────────────────────────────────────────┐
│  Today's Focus                    Jan 24, Fri │
│                                               │
│  📍 Current context: Mobile only              │
│                                               │
│  ⚠️ Your active projects need desk + tools    │
│                                               │
│  Options:                                     │
│  • Change context if you have desk access     │
│  • Take a planning session (mobile-friendly)  │
│  • Review memories (mobile-friendly)          │
│                                               │
│  [Edit Context]  [Plan Projects]  [Memories]  │
└──────────────────────────────────────────────┘
```

---

## Mobile Optimization

### Swipeable Cards

On mobile, implement swipe gestures:

```
[Card]
  Swipe right → Continue/Start
  Swipe left → Skip Today
  Tap → View details
```

### Compact Context

Mobile shows simplified context bar:
```
⏱️ 2h  💪 Moderate  📍 Desk
```

Tap to edit → modal with full context options.

---

## Analytics & Learning

Track user behavior to improve queue:

```typescript
interface QueueAnalytics {
  date: Date
  projects_shown: string[] // IDs in queue
  projects_worked_on: string[] // Which ones user actually clicked
  skip_reasons: { project_id: string, skipped: boolean }[]
  context: UserContext
  satisfaction_rating: number | null // Optional user feedback
}
```

**Learning Opportunities:**
- Which categories (hot streak, needs attention, fresh) get most clicks?
- Are alignment scores accurate? (do users work on well-matched projects?)
- Do users skip high-scoring projects? (maybe scoring is wrong)
- Time of day patterns? (morning = deep work, evening = low energy)

---

## Implementation Priority

**Phase 1: MVP (Core Queue)**
- Scoring algorithm (5 dimensions)
- Queue selection logic (max 3)
- Basic UI with 3 project cards
- Manual context input

**Phase 2: Enhanced UX**
- Category badges (🔥⚠️✨)
- Match reason explanations
- Skip actions
- Queue reset logic

**Phase 3: Intelligence**
- Context persistence
- Smart defaults
- Edge case handling
- Analytics tracking

**Phase 4: Polish**
- Mobile swipe gestures
- Context presets ("Morning Setup", "Evening Wind-Down")
- Week-at-a-glance view (upcoming queue previews)
- Queue performance insights ("You completed 70% of suggested projects this week!")

---

## Success Metrics

- **Engagement:** 70%+ of users work on a queued project within 30 min of opening app
- **Completion:** 50%+ of queued projects actually worked on that day
- **Satisfaction:** 80%+ of users rate queue as "helpful" vs. "overwhelming"
- **Streak Maintenance:** Hot streak projects have 80%+ continuation rate
- **Intervention Success:** Needs attention projects move back to active status 60%+ of time

---

**Status:** Ready for implementation
**Dependencies:** Project scoring system, user context storage, queue UI components
