# Memory Onboarding System - Ready for Implementation

> **Status**: ✅ Foundation Complete - Ready to Build UI & API
> **Date**: 2025-10-22
> **Next**: Implement frontend components and API endpoints

---

## ✅ What's Been Built

### 1. **Complete Specification** ✓
- File: `MEMORY_ONBOARDING_SPEC.md`
- 40 memory prompts (10 required, 30 optional)
- Node strengthening algorithm
- Dormant project resurfacing logic
- Synthesis transparency design
- Mobile-first UX flows

### 2. **Database Schema** ✓
- File: `migration-memory-onboarding.sql`
- New tables:
  - `memory_prompts` - 40 template prompts
  - `memory_responses` - User's 3+ bullet responses
  - `user_prompt_status` - Completion tracking
  - `project_notes` - Project journal entries
- Extended tables:
  - `projects.days_dormant` - Computed column
  - `projects_suggestions.source_analysis` - Transparency
- Helper functions:
  - `get_memory_progress(user_id)` - Check completion
  - `has_unlocked_projects(user_id)` - Gate check
- Triggers:
  - Auto-update `updated_at` timestamps
  - Auto-update `project.last_active` on note creation

### 3. **Seed Data** ✓
- File: `scripts/seed-memory-prompts.sql`
- 40 prompts ready to insert
- Organized by category:
  - Core Identity (5)
  - Relationships (8)
  - Places (3)
  - Education & Career (4)
  - Interests & Hobbies (5)
  - Life Events (6)
  - Daily Life (4)
  - Aspirations (3)
  - Creative/Professional (2)

### 4. **TypeScript Types** ✓
- File: `src/types.ts`
- All interfaces defined:
  - Memory onboarding (`MemoryPrompt`, `MemoryResponse`, `UserPromptStatus`)
  - Projects (`ProjectNote`, `ProjectWithNotes`, `DormantProjectNudge`)
  - Synthesis (`SourceAnalysis`, `CapabilityUsed`, `InterestMatched`)
  - Node strengthening (`ActiveSkill`, `NodeStrengthUpdate`)
  - API responses (all endpoints)

---

## 🚀 Next Steps - Implementation Plan

### **Phase 1: Database Setup** (30 mins)

```bash
# 1. Run migrations
# In Supabase SQL Editor:
# - Run migration-memory-onboarding.sql
# - Run scripts/seed-memory-prompts.sql

# 2. Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('memory_prompts', 'memory_responses', 'user_prompt_status', 'project_notes');

# Should return 4 rows

# 3. Check prompt count
SELECT COUNT(*) FROM memory_prompts WHERE is_required = true;
-- Should be 10

SELECT COUNT(*) FROM memory_prompts;
-- Should be 40
```

---

### **Phase 2: API Endpoints** (4-6 hours)

Create these files in `api/`:

#### `api/memory-prompts.ts`
```typescript
// GET /api/memory-prompts
// Returns all prompts with user's status
export default async function handler(req, res) {
  const userId = req.headers['x-user-id']

  // Fetch all prompts
  const { data: prompts } = await supabase
    .from('memory_prompts')
    .select('*')
    .order('priority_order', { ascending: true, nullsLast: true })

  // Fetch user's status for each
  const { data: statuses } = await supabase
    .from('user_prompt_status')
    .select('*')
    .eq('user_id', userId)

  // Get progress
  const { data: progress } = await supabase
    .rpc('get_memory_progress', { p_user_id: userId })
    .single()

  const hasUnlocked = await supabase
    .rpc('has_unlocked_projects', { p_user_id: userId })

  // Merge and categorize
  const required = prompts
    .filter(p => p.is_required)
    .map(p => ({
      ...p,
      status: statuses.find(s => s.prompt_id === p.id)?.status || 'pending'
    }))

  // ... (categorize suggested, optional)

  return res.json({
    required,
    suggested,
    optional,
    progress: {
      ...progress,
      has_unlocked_projects: hasUnlocked
    }
  })
}
```

#### `api/memory-responses.ts`
```typescript
// POST /api/memory-responses
// Submit memory response (3+ bullets)
export default async function handler(req, res) {
  const userId = req.headers['x-user-id']
  const { prompt_id, custom_title, bullets } = req.body

  // Validate 3+ bullets
  if (!bullets || bullets.length < 3) {
    return res.status(400).json({ error: 'Minimum 3 bullets required' })
  }

  // AI quality check (Gemini Flash 2.5)
  const qualityCheck = await validateBullets(promptText, bullets)
  if (!qualityCheck.valid) {
    return res.status(400).json({ error: qualityCheck.message })
  }

  // Generate embedding
  const embedding = await generateEmbedding(bullets.join(' '))

  // Insert response
  const { data: response } = await supabase
    .from('memory_responses')
    .insert({
      user_id: userId,
      prompt_id,
      custom_title,
      bullets,
      is_template: !!prompt_id,
      embedding
    })
    .select()
    .single()

  // Update prompt status
  if (prompt_id) {
    await supabase
      .from('user_prompt_status')
      .upsert({
        user_id: userId,
        prompt_id,
        status: 'completed',
        response_id: response.id,
        completed_at: new Date().toISOString()
      })
  }

  // Run gap detection
  const gapAnalysis = await detectGaps(userId, response.id)

  // Get updated progress
  const progress = await getMemoryProgress(userId)

  return res.json({
    response,
    gap_analysis: gapAnalysis,
    progress
  })
}
```

#### `api/projects/nudges.ts`
```typescript
// GET /api/projects/nudges
// Get dormant project nudges
export default async function handler(req, res) {
  const nudges = await checkDormantProjects(userId)
  return res.json({ nudges })
}
```

#### `api/projects/[id]/notes.ts`
```typescript
// POST /api/projects/[id]/notes
// Add note to project
export default async function handler(req, res) {
  const { id } = req.query
  const { bullets } = req.body

  const embedding = await generateEmbedding(bullets.join(' '))

  const { data: note } = await supabase
    .from('project_notes')
    .insert({
      project_id: id,
      user_id: userId,
      bullets,
      embedding
    })
    .select()
    .single()

  // Trigger auto-updates project.last_active
  return res.json({ note })
}
```

#### `api/projects/[id]/quick-update.ts`
```typescript
// POST /api/projects/[id]/quick-update
// Quick status update
export default async function handler(req, res) {
  const { id } = req.query
  const { action, bullets } = req.body

  if (action === 'did_session') {
    // Update last_active
    await supabase
      .from('projects')
      .update({ last_active: new Date().toISOString() })
      .eq('id', id)

    // Optionally add note
    if (bullets && bullets.length > 0) {
      await supabase.from('project_notes').insert({
        project_id: id,
        user_id: userId,
        bullets
      })
    }
  } else if (action === 'taking_break') {
    await supabase
      .from('projects')
      .update({ status: 'on-hold' })
      .eq('id', id)
  }

  return res.json({ success: true })
}
```

#### `api/synthesis/active-skills.ts`
```typescript
// GET /api/synthesis/active-skills
// Get recently strengthened nodes
export default async function handler(req, res) {
  const { data: activeNodes } = await supabase
    .from('node_strengths')
    .select('*, capabilities(*)')
    .eq('node_type', 'capability')
    .gte('last_activity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .order('strength', { ascending: false })
    .limit(5)

  // Calculate change (compare to 7 days ago snapshot)
  const activeSkills = activeNodes.map(node => ({
    capability_id: node.node_id,
    name: node.capabilities.name,
    strength: node.strength,
    change: 0.30, // TODO: Calculate actual change
    commits: node.activity_count,
    last_activity: node.last_activity
  }))

  return res.json({ activeSkills })
}
```

---

### **Phase 3: UI Components** (8-12 hours)

Mobile-first components to build:

#### Memory Onboarding
1. `src/components/memories/FoundationalPrompts.tsx`
2. `src/components/memories/PromptModal.tsx` (full-screen)
3. `src/components/memories/SuggestedPrompts.tsx`
4. `src/components/memories/AdHocMemoryModal.tsx`
5. `src/components/memories/MemoryCard.tsx`
6. `src/components/memories/ProgressBar.tsx`

#### Projects
7. `src/components/projects/ProjectDetailView.tsx`
8. `src/components/projects/QuickUpdateSheet.tsx` (bottom sheet)
9. `src/components/projects/DormantProjectNudge.tsx`
10. `src/components/projects/ProjectNoteModal.tsx`

#### Suggestions
11. `src/components/suggestions/SynthesisTransparency.tsx`
12. `src/components/suggestions/ActiveSkillsWidget.tsx`
13. `src/components/suggestions/NodeStrengthVisualization.tsx`

#### UI Primitives
14. `src/components/ui/BottomSheet.tsx`
15. `src/components/ui/SwipeableCard.tsx`
16. `src/components/ui/FAB.tsx` (Floating Action Button)

---

### **Phase 4: Helper Functions** (2-3 hours)

Create `lib/` utilities:

#### `lib/gap-detection.ts`
```typescript
export async function detectGaps(
  userId: string,
  latestMemoryId: string
): Promise<GapAnalysisResult> {
  // Fetch all user memories
  const allMemories = await fetchAllUserMemories(userId)
  const latestMemory = allMemories[0]

  // Call Gemini Flash 2.5
  const gapAnalysis = await geminiFlash.generate({
    model: 'gemini-2.0-flash-exp',
    prompt: `...` // See MEMORY_ONBOARDING_SPEC.md
  })

  // Parse and create follow-up prompts
  const { followUpPrompts } = JSON.parse(gapAnalysis)

  for (const prompt of followUpPrompts) {
    // Create custom prompt
    // Mark as 'suggested' in user_prompt_status
  }

  return { followUpPrompts }
}
```

#### `lib/validate-bullets.ts`
```typescript
export async function validateBullets(
  promptText: string,
  bullets: string[]
): Promise<{ valid: boolean; message?: string }> {
  if (bullets.length < 3) {
    return { valid: false, message: 'Add at least 3 bullets' }
  }

  const tooShort = bullets.some(b => b.length < 10)
  if (tooShort) {
    return { valid: false, message: 'Add more detail to each bullet' }
  }

  // AI quality check
  const aiCheck = await geminiFlash.generate({
    prompt: `Rate quality 1-5 of user's response...`
  })

  if (aiCheck.quality < 3) {
    return { valid: false, message: aiCheck.feedback }
  }

  return { valid: true }
}
```

#### `lib/strengthen-nodes.ts`
```typescript
export async function strengthenNodes() {
  // Scan git commits (last 7 days)
  const commits = await getRecentCommits(7)

  // Map files to capabilities
  // Update node_strengths table
  // Apply boost formula (see spec)

  // Decay unused nodes
}
```

#### `lib/check-dormant-projects.ts`
```typescript
export async function checkDormantProjects(
  userId: string
): Promise<DormantProjectNudge[]> {
  const dormancyThresholds = {
    cooling: 7,
    cold: 30,
    frozen: 90
  }

  // Fetch projects in each threshold
  // Generate nudge messages
  // Return structured nudges
}
```

---

### **Phase 5: Zustand Stores** (2 hours)

Create stores for state management:

#### `src/stores/useMemoryStore.ts`
```typescript
interface MemoryStore {
  prompts: MemoryPromptWithStatus[]
  progress: MemoryProgress | null
  loading: boolean
  error: string | null

  fetchPrompts: () => Promise<void>
  submitResponse: (input: CreateMemoryResponseInput) => Promise<void>
  dismissPrompt: (promptId: string) => Promise<void>
}
```

#### `src/stores/useProjectStore.ts` (enhance existing)
```typescript
// Add:
nudges: DormantProjectNudge[]
activeSkills: ActiveSkill[]

fetchNudges: () => Promise<void>
fetchActiveSkills: () => Promise<void>
addNote: (projectId: string, bullets: string[]) => Promise<void>
quickUpdate: (projectId: string, input: QuickUpdateInput) => Promise<void>
```

---

### **Phase 6: Pages** (2 hours)

Enhance existing pages:

#### `src/pages/MemoriesPage.tsx`
- Add tab structure: [Foundational] [My Memories] [Add New]
- Render FoundationalPrompts component
- Render SuggestedPrompts
- Add FAB for ad-hoc memories

#### `src/pages/ProjectsPage.tsx`
- Add DormantProjectNudge at top (if nudges exist)
- Show ActiveSkillsWidget
- Enhance ProjectCard with days_dormant indicator

#### `src/pages/SuggestionsPage.tsx`
- Add SynthesisTransparency to cards
- Add swipe interactions
- Show node strength changes on build

---

## 📋 Testing Checklist

### Database
- [ ] Run migration-memory-onboarding.sql
- [ ] Run seed-memory-prompts.sql
- [ ] Verify 40 prompts inserted
- [ ] Test helper functions (`get_memory_progress`, `has_unlocked_projects`)
- [ ] Test RLS policies

### API
- [ ] GET /api/memory-prompts returns correct structure
- [ ] POST /api/memory-responses validates 3+ bullets
- [ ] POST /api/memory-responses runs gap detection
- [ ] GET /api/projects/nudges returns dormant projects
- [ ] POST /api/projects/[id]/notes updates last_active
- [ ] GET /api/synthesis/active-skills returns strengthened nodes

### UI
- [ ] FoundationalPrompts shows 10 prompts in order
- [ ] PromptModal enforces 3+ bullets
- [ ] Progress bar shows completion accurately
- [ ] Projects unlock after 10 memories
- [ ] Dormant nudges appear at correct thresholds
- [ ] Quick update increments progress
- [ ] Synthesis transparency shows capability sources
- [ ] Active skills widget filters suggestions

### Mobile
- [ ] All components render correctly on mobile
- [ ] FAB is thumb-friendly (bottom right)
- [ ] Bottom sheets slide up smoothly
- [ ] Swipe gestures work (left = meh, right = spark, up = build)
- [ ] Haptic feedback triggers
- [ ] Offline drafts saved locally

---

## 🎯 Success Criteria

✅ **New user completes 10 prompts in <30 minutes**
✅ **AI generates 0-2 relevant follow-up prompts per submission**
✅ **Project suggestions unlock after 10 memories**
✅ **Dormant projects resurface within 24 hours of threshold**
✅ **Mobile UX is thumb-friendly**
✅ **Node strengthening reflects git activity accurately**
✅ **Synthesis transparency shows clear "why this matches you"**

---

## 📦 Files Created

```
projects/polymath/
├── MEMORY_ONBOARDING_SPEC.md            ← Full specification
├── IMPLEMENTATION_READY.md              ← This file
├── migration-memory-onboarding.sql      ← Database schema
├── scripts/
│   └── seed-memory-prompts.sql          ← 40 prompts
├── src/
│   └── types.ts                         ← Enhanced with memory types
```

---

## 🚀 Ready to Build!

Everything is in place to start implementing. Begin with:

1. **Database setup** (30 mins)
2. **API endpoints** (6 hours)
3. **UI components** (12 hours)

Total estimated time: **20-24 hours** for complete implementation.

---

**Let's go!** 🎨
