# 🔄 User Flow Analysis - Complete Journey

> **Tracing the full user experience from voice note to built project**

---

## The Complete Journey

### Step 1: User Records Voice Note
**Tool**: Audiopen
**Action**: User speaks into Audiopen app
**Example**: "I'm really interested in AI photo organization for my baby pictures. Would be cool to automatically detect faces and create timelines."

---

### Step 2: Audiopen Sends Webhook
**Endpoint**: `POST /api/capture`
**Payload**:
```json
{
  "id": "audiopen-uuid",
  "title": "AI Photo Organization Idea",
  "body": "I'm really interested in AI photo organization...",
  "orig_transcript": "raw transcript",
  "tags": "ai, photos, baby",
  "date_created": "2024-10-21T12:00:00Z"
}
```

**Current Code**: ✅ Exists
**Status**: ❌ **BROKEN** - imports deleted `src/lib/process`

---

### Step 3: Store Raw Memory
**Database**: `memories` table
**What**: Raw voice note stored
**Fields**:
- audiopen_id
- title
- body
- tags
- processed: false

**Current Code**: ✅ Works (this part is fine)

---

### Step 4: Process Memory (Extract Interests)
**What Should Happen**:
1. Call Gemini to extract entities
2. Generate embeddings
3. Store in `entities` table
4. Mark memory as processed

**Current Code**: ❌ **MISSING**
- Was in `src/lib/process.ts` (deleted for security)
- Needs to be recreated in `/api/` directory

**Gap**: No processing logic exists!

---

### Step 5: Weekly Synthesis (Monday 09:00 UTC)
**Trigger**: Vercel cron
**Endpoint**: `POST /api/cron/weekly-synthesis`

**What Should Happen**:
1. Get recent entities from `entities` table
2. Count frequency → identify interests
3. Get capabilities from `capabilities` table
4. Generate combinations
5. Call Claude to create project ideas
6. Score each (novelty + feasibility + interest)
7. Inject wildcard at position 3
8. Store in `project_suggestions` table

**Current Code**: ✅ Exists in `scripts/polymath/synthesis.ts`
**Status**: ✅ Works (calls Claude, generates suggestions)

---

### Step 6: User Views Suggestions
**Page**: `/suggestions`
**What User Sees**:
- Grid of suggestion cards
- Each with title, description, scores
- Wild card badge on diversity suggestions
- Rating buttons (👍 👎 💡)

**Current Code**: ✅ UI exists
**API**: `GET /api/suggestions`
**Status**: ✅ Works

---

### Step 7: User Rates Suggestion
**Action**: User clicks 👍 (Spark)
**Endpoint**: `POST /api/suggestions/:id/rate`
**Payload**: `{ "rating": 1 }`

**What Happens**:
1. Store rating in `suggestion_ratings` table
2. Update suggestion status to 'spark'
3. Adjust capability node strengths (+0.05)

**Current Code**: ✅ Exists
**Status**: ✅ Works

---

### Step 8: User Builds Project
**Action**: User clicks 💡 (Build)
**Endpoint**: `POST /api/suggestions/:id/build`

**What Happens**:
1. Create project in `projects` table
2. Link to suggestion
3. Boost capability strengths (+0.30)
4. Update suggestion status to 'built'

**Current Code**: ✅ Exists
**Status**: ✅ Works

---

### Step 9: User Works on Project
**Action**: User makes git commits
**What Should Happen**: Daily cron detects activity

**Trigger**: Vercel cron (Daily 00:00 UTC)
**Endpoint**: `POST /api/cron/strengthen-nodes`

**What Happens**:
1. Check git log (last 24 hours)
2. Map commits → projects
3. Map projects → capabilities
4. Strengthen active capabilities (+0.05)
5. Decay unused capabilities (-0.01)

**Current Code**: ✅ Exists in `scripts/polymath/strengthen-nodes.ts`
**Status**: ✅ Works

---

### Step 10: Next Week's Synthesis
**What Happens**:
- Strengthened capabilities appear more in suggestions
- System learned what you're actually building
- More relevant ideas generated

**Current Code**: ✅ Works (uses updated strengths)

---

## 🚨 Critical Gaps Found

### Gap #1: Memory Processing ❌ CRITICAL
**Location**: `api/capture.ts` line 59
**Problem**: Imports deleted `src/lib/process`
**Impact**: Voice notes stored but never processed
**Result**: No interests extracted → synthesis has nothing to work with

**Fix Needed**: Create `api/lib/process-memory.ts` with:
- Gemini entity extraction
- Embedding generation
- Entity storage
- Memory marking as processed

---

### Gap #2: Process API Broken ❌ CRITICAL
**Location**: `api/process.ts` line 2
**Problem**: Imports deleted `src/lib/process`
**Impact**: Manual processing endpoint broken
**Result**: Can't manually trigger processing

**Fix Needed**: Update to import from new location

---

### Gap #3: Missing Entities Table
**Problem**: Migration might not include `entities` table
**Impact**: Nowhere to store extracted interests
**Result**: System can't track what user cares about

**Fix Needed**: Verify `entities` table in migration.sql

---

### Gap #4: No Initial Capabilities
**Problem**: Empty `capabilities` table on first run
**Impact**: Nothing to combine with interests
**Result**: Synthesis can't generate suggestions

**Fix Needed**: Run capability scanner before first synthesis

---

### Gap #5: Bridge Finding (Optional)
**Problem**: Bridge logic was in deleted `src/lib/bridges.ts`
**Impact**: Can't find connections between memories
**Result**: Less useful for memory strengthening

**Fix Needed**: Optional - could skip for MVP

---

## 🎯 Required Fixes (Priority Order)

### 1. CRITICAL: Recreate Processing Logic
Create `api/lib/process-memory.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

export async function processMemory(memoryId: string) {
  // 1. Get memory
  // 2. Extract entities with Gemini
  // 3. Generate embeddings
  // 4. Store entities
  // 5. Mark processed
}
```

### 2. CRITICAL: Fix capture.ts
Update import to new location

### 3. CRITICAL: Fix process.ts
Update import to new location

### 4. IMPORTANT: Add entities table
Verify in migration.sql or add

### 5. IMPORTANT: Document first-run steps
User must run capability scanner before synthesis

---

## 📊 Flow Completeness

| Step | Implemented | Working | Gap |
|------|-------------|---------|-----|
| 1. Voice note | ✅ | ✅ | None |
| 2. Webhook | ✅ | ❌ | Broken import |
| 3. Store memory | ✅ | ✅ | None |
| 4. Process memory | ❌ | ❌ | Missing logic |
| 5. Weekly synthesis | ✅ | ⚠️ | Works but needs data |
| 6. View suggestions | ✅ | ✅ | None |
| 7. Rate suggestion | ✅ | ✅ | None |
| 8. Build project | ✅ | ✅ | None |
| 9. Git tracking | ✅ | ✅ | None |
| 10. Learning loop | ✅ | ✅ | None |

**Overall**: 7/10 working, 3 critical gaps

---

## ⚡ Quick Fix Summary

**What's broken**:
1. Memory processing (voice → interests)
2. Capture endpoint (imports deleted file)
3. Process endpoint (imports deleted file)

**What works**:
- Everything else!

**Time to fix**: ~30 minutes

---

## 🎬 User Experience Impact

### Without Fixes:
1. User records voice note ✅
2. System stores it ✅
3. **STOPS HERE** ❌ - never processed
4. Synthesis runs but finds no interests ❌
5. Generates suggestions based only on capabilities ⚠️
6. User sees generic suggestions (not personalized) 😞

### With Fixes:
1. User records voice note ✅
2. System stores it ✅
3. **Gemini extracts entities** ✅
4. Interests tracked in DB ✅
5. Synthesis combines interests + capabilities ✅
6. User sees **personalized** suggestions 🎉
7. User rates/builds projects ✅
8. System learns and improves ✅

---

**Status**: Needs 3 critical fixes before voice notes actually work

**Next**: Implement processing logic in API directory
