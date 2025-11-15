# Polymath Architecture

> Technical design for the MemoryOS + Polymath unified creative intelligence system

## System Overview

Polymath extends MemoryOS with creative project synthesis. They share the same codebase, database, and deployment - deeply integrated as a single application.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface (React)                    │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │  /memories       │              │  /projects       │     │
│  │  - View memories │              │  - View projects │     │
│  │  - Bridges       │              │  - Suggestions   │     │
│  │  - Search        │              │  - Rate ideas    │     │
│  └──────────────────┘              └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Vercel Functions)               │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │  /api/webhook    │              │  /api/projects   │     │
│  │  /api/memories   │              │  /api/synthesis  │     │
│  │  /api/bridges    │              │  /api/ratings    │     │
│  └──────────────────┘              └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Shared Database (Supabase)                  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Unified Knowledge Graph                  │   │
│  │                                                        │   │
│  │  Nodes:                          Edges:               │   │
│  │  - memories (MemoryOS)           - bridges            │   │
│  │  - entities (extracted)          - relates_to         │   │
│  │  - projects (personal)           - uses_capability    │   │
│  │  - capabilities (technical)      - inspired_by        │   │
│  │  - suggestions (AI-generated)    - strength (weight)  │   │
│  │                                                        │   │
│  │  Tables:                                               │   │
│  │  - memories                                            │   │
│  │  - entities                                            │   │
│  │  - bridges                                             │   │
│  │  - projects                       [NEW]               │   │
│  │  - capabilities                   [NEW]               │   │
│  │  - project_suggestions            [NEW]               │   │
│  │  - suggestion_ratings             [NEW]               │   │
│  │  - node_strengths                 [NEW]               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Vector Embeddings (pgvector):                               │
│  - memory_embeddings                                         │
│  - project_embeddings                [NEW]                   │
│  - capability_embeddings              [NEW]                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Background Jobs (Cron)                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Weekly Synthesis Job                                 │   │
│  │  - Scan Aperture codebase for capabilities            │   │
│  │  - Extract interests from recent MemoryOS notes       │   │
│  │  - Generate novel project suggestions                 │   │
│  │  - Allocate points (novelty + feasibility + interest) │   │
│  │  - Inject diversity (anti-echo-chamber)               │   │
│  │  Trigger: Every Monday 09:00 UTC                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Node Strengthening Job                               │   │
│  │  - Track git commits to Aperture projects             │   │
│  │  - Strengthen capability nodes based on activity      │   │
│  │  - Update project "last_active" timestamps            │   │
│  │  Trigger: Daily 00:00 UTC                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      AI Services                             │
│                                                               │
│  Gemini 2.5 Flash:                                           │
│  - Capability extraction from code                           │
│  - Entity extraction (existing MemoryOS flow)                │
│                                                               │
│  Claude Sonnet 4.5:                                          │
│  - Project synthesis (generate novel ideas)                  │
│  - Point allocation reasoning                                │
│  - Diversity injection logic                                 │
│                                                               │
│  OpenAI Embeddings:                                          │
│  - Semantic search (existing MemoryOS flow)                  │
│  - Project/capability embeddings for similarity              │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Extensions

### New Tables

#### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- always same user for now
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'personal' | 'technical' | 'meta'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'dormant' | 'completed'
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB -- flexible storage for project-specific data
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_last_active ON projects(last_active DESC);
```

#### `capabilities`
```sql
CREATE TABLE capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., 'voice-processing', 'face-alignment'
  description TEXT,
  source_project TEXT, -- e.g., 'memory-os', 'wizard-of-oz'
  code_references JSONB, -- file paths, functions, etc.
  strength FLOAT DEFAULT 1.0, -- increases with usage
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding VECTOR(1536) -- semantic embedding
);

CREATE INDEX idx_capabilities_strength ON capabilities(strength DESC);
CREATE INDEX idx_capabilities_embedding ON capabilities USING ivfflat(embedding vector_cosine_ops);
```

#### `project_suggestions`
```sql
CREATE TABLE project_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  synthesis_reasoning TEXT, -- why AI suggested this
  novelty_score FLOAT, -- 0-1
  feasibility_score FLOAT, -- 0-1
  interest_score FLOAT, -- 0-1
  total_points INTEGER, -- weighted sum
  capability_ids UUID[], -- capabilities this combines
  memory_ids UUID[], -- memories that inspired it
  suggested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending', -- 'pending' | 'rated' | 'built' | 'dismissed'
  built_project_id UUID REFERENCES projects(id) -- if user builds it
);

CREATE INDEX idx_suggestions_user_id ON project_suggestions(user_id);
CREATE INDEX idx_suggestions_points ON project_suggestions(total_points DESC);
CREATE INDEX idx_suggestions_status ON project_suggestions(status);
```

#### `suggestion_ratings`
```sql
CREATE TABLE suggestion_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES project_suggestions(id),
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL, -- 1-5 or simple thumbs up/down (-1, 1)
  feedback TEXT, -- optional user notes
  rated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_ratings_suggestion_id ON suggestion_ratings(suggestion_id);
CREATE INDEX idx_ratings_user_id ON suggestion_ratings(user_id);
```

#### `node_strengths`
```sql
CREATE TABLE node_strengths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL, -- 'capability' | 'interest' | 'project'
  node_id UUID NOT NULL, -- id from respective table
  strength FLOAT DEFAULT 1.0,
  activity_count INTEGER DEFAULT 0, -- how many times used/referenced
  last_activity TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_node_strengths_unique ON node_strengths(node_type, node_id);
CREATE INDEX idx_node_strengths_strength ON node_strengths(strength DESC);
```

### Extended Tables

#### `entities` (existing, extend)
```sql
-- Add column to track if entity represents an "interest"
ALTER TABLE entities ADD COLUMN is_interest BOOLEAN DEFAULT false;
ALTER TABLE entities ADD COLUMN interest_strength FLOAT DEFAULT 0.0;
```

## Key Algorithms

### 1. Weekly Synthesis Algorithm

**Input:**
- Recent MemoryOS memories (last 7-30 days)
- Aperture codebase capabilities (scanned)
- Existing projects (activity levels)
- Historical ratings (tune suggestions)

**Process:**
```
1. Extract Interests from MemoryOS
   - Scan recent memories
   - Identify recurring themes, topics, people
   - Weight by recency + frequency
   - Extract interest embeddings

2. Scan Codebase for Capabilities
   - Parse Aperture projects (MemoryOS, Wizard, etc.)
   - Identify technical capabilities (APIs, algorithms, integrations)
   - Extract capability descriptions
   - Generate capability embeddings

3. Generate Candidate Projects
   - For each capability pair (C1, C2):
     - Calculate novelty = how rarely this combination appears
     - Calculate feasibility = code reuse potential + complexity
     - Find matching interests via embedding similarity
     - Calculate interest_score = max similarity to recent interests

   - For capability + interest pairs:
     - Generate project idea prompt for Claude
     - Calculate scores (novelty, feasibility, interest)

   - Generate N candidates (e.g., 50)

4. Allocate Points
   - For each candidate:
     - total_points = (novelty * 0.3) + (feasibility * 0.4) + (interest * 0.3)
     - Multiply by 100 for integer points

   - Sort by total_points descending
   - Take top X (e.g., 10) suggestions

5. Diversity Injection
   - Every 4th suggestion: force a "wild card"
   - Wild card selection:
     - Pick from bottom 50% of rated suggestions historically
     - OR pick capability combination user has never rated
     - OR invert typical patterns (high novelty + low interest)

   - Replace one high-scoring suggestion with wild card

6. Store Suggestions
   - Insert into project_suggestions table
   - Link to capability_ids and memory_ids
   - Set status = 'pending'
```

**Output:**
- X new project suggestions with point allocations
- Stored in database for user review

**Pseudo-code:**
```typescript
async function runWeeklySynthesis() {
  // 1. Extract interests
  const recentMemories = await getMemories({ days: 30 })
  const interests = await extractInterests(recentMemories)

  // 2. Scan capabilities
  const capabilities = await scanCodebase('/path/to/aperture')

  // 3. Generate candidates
  const candidates = []

  for (const [cap1, cap2] of combinations(capabilities, 2)) {
    const novelty = calculateNovelty(cap1, cap2)
    const feasibility = calculateFeasibility(cap1, cap2)
    const interestScore = findMatchingInterest(interests, [cap1, cap2])

    const idea = await generateProjectIdea(cap1, cap2, interests)

    candidates.push({
      ...idea,
      novelty,
      feasibility,
      interest: interestScore
    })
  }

  // 4. Allocate points
  const scored = candidates.map(c => ({
    ...c,
    totalPoints: Math.round(
      (c.novelty * 0.3 + c.feasibility * 0.4 + c.interest * 0.3) * 100
    )
  }))

  const topN = scored.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10)

  // 5. Diversity injection (replace 3rd suggestion with wildcard)
  const wildcard = await getWildcardSuggestion()
  topN[2] = wildcard

  // 6. Store
  await storeSuggestions(topN)
}
```

### 2. Point Allocation Scoring

**Novelty Score (0-1):**
```
novelty = 1 - (times_this_combination_suggested / total_suggestions_ever)
```

**Feasibility Score (0-1):**
```
feasibility = (
  (code_reuse_potential * 0.5) +  // how much existing code can be reused
  (1 - estimated_complexity * 0.3) +  // inverse of complexity
  (has_existing_integrations * 0.2)  // already have APIs/services set up
)
```

**Interest Score (0-1):**
```
interest = max(
  cosine_similarity(project_embedding, interest_embeddings)
)
// Use the highest similarity to any recent interest
```

**Total Points:**
```
total_points = round(
  (novelty * NOVELTY_WEIGHT) +
  (feasibility * FEASIBILITY_WEIGHT) +
  (interest * INTEREST_WEIGHT)
) * 100

where:
  NOVELTY_WEIGHT = 0.3
  FEASIBILITY_WEIGHT = 0.4  // prioritize buildable ideas
  INTEREST_WEIGHT = 0.3
```

### 3. Anti-Echo-Chamber Diversity Mechanism

**Strategy: Scheduled Wild Cards**

Every Nth suggestion (e.g., N=4), inject a "wild card" idea:

**Wild Card Selection Logic:**
```typescript
function getWildcardSuggestion(): Suggestion {
  const strategy = chooseStrategy()

  switch (strategy) {
    case 'unpopular':
      // Pick from historically low-rated suggestions
      return selectFrom(historicalSuggestions, {
        avgRating: { lt: 2.5 },
        neverBuilt: true
      })

    case 'novel-combo':
      // Pick capability combination never suggested before
      return generateFromUnexploredCombination()

    case 'inverted':
      // High novelty + low interest (stretch your range)
      return generateWith({ novelty: { gt: 0.8 }, interest: { lt: 0.3 } })

    case 'random':
      // Pure randomness
      return selectRandom(allPossibleCombinations)
  }
}

function chooseStrategy(): string {
  // Rotate through strategies to maintain diversity
  const week = getCurrentWeek()
  return STRATEGIES[week % STRATEGIES.length]
}
```

**Frequency:** Every 4th suggestion = 25% diversity injection

**Tracking:** Log which wild cards get rated positively to tune strategy

### 4. Node Strengthening Algorithm

**Trigger:** Daily job checks git activity

**Process:**
```typescript
async function strengthenNodes() {
  // 1. Check git commits in last 24h
  const commits = await getRecentCommits({ since: '24h' })

  // 2. Map commits to projects
  for (const commit of commits) {
    const files = commit.files
    const project = inferProject(files) // e.g., 'memory-os', 'wizard-of-oz'

    if (!project) continue

    // 3. Identify capabilities used
    const capabilities = await extractCapabilitiesFromFiles(files)

    // 4. Strengthen capability nodes
    for (const capability of capabilities) {
      await incrementNodeStrength({
        nodeType: 'capability',
        nodeId: capability.id,
        increment: 0.1 // small boost per use
      })
    }

    // 5. Update project last_active
    await updateProject(project.id, {
      last_active: commit.timestamp
    })

    // 6. Strengthen project node
    await incrementNodeStrength({
      nodeType: 'project',
      nodeId: project.id,
      increment: 0.2 // larger boost for active projects
    })
  }
}

async function incrementNodeStrength(params) {
  await db.nodeStrengths.upsert({
    where: { nodeType: params.nodeType, nodeId: params.nodeId },
    update: {
      strength: { increment: params.increment },
      activityCount: { increment: 1 },
      lastActivity: new Date(),
      updatedAt: new Date()
    },
    create: {
      nodeType: params.nodeType,
      nodeId: params.nodeId,
      strength: 1.0 + params.increment,
      activityCount: 1,
      lastActivity: new Date()
    }
  })
}
```

**Effect:** Stronger nodes appear in more future suggestions

**Decay:** Optional - nodes lose strength over time if unused (exponential decay)

### 5. Rating System Logic

**User Actions:**
- Thumbs up (+1)
- Thumbs down (-1)
- "Built it" (automatic +2, creates project link)

**Feedback Loop:**
```typescript
async function rateSuggestion(suggestionId: string, rating: number) {
  // 1. Store rating
  await db.suggestionRatings.create({
    suggestionId,
    rating,
    ratedAt: new Date()
  })

  // 2. Update suggestion status
  await db.projectSuggestions.update({
    where: { id: suggestionId },
    data: { status: rating > 0 ? 'rated' : 'dismissed' }
  })

  // 3. Learn from rating
  const suggestion = await db.projectSuggestions.findUnique({
    where: { id: suggestionId },
    include: { capabilities: true }
  })

  if (rating > 0) {
    // Boost these capabilities in future synthesis
    for (const cap of suggestion.capabilities) {
      await incrementNodeStrength({
        nodeType: 'capability',
        nodeId: cap.id,
        increment: 0.05
      })
    }
  } else {
    // Penalize this combination (but don't delete - keep for diversity)
    await db.capabilityCombinations.upsert({
      where: { combo: [cap1.id, cap2.id].sort() },
      update: { penaltyScore: { increment: 0.1 } }
    })
  }
}
```

## Integration Points

### MemoryOS → Polymath

**Interest Extraction:**
```typescript
// Existing entity extraction in MemoryOS
// Extend to mark "interests" (recurring themes)

async function processMemory(memory: Memory) {
  const entities = await extractEntities(memory.content)

  // NEW: Identify interests
  for (const entity of entities) {
    const frequency = await countEntityOccurrences(entity.name)
    const recency = await getEntityRecencyScore(entity.name)

    if (frequency > 3 && recency > 0.5) {
      await db.entities.update({
        where: { id: entity.id },
        data: {
          isInterest: true,
          interestStrength: (frequency * 0.5) + (recency * 0.5)
        }
      })
    }
  }
}
```

**Bridge Connection:**
```typescript
// When Polymath suggests project, link to relevant memories
async function generateSuggestion(capabilities, interests) {
  const suggestion = await synthesizeIdea(capabilities, interests)

  // Find memories that inspired this
  const relatedMemories = await findSimilarMemories({
    embedding: suggestion.embedding,
    limit: 5
  })

  await db.projectSuggestions.create({
    ...suggestion,
    memoryIds: relatedMemories.map(m => m.id)
  })
}
```

### Polymath → MemoryOS

**Project as Entity:**
```typescript
// When user builds a suggested project, add to knowledge graph
async function buildProject(suggestionId: string) {
  const suggestion = await db.projectSuggestions.findUnique({
    where: { id: suggestionId }
  })

  // Create project
  const project = await db.projects.create({
    title: suggestion.title,
    description: suggestion.description,
    type: 'technical'
  })

  // NEW: Add project as entity in MemoryOS
  await db.entities.create({
    name: project.title,
    type: 'project',
    relatedId: project.id
  })

  // Link suggestion to built project
  await db.projectSuggestions.update({
    where: { id: suggestionId },
    data: {
      status: 'built',
      builtProjectId: project.id
    }
  })
}
```

**Cross-System Bridging:**
```typescript
// MemoryOS bridge-finding now includes projects
async function findBridges(memory: Memory) {
  // Existing: entity matching, semantic similarity
  const entityBridges = await findEntityMatches(memory)
  const semanticBridges = await findSemanticMatches(memory)

  // NEW: Project-related bridges
  const projectBridges = await findProjectMatches(memory)

  return [...entityBridges, ...semanticBridges, ...projectBridges]
}

async function findProjectMatches(memory: Memory) {
  // Find projects mentioned in memory
  const projectEntities = await db.entities.findMany({
    where: {
      type: 'project',
      name: { in: extractedEntities(memory) }
    }
  })

  // Find projects semantically similar to memory
  const similarProjects = await vectorSearch({
    table: 'projects',
    embedding: memory.embedding,
    limit: 3
  })

  return [...projectEntities, ...similarProjects]
}
```

## Deployment Strategy

**Same Deployment as MemoryOS:**
- Vercel project (single deployment)
- Shared environment variables
- Single domain: `memoryos.vercel.app`
- Routes: `/memories`, `/projects`, `/synthesis`

**Cron Jobs (Vercel Cron):**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/synthesis/weekly",
      "schedule": "0 9 * * 1" // Every Monday 09:00 UTC
    },
    {
      "path": "/api/synthesis/strengthen-nodes",
      "schedule": "0 0 * * *" // Daily 00:00 UTC
    }
  ]
}
```

**Database:**
- Extend existing MemoryOS Supabase instance
- Run migration to add new tables
- Update RLS policies for new tables

## Future Enhancements

1. **Multi-user support** - Currently single user, could extend with proper user_id scoping
2. **Collaborative projects** - Suggest projects that combine multiple users' capabilities
3. **External capability scanning** - Not just Aperture, but any GitHub repos user owns
4. **Voice-based project updates** - "Worked on watercolor today" via Audiopen
5. **Visual project cards** - Screenshots, photos, artifacts attached to projects
6. **Energy/time metadata** - "This project needs 2 hours of focus" filtering
7. **Seasonal suggestions** - "Winter projects" vs "Summer projects" context-aware
8. **Cross-pollination** - Suggest how personal projects (painting) could inspire technical ones (color theory AI)

## Success Metrics

**Engagement:**
- % of suggestions rated (not ignored)
- % of suggestions built (ultimate validation)
- Time from suggestion to build (faster = better resonance)

**Quality:**
- Average rating of suggestions (trending up over time)
- Diversity score (entropy of capability combinations suggested)
- Novel combinations discovered (never suggested before)

**Strength:**
- Node strength distribution (balanced vs. over-indexed)
- Capability utilization rate (are all capabilities getting used?)
- Interest evolution (are new interests emerging?)

---

**Status:** Design phase - implementation pending database migration and API development
**See also:** `CONCEPT.md`, `NEXT_SESSION.md`, MemoryOS `README.md`
