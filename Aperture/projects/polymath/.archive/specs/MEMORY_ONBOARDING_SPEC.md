# Memory Onboarding System - Complete Specification

> **Status**: Ready for implementation
> **Created**: 2025-10-22
> **Purpose**: Structured memory capture system with AI-powered gap detection and mobile-first UX

---

## Overview

This system replaces ad-hoc voice note capture with a structured onboarding flow that:
1. Collects 10 foundational memories (3+ bullets each)
2. Uses AI to detect gaps and suggest follow-up prompts
3. Unlocks project suggestions after completion
4. Enables ongoing ad-hoc memory capture
5. Mobile-first, thumb-friendly design

---

## User Flow

```
New User
  ↓
10 Foundational Prompts (3+ bullets each)
  ↓
AI analyzes with Gemini Flash 2.5 (all memories context)
  ↓
Projects Section Unlocks
  ↓
[Ongoing] AI suggests follow-up prompts (gap detection)
  ↓
[Ongoing] User adds ad-hoc memories
  ↓
[Weekly] Synthesis uses all memories for project suggestions
```

---

## 10 Priority Memory Prompts

### Core Identity (3 prompts)
1. **Life Overview** - "Give 3+ key phases or moments that shaped who you are today"
2. **Current Situation** - "3+ bullets about your life right now (where, what, who, daily rhythm)"
3. **Values & Strengths** - "3+ principles that guide you OR skills you're known for"

### Relationships (3 prompts)
4. **Partner/Close Relationship** - "3+ things about your most important relationship"
5. **Family Core** - "3+ facts about your immediate family (parents, siblings, kids)"
6. **Close Friends** - "3+ people you're closest to and why they matter"

### Work & Learning (2 prompts)
7. **Career Journey** - "3+ pivotal moments or transitions in your work life"
8. **Current Work** - "3+ things about what you do now and how it makes you feel"

### Interests & Future (2 prompts)
9. **Hobbies & Passions** - "3+ things you do for fun or creative expression"
10. **Goals & Aspirations** - "3+ things you're working toward (short or long term)"

---

## 40 Total Template Prompts

<details>
<summary>View full list of 40 prompts</summary>

### Core Identity (5)
1. Life Overview
2. Current Situation
3. Values & Strengths
4. Challenges & Growth
5. Personality Traits

### Relationships (8)
6. Partner/Spouse
7. How You Met Partner
8. Wedding (if applicable)
9. Parents
10. Siblings
11. Children (if applicable)
12. Close Friends
13. Groomsmen/Bridesmaids (if applicable)

### Places & Geography (3)
14. Childhood Home
15. Places You've Lived
16. Meaningful Locations

### Education & Career (4)
17. School Years
18. University/College
19. Career Journey
20. Current Work

### Interests & Hobbies (5)
21. Current Hobbies
22. Creative Pursuits
23. Physical Activities
24. Media Consumption
25. Learning & Curiosity

### Life Events & Milestones (6)
26. Major Achievements
27. Difficult Periods
28. Turning Points
29. Travel & Adventures
30. Health & Wellness Journey
31. Spiritual/Philosophical Journey

### Daily Life & Routines (4)
32. Morning Routine
33. Evening Routine
34. Weekend Patterns
35. Home Environment

### Aspirations & Future (3)
36. Short-Term Goals (1-2 years)
37. Long-Term Vision (5-10 years)
38. Legacy & Impact

### Creative & Professional (2)
39. Projects You've Built
40. Technical Capabilities

</details>

---

## Database Schema Extensions

### New Table: `memory_prompts`

```sql
CREATE TABLE IF NOT EXISTS memory_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  prompt_description TEXT, -- Expanded explanation
  category TEXT NOT NULL, -- 'core_identity', 'relationships', 'places', etc.
  priority_order INTEGER, -- 1-10 for required prompts, NULL for optional
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_memory_prompts_priority ON memory_prompts(priority_order) WHERE priority_order IS NOT NULL;
CREATE INDEX idx_memory_prompts_category ON memory_prompts(category);
```

### New Table: `memory_responses`

```sql
CREATE TABLE IF NOT EXISTS memory_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_id UUID REFERENCES memory_prompts(id) ON DELETE SET NULL,
  custom_title TEXT, -- NULL if template prompt, populated if ad-hoc
  bullets TEXT[] NOT NULL CHECK (array_length(bullets, 1) >= 3),
  is_template BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding VECTOR(768)
);

CREATE INDEX idx_memory_responses_user_id ON memory_responses(user_id);
CREATE INDEX idx_memory_responses_prompt_id ON memory_responses(prompt_id);
CREATE INDEX idx_memory_responses_created_at ON memory_responses(created_at DESC);
CREATE INDEX idx_memory_responses_embedding ON memory_responses USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE memory_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memory responses"
  ON memory_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory responses"
  ON memory_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory responses"
  ON memory_responses FOR UPDATE
  USING (auth.uid() = user_id);
```

### New Table: `user_prompt_status`

Tracks which prompts user has completed/dismissed:

```sql
CREATE TABLE IF NOT EXISTS user_prompt_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_id UUID NOT NULL REFERENCES memory_prompts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'dismissed', 'suggested')),
  response_id UUID REFERENCES memory_responses(id) ON DELETE SET NULL,
  suggested_at TIMESTAMP WITH TIME ZONE, -- When AI suggested this as follow-up
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_prompt_status_unique ON user_prompt_status(user_id, prompt_id);
CREATE INDEX idx_user_prompt_status_user_id ON user_prompt_status(user_id);
CREATE INDEX idx_user_prompt_status_status ON user_prompt_status(status);

-- RLS
ALTER TABLE user_prompt_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompt status"
  ON user_prompt_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own prompt status"
  ON user_prompt_status FOR ALL
  USING (auth.uid() = user_id);
```

### Extend `project_suggestions` Table

Add synthesis transparency:

```sql
ALTER TABLE project_suggestions
  ADD COLUMN IF NOT EXISTS source_analysis JSONB DEFAULT '{}';

COMMENT ON COLUMN project_suggestions.source_analysis IS 'Detailed synthesis transparency: {capabilities_used: [...], interests_matched: [...], synthesis_reasoning: "..."}';
```

### Extend `projects` Table

Add note tracking and dormancy detection:

```sql
-- Already has metadata JSONB, will use:
-- metadata.from_suggestion: string | null
-- metadata.original_points: number | null
-- metadata.detected_capabilities: string[]
-- metadata.energy_level: 'low' | 'medium' | 'high'
-- metadata.estimated_time: string
-- metadata.materials_needed: string[]

-- Add dormancy tracking
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS days_dormant INTEGER GENERATED ALWAYS AS (
    EXTRACT(day FROM (now() - last_active))
  ) STORED;

CREATE INDEX idx_projects_days_dormant ON projects(days_dormant DESC);
```

### New Table: `project_notes`

```sql
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bullets TEXT[] NOT NULL CHECK (array_length(bullets, 1) >= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding VECTOR(768)
);

CREATE INDEX idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX idx_project_notes_created_at ON project_notes(created_at DESC);

-- RLS
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes for their own projects"
  ON project_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create notes for their own projects"
  ON project_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## AI Gap Detection Logic

After each memory response is submitted:

```typescript
async function detectGaps(userId: string, latestMemoryId: string) {
  // Fetch all user memories
  const allMemories = await supabase
    .from('memory_responses')
    .select('*, memory_prompts(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const latestMemory = allMemories.data[0]

  // Send to Gemini Flash 2.5 with ALL context
  const gapAnalysis = await geminiFlash.generate({
    model: 'gemini-2.0-flash-exp',
    prompt: `
      User just answered: "${latestMemory.memory_prompts.prompt_text}"
      Their response:
      ${latestMemory.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

      All their memories so far (${allMemories.data.length} total):
      ${allMemories.data.map(m => `
        Prompt: ${m.memory_prompts?.prompt_text || m.custom_title}
        Response: ${m.bullets.join('; ')}
      `).join('\n\n')}

      Analyze for interesting gaps or unexplored depth.
      Generate 0-2 follow-up prompts that:
      1. Dig deeper into interesting details they mentioned
      2. Explore emotional/relational aspects not yet covered
      3. Fill narrative gaps (e.g., "how did X happen?", "tell me about Y")

      Return ONLY valid JSON (no markdown):
      {
        "followUpPrompts": [
          {
            "promptText": "...",
            "reasoning": "Why this gap is interesting"
          }
        ]
      }
    `
  })

  const { followUpPrompts } = JSON.parse(gapAnalysis)

  // Create custom prompts and mark as suggested
  for (const prompt of followUpPrompts) {
    const { data: newPrompt } = await supabase
      .from('memory_prompts')
      .insert({
        prompt_text: prompt.promptText,
        prompt_description: prompt.reasoning,
        category: 'ai_suggested',
        is_required: false
      })
      .select()
      .single()

    await supabase
      .from('user_prompt_status')
      .insert({
        user_id: userId,
        prompt_id: newPrompt.id,
        status: 'suggested',
        suggested_at: new Date().toISOString()
      })
  }

  return followUpPrompts
}
```

---

## Node Strengthening Algorithm

Runs daily at 00:00 UTC:

```typescript
async function strengthenNodes() {
  // 1. Scan git commits from last 7 days
  const commits = await getRecentCommits(7)

  // 2. Map files to capabilities
  const capabilityActivity = new Map<string, number>()

  for (const commit of commits) {
    for (const file of commit.files) {
      // Match file patterns to capabilities
      const caps = await matchFileToCapabilities(file)

      for (const capId of caps) {
        capabilityActivity.set(
          capId,
          (capabilityActivity.get(capId) || 0) + 1
        )
      }
    }
  }

  // 3. Update node strengths
  for (const [capId, commitCount] of capabilityActivity.entries()) {
    const { data: node } = await supabase
      .from('node_strengths')
      .select('*')
      .eq('node_type', 'capability')
      .eq('node_id', capId)
      .single()

    const currentStrength = node?.strength || 0.5

    // Boost formula: higher boost for low-strength nodes
    const baseBoost = 0.10
    const strengthMultiplier = 1 - (currentStrength * 0.5) // High strength = lower multiplier
    const boost = baseBoost * commitCount * strengthMultiplier

    const newStrength = Math.min(currentStrength + boost, 1.0)

    await supabase
      .from('node_strengths')
      .upsert({
        node_type: 'capability',
        node_id: capId,
        strength: newStrength,
        activity_count: (node?.activity_count || 0) + commitCount,
        last_activity: new Date().toISOString()
      })
  }

  // 4. Decay unused nodes (slow decay)
  const allNodes = await supabase
    .from('node_strengths')
    .select('*')
    .lt('last_activity', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days

  for (const node of allNodes.data) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(node.last_activity).getTime()) / (24 * 60 * 60 * 1000)
    )

    // Decay 0.01 per 30 days inactive
    const decay = 0.01 * Math.floor(daysSinceActivity / 30)
    const newStrength = Math.max(node.strength - decay, 0.1) // Min 0.1

    await supabase
      .from('node_strengths')
      .update({ strength: newStrength })
      .eq('id', node.id)
  }
}
```

---

## Dormant Project Resurfacing

Runs daily at 09:00 UTC:

```typescript
async function checkDormantProjects() {
  const dormancyThresholds = {
    cooling: 7,   // 7-30 days
    cold: 30,     // 30-90 days
    frozen: 90    // 90+ days
  }

  // Find projects in each dormancy level
  const coolingProjects = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .gte('days_dormant', dormancyThresholds.cooling)
    .lt('days_dormant', dormancyThresholds.cold)

  const coldProjects = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .gte('days_dormant', dormancyThresholds.cold)
    .lt('days_dormant', dormancyThresholds.frozen)

  const frozenProjects = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .gte('days_dormant', dormancyThresholds.frozen)

  // Create nudges (store in notifications table or return in API)
  const nudges = []

  // Cooling: gentle reminder
  for (const project of coolingProjects.data) {
    nudges.push({
      project_id: project.id,
      type: 'gentle_reminder',
      message: `It's been ${project.days_dormant} days - time for another session?`,
      actions: ['quick_update', 'not_now', 'mark_on_hold']
    })
  }

  // Cold: stronger nudge
  for (const project of coldProjects.data) {
    nudges.push({
      project_id: project.id,
      type: 'strong_nudge',
      message: `${project.days_dormant} days since your last update. What's going on?`,
      actions: ['on_hold', 'archive', 'revive']
    })
  }

  // Frozen: archive suggestion
  for (const project of frozenProjects.data) {
    nudges.push({
      project_id: project.id,
      type: 'archive_suggestion',
      message: `${project.days_dormant} days frozen. Move to archive?`,
      actions: ['keep_active', 'archive']
    })
  }

  return nudges
}
```

---

## Synthesis Transparency

When generating project suggestions, include detailed source analysis:

```typescript
async function generateSuggestion(capabilities, interests, memories) {
  const suggestion = await claudeSonnet.generate({
    // ... synthesis prompt
  })

  // Build transparency object
  const sourceAnalysis = {
    capabilities_used: capabilities.map(c => ({
      id: c.id,
      name: c.name,
      strength: c.strength,
      source_project: c.source_project,
      recent_commits: c.activity_count
    })),
    interests_matched: interests.map(i => ({
      memory_id: i.memory_id,
      quote: i.relevantQuote, // Extract from memory
      relevance_score: i.similarity
    })),
    synthesis_reasoning: suggestion.reasoning,
    node_strength_changes: capabilities.map(c => ({
      capability_id: c.id,
      strength_boost: 0.30 // If user builds this
    }))
  }

  await supabase
    .from('project_suggestions')
    .insert({
      // ... other fields
      source_analysis: sourceAnalysis,
      metadata: {
        tags: suggestion.tags,
        estimated_time: suggestion.estimatedTime,
        difficulty: suggestion.difficulty
      }
    })
}
```

---

## Mobile-First Component Structure

### Components to Build

```
src/components/memories/
  FoundationalPrompts.tsx      - 10 priority prompts
  PromptModal.tsx              - Full-screen bullet entry
  SuggestedPrompts.tsx         - AI follow-up prompts
  AdHocMemoryModal.tsx         - Freeform memory creation
  MemoryCard.tsx               - Display completed memory

src/components/projects/
  ProjectCard.tsx              - ✓ Exists, enhance with dormancy
  ProjectDetailView.tsx        - Full-screen project detail
  QuickUpdateSheet.tsx         - Bottom sheet for quick updates
  DormantProjectNudge.tsx      - Sticky nudge card
  ProjectNoteModal.tsx         - Add notes (3+ bullets)

src/components/suggestions/
  SuggestionCard.tsx           - ✓ Exists, add swipe + transparency
  SynthesisTransparency.tsx    - "Why this matches you" section
  ActiveSkillsWidget.tsx       - "Active this week" widget
  NodeStrengthVisualization.tsx - Strength bars with change indicators

src/components/ui/
  BottomSheet.tsx              - Mobile bottom sheet
  SwipeableCard.tsx            - Tinder-style swipe
  ProgressBar.tsx              - Visual progress indicators
  FAB.tsx                      - Floating action button
```

### Mobile Layout Structure

```typescript
// Mobile-first breakpoints
const breakpoints = {
  mobile: '0-640px',    // Primary target
  tablet: '641-1024px', // Secondary
  desktop: '1025px+'    // Tertiary
}

// Thumb-friendly zones
const touchZones = {
  primary: 'bottom 1/3',    // FABs, CTAs
  secondary: 'top bar',     // Back, menu
  content: 'middle scroll'  // Cards, lists
}

// Haptic feedback
const haptics = {
  light: 'button tap',
  medium: 'swipe action',
  heavy: 'success/error'
}
```

---

## API Endpoints

### New Endpoints

```typescript
// GET /api/memories/prompts
// Returns all available prompts + user status
{
  required: Prompt[],    // 10 priority prompts
  suggested: Prompt[],   // AI-generated follow-ups
  optional: Prompt[],    // Remaining 30 templates
  userProgress: {
    completed: number,   // e.g., 7
    total: number       // 10
  }
}

// POST /api/memories/responses
// Submit memory response
{
  prompt_id: string | null,  // NULL for ad-hoc
  custom_title?: string,     // For ad-hoc memories
  bullets: string[]          // Min 3 bullets
}

// GET /api/projects/nudges
// Get dormant project nudges
{
  nudges: Array<{
    project_id: string,
    type: 'gentle_reminder' | 'strong_nudge' | 'archive_suggestion',
    days_dormant: number,
    message: string,
    actions: string[]
  }>
}

// POST /api/projects/[id]/notes
// Add note to project
{
  bullets: string[]  // Min 1 bullet
}

// POST /api/projects/[id]/quick-update
// Quick status update
{
  action: 'did_session' | 'taking_break',
  bullets?: string[]  // Optional details
}

// GET /api/synthesis/active-skills
// Get recently strengthened nodes
{
  activeSkills: Array<{
    capability_id: string,
    name: string,
    strength: number,
    change: number,      // +0.30
    commits: number,
    related_suggestions: Suggestion[]
  }>
}
```

---

## Implementation Plan

### Phase 1: Database (Day 1)
- [ ] Add new tables to migration.sql
- [ ] Run migration on Supabase
- [ ] Seed 40 template prompts
- [ ] Test RLS policies

### Phase 2: Memory Onboarding (Days 2-3)
- [ ] Build FoundationalPrompts component
- [ ] Build PromptModal (full-screen, mobile-first)
- [ ] Implement bullet validation (3+ bullets, AI quality check)
- [ ] Add progress tracking
- [ ] Create API endpoints

### Phase 3: AI Gap Detection (Day 4)
- [ ] Implement gap detection algorithm
- [ ] Build SuggestedPrompts component
- [ ] Test with Gemini Flash 2.5
- [ ] Handle follow-up prompt creation

### Phase 4: Projects Enhancement (Days 5-6)
- [ ] Add dormancy detection
- [ ] Build DormantProjectNudge component
- [ ] Build QuickUpdateSheet (bottom sheet)
- [ ] Build ProjectNoteModal
- [ ] Implement project notes API

### Phase 5: Node Strengthening (Day 7)
- [ ] Implement git commit scanning
- [ ] Build strengthening algorithm
- [ ] Create ActiveSkillsWidget
- [ ] Add visual strength indicators

### Phase 6: Synthesis Transparency (Day 8)
- [ ] Extend synthesis to include source_analysis
- [ ] Build SynthesisTransparency component
- [ ] Add "wow" factor to suggestions
- [ ] Test full flow

### Phase 7: Mobile Optimization (Days 9-10)
- [ ] Build SwipeableCard component
- [ ] Build BottomSheet component
- [ ] Add haptic feedback
- [ ] Implement offline support
- [ ] Test on actual mobile devices

### Phase 8: Testing & Polish (Day 11)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Loading states

---

## Success Metrics

- [ ] New user completes 10 prompts in <30 minutes
- [ ] AI generates 0-2 relevant follow-up prompts per submission
- [ ] Project suggestions unlock after 10 memories
- [ ] Dormant projects resurface within 24 hours of threshold
- [ ] Mobile UX is thumb-friendly (no reaching top of screen)
- [ ] Node strengthening reflects git activity accurately
- [ ] Synthesis transparency shows clear "why this matches you"

---

## Next Steps

1. Run extended migration.sql
2. Seed memory prompt templates
3. Start Phase 1 implementation
4. Test with real user data

---

**Ready to build!** 🚀
