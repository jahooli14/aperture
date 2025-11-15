# 🏗️ MemoryOS + Polymath Architecture

> **Visual guide to the unified system**

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MemoryOS + Polymath                          │
│                    Unified System                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
         ┌──────▼──────┐            ┌──────▼──────┐
         │  MemoryOS   │            │  Polymath   │
         │   (Core)    │            │   (Meta)    │
         └──────┬──────┘            └──────┬──────┘
                │                           │
                └─────────────┬─────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Shared Database  │
                    │    (Supabase)     │
                    └───────────────────┘
```

---

## Data Flow

### 1. Capture Flow (MemoryOS)
```
Voice Note (Audiopen)
    │
    ▼
api/capture.ts (webhook)
    │
    ▼
Supabase: memories table
    │
    ▼
api/process.ts (async)
    │
    ├──▶ Gemini 2.5 Flash (entity extraction)
    │
    ├──▶ OpenAI (embeddings)
    │
    └──▶ Bridge-finding algorithm
         │
         ▼
    Supabase: entities, bridges tables
```

### 2. Synthesis Flow (Polymath)
```
Cron Trigger (Monday 09:00 UTC)
    │
    ▼
api/cron/weekly-synthesis.ts
    │
    ▼
scripts/polymath/synthesis.ts
    │
    ├──▶ Get recent memories → extract interests
    │
    ├──▶ Get capabilities (from scanner)
    │
    ├──▶ Find novel combinations (2-capability pairs)
    │
    ├──▶ Claude Sonnet 4.5 (generate project ideas)
    │
    ├──▶ Calculate scores (novelty + feasibility + interest)
    │
    ├──▶ Inject diversity (wild card at position 3)
    │
    └──▶ Store in Supabase
         │
         ▼
    Supabase: project_suggestions table
```

### 3. Rating Flow (Polymath)
```
User clicks 👍 Spark / 👎 Meh / 💡 Build
    │
    ▼
api/suggestions/[id]/rate.ts
    │
    ├──▶ Store rating
    │
    ├──▶ Update suggestion status
    │
    └──▶ Adjust capability strengths
         │
         ├──▶ Spark (+0.05)
         ├──▶ Meh (-0.05)
         └──▶ Build (+0.30)
              │
              ▼
         Supabase: node_strengths table
```

### 4. Build Flow (Polymath → MemoryOS)
```
User clicks 💡 Build
    │
    ▼
api/suggestions/[id]/build.ts
    │
    ├──▶ Create project
    │    │
    │    ▼
    │   Supabase: projects table
    │
    ├──▶ Link to suggestion
    │
    ├──▶ Boost capability strengths (+0.30)
    │
    └──▶ Create entity in MemoryOS graph
         │
         ▼
    Supabase: entities table
         │
         ▼
    MemoryOS can now surface this project
    when relevant memories hint at it
```

### 5. Strengthening Flow (Polymath)
```
Cron Trigger (Daily 00:00 UTC)
    │
    ▼
api/cron/strengthen-nodes.ts
    │
    ▼
scripts/polymath/strengthen-nodes.ts
    │
    ├──▶ Check git log (last 24 hours)
    │
    ├──▶ Map commits → projects
    │
    ├──▶ Map projects → capabilities
    │
    ├──▶ Boost active capabilities (+0.05)
    │
    ├──▶ Decay unused capabilities (-0.01)
    │
    └──▶ Update strengths
         │
         ▼
    Supabase: node_strengths table
         │
         ▼
    Next synthesis uses updated strengths
    → Active capabilities appear more often
```

---

## Database Schema

### MemoryOS Tables (Existing)
```
memories
├── id (uuid)
├── user_id
├── content (text)
├── processed_content (text)
├── memory_type ('foundational' | 'event' | 'insight')
├── embedding (vector)
├── created_at
└── metadata (jsonb)

entities
├── id (uuid)
├── memory_id (fk → memories)
├── name (text)
├── type (text)
├── embedding (vector)
├── created_at
└── metadata (jsonb)

bridges
├── id (uuid)
├── memory1_id (fk → memories)
├── memory2_id (fk → memories)
├── bridge_type ('entity_match' | 'semantic_similarity' | 'temporal_proximity')
├── strength (float)
├── explanation (text)
└── created_at
```

### Polymath Tables (New)
```
projects
├── id (uuid)
├── user_id
├── title (text)
├── description (text)
├── type ('personal' | 'technical' | 'meta')
├── status ('active' | 'dormant' | 'completed' | 'archived')
├── last_active (timestamp)
├── created_at
├── metadata (jsonb)
└── source_suggestion_id (fk → project_suggestions)

capabilities
├── id (uuid)
├── name (text)
├── description (text)
├── source_project (text) - e.g., "Wizard of Oz", "MemoryOS"
├── code_references (jsonb[])
├── embedding (vector)
├── strength (float)
└── created_at

project_suggestions
├── id (uuid)
├── user_id
├── title (text)
├── description (text)
├── capability_ids (uuid[])
├── novelty_score (float)
├── feasibility_score (float)
├── interest_score (float)
├── total_points (int)
├── is_wildcard (boolean)
├── status ('pending' | 'spark' | 'meh' | 'built' | 'dismissed' | 'saved')
├── created_at
└── metadata (jsonb)

suggestion_ratings
├── id (uuid)
├── suggestion_id (fk → project_suggestions)
├── user_id
├── rating (int) - 1 = spark, -1 = meh, 0 = neutral
├── notes (text)
└── created_at

node_strengths
├── id (uuid)
├── node_id (uuid) - fk → capabilities or interests or projects
├── node_type ('capability' | 'interest' | 'project')
├── strength (float)
├── activity_count (int)
├── last_active (timestamp)
└── updated_at

capability_combinations
├── id (uuid)
├── capability1_id (fk → capabilities)
├── capability2_id (fk → capabilities)
├── novelty_score (float)
├── times_suggested (int)
└── created_at
```

---

## API Endpoints

### MemoryOS Endpoints (Existing)
```
POST   /api/capture         - Webhook from Audiopen
POST   /api/process         - Process captured memory
GET    /api/memories        - List memories
GET    /api/bridges         - List bridges
```

### Polymath Endpoints (New)
```
Projects:
GET    /api/projects        - List projects
POST   /api/projects        - Create project
GET    /api/projects/[id]   - Get project
PATCH  /api/projects/[id]   - Update project
DELETE /api/projects/[id]   - Delete project

Suggestions:
GET    /api/suggestions     - List suggestions (with filters)

Rating:
POST   /api/suggestions/[id]/rate  - Rate suggestion

Build:
POST   /api/suggestions/[id]/build - Build project from suggestion

Cron:
POST   /api/cron/weekly-synthesis   - Weekly synthesis (Monday 09:00 UTC)
POST   /api/cron/strengthen-nodes   - Daily strengthening (00:00 UTC)
```

---

## Component Hierarchy

```
App.tsx
├── MemoryPage (MemoryOS UI)
│   ├── MemoryCard
│   ├── BridgeList
│   └── MemoryDetail
│
├── ProjectsPage (Polymath UI - to build)
│   └── ProjectCard
│       ├── ProjectMetadata
│       └── ProjectActions
│
├── SuggestionsPage (Polymath UI - to build)
│   └── SuggestionCard
│       ├── CapabilityBadge[]
│       ├── ScorePill[]
│       ├── RatingActions
│       └── WildcardBadge (conditional)
│
└── AllIdeasPage (Polymath UI - to build)
    └── IdeaList (all statuses)
```

---

## Bidirectional Integration

### MemoryOS → Polymath
```
MemoryOS Memories
    │
    ▼
Extract Interests (from entities)
    │
    ▼
Feed to Synthesis Algorithm
    │
    ▼
Generate Project Suggestions
```

### Polymath → MemoryOS
```
User Builds Project
    │
    ▼
Create Project Entity in MemoryOS Graph
    │
    ▼
MemoryOS can now:
- Surface project when relevant memories appear
- Bridge project to related memories
- Include in daily digest
```

---

## Feedback Loops

### Short Loop (Real-time)
```
1. User rates suggestion
2. Capability strengths updated
3. Next synthesis uses new strengths
4. Different suggestions appear
```

### Medium Loop (Weekly)
```
1. User works on project (git commits)
2. Daily cron detects activity
3. Capabilities strengthened
4. Monday synthesis uses updated strengths
5. More relevant suggestions
```

### Long Loop (Continuous)
```
1. User records memories in MemoryOS
2. New interests extracted
3. Weekly synthesis combines new interests × capabilities
4. Novel project ideas emerge
5. User builds project
6. Project becomes entity in MemoryOS
7. MemoryOS surfaces project in future contexts
8. User has "holy shit" moment
9. Records new memory about connection
10. Loop continues
```

---

## Technology Stack

### Frontend
- React 18.3
- TypeScript 5.x
- Vite 5.x
- React Router DOM 6.x (to add)
- Zustand 5.x (state management - to add)

### Backend
- Vercel Serverless Functions
- Node.js 20.x
- TypeScript 5.x

### Database
- Supabase (PostgreSQL 15)
- pgvector (embeddings)
- Row Level Security (RLS)

### AI
- Claude Sonnet 4.5 (synthesis, project generation)
- OpenAI (embeddings)
- Gemini 2.5 Flash (entity extraction)

### Deployment
- Vercel (hosting + serverless + cron)
- Supabase (database + auth)
- GitHub (version control)

---

## File Structure

```
projects/memory-os/
│
├── api/                              # Vercel Serverless Functions
│   ├── capture.ts                    # MemoryOS: Audiopen webhook
│   ├── process.ts                    # MemoryOS: Memory processing
│   ├── projects.ts                   # Polymath: Projects CRUD
│   ├── projects/[id].ts              # Polymath: Single project
│   ├── suggestions.ts                # Polymath: List suggestions
│   ├── suggestions/[id]/rate.ts      # Polymath: Rate suggestion
│   ├── suggestions/[id]/build.ts     # Polymath: Build project
│   └── cron/
│       ├── weekly-synthesis.ts       # Polymath: Monday synthesis
│       └── strengthen-nodes.ts       # Polymath: Daily strengthening
│
├── src/
│   ├── components/
│   │   ├── MemoryCard.tsx            # MemoryOS component
│   │   ├── capabilities/
│   │   │   └── CapabilityBadge.tsx   # Polymath component
│   │   ├── projects/
│   │   │   └── ProjectCard.tsx       # Polymath component
│   │   └── suggestions/
│   │       ├── SuggestionCard.tsx    # Polymath component
│   │       ├── RatingActions.tsx     # Polymath component
│   │       └── WildcardBadge.tsx     # Polymath component
│   │
│   ├── pages/ (to build)
│   │   ├── MemoryPage.tsx            # MemoryOS page
│   │   ├── ProjectsPage.tsx          # Polymath page
│   │   ├── SuggestionsPage.tsx       # Polymath page
│   │   └── AllIdeasPage.tsx          # Polymath page
│   │
│   ├── stores/ (to build)
│   │   ├── useProjectStore.ts        # Polymath store
│   │   └── useSuggestionStore.ts     # Polymath store
│   │
│   ├── types.ts                      # Unified types
│   └── App.tsx                       # Main app
│
├── scripts/
│   ├── migration.sql                 # Polymath database schema
│   └── polymath/
│       ├── capability-scanner.ts     # Scan codebase
│       ├── synthesis.ts              # AI synthesis engine
│       ├── strengthen-nodes.ts       # Activity tracker
│       └── seed-test-data.ts         # Test data
│
├── package.json                      # Dependencies
├── vercel.json                       # Deployment + cron config
├── tsconfig.json                     # TypeScript config
└── vite.config.ts                    # Vite config
```

---

## Environment Variables

```bash
# Supabase (shared)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ... (for server-side)

# MemoryOS
GEMINI_API_KEY=AIza...

# Polymath
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
USER_ID=uuid-of-supabase-user

# Optional
CRON_SECRET=random-secret (for cron job security)
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│           Vercel Edge Network           │
│  ┌─────────────────────────────────┐   │
│  │   Frontend (Static Site)         │   │
│  │   - React SPA                    │   │
│  │   - Hosted on CDN                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Serverless Functions           │   │
│  │   - /api/capture                 │   │
│  │   - /api/projects                │   │
│  │   - /api/suggestions             │   │
│  │   - etc.                         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Cron Jobs                      │   │
│  │   - Monday 09:00 UTC (synthesis) │   │
│  │   - Daily 00:00 UTC (strengthen) │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Supabase Platform               │
│  ┌─────────────────────────────────┐   │
│  │   PostgreSQL Database            │   │
│  │   - 11 tables (5 MemoryOS + 6   │   │
│  │     Polymath)                    │   │
│  │   - pgvector extension           │   │
│  │   - RLS policies                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Supabase Auth (future)         │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           AI Services                   │
│  - Anthropic (Claude Sonnet 4.5)        │
│  - OpenAI (Embeddings)                  │
│  - Google (Gemini 2.5 Flash)            │
└─────────────────────────────────────────┘
```

---

**Status**: ✅ Complete and ready to deploy
**Last Updated**: Session 21 (2025-10-21)
