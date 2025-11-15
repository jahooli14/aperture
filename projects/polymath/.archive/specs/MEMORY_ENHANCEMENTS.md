# Memory Storage Enhancements

> Making memories more useful through context, visualization, and curation

## Overview

These enhancements transform memories from passive storage into an active, evolving knowledge system. Focus on preventing information overload while maximizing signal.

---

## 1. Context Windows - Time-based Memory Clustering

**Problem:** Memories are currently flat. Hard to recall "that period when I was thinking about X and Y together."

**Solution:** Auto-cluster memories into temporal context windows with AI-generated summaries.

### How It Works

```typescript
interface ContextWindow {
  id: string
  start_date: Date
  end_date: Date
  theme: string // AI-generated: "Exploring communism and abstract art"
  memory_ids: string[]
  memory_count: number
  dominant_entities: string[] // Top 3-5 recurring entities
  summary: string // 2-3 sentence narrative
}
```

### Clustering Algorithm

```
1. Group memories by week/month (user preference)
2. For each time window:
   - Extract all entities
   - Find dominant themes (frequency + co-occurrence)
   - Generate narrative summary via Gemini
3. Only create window if 3+ memories in period
4. Windows with <2 memories = "sparse period" (still shown)
```

### UI Implementation

**Timeline View:**
```
┌──────────────────────────────────────────────┐
│  Your Memory Timeline                         │
│                                               │
│  🎨 Jan 15-21: Exploring Art & Politics      │
│     5 memories • communism, abstract art      │
│     "You explored intersection of political   │
│      themes and creative expression..."       │
│     [View 5 memories]                         │
│                                               │
│  💻 Jan 8-14: React Development Deep Dive    │
│     8 memories • React, hooks, TypeScript     │
│     [View 8 memories]                         │
│                                               │
│  🌫️ Jan 1-7: Sparse period (2 memories)      │
│     [View anyway]                             │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Show max 10 most recent context windows
- Older windows collapsed into "Archive" section
- Click to expand full memories within window
- Option to manually merge/split windows

---

## 2. Memory Decay Visualization

**Problem:** Users don't know which memories are "fading" (haven't been reviewed, losing strength in graph).

**Solution:** Visual heat map showing memory health across timeline.

### Decay Algorithm

```typescript
function calculateMemoryStrength(memory: Memory): number {
  const daysSinceCreated = daysBetween(memory.created_at, now())
  const daysSinceReviewed = memory.last_reviewed_at
    ? daysBetween(memory.last_reviewed_at, now())
    : daysSinceCreated

  const reviewBonus = memory.review_count * 0.1 // Each review adds 10%
  const decayRate = 0.01 // 1% per day without review

  // Start at 100%, decay over time, boost with reviews
  let strength = 100
  strength -= (daysSinceReviewed * decayRate * 100)
  strength += (reviewBonus * 100)
  strength = Math.max(0, Math.min(100, strength)) // Clamp 0-100

  return strength
}
```

### Strength Categories
- **Strong** (80-100%): Fresh or frequently reviewed
- **Stable** (50-79%): Healthy but not recent
- **Fading** (20-49%): Needs attention soon
- **Weak** (<20%): Critical - review or archive

### UI Implementation

**Memory Cards with Strength Indicator:**
```
┌─────────────────────────────────────────────┐
│  Memory: "Communism and abstract art"       │
│  ████████░░ 80% Strong                      │
│  Last reviewed: 3 days ago                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Memory: "React hooks patterns"             │
│  ███░░░░░░░ 30% Fading                      │
│  ⚠️ Not reviewed in 45 days                 │
│  [Review Now]                                │
└─────────────────────────────────────────────┘
```

**Heat Map Calendar:**
```
Memory Strength This Month:

Mon  Tue  Wed  Thu  Fri  Sat  Sun
 🟢   🟢   🟡   🟢   🟢   🔴   🟡   Week 1
 🟢   🔴   🟢   🟡   🟢   🟢   🟡   Week 2
 🟡   🟢   🔴   🟢   🟢   🟡   🟢   Week 3
 🟢   🟡   🟢   🟢   🟢   🟡   🔴   Week 4

🟢 Strong  🟡 Stable  🟠 Fading  🔴 Weak
```

### Anti-Overwhelm Design
- Only alert for top 5 "fading" memories (not all weak ones)
- Option to "Accept Decay" - mark memory as "ok to fade"
- Batch review mode: "Review all fading memories" (max 10 at once)

---

## 3. Cross-Memory Synthesis Notes

**Problem:** When reviewing memories, insights emerge from *combinations*, but nowhere to capture them.

**Solution:** Create "synthesis notes" that link 2-3 memories and become new memory nodes.

### Data Model

```typescript
interface SynthesisNote extends Memory {
  type: 'synthesis' // vs. 'captured'
  source_memory_ids: string[] // 2-3 memories that sparked this
  synthesis_type: 'connection' | 'contradiction' | 'evolution'
  confidence: number // How strong is this synthesis?
}
```

### UI Implementation

**During Resurfacing:**
```
┌──────────────────────────────────────────────┐
│  Resurfacing: "React hooks patterns"         │
│  [Memory content...]                          │
│                                               │
│  💡 Related memories you've reviewed:         │
│  • "TypeScript best practices" (2 days ago)   │
│  • "Component composition" (5 days ago)       │
│                                               │
│  [✓ Reviewed]  [💡 Synthesize]                │
└──────────────────────────────────────────────┘

[User clicks "Synthesize"]

┌──────────────────────────────────────────────┐
│  Create Synthesis Note                        │
│                                               │
│  Linking:                                     │
│  • React hooks patterns                       │
│  • TypeScript best practices                  │
│                                               │
│  What insight emerges from these?             │
│  ┌────────────────────────────────────────┐  │
│  │ Hooks + TypeScript = need custom types│  │
│  │ for complex state management...        │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  [Save Synthesis]                             │
└───────────���──────────────────────────────────┘
```

**Synthesis View:**
```
┌──────────────────────────────────────────────┐
│  🔗 Synthesis: Hooks + TypeScript patterns    │
│                                               │
│  "Combining hooks with TypeScript requires    │
│   careful type definitions for state..."      │
│                                               │
│  Synthesized from:                            │
│  → React hooks patterns                       │
│  → TypeScript best practices                  │
│                                               │
│  Created: Jan 20, 2025                        │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Synthesis is **optional** - never forced
- Only suggest synthesis if 2+ related memories reviewed in same session
- Limit to 3 source memories max (more = confusing)
- AI can suggest synthesis prompt to reduce writing burden

---

## 4. Memory Export as Narrative

**Problem:** Graph structure is powerful but hard to communicate. Users want to share/reflect on "what I learned this month."

**Solution:** AI-generated narrative summaries with export options.

### Export Formats

**Weekly Summary:**
```markdown
# Your Week in Memories (Jan 15-21)

This week you explored the intersection of **art and politics**,
particularly how abstract expressionism relates to communist themes.
You captured 5 memories on this topic, with strong interest in:

- Abstract art techniques
- Political philosophy
- Creative expression

## Key Insights
1. "Abstract art can be political without being literal"
2. "Communism and creativity have complex relationship"

## Strongest Connections
React hooks → TypeScript patterns (3 bridges)
Abstract art → Political theory (5 bridges)

## Suggested Next Steps
Your synthesis suggests exploring: "Political art in modern context"
```

**Monthly Narrative:**
```markdown
# January 2025: Memory Patterns

In January you showed **two dominant themes**:

**Technical Learning (12 memories)**
Deep dive into React ecosystem, with focus on hooks,
TypeScript integration, and component patterns. This
represents a strengthening of your frontend capabilities.

**Creative Exploration (8 memories)**
Emerging interest in abstract art and political themes.
New territory for you - first artistic memories captured.

## Evolution Detected
- Week 1-2: Purely technical focus
- Week 3-4: Creative interests emerged
- Pattern: Technical work → creative counterbalance

## Strongest Memory
"React hooks patterns" - reviewed 3x, bridges to 8 other memories
```

### UI Implementation

```
┌──────────────────────────────────────────────┐
│  Memory Insights                              │
│                                               │
│  Generate narrative summary:                  │
│  ○ This week                                  │
│  ○ This month                                 │
│  ○ Last 30 days                               │
│  ○ Custom range                               │
│                                               │
│  Export format:                               │
│  ☑ Markdown  ☐ PDF  ☐ Email                  │
│                                               │
│  [Generate Summary]                           │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Summaries are **generated on demand** (not auto-sent)
- Max 2 pages of narrative (concise)
- Option to collapse detailed sections
- Export includes only top 10 memories (not all)

---

## 5. Memory Collision Detection

**Problem:** Users evolve. Memory from March contradicts memory from May. No way to surface this.

**Solution:** AI detects contradictory memories and prompts reconciliation.

### Collision Detection Algorithm

```typescript
interface MemoryCollision {
  id: string
  memory_a: Memory
  memory_b: Memory
  contradiction_type: 'belief' | 'fact' | 'preference' | 'approach'
  confidence: number // 0-1, how sure AI is this is a real collision
  detected_at: Date
  resolution: 'evolved' | 'error' | 'context_dependent' | null
  resolution_note: string | null
}
```

**Detection Process:**
```
1. When new memory created, compare to all existing memories
2. Use embedding similarity to find related memories
3. For top 5 similar memories:
   - Use Gemini to analyze for contradictions
   - If contradiction detected with confidence > 0.7:
     - Create collision record
     - Surface to user
```

**Example Collisions:**

```typescript
// Preference collision
Memory A (March): "I love React's simplicity"
Memory B (June): "React is overcomplicated, prefer Vue"
Type: preference
```

```typescript
// Approach collision
Memory A (Feb): "Always use useState for component state"
Memory B (May): "useReducer is better for complex state"
Type: approach
```

### UI Implementation

**Collision Alert:**
```
┌──────────────────────────────────────────────┐
│  ⚠️ Memory Collision Detected                 │
│                                               │
│  Your new memory contradicts an earlier one:  │
│                                               │
│  📌 March 15: "React is simple and elegant"   │
│  🆚                                           │
│  📌 June 3: "React is overcomplicated"        │
│                                               │
│  Has your view evolved?                       │
│  ○ Yes - I changed my mind                   │
│  ○ No - I was wrong before                   │
│  ○ Both true - context dependent             │
│  ○ False alarm - no contradiction            │
│                                               │
│  Optional: Explain what changed               │
│  ┌────────────────────────────────────────┐  │
│  │ After building larger apps, I see      │  │
│  │ React's complexity now...              │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  [Resolve]  [Ignore]                          │
└──────────────────────────────────────────────┘
```

**Collision History View:**
```
┌──────────────────────────────────────────────┐
│  Memory Evolution                             │
│                                               │
│  🔄 React Framework Opinion                   │
│     March: "Simple and elegant"               │
│       ↓ (3 months)                            │
│     June: "Overcomplicated for large apps"    │
│     Resolution: View evolved with experience  │
│                                               │
│  🔄 State Management Approach                 │
│     Feb: "Always useState"                    │
│       ↓ (3 months)                            │
│     May: "useReducer for complex state"       │
│     Resolution: Learned better patterns       │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Only show collisions with confidence > 0.7 (avoid false positives)
- Max 1 collision alert per day (no spam)
- Can dismiss collisions permanently ("stop comparing these")
- Option to disable feature entirely

---

## 6. Dead Memory Pruning with Archeology

**Problem:** Over time, some memories have no value (no bridges, never reviewed, weak strength). But deleting feels bad.

**Solution:** AI-suggested pruning with "tombstone" preservation for nostalgia.

### Pruning Criteria

A memory is a **pruning candidate** if:
```typescript
function isPruneCandidate(memory: Memory): boolean {
  const age = daysBetween(memory.created_at, now())
  const strength = calculateMemoryStrength(memory)
  const bridgeCount = getBridgeCount(memory.id)
  const entityCount = memory.entities?.length || 0

  return (
    age > 90 && // At least 3 months old
    strength < 20 && // Weak/fading
    bridgeCount === 0 && // No connections
    memory.review_count === 0 && // Never reviewed
    entityCount < 2 // Low information content
  )
}
```

### Tombstone System

```typescript
interface MemoryTombstone {
  id: string
  original_memory_id: string
  title: string
  created_at: Date
  pruned_at: Date
  prune_reason: string
  // Full content NOT stored - just metadata
}
```

### UI Implementation

**Pruning Suggestion:**
```
┌──────────────────────────────────────────────┐
│  🗑️ Memory Cleanup Suggested                  │
│                                               │
│  These 5 memories haven't been reviewed or    │
│  connected to other memories in 90+ days:     │
│                                               │
│  ☐ "Random thought about coffee" (120 days)  │
│  ☐ "Brief note on walking" (95 days)         │
│  ☐ "Incomplete idea about..." (180 days)     │
│  ☐ "Test memory" (200 days)                  │
│  ☐ "Quick note" (150 days)                   │
│                                               │
│  [Preview] [Archive Selected] [Keep All]      │
│                                               │
│  💡 Archived memories become "tombstones" -   │
│     titles preserved for nostalgia, but       │
│     content removed to reduce clutter.        │
└──────────────────────────────────────────────┘
```

**Archeology View (Tombstones):**
```
┌──────────────────────────────────────────────┐
│  🏛️ Memory Archive (Tombstones)               │
│                                               │
│  Memories pruned but not forgotten:           │
│                                               │
│  📜 "Random thought about coffee"             │
│     Created: March 2024                       │
│     Archived: Jan 2025 (no connections)       │
│                                               │
│  📜 "Brief note on walking"                   │
│     Created: April 2024                       │
│     Archived: Jan 2025 (never reviewed)       │
│                                               │
│  [View All 23 Tombstones]                     │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Pruning is **opt-in** - user must approve each deletion
- Max 5 pruning suggestions at once (not overwhelming)
- Pruning suggestions quarterly (not constantly)
- Option to "restore" tombstone within 30 days (undo buffer)
- After 30 days, tombstones are permanent (content deleted)

---

## Implementation Priority

**Phase 1 (MVP):**
1. Memory Decay Visualization (easy, high impact)
2. Context Windows (medium effort, high value)

**Phase 2 (Enhanced):**
3. Cross-Memory Synthesis Notes (complex, powerful)
4. Memory Collision Detection (AI-heavy, novel)

**Phase 3 (Polish):**
5. Memory Export as Narrative (nice-to-have)
6. Dead Memory Pruning (maintenance feature)

---

## Database Schema Changes

```sql
-- Context Windows
CREATE TABLE context_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  theme TEXT NOT NULL,
  memory_ids UUID[] NOT NULL,
  memory_count INTEGER NOT NULL,
  dominant_entities TEXT[],
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Synthesis Notes (extends memories table)
ALTER TABLE memories ADD COLUMN is_synthesis BOOLEAN DEFAULT false;
ALTER TABLE memories ADD COLUMN source_memory_ids UUID[];
ALTER TABLE memories ADD COLUMN synthesis_type TEXT; -- 'connection' | 'contradiction' | 'evolution'

-- Memory Collisions
CREATE TABLE memory_collisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  memory_a_id UUID NOT NULL REFERENCES memories(id),
  memory_b_id UUID NOT NULL REFERENCES memories(id),
  contradiction_type TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  resolution TEXT, -- 'evolved' | 'error' | 'context_dependent'
  resolution_note TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Memory Tombstones
CREATE TABLE memory_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_memory_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  pruned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  prune_reason TEXT,
  restorable_until TIMESTAMP WITH TIME ZONE -- 30 days from pruned_at
);

-- Add decay tracking to memories
ALTER TABLE memories ADD COLUMN strength_score FLOAT DEFAULT 100.0;
ALTER TABLE memories ADD COLUMN last_strength_update TIMESTAMP WITH TIME ZONE DEFAULT now();
```

---

## API Endpoints

```typescript
// Context Windows
GET  /api/memories/context-windows
POST /api/memories/context-windows/generate
GET  /api/memories/context-windows/:id

// Synthesis Notes
POST /api/memories/synthesize
GET  /api/memories/syntheses

// Collisions
GET  /api/memories/collisions
POST /api/memories/collisions/:id/resolve

// Pruning
GET  /api/memories/prune-candidates
POST /api/memories/archive
GET  /api/memories/tombstones
POST /api/memories/tombstones/:id/restore

// Export
POST /api/memories/export
  body: { format: 'markdown' | 'pdf', period: 'week' | 'month' | 'custom' }
```

---

## Success Metrics

- **Context Windows:** 60%+ of users browse timeline view weekly
- **Decay Viz:** Users review 50%+ of "fading" memories when alerted
- **Synthesis Notes:** 10%+ of resurfacing sessions create synthesis
- **Collisions:** 70%+ of detected collisions marked as "real" (not false positive)
- **Pruning:** Users archive 30%+ of suggested candidates
- **Export:** 20%+ of users export at least one summary per month

---

**Status:** Ready for implementation
**Dependencies:** Core memory system, resurfacing, Gemini API
