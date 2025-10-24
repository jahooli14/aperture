# Cross-Pillar Improvements

> Connecting memories and projects into a unified creative system

## Overview

Memories and projects are currently separate. These improvements create **bidirectional flow**:
- Memories → Projects (context for work)
- Projects → Memories (learning capture)
- Synthesis constraints (user control)

---

## 1. Memory → Project Dependency Tracking

**Problem:** User starts working on a project but forgot key context captured in related memories.

**Solution:** Explicit "required memory" linking with refresh prompts before work sessions.

### Data Model

```typescript
interface ProjectMemoryDependency {
  project_id: string
  memory_id: string
  dependency_type: 'required' | 'helpful' | 'related'
  reason: string // Why this memory is needed
  last_reviewed: Date | null
  auto_detected: boolean // AI-suggested vs. user-added
}
```

### Auto-Detection Algorithm

When project is created or updated, AI scans memories for relevant context:

```typescript
async function detectMemoryDependencies(project: Project): Promise<Dependency[]> {
  // 1. Get project embedding
  const projectEmbedding = await embed(project.title + project.description)

  // 2. Find semantically similar memories
  const similarMemories = await vectorSearch({
    table: 'memories',
    embedding: projectEmbedding,
    limit: 10,
    threshold: 0.7 // High similarity required
  })

  // 3. Use AI to classify relevance
  const dependencies: Dependency[] = []
  for (const memory of similarMemories) {
    const analysis = await analyzeRelevance(project, memory)

    if (analysis.is_required) {
      dependencies.push({
        memory_id: memory.id,
        dependency_type: 'required',
        reason: analysis.reason,
        auto_detected: true
      })
    }
  }

  return dependencies
}

async function analyzeRelevance(project: Project, memory: Memory) {
  const prompt = `
Project: ${project.title}
Description: ${project.description}

Memory: ${memory.title}
Content: ${memory.content}

Is this memory REQUIRED context for working on this project?
(Required = can't proceed without this knowledge)

Respond with:
{
  "is_required": true/false,
  "reason": "brief explanation"
}
  `

  return await gemini.generateContent(prompt)
}
```

### UI Implementation

**Project Detail View - Dependencies Section:**
```
┌──────────────────────────────────────────────┐
│  Portfolio Website                            │
│  65% complete                                 │
│                                               │
│  📚 Required Context (2 memories)             │
│  ┌────────────────────────────────────────┐  │
│  │ 📌 "React best practices"               │  │
│  │    Reviewed: 5 days ago ✓                │  │
│  │    Why: Core architecture decisions      │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ┌────────────────────────────────────────┐  │
│  │ ⚠️ "Design system colors"                │  │
│  │    Not reviewed in 30 days               │  │
│  │    Why: Need to match brand colors       │  │
│  │    [Review Now]                           │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  💡 Helpful Context (3 memories)              │
│     [View related memories]                   │
└──────────────────────────────────────────────┘
```

**Pre-Work Prompt (When Starting Project):**
```
┌──────────────────────────────────────────────┐
│  Ready to work on Portfolio Website?          │
│                                               │
│  ⚠️ Required memory needs refresh             │
│                                               │
│  "Design system colors" hasn't been reviewed  │
│  in 30 days. Quick refresh before starting?   │
│                                               │
│  [Review Memory (2 min)] [Skip] [Work Anyway] │
└──────────────────────────────────────────────┘
```

**Manual Linking:**
```
┌──────────────────────────────────────────────┐
│  Link Memory to Project                       │
│                                               │
│  Project: Portfolio Website                   │
│                                               │
│  Search memories:                             │
│  ┌────────────────────────────────────────┐  │
│  │ design system, colors, branding...     │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  Results:                                     │
│  ☐ "Design system colors"                    │
│  ☐ "Brand guidelines discussion"             │
│  ☐ "UI inspiration from..."                  │
│                                               │
│  Dependency type:                             │
│  ● Required  ○ Helpful  ○ Related            │
│                                               │
│  Why is this memory needed?                   │
│  ┌────────────────────────────────────────┐  │
│  │ Need to reference exact color codes    │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  [Link Memory]                                │
└──────────────────────────────────────────────┘
```

### Anti-Overwhelm Design
- Only alert for "required" dependencies (not "helpful" or "related")
- Max 1 memory review prompt per work session
- Can dismiss prompt with "Don't ask again for this project"
- Auto-detection is optional (can disable)

---

## 2. Project Completion → Auto-Memory Creation

**Problem:** When projects finish, learnings are lost. No capture of "what worked" or "what I learned."

**Solution:** Automatic post-project reflection prompt that creates a new memory.

### Trigger

When project status changes to `completed`:
1. Prompt user for reflection
2. Create memory from reflection
3. Link memory back to project
4. Update capability strengths based on learnings

### Data Model

```typescript
interface ProjectCompletionMemory extends Memory {
  type: 'project_reflection'
  source_project_id: string
  reflection: {
    what_worked: string
    what_surprised: string
    what_learned: string
    would_do_differently: string
  }
  capabilities_strengthened: string[] // Updated based on reflection
}
```

### UI Implementation

**Completion Flow:**
```
[User marks project as Complete]

┌──────────────────────────────────────────────┐
│  🎉 Project Completed!                        │
│                                               │
│  Portfolio Website is done!                   │
│                                               │
│  Before closing, capture your learnings:      │
│                                               │
│  What worked well?                            │
│  ┌────────────────────────────────────────┐  │
│  │ React + TypeScript combo was smooth,   │  │
│  │ component library saved tons of time   │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  What surprised you?                          │
│  ┌────────────────────────────────────────┐  │
│  │ Deployment to Vercel was way easier    │  │
│  │ than expected - 5 minutes total        │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  What did you learn?                          │
│  ┌────────────────────────────────────────┐  │
│  │ Form validation patterns, accessibility│  │
│  │ best practices, responsive design      │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  What would you do differently next time?     │
│  ┌────────────────────────────────────────┐  │
│  │ Start with mobile-first design,        │  │
│  │ set up testing from day 1              │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  [Save Reflection] [Skip]                     │
│                                               │
│  💡 This creates a memory you can reference   │
│     for future projects                       │
└──────────────────────────────────────────────┘
```

**Created Memory (Auto-generated):**
```
┌──────────────────────────────────────────────┐
│  📝 Memory: Portfolio Website - Learnings     │
│                                               │
│  Project completed: Jan 24, 2025              │
│                                               │
│  What worked: React + TypeScript combo was    │
│  smooth, component library saved time         │
│                                               │
│  Surprises: Vercel deployment easier than     │
│  expected (5 min)                             │
│                                               │
│  Learned: Form validation, accessibility,     │
│  responsive design patterns                   │
│                                               │
│  Next time: Mobile-first, testing from day 1  │
│                                               │
│  Capabilities strengthened:                   │
│  • React (+15% freshness)                    │
│  • TypeScript (+10% freshness)               │
│  • Accessibility (+20% freshness)            │
│                                               │
│  Linked to: Portfolio Website (completed)     │
└──────────────────────────────────────────────┘
```

### AI Enhancement (Optional)

If user skips manual reflection, AI can generate one from commit history:

```typescript
async function generateProjectReflection(project: Project) {
  const commits = await getProjectCommits(project.id)
  const commitMessages = commits.map(c => c.message).join('\n')

  const prompt = `
Project: ${project.title}
Duration: ${project.duration_days} days
Commits: ${commits.length}
Commit history:
${commitMessages}

Generate a brief project reflection covering:
- What likely worked well
- What the developer learned
- Capabilities used/strengthened

Keep it concise (3-4 sentences).
  `

  return await gemini.generateContent(prompt)
}
```

### Anti-Overwhelm Design
- Reflection is **optional** (can skip)
- Fields are **optional** (can fill just one)
- AI can fill in gaps if user provides minimal input
- Prompt appears once at completion (not repeated)
- Can disable auto-prompts in settings

---

## 3. Synthesis Constraints UI

**Problem:** AI synthesis generates suggestions blindly. User can't say "only short projects" or "use stale capabilities."

**Solution:** User-configurable constraints that tune synthesis behavior.

### Constraint Types

```typescript
interface SynthesisConstraints {
  time_limit: 'none' | 'under_1_week' | 'under_1_month' | 'custom'
  energy_preference: 'low' | 'moderate' | 'high' | 'any'
  project_type: 'creative' | 'technical' | 'learning' | 'any'
  capability_strategy: 'use_strongest' | 'use_stale' | 'balanced' | 'explore_new'
  novelty_preference: 'safe' | 'balanced' | 'wild' // Low vs high novelty
  exclude_capabilities: string[] // Capabilities to avoid
  require_capabilities: string[] // Must include these
  interest_alignment: 'strict' | 'loose' // How closely to match interests
  custom_note: string // Free-text guidance for AI
}
```

### UI Implementation

**Synthesis Settings:**
```
┌──────────────────────────────────────────────┐
│  🎛️ Tune Your Suggestions                     │
│                                               │
│  Time Commitment                              │
│  ○ Any length                                │
│  ● Projects under 1 week                     │
│  ○ Projects under 1 month                    │
│  ○ Custom: [___] days                        │
│                                               │
│  Energy Level                                 │
│  ○ Low energy (maintenance, easy wins)       │
│  ● Moderate (normal creative work)           │
│  ○ High energy (ambitious, flow state)       │
│  ○ Any                                        │
│                                               │
│  Project Type                                 │
│  ○ Creative only (art, writing, music)       │
│  ○ Technical only (coding projects)          │
│  ○ Learning focused (skill building)         │
│  ● Any type                                  │
│                                               │
│  Capability Strategy                          │
│  ○ Use strongest skills (leverage expertise) │
│  ● Use stale skills (refresh old knowledge)  │
│  ○ Balanced mix                              │
│  ○ Explore new capabilities                  │
│                                               │
│  Novelty Preference                           │
│  Safe ◉━━━━━━━━━━○ Wild                      │
│                                               │
│  Exclude Capabilities                         │
│  [+ Add capability to avoid]                  │
│                                               │
│  Require Capabilities                         │
│  [+ Add must-have capability]                 │
│                                               │
│  Custom Guidance (optional)                   │
│  ┌────────────────────────────────────────┐  │
│  │ Focus on projects that could generate  │  │
│  │ income or portfolio pieces             │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  [Save Constraints] [Reset to Defaults]       │
│                                               │
│  💡 These settings apply to next synthesis    │
└──────────────────────────────────────────────┘
```

**Quick Presets:**
```
┌──────────────────────────────────────────────┐
│  Quick Constraint Presets                     │
│                                               │
│  [Quick Wins]                                 │
│  Under 1 week, low energy, use stale skills   │
│                                               │
│  [Ambitious Build]                            │
│  1+ month, high energy, use strongest skills  │
│                                               │
│  [Learning Focus]                             │
│  Learning projects, explore new capabilities  │
│                                               │
│  [Creative Flow]                              │
│  Creative only, high energy, any length       │
│                                               │
│  [Custom]                                     │
│  Create your own constraint set               │
└──────────────────────────────────────────────┘
```

**Synthesis Preview:**
```
┌──────────────────────────────────────────────┐
│  Generate Suggestions with Constraints        │
│                                               │
│  Current constraints:                         │
│  ✓ Projects under 1 week                     │
│  ✓ Use stale skills                          │
│  ✓ Balanced novelty                          │
│                                               │
│  Expected results:                            │
│  • ~10 suggestions                            │
│  • Focus on: Python (rusty), Docker (stale)  │
│  • Est. time per project: 2-5 days           │
│                                               │
│  [Generate Now] [Edit Constraints]            │
└──────────────────────────────────────────────┘
```

### Implementation in Synthesis

```typescript
async function synthesizeWithConstraints(
  constraints: SynthesisConstraints,
  capabilities: Capability[],
  interests: Interest[]
): Promise<ProjectSuggestion[]> {

  // 1. Filter capabilities based on strategy
  let candidateCapabilities = capabilities
  if (constraints.capability_strategy === 'use_stale') {
    candidateCapabilities = capabilities.filter(c => c.freshness < 60)
  } else if (constraints.capability_strategy === 'use_strongest') {
    candidateCapabilities = capabilities
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10)
  }

  // 2. Apply exclusions/requirements
  candidateCapabilities = candidateCapabilities.filter(c =>
    !constraints.exclude_capabilities.includes(c.id)
  )

  if (constraints.require_capabilities.length > 0) {
    // Ensure at least one required capability in each suggestion
  }

  // 3. Generate suggestions with AI
  const suggestions = await generateSuggestions({
    capabilities: candidateCapabilities,
    interests,
    constraints
  })

  // 4. Filter by time/energy/novelty
  const filtered = suggestions.filter(s => {
    // Time constraint
    if (constraints.time_limit === 'under_1_week' && s.estimated_time > 7) {
      return false
    }

    // Energy constraint
    if (constraints.energy_preference !== 'any' &&
        s.energy_level !== constraints.energy_preference) {
      return false
    }

    // Novelty constraint (slider)
    const noveltyThreshold = constraints.novelty_preference === 'safe' ? 0.5 : 0.8
    if (s.novelty_score > noveltyThreshold && constraints.novelty_preference === 'safe') {
      return false
    }

    return true
  })

  return filtered
}
```

### Anti-Overwhelm Design
- **Presets** available for common scenarios
- Constraints are **optional** (synthesis works without them)
- "Reset to Defaults" clears all constraints
- Preview shows **what to expect** before generating
- Can save constraint sets as named presets

---

## Database Schema Changes

```sql
-- Memory-Project Dependencies
CREATE TABLE project_memory_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL, -- 'required' | 'helpful' | 'related'
  reason TEXT,
  last_reviewed TIMESTAMP WITH TIME ZONE,
  auto_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, memory_id)
);

CREATE INDEX idx_dependencies_project ON project_memory_dependencies(project_id);
CREATE INDEX idx_dependencies_memory ON project_memory_dependencies(memory_id);
CREATE INDEX idx_dependencies_required ON project_memory_dependencies(dependency_type)
  WHERE dependency_type = 'required';

-- Project Completion Memories
ALTER TABLE memories ADD COLUMN source_project_id UUID REFERENCES projects(id);
ALTER TABLE memories ADD COLUMN reflection JSONB;
ALTER TABLE memories ADD COLUMN capabilities_strengthened TEXT[];

-- Synthesis Constraints
CREATE TABLE synthesis_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT, -- Preset name (null for active constraints)
  is_active BOOLEAN DEFAULT false, -- Only one active constraint set
  constraints JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_constraints_active ON synthesis_constraints(user_id, is_active)
  WHERE is_active = true;
```

---

## API Endpoints

```typescript
// Memory-Project Dependencies
GET  /api/projects/:id/dependencies
POST /api/projects/:id/dependencies
  body: { memory_id, dependency_type, reason }
DELETE /api/projects/:projectId/dependencies/:memoryId
POST /api/projects/:id/detect-dependencies

// Pre-work checks
GET  /api/projects/:id/pre-work-check
  response: { needs_review: boolean, memories: Memory[] }

// Project Completion
POST /api/projects/:id/complete
  body: { reflection?: { what_worked, what_surprised, what_learned, would_do_differently } }
  response: { memory_created: Memory }

// Synthesis Constraints
GET  /api/synthesis/constraints
POST /api/synthesis/constraints
  body: { constraints: SynthesisConstraints }
PUT  /api/synthesis/constraints/:id
DELETE /api/synthesis/constraints/:id
POST /api/synthesis/constraints/:id/activate
GET  /api/synthesis/constraints/presets
```

---

## User Flows

### Flow 1: Memory-Dependent Project Work

```
1. User opens Daily Queue
2. Clicks "Continue" on Portfolio Website
3. System checks memory dependencies:
   → "Design system colors" not reviewed in 30 days
4. Pre-work prompt appears
5. User clicks "Review Memory (2 min)"
6. Memory opens in modal
7. After review, memory.last_reviewed updated
8. User returns to project, starts work
9. Dependency requirement satisfied ✓
```

### Flow 2: Project Completion Reflection

```
1. User completes final task in project
2. Clicks "Mark as Complete"
3. Completion modal appears with reflection prompts
4. User fills out (or skips fields)
5. System creates memory from reflection
6. Memory linked to completed project
7. Capabilities freshness updated based on learnings
8. Confirmation: "Reflection saved! View in Memories"
```

### Flow 3: Constrained Synthesis

```
1. User clicks "Generate Suggestions"
2. Instead of immediate synthesis, constraint dialog appears
3. User selects "Quick Wins" preset:
   - Under 1 week
   - Low energy
   - Use stale skills
4. Preview shows: "Expected 8 suggestions, focus on Python (rusty)"
5. User clicks "Generate Now"
6. Synthesis runs with constraints
7. Suggestions page shows filtered results
8. Banner: "Showing suggestions matching: Quick Wins preset"
```

---

## Success Metrics

- **Dependencies:** 40%+ of projects have at least 1 required memory
- **Pre-work Reviews:** 60%+ of dependency prompts result in memory review
- **Completion Reflections:** 50%+ of completed projects create reflection memory
- **Constraints Usage:** 30%+ of synthesis runs use custom constraints
- **Constraint Satisfaction:** 80%+ of constrained suggestions match user expectations

---

**Status:** Ready for implementation
**Dependencies:** Memory system, project system, AI synthesis engine
