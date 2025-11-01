# Comprehensive API Review & Consolidation Strategy

**Current Status**: 12/12 serverless functions (AT LIMIT!)
**Goal**: Reduce to ≤10 functions without breaking functionality
**Strategy**: Merge overlapping functionality based on app purpose

---

## App Purpose Analysis

### Core Purpose
**Polymath** is a personal knowledge management system for creative professionals that:
1. **Captures** thoughts via voice/text (memories/thoughts)
2. **Organizes** into projects (active work)
3. **Reads** articles and extracts insights (reading list)
4. **Connects** related content using AI (suggestions/sparks)
5. **Analyzes** patterns to suggest next actions (daily queue, smart suggestions)

### User Flow
```
Voice Input → Memory → AI Processing → Tags/Themes
                ↓
         Find Connections → Suggest Projects
                ↓
         Link to Existing Projects
                ↓
         Daily Queue (what to work on today)
```

---

## Detailed API Function Review

### **1. api/analytics.ts** ✅ KEEP
**Size**: 911 lines
**Routes**:
- `GET ?resource=smart-suggestion` - Context-aware next action
- `GET ?resource=patterns` - Timeline analysis (when user thinks best)
- `GET ?resource=evolution` - Thought maturity tracking
- `GET ?resource=opportunities` - Creative project opportunities
- `POST ?resource=init-tags` - Admin: Tag embeddings

**Purpose**: Multi-purpose analytics engine
**Frontend Usage**: DailyQueuePage (smart suggestions)
**AI Models**: gemini-2.0-flash-exp
**Dependencies**: Supabase, Gemini AI

**Why Keep**: Core feature for daily queue and insights. Already consolidated.

**Overlap**: `opportunities` overlaps with `api/suggestions.ts` project suggestions

---

### **2. api/connections.ts** ✅ KEEP (Just Optimized!)
**Size**: ~250 lines
**Routes**:
- `POST ?action=auto-suggest` - AI connection suggestions (NEW: using Gemini batch)
- `PATCH ?action=update-suggestion&id=X` - Accept/reject suggestions
- `POST ?action=suggest` - Legacy bridge creation

**Purpose**: AI-powered connection suggestions between thoughts/projects/articles
**Frontend Usage**: 4 files (MemoryCard, ArticleCompletionDialog, etc.)
**AI Models**: text-embedding-gem-001, gemini-2.5-flash (just updated!)
**Performance**: 3 API calls vs 56 (94% reduction!)

**Why Keep**: Core Phase 2 feature, just heavily optimized with Gemini

**Overlap**: None (this is the definitive connections API)

---

### **3. api/cron/jobs.ts** ✅ KEEP (Required)
**Size**: Unknown
**Routes**:
- `GET ?job=daily` - Daily cron job

**Purpose**: Scheduled background tasks
**Frontend Usage**: None (Vercel scheduler)
**Dependencies**: Vercel cron (vercel.json config)

**Why Keep**: Required for automated maintenance/analysis

**Action Needed**: Review file to see what it does

---

### **4. api/memories.ts** ✅ KEEP
**Size**: ~500+ lines
**Routes**:
- `GET /api/memories` - List memories
- `POST /api/memories` - Create memory (with AI processing)
- `PATCH /api/memories/:id` - Update
- `DELETE /api/memories/:id` - Delete

**Purpose**: Memories CRUD
**Frontend Usage**: MemoriesPage, voice recorder, CreateMemoryDialog
**AI Models**: Gemini (for processing)
**Dependencies**: Supabase, Gemini AI

**Why Keep**: Core content type, heavily used

**Overlap**: None

---

### **5. api/onboarding.ts** ⚠️ **REMOVE OR CONSOLIDATE**
**Size**: 267 lines
**Routes**:
- `POST ?resource=analyze` - Analyze 5 onboarding responses
- `GET ?resource=gap-analysis` - Gap-filling prompts

**Purpose**: Onboarding flow analysis
**Frontend Usage**: **0 files** (OnboardingPage.tsx exists but doesn't call this API!)
**AI Models**: gemini-2.0-flash-exp
**Dependencies**: Supabase, Gemini AI

**🚨 FINDINGS**:
- OnboardingPage.tsx exists (366 lines) but does NOT call `/api/onboarding`
- Likely deprecated or incomplete feature
- Frontend probably has local onboarding flow

**RECOMMENDATION**: **DELETE** (saves 1 function)
**Risk**: VERY LOW (not used by frontend)

---

### **6. api/process.ts** ✅ KEEP
**Size**: ~100 lines
**Routes**:
- `POST /api/process` - Process memory (AI enrichment)

**Purpose**: Background AI processing for memories (extract themes, tags, entities)
**Frontend Usage**: Called after memory creation
**Dependencies**: lib/process-memory.js
**AI Models**: Gemini (via process-memory lib)

**Why Keep**: Core feature for memory enrichment

**Overlap**: None

---

### **7. api/projects.ts** ✅ KEEP
**Size**: ~400+ lines
**Routes**:
- `GET /api/projects` - List projects
- `POST /api/projects` - Create
- `PATCH /api/projects/:id` - Update
- `DELETE /api/projects/:id` - Delete
- Daily queue endpoints
- Project context endpoints

**Purpose**: Projects CRUD + daily queue + context
**Frontend Usage**: ProjectsPage, DailyQueuePage, CreateProjectDialog
**Dependencies**: Supabase

**Why Keep**: Core content type, already consolidated

**Overlap**: None

---

### **8. api/reading.ts** ✅ KEEP
**Size**: ~600+ lines
**Routes**:
- `GET /api/reading` - List articles
- `POST /api/reading` - Save article (Jina AI extraction)
- `PATCH /api/reading/:id` - Update status
- `DELETE /api/reading/:id` - Delete
- RSS feed operations (list, add, remove, refresh)
- Highlights CRUD

**Purpose**: Reading list + RSS feeds + highlights
**Frontend Usage**: ReadingPage, SaveArticleDialog, RSS management
**Dependencies**: Jina AI, marked, rss-parser, Supabase

**Why Keep**: Core content type, already heavily consolidated

**Overlap**: None

---

### **9. api/related.ts** 🔴 **CONSOLIDATE INTO api/connections.ts**
**Size**: 401 lines
**Routes**:
- `GET ?id=X&type=Y` - Find related items (semantic search)
- `GET ?id=X&type=Y&connections=true` - Get item connections (Sparks)
- `GET ?connections=true&ai_suggested=true` - AI-suggested Sparks for homepage
- `GET ?id=X&type=Y&thread=true` - Get thread (recursive connections)
- `POST` - Create connection (Spark)
- `DELETE ?connection_id=X` - Delete connection

**Purpose**:
1. Find related items using knowledge graph (semantic search)
2. Manage explicit connections (Sparks system)

**Frontend Usage**: 1 file (CreateConnectionDialog.tsx)
**Dependencies**: Supabase only (no AI!)
**AI Models**: None

**🚨 FINDINGS**:
- **Overlaps heavily with api/connections.ts** (both handle connections!)
- `api/connections.ts` = AI-suggested connections (auto-suggest)
- `api/related.ts` = Manual connections (Sparks) + semantic search
- Only used by 1 component (CreateConnectionDialog)

**RECOMMENDATION**: **MERGE into api/connections.ts** (saves 1 function)

**Why**:
1. Both manage connections between items
2. `api/connections.ts` already has connection suggestion logic
3. Sparks system (manual connections) fits naturally in connections API
4. Semantic search can be new route: `GET ?action=find-related`
5. Thread/recursive logic can move to connections
6. Only 1 frontend file uses it

**New Routes After Merge**:
```
api/connections.ts:
  POST ?action=auto-suggest - AI suggestions (EXISTS)
  PATCH ?action=update-suggestion&id=X - Accept/reject (EXISTS)
  GET ?action=find-related&id=X&type=Y - Semantic search (NEW from related.ts)
  GET ?action=list-sparks&id=X&type=Y - List connections (NEW from related.ts)
  GET ?action=ai-sparks&limit=3 - AI sparks for homepage (NEW from related.ts)
  GET ?action=thread&id=X&type=Y - Recursive thread (NEW from related.ts)
  POST ?action=create-spark - Create manual connection (NEW from related.ts)
  DELETE ?action=delete-spark&id=X - Delete connection (NEW from related.ts)
```

**Risk**: MEDIUM (need to update CreateConnectionDialog.tsx to use new routes)

---

### **10. api/search.ts** ✅ KEEP
**Size**: ~200 lines
**Routes**:
- `GET ?q=query` - Universal search (memories, projects, articles)

**Purpose**: Global search across all content
**Frontend Usage**: SearchPage, global search bar
**Dependencies**: Supabase (pgvector for semantic search)
**AI Models**: None (uses pre-computed embeddings)

**Why Keep**: Core feature for content discovery

**Overlap**: None

---

### **11. api/suggestions.ts** 🟡 **CONSOLIDATE INTO api/analytics.ts**
**Size**: 357 lines
**Routes**:
- `GET /api/suggestions` - List project suggestions
- `POST ?action=rate&id=X` - Rate suggestion
- `POST ?action=build&id=X` - Build project from suggestion

**Purpose**: AI-generated project suggestions (based on capabilities/themes)
**Frontend Usage**: 1 file (SuggestionsPage.tsx) - EXISTS and ACTIVE!
**Dependencies**: Supabase, Zod validation
**AI Models**: None (suggestions pre-generated by synthesis script)

**🚨 FINDINGS**:
- SuggestionsPage.tsx EXISTS and is ACTIVE (365 lines, complex UI)
- Uses `useSuggestionStore` to fetch/manage suggestions
- Has "Analyze & Generate" button that triggers synthesis
- **Overlaps with api/analytics.ts** (`?resource=opportunities` creative suggestions)

**RECOMMENDATION**: **MERGE into api/analytics.ts** (saves 1 function)

**Why**:
1. Both generate project suggestions via AI analysis
2. `api/analytics.ts` already has `opportunities` endpoint (creative projects)
3. Suggestions are analytical output (fits analytics theme)
4. Rating/building can move to `api/projects.ts` (since they create projects)

**New Routes After Merge**:
```
api/analytics.ts:
  GET ?resource=smart-suggestion - Next action (EXISTS)
  GET ?resource=patterns - Timeline patterns (EXISTS)
  GET ?resource=evolution - Synthesis evolution (EXISTS)
  GET ?resource=opportunities - Creative opportunities (EXISTS, similar to suggestions!)
  GET ?resource=project-suggestions - List suggestions (NEW from suggestions.ts)
  POST ?resource=init-tags - Admin tags (EXISTS)

api/projects.ts:
  POST ?action=rate-suggestion&id=X - Rate suggestion (NEW from suggestions.ts)
  POST ?action=build-from-suggestion&id=X - Build project (NEW from suggestions.ts)
```

**Risk**: MEDIUM (need to update SuggestionsPage + useSuggestionStore)

---

### **12. api/transcribe.ts** ✅ KEEP
**Size**: ~150 lines
**Routes**:
- `POST /api/transcribe` - Transcribe audio using Gemini

**Purpose**: Audio → text transcription
**Frontend Usage**: Voice recorder, audio memory capture
**Dependencies**: Gemini AI, formidable (multipart upload)
**AI Models**: Gemini (audio transcription)

**Why Keep**: Core feature for voice input

**Overlap**: None

---

## Consolidation Strategy

### **Phase 1: Remove api/onboarding.ts** (SAFEST)
**Impact**: 12 → 11 functions
**Risk**: VERY LOW (not used)
**Effort**: 5 minutes

**Steps**:
1. Verify OnboardingPage.tsx doesn't call `/api/onboarding`
2. Delete `api/onboarding.ts`
3. Update frontend if needed (unlikely)

**Result**: 11/12 functions

---

### **Phase 2: Merge api/related.ts → api/connections.ts** (MEDIUM COMPLEXITY)
**Impact**: 11 → 10 functions
**Risk**: MEDIUM (1 frontend file to update)
**Effort**: 1-2 hours

**Steps**:
1. Add Sparks routes to `api/connections.ts`:
   - `GET ?action=find-related` (semantic search)
   - `GET ?action=list-sparks` (list connections)
   - `GET ?action=ai-sparks` (AI sparks for homepage)
   - `GET ?action=thread` (recursive thread)
   - `POST ?action=create-spark` (create connection)
   - `DELETE ?action=delete-spark` (delete connection)
2. Copy helper functions from `api/related.ts`:
   - `findRelatedItems()`
   - `getItemConnections()`
   - `getItemThread()`
   - `getAISuggestedSparks()`
   - `fetchItemByTypeAndId()`
   - `extractKeywords()`
3. Update `CreateConnectionDialog.tsx` to use new routes
4. Test thoroughly
5. Delete `api/related.ts`

**Result**: 10/12 functions ✅

---

### **Phase 3 (Optional): Merge api/suggestions.ts → api/analytics.ts + api/projects.ts** (COMPLEX)
**Impact**: 10 → 9 functions
**Risk**: MEDIUM-HIGH (affects SuggestionsPage, store)
**Effort**: 2-3 hours

**Steps**:
1. Move `GET /api/suggestions` logic to `api/analytics.ts?resource=project-suggestions`
2. Move `POST ?action=rate` to `api/projects.ts?action=rate-suggestion`
3. Move `POST ?action=build` to `api/projects.ts?action=build-from-suggestion`
4. Update `SuggestionsPage.tsx` to use new routes
5. Update `useSuggestionStore.ts` API calls
6. Test SuggestionsPage thoroughly (complex UI!)
7. Delete `api/suggestions.ts`

**Result**: 9/12 functions (3 under limit!)

**Note**: This is optional - we hit our goal with Phase 2

---

## Recommended Immediate Action

### **Execute Phase 1 + Phase 2**

**Result**: 10/12 functions (2 under limit) ✅
**Total Time**: ~2 hours
**Risk**: LOW-MEDIUM

This gives us:
1. Safe buffer (2 functions under limit)
2. Cleaner API architecture (connections unified)
3. Removed dead code (onboarding)

**Phase 3 is optional** - only do if we need more functions or want cleaner architecture.

---

## Final API Structure (After Phase 1 + Phase 2)

1. ✅ **api/analytics.ts** - Analytics, patterns, evolution, opportunities, smart suggestions
2. ✅ **api/connections.ts** - AI suggestions + Sparks + semantic search + threads
3. ✅ **api/cron/jobs.ts** - Scheduled tasks
4. ✅ **api/memories.ts** - Memories CRUD
5. ✅ **api/process.ts** - Memory processing
6. ✅ **api/projects.ts** - Projects CRUD + daily queue
7. ✅ **api/reading.ts** - Articles + RSS + highlights
8. ✅ **api/search.ts** - Universal search
9. ✅ **api/suggestions.ts** - Project suggestions (or merged in Phase 3)
10. ✅ **api/transcribe.ts** - Audio transcription

**Total**: 10 functions (11 if we skip Phase 3)

---

## Code Quality Improvements

### Benefits of Consolidation
1. **Fewer cold starts** - Less Vercel function initialization
2. **Unified logic** - Connections/Sparks in one place
3. **Easier maintenance** - Related features together
4. **Better performance** - Shared connection pools
5. **Clearer API** - Fewer endpoints to remember

### Architectural Principles
- **By domain** (analytics, connections, content types)
- **Not by method** (avoid "getAllThings" endpoints)
- **RESTful** where possible (`GET /api/projects/:id`)
- **Query params** for actions (`?action=build`)
- **Consistent patterns** across APIs

---

## Next Steps

1. **Verify OnboardingPage usage** - Confirm it doesn't call /api/onboarding
2. **Start with Phase 1** - Delete api/onboarding.ts (5 min, zero risk)
3. **Execute Phase 2** - Merge related → connections (1-2 hours)
4. **Test thoroughly** - Especially CreateConnectionDialog + Sparks
5. **Deploy** - Monitor for errors
6. **(Optional) Phase 3** - Merge suggestions if needed

---

**Estimated Timeline**: 2-3 hours for Phases 1 + 2
**Risk Level**: LOW-MEDIUM (mostly safe merges)
**Result**: 10/12 functions (safe buffer for future growth) ✅
