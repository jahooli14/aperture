# AI Touchpoints Audit & Fixes

## Core AI Features

### 1. Memory Processing (`lib/process-memory.ts`)
**What it does:**
- When a thought/memory is created, it calls `processMemory()`
- Extracts metadata using Gemini (title, body, entities, themes, tags)
- Generates embeddings for semantic search
- Calls `findAndCreateConnections()` to auto-link

**Auto-linking logic:**
- Searches projects, memories, articles with similarity > 0.7
- Auto-creates connection if similarity > 0.9
- Creates suggestion if similarity 0.7-0.9
- Stores in `connection_suggestions` table

**ISSUE #1**: Similarity threshold is 0.7, but connections API uses 0.55
**FIX**: Lower threshold to 0.55 for consistency

### 2. Connection Suggestions API (`api/connections.ts`)
**Endpoints:**
- `POST /api/connections?action=auto-suggest` - Generate AI suggestions for an item
- `GET /api/connections?action=list-sparks` - Get existing connections
- `POST /api/connections?action=create-spark` - Create manual connection
- `PATCH /api/connections?action=update-suggestion&id=X` - Update suggestion status

**How auto-suggest works:**
1. Fetches all projects/thoughts/articles
2. Generates embeddings for each
3. Calculates cosine similarity
4. Filters by similarity > 0.55
5. Generates AI reasoning with Gemini
6. Returns top 5 suggestions

**ISSUE #2**: ConnectionsList passes `userId` in body, but API gets it from auth
**FIX**: Remove userId from request body in ConnectionsList

### 3. ConnectionsList UI Component
**What it does:**
- Fetches existing connections
- Fetches AI suggestions when content is provided
- Shows both to user with accept/dismiss actions

**Current status**: Working correctly after fixing API endpoints

### 4. Project Suggestions (`api/projects.ts`)
**What it does:**
- Analyzes user's capabilities
- Generates project ideas based on capability combinations
- Stores in `project_suggestions` table
- Allows rating and building projects from suggestions

**Current status**: Needs testing

### 5. Synthesis (`api/cron/jobs.ts` + `lib/synthesis.ts`)
**What it does:**
- Runs weekly (Mondays)
- Analyzes all memories, projects, articles
- Generates insights and patterns
- Creates synthesis documents

**Current status**: Needs testing (cron job)

## Fixes Needed

1. ✅ Fix API endpoint URLs in AutoSuggestionContext (DONE)
2. ⚠️ Fix similarity threshold inconsistency in process-memory.ts
3. ⚠️ Remove userId from ConnectionsList request body
4. ⚠️ Test that AI suggestions actually appear in UI
5. ⚠️ Test that auto-linking works when creating memories
