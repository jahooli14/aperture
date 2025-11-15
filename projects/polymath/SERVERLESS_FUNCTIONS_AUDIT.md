# Serverless Functions Audit

**Current Count**: 12 functions (at Vercel limit)
**Goal**: Consolidate or remove to stay ≤12 without breaking functionality

---

## Current Serverless Functions

### 1. **api/analytics.ts** ✅ KEEP (Consolidated)
**Routes**:
- `GET /api/analytics?resource=smart-suggestion` - Context-aware next action
- `GET /api/analytics?resource=patterns` - Timeline patterns analysis
- `GET /api/analytics?resource=evolution` - Synthesis evolution (thought maturity)
- `GET /api/analytics?resource=opportunities` - Creative project opportunities
- `POST /api/analytics?resource=init-tags` - Admin: Initialize tag embeddings

**Purpose**: Consolidated analytics (timeline patterns, synthesis evolution, creative intelligence, smart suggestions, admin utilities)

**Dependencies**: Gemini AI (gemini-2.0-flash-exp), Supabase
**Used by**: DailyQueuePage (smart suggestions), future analytics features
**Size**: 911 lines

---

### 2. **api/connections.ts** ✅ KEEP (Core Feature)
**Routes**:
- `POST /api/connections?action=auto-suggest` - Generate AI connection suggestions
- `PATCH /api/connections?action=update-suggestion&id=X` - Accept/reject suggestions
- `POST /api/connections?action=suggest` - Legacy bridge creation

**Purpose**: Unified connections API - auto-suggests related items using Gemini embeddings

**Dependencies**: Gemini embeddings (text-embedding-gem-001), Gemini chat (gemini-2.5-flash)
**Used by**: MemoryCard (quick-add), ArticleCompletionDialog, SaveArticleDialog
**Size**: ~250 lines
**Performance**: Optimized (3 API calls vs 56 previously)

---

### 3. **api/cron/jobs.ts** ✅ KEEP (Required)
**Routes**:
- `GET /api/cron/jobs?job=daily` - Daily cron job

**Purpose**: Scheduled tasks (daily analysis, cleanup, etc.)

**Dependencies**: Vercel cron (configured in vercel.json)
**Used by**: Vercel scheduler (runs daily at midnight)
**Size**: Unknown (need to check)

---

### 4. **api/memories.ts** ✅ KEEP (Core Feature)
**Routes**:
- `GET /api/memories` - List memories
- `POST /api/memories` - Create memory
- `PATCH /api/memories/:id` - Update memory
- `DELETE /api/memories/:id` - Delete memory

**Purpose**: Unified memories CRUD API

**Dependencies**: Gemini AI, Supabase
**Used by**: MemoriesPage, MemoryCard, CreateMemoryDialog, voice recorder
**Size**: ~500+ lines

---

### 5. **api/onboarding.ts** ⚠️ CONSOLIDATION CANDIDATE
**Routes**:
- Onboarding analysis
- Gap-filling prompts

**Purpose**: Onboarding flow and knowledge gap analysis

**Dependencies**: Gemini AI, Supabase
**Used by**: Onboarding flow (if exists)
**Size**: ~200 lines
**Notes**: Could potentially merge into `api/analytics.ts` or `api/memories.ts`

---

### 6. **api/process.ts** ✅ KEEP (Core Feature)
**Routes**:
- `POST /api/process` - Process memory (AI analysis, themes, tags)

**Purpose**: Background processing for new memories (AI enrichment)

**Dependencies**: lib/process-memory.js, Gemini AI
**Used by**: Called after memory creation, manual processing
**Size**: ~100 lines

---

### 7. **api/projects.ts** ✅ KEEP (Core Feature)
**Routes**:
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- Project context/daily queue endpoints

**Purpose**: Consolidated projects CRUD + daily queue + context

**Dependencies**: Supabase
**Used by**: ProjectsPage, CreateProjectDialog, DailyQueuePage
**Size**: ~400+ lines

---

### 8. **api/reading.ts** ✅ KEEP (Core Feature)
**Routes**:
- `GET /api/reading` - List articles
- `POST /api/reading` - Save article (Jina AI extraction)
- `PATCH /api/reading/:id` - Update article status
- `DELETE /api/reading/:id` - Delete article
- RSS feed operations
- Highlights CRUD

**Purpose**: Consolidated reading API (articles, highlights, RSS feeds)

**Dependencies**: Jina AI, marked (markdown), rss-parser, Supabase
**Used by**: ReadingPage, SaveArticleDialog, RSS feed sync
**Size**: ~600+ lines

---

### 9. **api/related.ts** ⚠️ POTENTIAL DUPLICATE
**Routes**:
- `GET /api/related` - Find related items using knowledge graph
- `GET /api/related?action=list` - List explicit connections (Sparks)
- `POST /api/related` - Create explicit connection
- `DELETE /api/related` - Delete connection

**Purpose**: Finds contextually related items + manages explicit connections (Sparks system)

**Dependencies**: Supabase
**Used by**: Item detail pages (show related content)
**Size**: ~300 lines
**⚠️ OVERLAP**: This might overlap with `api/connections.ts` and `api/suggestions.ts`

---

### 10. **api/search.ts** ✅ KEEP (Core Feature)
**Routes**:
- `GET /api/search?q=query` - Universal search across memories/projects/articles
- Supports text + semantic search (embeddings)

**Purpose**: Universal search API

**Dependencies**: Supabase (pgvector for semantic search when available)
**Used by**: Global search bar, quick search
**Size**: ~200 lines

---

### 11. **api/suggestions.ts** ⚠️ CONSOLIDATION CANDIDATE
**Routes**:
- `GET /api/suggestions` - List project suggestions
- `POST /api/suggestions?action=rate&id=X` - Rate suggestion
- `POST /api/suggestions?action=build&id=X` - Build project from suggestion

**Purpose**: Project suggestion system (AI-generated project ideas)

**Dependencies**: Supabase, Zod validation
**Used by**: Suggestions page (if exists)
**Size**: ~200 lines
**⚠️ OVERLAP**: Overlaps with `api/connections.ts` (connection suggestions) and `api/analytics.ts` (creative opportunities)

---

### 12. **api/transcribe.ts** ✅ KEEP (Core Feature)
**Routes**:
- `POST /api/transcribe` - Transcribe audio to text using Gemini

**Purpose**: Audio transcription for voice recordings

**Dependencies**: Gemini AI, formidable (multipart/form-data)
**Used by**: Voice recorder, audio memory capture
**Size**: ~150 lines

---

## Analysis: Consolidation Opportunities

### ⚠️ HIGH-PRIORITY CONSOLIDATION

#### **Option 1: Merge `api/suggestions.ts` into `api/connections.ts`**
**Rationale**:
- Both handle "suggestions" (connection suggestions vs project suggestions)
- Both use AI to analyze relationships
- `api/connections.ts` already handles auto-suggestions
- Project suggestions could be a new `?action=project-suggestions` route

**Impact**: -1 function (12 → 11)

#### **Option 2: Merge `api/onboarding.ts` into `api/analytics.ts`**
**Rationale**:
- Both are AI-powered analysis endpoints
- Onboarding is a one-time flow, not core functionality
- `api/analytics.ts` already handles multiple AI analysis types
- Could add `?resource=onboarding` and `?resource=gaps` routes

**Impact**: -1 function (12 → 11)

#### **Option 3: Merge `api/related.ts` into `api/connections.ts`**
**Rationale**:
- Both handle relationships between items
- `api/related.ts` finds related items via knowledge graph
- `api/connections.ts` suggests connections via AI
- Overlapping functionality could be unified
- Sparks system (explicit connections) could move to `api/connections.ts`

**Impact**: -1 function (12 → 11)

---

## Recommended Consolidation Plan

### **Phase 1: Merge suggestions.ts → connections.ts** (SAFEST)
**Steps**:
1. Add project suggestions routes to `api/connections.ts`:
   - `GET /api/connections?action=list-suggestions` - List project suggestions
   - `POST /api/connections?action=rate-suggestion&id=X` - Rate suggestion
   - `POST /api/connections?action=build-from-suggestion&id=X` - Build project
2. Update frontend to use new routes
3. Delete `api/suggestions.ts`

**Risk**: LOW (project suggestions seem less used than connections)

### **Phase 2: Merge onboarding.ts → analytics.ts** (MEDIUM RISK)
**Steps**:
1. Add onboarding routes to `api/analytics.ts`:
   - `GET /api/analytics?resource=onboarding` - Onboarding analysis
   - `GET /api/analytics?resource=gaps` - Gap-filling prompts
2. Update frontend onboarding flow (if exists)
3. Delete `api/onboarding.ts`

**Risk**: MEDIUM (need to verify if onboarding is actively used)

### **Phase 3 (Optional): Merge related.ts → connections.ts** (COMPLEX)
**Steps**:
1. Analyze overlap between knowledge graph relations and AI suggestions
2. Move Sparks system to `api/connections.ts` as explicit connections
3. Unify "find related" logic
4. Delete `api/related.ts`

**Risk**: HIGH (complex logic, need to preserve Sparks system)

---

## Result: 10-11 Functions (Safe Buffer)

If we execute **Phase 1 + Phase 2**:
- Start: 12 functions
- After Phase 1: 11 functions (remove suggestions.ts)
- After Phase 2: 10 functions (remove onboarding.ts)
- **Final: 10 functions (2 functions under limit)**

---

## Questions to Answer

1. **Is onboarding.ts actively used?** Check if there's an onboarding flow in the frontend
2. **What's in api/cron/jobs.ts?** Need to see what scheduled tasks exist
3. **Is api/suggestions.ts used?** Check frontend for project suggestions feature
4. **Is api/related.ts used?** Check if "Related" sections appear in UI

---

## Next Steps

1. ✅ List all functions (DONE)
2. ⏳ Check frontend usage of consolidation candidates
3. ⏳ Choose safest consolidation path
4. ⏳ Implement consolidation
5. ⏳ Test thoroughly
6. ⏳ Deploy
