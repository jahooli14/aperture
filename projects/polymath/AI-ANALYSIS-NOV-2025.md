# Critical Review: AI Processing & Suggestions Flow in Polymath
**Date:** November 2, 2025
**Reviewer:** Claude (Sonnet 4.5)

## Executive Summary

This document analyzes the AI processing pipeline across thoughts, projects, and articles in Polymath. It examines **when AI analysis happens**, **what users see**, and identifies gaps between the intended design and actual implementation.

---

## 🧠 **THOUGHTS (Voice Notes / Memories)**

### **Theory (Intended Flow)**
1. User records voice note or creates manual thought
2. **Immediate parsing** with Gemini (< 5 seconds) to create title + bullets
3. Memory saved to database with `processed: false`
4. **Background processing** triggered via `/api/process` (fire-and-forget)
5. Full AI analysis extracts entities, themes, tags, embeddings
6. Memory updated with `processed: true`

### **Reality (Actual Implementation)**

✅ **What Works:**
- **api/memories.ts:109-219** (`handleCapture`): Voice capture flow is well-designed
  - Gemini parses transcript FIRST (line 121-143) before saving
  - Returns immediately with parsed title/bullets (line 205-210)
  - Triggers background processing (line 197-201)
  - Shows "Voice note saved! AI is processing..." toast

✅ **What Users See:**
- **MemoriesPage.tsx:436-463**: "Voice note saved - AI processing..." banner
  - Shows processing state for up to 30 seconds (line 447)
  - Animated progress bar (line 450-456)
  - Users can navigate away while processing happens (line 169-170)

⚠️ **Critical Gaps:**

1. **No visibility when background processing completes**
   - Memory gets updated with entities/themes/tags (process-memory.ts:46-62)
   - BUT users never see "Processing complete!" notification
   - The `processingVoiceNote` state clears after toast, not when actually done

2. **"Processed" memories look identical to unprocessed ones**
   - `MemoryCard` component doesn't show processing status
   - No visual indicator: ✓ "Analyzed" vs ⏳ "Processing" vs ❌ "Failed"
   - Users can't tell if AI analysis succeeded

3. **Error handling is silent**
   - If background `/api/process` fails, error stored in DB (process-memory.ts:83-89)
   - But UI never checks or displays this
   - Failed memories stuck in limbo forever

---

## 🎨 **PROJECTS (Suggestions)**

### **Theory (Intended Flow)**
1. Weekly cron job (Mondays) OR manual trigger
2. Synthesis engine analyzes memories + capabilities
3. Generates 5 project suggestions via Gemini
4. Stores in `project_suggestions` table with scores
5. Users browse, rate (spark/meh), or build into projects

### **Reality (Actual Implementation)**

✅ **What Works:**
- **synthesis.ts:728-909** (`runSynthesis`): Sophisticated synthesis logic
  - Extracts interests from entities (line 70-138)
  - Loads capabilities from projects (line 144-155)
  - Generates mix of tech+tech, tech+interest, creative (line 749-771)
  - Prevents duplicates with similarity checks (line 777-782)
  - Wildcard suggestions for anti-echo-chamber (line 459-534)

✅ **What Users See:**
- **SuggestionsPage.tsx:98-131**: Manual trigger with progress bar
  - "Analyze & Generate" button (line 155-171)
  - Simulated progress bar (synthesis takes 20-40s, line 103-112)
  - Completes at 100% when done (line 120)
  - Empty state explains AI features (line 274-330)

⚠️ **Critical Issues:**

1. **Theory-Reality Mismatch: "When does synthesis run?"**
   - **Cron config says:** Weekly on Mondays (cron/jobs.ts:121-137)
   - **Reality:** Vercel Hobby only allows 1 cron/day
   - The daily cron checks `isMonday` and conditionally runs synthesis
   - BUT if user has never captured thoughts, synthesis generates nothing
   - **No clear UX around "when will I see suggestions?"**

2. **Synthesis requires undocumented prerequisites:**
   - Need at least 2 capabilities (synthesis.ts:737-740)
   - Capabilities extracted from past projects
   - **But where do initial capabilities come from?**
   - Looks like capabilities table is populated externally (not in codebase)
   - New users hit empty state with no path forward

3. **Suggestion quality invisible to users:**
   - Each suggestion has 3 scores: novelty, feasibility, interest (synthesis.ts:627-636)
   - Total points calculated (line 632-636)
   - **BUT SuggestionCard component doesn't show these scores!**
   - Users can't understand WHY a suggestion was generated
   - No transparency into "synthesis reasoning" field

4. **"Pending" suggestions accumulate forever:**
   - Filter shows: pending, spark, saved, built (SuggestionsPage.tsx:215-221)
   - No "dismiss" or "archive" action
   - No auto-cleanup of old suggestions
   - Database will fill with stale ideas

---

## 📚 **ARTICLES (Reading Queue)**

### **Theory (Intended Flow)**
1. User saves URL via SaveArticleDialog
2. Jina AI extracts clean article content
3. Content cleaned with aggressive filtering
4. Article stored with metadata (word count, read time, etc.)
5. Status tracked: unread → reading → archived

### **Reality (Actual Implementation)**

✅ **What Works:**
- **reading.ts:20-99** (`fetchArticleWithJina`): Robust article extraction
  - Jina AI returns clean markdown (line 33-48)
  - Aggressive content cleaning (line 105-238)
  - Removes nav, ads, cookie notices, social media cruft
  - Converts to HTML for rendering (line 79-83)
  - Status auto-updates on first view (line 383-392)

✅ **What Users See:**
- Articles display immediately after save
- Status badges: Unread, Reading, Archived
- Reading time estimate shown (line 249-253)
- Word count tracked (line 255-257)

⚠️ **Missing AI Analysis:**

1. **Articles never get AI processing!**
   - Voice notes get entities/themes/tags extracted
   - Projects have capabilities
   - **Articles just sit there with title + content**
   - No semantic analysis, no entity extraction, no theme clustering
   - They're isolated from the knowledge graph

2. **No article → suggestion connection:**
   - Synthesis engine only looks at memories + capabilities (synthesis.ts:732-735)
   - Articles never feed into project suggestions
   - Even though they're in the "inspiration" endpoint (HomePage.tsx:58-73)
   - Wasted opportunity for "article + skill → project idea"

3. **RSS feed auto-import has no filtering:**
   - RSS sync pulls 5 articles per feed (reading.ts:602)
   - All tagged "rss, auto-imported" (line 628)
   - No AI relevance scoring
   - No duplicate detection beyond URL matching
   - Reading queue gets polluted with noise

---

## 🔗 **CONNECTIONS (Bridge Detection)**

### **Theory (Intended Flow)**
1. After memory processing, trigger connection detection (async)
2. Find related memories/projects/articles via embeddings
3. Suggest connections to user
4. User can accept/dismiss

### **Reality (Actual Implementation)**

⚠️ **Partially Implemented:**
- `processMemory` triggers connection detection (process-memory.ts:68-70)
- Calls `/api/connections/suggest` (line 211-220)
- BUT errors are silently caught and logged (line 223-226)
- **Connection API handler not found in codebase!**
- `useConnectionStore` exists but no backend implementation found
- Suggests feature was designed but not completed

---

## 🎯 **Summary: Theory vs Reality**

| Feature | Theory | Reality | User Impact |
|---------|--------|---------|-------------|
| **Voice Notes** | Instant parse → background analysis | ✅ Works, but no completion notification | Users don't know when analysis is done |
| **Thought Processing** | Entities, themes, tags extracted | ✅ Works, but errors hidden | Failed processing goes unnoticed |
| **Weekly Synthesis** | Automatic Monday generation | ⚠️ Works, but needs 2+ capabilities | New users stuck with empty state |
| **Suggestion Scoring** | 3 scores + reasoning | ✅ Calculated, but not shown | Users can't evaluate suggestion quality |
| **Article Analysis** | Should integrate with synthesis | ❌ Not implemented | Articles isolated from knowledge graph |
| **Connection Detection** | Bridge between content types | ❌ Partially implemented | Feature exists in UI but no backend |
| **RSS Intelligence** | Filter and rank imports | ❌ Not implemented | Reading queue fills with noise |

---

## 🚨 **Recommended Changes**

### **HIGH IMPACT - User Visibility**

#### **1. Show Memory Processing Status**

**File:** `src/components/MemoryCard.tsx`

**Current:** No indication of processing status

**Change:** Add visual indicators for processing state

```tsx
// Add to MemoryCard component
{memory.processed ? (
  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--premium-emerald)' }}>
    <CheckCircle className="h-3 w-3" />
    <span>Analyzed</span>
    {memory.entities && (
      <span style={{ color: 'var(--premium-text-tertiary)' }}>
        • {Object.values(memory.entities).flat().length} entities
      </span>
    )}
  </div>
) : memory.error ? (
  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--premium-red)' }}>
    <AlertCircle className="h-3 w-3" />
    <span>Analysis failed</span>
    <button
      onClick={(e) => { e.stopPropagation(); onRetry?.(memory.id) }}
      className="underline hover:no-underline"
    >
      Retry
    </button>
  </div>
) : (
  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--premium-amber)' }}>
    <Loader className="h-3 w-3 animate-spin" />
    <span>Processing...</span>
  </div>
)}
```

**Impact:** Users can immediately see which thoughts have been analyzed vs still processing vs failed.

---

#### **2. Add Processing Completion Polling**

**File:** `src/pages/MemoriesPage.tsx`

**Current:** Fire-and-forget background processing (line 197-201)

**Change:** Add polling to detect when processing completes

```tsx
// After line 290 in handleVoiceCapture
// Poll for completion
const pollInterval = setInterval(async () => {
  const response = await fetch(`/api/memories?id=${createdMemory.id}`)
  const data = await response.json()
  const updatedMemory = data.memories?.[0]

  if (updatedMemory?.processed) {
    clearInterval(pollInterval)
    setProcessingVoiceNote(false)

    // Show completion toast with what was found
    const entityCount = updatedMemory.entities
      ? Object.values(updatedMemory.entities).flat().length
      : 0
    const themes = updatedMemory.themes || []

    addToast({
      title: '✓ Analysis complete!',
      description: `Found ${entityCount} entities, ${themes.length} themes`,
      variant: 'success',
    })

    // Refresh to show updated data
    await loadMemoriesWithCache()
  } else if (updatedMemory?.error) {
    clearInterval(pollInterval)
    setProcessingVoiceNote(false)

    addToast({
      title: 'Analysis failed',
      description: updatedMemory.error,
      variant: 'destructive',
    })
  }
}, 3000) // Poll every 3 seconds

// Clear after max 60 seconds
setTimeout(() => clearInterval(pollInterval), 60000)
```

**Impact:** Users get feedback when analysis completes and see what was discovered.

---

#### **3. Expose Suggestion Scoring in UI**

**File:** `src/components/suggestions/SuggestionCard.tsx`

**Current:** Scores calculated but hidden

**Change:** Show score breakdown

```tsx
// Add after suggestion title
<div className="flex gap-2 mb-3">
  <div className="flex-1">
    <div className="text-xs mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>
      Novelty
    </div>
    <div className="h-1.5 rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{
          width: `${suggestion.novelty_score * 100}%`,
          backgroundColor: 'var(--premium-blue)'
        }}
      />
    </div>
  </div>
  <div className="flex-1">
    <div className="text-xs mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>
      Feasibility
    </div>
    <div className="h-1.5 rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{
          width: `${suggestion.feasibility_score * 100}%`,
          backgroundColor: 'var(--premium-emerald)'
        }}
      />
    </div>
  </div>
  <div className="flex-1">
    <div className="text-xs mb-1" style={{ color: 'var(--premium-text-tertiary)' }}>
      Interest
    </div>
    <div className="h-1.5 rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{
          width: `${suggestion.interest_score * 100}%`,
          backgroundColor: 'var(--premium-purple)'
        }}
      />
    </div>
  </div>
</div>
```

**File:** `src/components/suggestions/SuggestionDetailDialog.tsx`

**Change:** Show synthesis reasoning

```tsx
// Add after description
{suggestion.synthesis_reasoning && (
  <div className="premium-glass-subtle p-4 rounded-lg mb-4">
    <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--premium-text-secondary)' }}>
      Why this suggestion?
    </h4>
    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
      {suggestion.synthesis_reasoning}
    </p>
  </div>
)}
```

**Impact:** Users understand WHY suggestions were generated and can trust the AI's reasoning.

---

#### **4. Add Dismiss Action for Suggestions**

**File:** `api/projects.ts`

**Current:** No way to dismiss bad suggestions

**Change:** Add dismiss endpoint (after line 376)

```ts
// POST: Dismiss suggestion
if (req.method === 'POST' && action === 'dismiss') {
  return handleDismissSuggestion(req, res, id, supabase, userId)
}

// Add handler function at end of file
async function handleDismissSuggestion(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  supabase: any,
  userId: string
) {
  if (!id) {
    return res.status(400).json({ error: 'Suggestion ID required' })
  }

  try {
    // Update suggestion status to dismissed
    const { data: suggestion, error: updateError } = await supabase
      .from('project_suggestions')
      .update({ status: 'dismissed' })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    // Penalize this capability combination to avoid similar suggestions
    if (suggestion.capability_ids && suggestion.capability_ids.length > 0) {
      await penalizeCombination(suggestion.capability_ids, 0.2, supabase)
    }

    return res.status(200).json({
      success: true,
      updated_suggestion: suggestion
    })

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
```

**File:** `src/stores/useSuggestionStore.ts`

**Change:** Add dismiss action (after line 142)

```ts
dismissSuggestion: async (id: string) => {
  try {
    const response = await fetch(`${API_BASE}/projects?resource=suggestions&action=dismiss&id=${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('Failed to dismiss suggestion')
    }

    // Refresh suggestions after dismissing
    await get().fetchSuggestions()
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}
```

**File:** `src/components/suggestions/SuggestionCard.tsx`

**Change:** Add dismiss button

```tsx
// Add to card actions
<button
  onClick={(e) => {
    e.stopPropagation()
    onDismiss?.(suggestion.id)
  }}
  className="text-xs px-3 py-1.5 rounded-full transition-all hover:bg-white/10"
  style={{ color: 'var(--premium-text-tertiary)' }}
>
  Dismiss
</button>
```

**Impact:** Users can clean up bad suggestions, and the AI learns to avoid similar combinations.

---

### **MEDIUM IMPACT - Fix Bootstrapping**

#### **5. Show Clear Path to Unlock Suggestions**

**File:** `src/pages/SuggestionsPage.tsx`

**Current:** Empty state says "click generate" but doesn't explain prerequisites

**Change:** Show progress toward unlocking (replace lines 269-330)

```tsx
{suggestions.length === 0 && !loading && (
  <Card className="premium-card">
    <CardContent className="py-16">
      <div className="max-w-2xl mx-auto text-center">
        <Database className="h-12 w-12 mx-auto mb-6" style={{ color: 'var(--premium-blue)' }} />
        <h3 className="text-2xl font-bold mb-4 premium-text-platinum">
          Unlock AI Project Suggestions
        </h3>

        {/* Prerequisites checklist */}
        <div className="max-w-md mx-auto mb-8 text-left space-y-3">
          <div className="flex items-start gap-3 premium-glass-subtle p-3 rounded-lg">
            {memories.length >= 5 ? (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--premium-text-tertiary)' }} />
            )}
            <div className="flex-1">
              <p className="font-medium premium-text-platinum">
                Capture 5+ thoughts
              </p>
              <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                {memories.length} / 5 captured
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 premium-glass-subtle p-3 rounded-lg">
            {projects.length >= 2 ? (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--premium-text-tertiary)' }} />
            )}
            <div className="flex-1">
              <p className="font-medium premium-text-platinum">
                Create 2+ projects
              </p>
              <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                {projects.length} / 2 created (builds capability graph)
              </p>
            </div>
          </div>
        </div>

        {memories.length >= 5 && projects.length >= 2 ? (
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="premium-btn-primary"
          >
            {synthesizing ? 'Generating...' : 'Generate Suggestions'}
          </button>
        ) : (
          <div className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
            Complete the steps above to unlock AI suggestions
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

**Impact:** Users understand what they need to do to get suggestions, not just "nothing here yet."

---

#### **6. Auto-Extract Capabilities from First Projects**

**File:** `lib/extract-capabilities.ts` (new file)

**Current:** Capabilities table manually populated

**Change:** Auto-extract when project created

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig, getGeminiConfig } from './env.js'

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

/**
 * Extract capabilities from project description and metadata
 * Called when a new project is created
 */
export async function extractCapabilitiesFromProject(
  projectId: string,
  title: string,
  description: string,
  userId: string
): Promise<void> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

  const prompt = `Extract technical capabilities demonstrated by this project.

Project: ${title}
Description: ${description}

Return a JSON array of capabilities:
[
  {
    "name": "capability name (e.g., React, API Design, Machine Learning)",
    "description": "1-2 sentence description of proficiency level"
  }
]

Only return capabilities that are clearly demonstrated, not assumed. Focus on:
- Specific technologies (React, Python, PostgreSQL)
- Technical skills (API design, data modeling, UI/UX)
- Domain knowledge (e-commerce, healthcare, education)

Return ONLY the JSON array, no other text.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return

  const capabilities = JSON.parse(jsonMatch[0])

  // Store capabilities with link to source project
  for (const cap of capabilities) {
    await supabase
      .from('capabilities')
      .upsert({
        name: cap.name,
        description: cap.description,
        source_project: projectId,
        strength: 1.0, // Initial strength
        user_id: userId,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString()
      }, {
        onConflict: 'name,user_id' // Update if exists
      })
  }
}
```

**File:** `api/projects.ts`

**Change:** Call capability extraction on project creation (after line 629)

```ts
if (error) {
  console.error('[projects] Insert error:', error)
  throw error
}

// Extract capabilities from new project
try {
  await extractCapabilitiesFromProject(
    data.id,
    data.title,
    data.description || '',
    userId
  )
} catch (capError) {
  // Log but don't fail project creation
  console.warn('[projects] Capability extraction failed:', capError)
}

return res.status(201).json(data)
```

**Impact:** Capabilities automatically populated from user's actual projects, not external seeding.

---

### **MEDIUM IMPACT - Article Intelligence**

#### **7. Add AI Analysis to Articles**

**File:** `api/reading.ts`

**Current:** Articles saved with just content, no analysis

**Change:** Extract entities/themes after save (after line 500)

```ts
// After successful article insert
if (error) {
  throw new Error(`Database error: ${error.message}`)
}

// Extract entities and themes from article (async, non-blocking)
const host = req.headers.host || process.env.VERCEL_URL || 'localhost:5173'
const protocol = host.includes('localhost') ? 'http' : 'https'
const baseUrl = `${protocol}://${host}`

fetch(`${baseUrl}/api/reading?resource=analyze&id=${data.id}`, {
  method: 'POST'
}).catch(err => console.error('[article] Background analysis trigger failed:', err))

return res.status(201).json({
  success: true,
  article: data
})
```

**Add new handler** (after line 354):

```ts
// ANALYZE RESOURCE - Extract entities/themes from article
if (resource === 'analyze' && req.method === 'POST') {
  try {
    const articleId = req.query.id as string
    if (!articleId) {
      return res.status(400).json({ error: 'Article ID required' })
    }

    const { data: article, error: fetchError } = await supabase
      .from('reading_queue')
      .select('*')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      throw new Error('Article not found')
    }

    // Use Gemini to extract entities/themes
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    const prompt = `Analyze this article and extract key information.

Title: ${article.title}
Content: ${article.content.substring(0, 5000)} // First 5k chars

Extract:
{
  "entities": {
    "people": ["names"],
    "topics": ["specific technologies, concepts, or subjects discussed"],
    "organizations": ["companies, institutions mentioned"]
  },
  "themes": ["high-level themes - max 3"],
  "key_insights": ["2-3 key takeaways"]
}

Return ONLY the JSON, no other text.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0])

      // Update article with analysis
      await supabase
        .from('reading_queue')
        .update({
          entities: analysis.entities,
          themes: analysis.themes,
          metadata: {
            ...article.metadata,
            key_insights: analysis.key_insights,
            analyzed_at: new Date().toISOString()
          }
        })
        .eq('id', articleId)
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('[article analyze] Error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
```

**Impact:** Articles become part of knowledge graph, can feed into project suggestions.

---

#### **8. Include Articles in Synthesis**

**File:** `lib/synthesis.ts`

**Current:** Only looks at memories for interests (line 70-138)

**Change:** Also extract interests from articles

```ts
/**
 * Extract interests from recent articles
 */
async function extractInterestsFromArticles(): Promise<Interest[]> {
  logger.info('Extracting interests from articles')

  const { data: articles, error } = await supabase
    .from('reading_queue')
    .select('entities, themes')
    .gte('created_at', new Date(Date.now() - CONFIG.RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString())
    .not('entities', 'is', null)

  if (error) throw error

  const topicCounts: Record<string, number> = {}

  articles.forEach(article => {
    const topics = article.entities?.topics || []
    topics.forEach((topic: string) => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1
    })
  })

  return Object.entries(topicCounts)
    .filter(([_, count]) => count >= 2) // Mentioned in 2+ articles
    .map(([topic, count]) => ({
      id: topic,
      name: topic,
      type: 'article-topic',
      strength: count / 5,
      mentions: count
    }))
}

// In runSynthesis function (line 732):
const [memoryInterests, articleInterests] = await Promise.all([
  extractInterests(),
  extractInterestsFromArticles()
])

const interests = [...memoryInterests, ...articleInterests]
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 10) // Top 10 interests
```

**Impact:** Reading habits influence project suggestions—read about Rust → get Rust project ideas.

---

## 📊 **Implementation Priority Matrix**

| Change | Impact | Effort | Priority |
|--------|--------|--------|----------|
| **1. Memory processing status** | High | Low | 🔴 P0 |
| **2. Processing completion polling** | High | Medium | 🔴 P0 |
| **3. Suggestion scoring UI** | High | Low | 🔴 P0 |
| **4. Dismiss suggestions** | High | Medium | 🟡 P1 |
| **5. Prerequisites checklist** | Medium | Low | 🟡 P1 |
| **6. Auto-extract capabilities** | Medium | Medium | 🟡 P1 |
| **7. Article AI analysis** | Medium | Medium | 🟢 P2 |
| **8. Articles in synthesis** | Medium | Low | 🟢 P2 |

---

## 🏁 **Conclusion**

The **theory is solid**: sophisticated synthesis engine, multi-stage processing, semantic connections. But the **implementation has gaps**:

1. **Processing happens, but users can't see it**
2. **Suggestions generated, but scoring hidden**
3. **Articles imported, but never analyzed**
4. **Connections designed, but not implemented**

The app works for the **happy path** (voice note → entities → suggestions) but lacks **transparency, error handling, and feedback loops** that would make users trust the AI.

**Biggest quick win:** Making the AI's work visible—show what it found, why it matters, and when it's done.

**Long-term opportunity:** Complete the knowledge graph by analyzing articles and implementing connection detection.

---

## 📝 **Database Schema Changes Needed**

For the changes above to work, these schema modifications are required:

```sql
-- Add dismissed status to project_suggestions
ALTER TABLE project_suggestions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'spark', 'meh', 'saved', 'built', 'dismissed'));

-- Add entities/themes to reading_queue
ALTER TABLE reading_queue
  ADD COLUMN IF NOT EXISTS entities JSONB,
  ADD COLUMN IF NOT EXISTS themes TEXT[];

-- Add user_id to capabilities (if multi-tenant)
ALTER TABLE capabilities
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_suggestions_status
  ON project_suggestions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_articles_analyzed
  ON reading_queue(user_id) WHERE entities IS NOT NULL;
```

---

**End of Document**
