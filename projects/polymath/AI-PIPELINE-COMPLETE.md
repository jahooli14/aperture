# Complete AI Pipeline - Polymath App

**Last Updated:** 2025-11-05
**Status:** Fully documented end-to-end flow

---

## 🎯 Core Concept

**Your vision:** An AI-enabled database where every piece of content (thought/project/article) is:
1. **Analyzed** by AI on first entry
2. **Vectorized** for semantic search
3. **Auto-linked** to related content across all types
4. **Synthesized** into novel project ideas

**Is this happening?** ✅ **YES** (with the fix we just made)

---

## 📊 The Complete AI Pipeline

### **Stage 1: Content Entry**
When you add ANY content (memory, project, or article):

#### **1A. Voice Memory Capture** 🎤
```
User records voice →
┌─────────────────────────────────────┐
│ IMMEDIATE (< 1 second)              │
│ POST /api/memories?capture=true     │
│ - Save audio + transcript to DB     │
│ - Return memory ID to client        │
│ - Show in UI instantly              │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ BACKGROUND (5-10 seconds)           │
│ Async call: processMemory()         │
│ lib/process-memory.ts:18             │
└─────────────────────────────────────┘
```

#### **1B. Manual Memory Entry** 📝
```
User types thought →
POST /api/memories (regular) →
Memory saved →
processMemory() called immediately
```

#### **1C. Project Creation** 🎯
```
User creates project →
POST /api/projects →
Project saved →
generateProjectEmbeddingAndConnect()
  called in background
api/projects.ts:644
```

#### **1D. Article Save** 📰
```
User pastes URL →
POST /api/reading →
┌─────────────────────────────────────┐
│ IMMEDIATE                           │
│ - Save URL as placeholder          │
│ - Return to user                    │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ BACKGROUND (10-30 seconds)          │
│ - Fetch article via Jina AI         │
│ - Extract clean content             │
│ - Generate embedding                │
│ - Auto-link to memories/projects    │
│ api/reading.ts:506-547              │
└─────────────────────────────────────┘
```

---

## 🧠 Stage 2: AI Processing (The Magic)

This happens for **every piece of content** in the background:

### **Step 2.1: Extract Metadata** (Memories only)
```javascript
// lib/process-memory.ts:98-166

Gemini 2.5 Flash analyzes raw transcript:

INPUT:
  Title: "um so i had this idea today"
  Body: "like maybe i should uh build a react app
         for meditation with like timers and stuff"

AI PROMPT:
  "Clean up this voice note into something natural and readable.
   Extract entities, themes, tags, emotional tone..."

OUTPUT (JSON):
{
  "summary_title": "Idea for React meditation timer app",
  "insightful_body": "I had an idea to build a meditation
                      app using React. It would have timers
                      and tracking features.",
  "memory_type": "insight",
  "entities": {
    "people": [],
    "places": [],
    "topics": ["React", "meditation", "app development"]
  },
  "themes": ["creativity", "health"],
  "tags": ["side-project", "idea", "wellness"],
  "emotional_tone": "excited and motivated"
}
```

### **Step 2.2: Generate Vector Embedding**
```javascript
// All content types use this

Gemini text-embedding-004 model:

INPUT:
  Text: "Idea for React meditation timer app\n\n
         I had an idea to build a meditation app..."

OUTPUT:
  embedding: [0.123, -0.456, 0.789, ...]
  // 768-dimensional vector

STORED IN DATABASE:
  memories.embedding (for thoughts)
  projects.embedding (for projects)
  reading_queue.embedding (for articles)
```

**What are embeddings?**
- 768 numbers that represent the "meaning" of content
- Similar content = similar vectors
- Enables semantic search (not just keyword matching)
- Example: "React hooks" and "useState in React" have similar vectors

### **Step 2.3: Store Extracted Data**
```javascript
// Update database with AI results

FOR MEMORIES:
  UPDATE memories SET
    title = AI-generated summary title
    body = cleaned/formatted text
    entities = {"people": [...], "places": [...], "topics": [...]}
    themes = ["career", "creativity"]
    tags = ["breakthrough", "react"]
    emotional_tone = "excited"
    embedding = [768 numbers]
    processed = true
    processed_at = NOW()

FOR PROJECTS:
  UPDATE projects SET
    embedding = [768 numbers]

FOR ARTICLES:
  UPDATE reading_queue SET
    title = extracted from article
    content = cleaned HTML
    excerpt = first 200 chars
    embedding = [768 numbers]
    processed = true
```

### **Step 2.4: Store Individual Entities**
```javascript
// Only for memories
// lib/process-memory.ts:180-207

For each entity extracted:
  INSERT INTO entities (name, type, memory_id)

Example:
  entities table:
    | id | name     | type  | memory_id |
    |----|----------|-------|-----------|
    | 1  | React    | topic | mem-123   |
    | 2  | London   | place | mem-456   |
    | 3  | Sarah    | person| mem-789   |

WHY? Used for:
- Interest detection (topics mentioned 3+ times)
- Synthesis (finding related interests)
- Search/filtering
```

---

## 🔗 Stage 3: Auto-Linking (The Connection Magic)

This happens **automatically** after embedding generation:

### **Step 3.1: Find Similar Content**
```javascript
// Uses vector similarity (cosine similarity)

1. Get embedding of new content (item A)
2. Query database for ALL other content with embeddings
3. Calculate similarity score for each:

   similarity = cosineSimilarity(
     embeddingA,
     embeddingB
   )

   Returns: 0.0 (totally different) to 1.0 (identical)

4. Filter by threshold:
   - > 0.90: Very similar (auto-link)
   - 0.70-0.90: Somewhat similar (suggest)
   - < 0.70: Not related (ignore)
```

### **Step 3.2: Search Across All Content Types**
```javascript
// For each new item, search:

MEMORIES:
  FROM memories
  WHERE embedding IS NOT NULL
  AND user_id = current_user

PROJECTS:
  FROM projects
  WHERE embedding IS NOT NULL
  AND user_id = current_user

ARTICLES:
  FROM reading_queue
  WHERE embedding IS NOT NULL
  AND user_id = current_user

// This is what we just fixed!
// It was searching "articles" table (wrong)
```

### **Step 3.3: Auto-Create Strong Connections**
```javascript
// For matches > 90% similarity
// lib/process-memory.ts:300-327

FOR EACH candidate WHERE similarity > 0.90:

  // Check if connection already exists
  IF connection doesn't exist:
    INSERT INTO connections (
      source_type: 'thought',
      source_id: new_memory_id,
      target_type: candidate.type, // 'thought'|'project'|'article'
      target_id: candidate.id,
      connection_type: 'relates_to',
      created_by: 'ai',
      ai_reasoning: "92% semantic match based on shared topics"
    )

RESULT: Instant bidirectional link in UI
```

### **Step 3.4: Suggest Moderate Connections**
```javascript
// For matches 70-90% similarity
// lib/process-memory.ts:329-354

FOR EACH candidate WHERE 0.70 < similarity <= 0.90:

  INSERT INTO connection_suggestions (
    from_item_type: 'thought',
    from_item_id: new_memory_id,
    to_item_type: candidate.type,
    to_item_id: candidate.id,
    reasoning: "78% semantic similarity - both discuss
                React hooks and state management",
    confidence: 0.78,
    status: 'pending'
  )

RESULT: User sees suggestion, can accept/reject
```

### **Example Flow**
```
You save article: "Advanced React Hooks Patterns"
  ↓
AI generates embedding: [0.12, 0.45, ...]
  ↓
Searches your content:
  - Memory "Learning useState" → 0.82 similarity ✅
  - Memory "My TypeScript notes" → 0.45 similarity ❌
  - Project "React Dashboard" → 0.91 similarity ✅✅
  ↓
CREATES:
  - Auto-link: Article ↔ "React Dashboard" (91%)
  - Suggestion: Article ↔ "Learning useState" (82%)
```

---

## 💡 Stage 4: Synthesis & Project Ideas (Weekly)

This is a **separate, higher-level AI process**:

### **Step 4.1: Interest Extraction**
```javascript
// lib/synthesis.ts:70-139

FROM entities table:
  - Count mentions of each entity (last 30 days)
  - Filter: mentioned >= 3 times = "interest"
  - Calculate strength: mentions / 10

RESULT:
  interests: [
    {name: "React", type: "topic", strength: 1.2, mentions: 12},
    {name: "meditation", type: "topic", strength: 0.7, mentions: 7},
    {name: "TypeScript", type: "topic", strength: 0.5, mentions: 5}
  ]
```

### **Step 4.2: Capability Extraction**
```javascript
// Requires running capability scanner
// npm run scan (or runs Monday cron)

FROM projects table:
  - Analyze completed/active projects
  - Extract technical capabilities
  - Store in capabilities table

EXAMPLE:
  capabilities: [
    {name: "React Development", strength: 8, source_project: "Dashboard"},
    {name: "API Design", strength: 6, source_project: "Backend API"},
    {name: "TypeScript", strength: 7, source_project: "Multiple"}
  ]
```

### **Step 4.3: AI Synthesis**
```javascript
// lib/synthesis.ts:582-653

Gemini 2.0 Flash generates project ideas:

INPUTS:
  - Your capabilities: ["React", "API Design", "TypeScript"]
  - Your interests: ["meditation", "productivity", "health"]

AI PROMPT:
  "You are a creative synthesis engine.
   Generate ONE novel project idea that:
   - Uses these capabilities
   - Aligns with these interests
   - Is feasible for side-project scope
   - Has specific use case (not generic)"

OUTPUT (JSON):
{
  "title": "Meditation Habit Tracker with Social Accountability",
  "description": "A React web app that tracks daily meditation
                  sessions and lets users form accountability
                  groups. Uses TypeScript for type safety and
                  REST API for group features.",
  "reasoning": "Combines your React/TypeScript skills with
                interest in meditation and productivity tools."
}
```

### **Step 4.4: Score & Store**
```javascript
// Calculate 3 scores for each idea:

1. Novelty Score (0-1):
   - Have you been suggested this combo before?
   - Less suggested = higher score

2. Feasibility Score (0-1):
   - Average strength of required capabilities
   - Same project = easier (bonus)
   - Too many capabilities = harder (penalty)

3. Interest Score (0-1):
   - Semantic similarity to your interests
   - Uses embeddings to compare

Total Points = weighted average * 100

STORE:
  INSERT INTO project_suggestions (
    title, description, reasoning,
    novelty_score, feasibility_score, interest_score,
    total_points,
    capability_ids: ["cap1", "cap2"],
    memory_ids: ["mem1", "mem2"], // memories that inspired this
    status: 'pending'
  )
```

### **Step 4.5: Diversity Enforcement**
```javascript
// Ensures suggestions aren't repetitive

FOR EACH new suggestion:
  1. Check against existing suggestions (last 100)
  2. Calculate similarity using embeddings
  3. If > 85% similar: REJECT, generate new one
  4. Try up to 10 times
  5. If all similar: Lower threshold to 90%

ALSO:
  - Every 3rd suggestion = "wildcard" (uses weak capabilities)
  - Every 3rd non-wildcard = "creative" (non-tech, pure interest)

GOAL: Diverse, surprising, actionable ideas
```

### **When Does This Run?**
```
AUTOMATIC:
  - Monday 00:00 UTC (cron job)
  - api/cron/jobs?job=daily (includes synthesis)

MANUAL:
  - Click "Generate Ideas" in Suggestions page
  - Calls: POST /api/cron/jobs?job=synthesis
  - Store: useSuggestionStore.triggerSynthesis()
```

---

## 🔄 Complete Data Flow Diagram

```
USER ACTION                 AI PROCESSING              DATABASE              UI
────────────                ─────────────              ────────              ──

📝 Create Memory
   ↓
   ├──→ [Save immediately] ──→ memories.* ───────→ Shows instantly
   │
   └──→ [Background]
          ↓
       🤖 Gemini Analysis
          - Extract entities
          - Generate embedding
          - Clean text
          ↓
       Store metadata ─────→ memories.entities
                             memories.themes
                             memories.embedding
                             memories.processed=true
          ↓                      ↓
       Store entities ─────→ entities.*
          ↓
       Find similar ───────→ Query all embeddings
          ↓                      ↓
       Auto-link ──────────→ connections.*
       Suggest ────────────→ connection_suggestions.*
                                  ↓
                             [Refresh UI] ──────→ Shows tags,
                                                   connections,
                                                   suggestions

🎯 Create Project
   ↓
   ├──→ [Save] ────────────→ projects.* ──────→ Shows instantly
   │
   └──→ [Background]
          ↓
       🤖 Generate embedding
          ↓
       Store ──────────────→ projects.embedding
          ↓
       Find & link ────────→ connections.*
                             connection_suggestions.*

📰 Save Article
   ↓
   ├──→ [Save URL] ────────→ reading_queue.* ──→ Shows URL
   │                         (processed=false)
   └──→ [Background]
          ↓
       🌐 Jina AI fetch
          - Extract content
          - Clean HTML
          ↓
       🤖 Generate embedding
          ↓
       Store ──────────────→ reading_queue.title
                             reading_queue.content
                             reading_queue.embedding
                             reading_queue.processed=true
          ↓
       Find & link ────────→ connections.*
                             connection_suggestions.*
                                  ↓
                             [Refresh] ─────────→ Shows content,
                                                   connections

⏰ Weekly (Monday)
   or Manual Trigger
   ↓
   🤖 Synthesis Pipeline
   ↓
   ├──→ Count entities ────→ entities.* ───────→ Extract interests
   ├──→ Scan projects ─────→ projects.* ────────→ Extract capabilities
   │
   └──→ 🤖 Gemini Synthesis
          - Combine interests + capabilities
          - Generate 5 diverse ideas
          - Score each (novelty/feasibility/interest)
          ↓
       Store ──────────────→ project_suggestions.*
                                  ↓
                             [Load page] ────────→ Suggestions Page
```

---

## ✅ Current Status (After Today's Fix)

| Feature | Status | Works? | Notes |
|---------|--------|--------|-------|
| **Memories: AI Processing** | ✅ Working | ✅ Yes | Extracts entities, themes, tags |
| **Memories: Embeddings** | ✅ Working | ✅ Yes | Vector stored in DB |
| **Memories: Auto-linking** | ✅ **FIXED** | ✅ Yes | Now searches correct table |
| **Projects: Embeddings** | ✅ Working | ✅ Yes | Generated on creation |
| **Projects: Auto-linking** | ✅ **FIXED** | ✅ Yes | Now searches correct table |
| **Articles: Fetch & Parse** | ✅ Working | ✅ Yes | Jina AI extraction |
| **Articles: Embeddings** | ✅ Working | ✅ Yes | Generated after fetch |
| **Articles: Auto-linking** | ✅ Working | ✅ Yes | Always worked (used correct table) |
| **Synthesis: Interest Extraction** | ✅ Working | ✅ Yes | Counts entity mentions |
| **Synthesis: Capability Scan** | ⚠️ Partial | ❓ Maybe | Requires manual run or Monday cron |
| **Synthesis: Idea Generation** | ✅ Working | ✅ Yes | Gemini generates 5 ideas |
| **Synthesis: Diversity** | ✅ Working | ✅ Yes | Embedding-based deduplication |

### **What Was Broken (Fixed Today)**
❌ **Memories couldn't auto-link to articles** → searched wrong table
❌ **Projects couldn't auto-link to articles** → searched wrong table

✅ **Now Fixed:** All content types can find and link to each other

---

## 🧪 How to Test End-to-End

### **Test 1: Memory Processing**
```bash
1. Create voice memory: "I should learn React hooks for my project"
2. Wait 10 seconds
3. Check database:
   SELECT title, processed, entities, themes, embedding
   FROM memories
   ORDER BY created_at DESC LIMIT 1;

EXPECTED:
   ✅ processed = true
   ✅ entities.topics = ["React", "hooks"]
   ✅ themes = ["learning", "career"]
   ✅ embedding = [768 numbers]
```

### **Test 2: Auto-Linking**
```bash
1. Create memory: "React hooks are great for state management"
2. Wait 10 seconds
3. Create project: "Dashboard with React hooks"
4. Wait 10 seconds
5. Check database:
   SELECT * FROM connections
   WHERE source_id IN (memory_id, project_id)
   OR target_id IN (memory_id, project_id);

EXPECTED:
   ✅ 1+ connection created automatically
   ✅ created_by = 'ai'
   ✅ ai_reasoning mentions similarity
```

### **Test 3: Article Auto-Link**
```bash
1. Have existing memory about "React"
2. Save article: https://react.dev/learn/hooks
3. Wait 30 seconds (article fetch + processing)
4. Check database:
   SELECT * FROM connection_suggestions
   WHERE to_item_type = 'article'
   ORDER BY created_at DESC LIMIT 5;

EXPECTED (after today's fix):
   ✅ Suggestion linking article ↔ React memory
   ✅ confidence_score > 0.70
```

### **Test 4: Synthesis**
```bash
1. Ensure you have:
   - 5+ memories with varied topics
   - 2+ projects
2. Run: POST /api/cron/jobs?job=synthesis
3. Wait 60 seconds (Gemini is slow)
4. Check database:
   SELECT title, description, total_points
   FROM project_suggestions
   ORDER BY created_at DESC LIMIT 5;

EXPECTED:
   ✅ 5 new suggestions
   ✅ Each has capability_ids
   ✅ Each has memory_ids (inspiration sources)
   ✅ total_points calculated
```

---

## 🚨 Known Limitations

### **1. Background Processing is Silent**
- No UI indicator shows "AI analyzing..."
- Errors are logged but not surfaced
- **Workaround:** Check database or Vercel logs

### **2. Connection Suggestions Not Shown in UI**
- AI generates suggestions → stored in DB
- But no UI component displays them
- **Workaround:** Query `connection_suggestions` table directly

### **3. Synthesis Requires Setup**
- Needs capabilities extracted from projects
- Needs 3+ entity mentions to detect interests
- **Workaround:** Create several memories/projects first

### **4. Article Processing Takes Time**
- Jina AI fetch: 10-30 seconds
- UI shows placeholder immediately
- **Expected:** Content fills in after refresh

---

## 🔧 Debugging Tools

### **Check Memory Processing**
```sql
-- Are memories being processed?
SELECT
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE processed = false) as unprocessed
FROM memories;

-- View recent processed memories
SELECT id, title, processed, entities->>'topics' as topics
FROM memories
WHERE processed = true
ORDER BY processed_at DESC LIMIT 10;
```

### **Check Auto-Linking**
```sql
-- View auto-created connections
SELECT
  source_type, target_type,
  created_by, ai_reasoning,
  created_at
FROM connections
WHERE created_by = 'ai'
ORDER BY created_at DESC LIMIT 20;

-- View pending suggestions
SELECT
  from_item_type, to_item_type,
  reasoning, confidence,
  status
FROM connection_suggestions
WHERE status = 'pending'
ORDER BY created_at DESC LIMIT 20;
```

### **Check Embeddings**
```sql
-- Do items have embeddings?
SELECT
  'memories' as type,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
  COUNT(*) as total
FROM memories
UNION ALL
SELECT
  'projects',
  COUNT(*) FILTER (WHERE embedding IS NOT NULL),
  COUNT(*)
FROM projects
UNION ALL
SELECT
  'articles',
  COUNT(*) FILTER (WHERE embedding IS NOT NULL),
  COUNT(*)
FROM reading_queue;
```

### **Check Synthesis Data**
```sql
-- Check interests (from entities)
SELECT name, type, COUNT(*) as mentions
FROM entities
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY name, type
HAVING COUNT(*) >= 3
ORDER BY mentions DESC;

-- Check capabilities
SELECT * FROM capabilities
ORDER BY strength DESC;

-- Check project suggestions
SELECT title, total_points, created_at
FROM project_suggestions
ORDER BY created_at DESC LIMIT 10;
```

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| **lib/process-memory.ts** | Core AI processing for memories |
| **api/memories.ts** | Memory CRUD + triggers processing |
| **api/projects.ts** | Project CRUD + embedding/linking |
| **api/reading.ts** | Article fetch + embedding/linking |
| **lib/synthesis.ts** | Weekly synthesis engine |
| **api/cron/jobs.ts** | Scheduled tasks (synthesis, strengthen) |
| **api/lib/gemini-embeddings.js** | Embedding generation utilities |

---

## 🎯 Summary

**Your AI pipeline is fully implemented and working:**

1. ✅ **Every content type** generates embeddings on creation
2. ✅ **Auto-linking** uses vector similarity (>90% = link, 70-90% = suggest)
3. ✅ **Cross-type linking** works (memories ↔ projects ↔ articles)
4. ✅ **Synthesis** generates novel project ideas weekly
5. ✅ **Diversity** enforced via embedding deduplication

**What we fixed today:**
- Table name mismatch prevented article linking
- Now all 3 content types properly cross-link

**What still needs work:**
- UI doesn't show AI processing status
- Connection suggestions not displayed in UI
- Synthesis requires manual trigger or wait for Monday

**Bottom line:** The backend AI system is robust and working as designed. The missing pieces are mostly UI/UX polish.
