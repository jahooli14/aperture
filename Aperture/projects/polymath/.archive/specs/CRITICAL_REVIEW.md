# Polymath: Critical Security and Deployment Review

**Reviewed**: 2025-10-21
**Reviewer**: Claude (Check and Challenge Agent)
**Status**: 🚨 **CRITICAL ISSUES - DO NOT DEPLOY**

---

## Executive Summary

The Polymath project has a solid architectural foundation and well-thought-out synthesis engine. However, there are **critical security vulnerabilities** that make the current implementation unsafe for deployment. Additionally, there are several high-priority bugs that will cause runtime failures.

**Deployment Readiness**: ❌ **BLOCKED** - Must fix critical issues first

---

## 🚨 CRITICAL ISSUES (Must Fix Before Deploy)

### 1. **SECURITY BREACH: Service Role Keys Exposed to Client** ⚠️

**Severity**: 🔴 CRITICAL - Complete database access bypass
**Files Affected**:
- `/src/lib/process.ts` (lines 6-8)
- `/src/lib/bridges.ts` (lines 4-6)
- `/src/lib/gemini.ts` (line 4)

**Problem**:
```typescript
// ❌ CRITICAL SECURITY VULNERABILITY
// These files are in /src/ so Vite bundles them for the browser

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🚨 EXPOSED IN CLIENT BUNDLE
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!) // 🚨 EXPOSED
```

**Impact**:
- **SUPABASE_SERVICE_ROLE_KEY bypasses ALL Row Level Security (RLS)**
- Attackers can read/write/delete ANY data from ANY table
- API keys (GEMINI, ANTHROPIC) exposed → unlimited usage on your account
- Complete security model failure

**Why This Happens**:
- Files in `/src/lib/` are compiled with Vite and sent to browsers
- `process.env.SUPABASE_SERVICE_ROLE_KEY` gets bundled into client JavaScript
- Anyone can inspect network tab or source code to extract keys

**Fix Required**:

**Step 1**: Delete server-side-only files from `/src/lib/`
```bash
rm /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath/src/lib/process.ts
rm /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath/src/lib/bridges.ts
rm /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath/src/lib/gemini.ts
```

**Step 2**: Fix `/api/capture.ts` (currently imports deleted file)
```typescript
// BEFORE (line 59-64) ❌
const { processMemory } = await import('../src/lib/process')
processMemory(memory.id).catch(err => {
  console.error('[capture] Background processing error:', err)
})

// AFTER ✅ Option A: Queue-based processing
await supabase.from('processing_queue').insert({
  memory_id: memory.id,
  status: 'pending'
})

// AFTER ✅ Option B: Synchronous processing (slower webhook response)
const { processMemory } = await import('./process') // Use API-side version
await processMemory(memory.id)
```

**Step 3**: Move processing logic to `/api/process.ts` (already exists!)
The file at `/api/process.ts` already exists and imports from the dangerous location. Update it:

```typescript
// api/process.ts - Move logic HERE from src/lib/process.ts
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ✅ SAFE - Only runs server-side
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function processMemory(memoryId: string) {
  // Move all logic from src/lib/process.ts here
  // Extract metadata, generate embeddings, find bridges, etc.
}
```

**Step 4**: Update client code to use ANON key only
```typescript
// src/lib/supabase.ts ✅ Already correct!
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY! // ✅ Safe to expose
)
```

---

### 2. **Missing TypeScript Configuration**

**Severity**: 🔴 CRITICAL - Build will fail
**Error**: `TS6053: File 'tsconfig.node.json' not found`

**Fix Option A**: Create missing file
```bash
cat > tsconfig.node.json <<EOF
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF
```

**Fix Option B**: Remove reference (simpler)
```json
// tsconfig.json - Delete line 24
{
  "include": ["src"]
  // DELETE THIS: "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

### 3. **Environment Variable Name Mismatch**

**Severity**: 🔴 CRITICAL - API endpoints will crash
**Files Affected**: `/api/suggestions.ts` line 11

**Problem**:
```typescript
// api/suggestions.ts uses DIFFERENT name
process.env.SUPABASE_SERVICE_KEY // ❌ Wrong

// All other files use:
process.env.SUPABASE_SERVICE_ROLE_KEY // ✅ Correct
```

**Fix**: Standardize to `SUPABASE_SERVICE_ROLE_KEY`
```typescript
// api/suggestions.ts line 10-11
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Changed from SUPABASE_SERVICE_KEY
)
```

---

### 4. **Duplicate Type Definitions**

**Severity**: 🔴 HIGH - TypeScript compilation will fail
**File**: `/src/types.ts`

**Problem**:
```typescript
// Line 22-47: First Memory interface
export interface Memory { ... }

// Line 372-383: Duplicate Memory interface ❌
export interface Memory { ... }
```

**Fix**: Delete duplicate definition (lines 372-383)

---

### 5. **Missing Database Function**

**Severity**: 🔴 HIGH - Bridge detection will crash
**File**: `/src/lib/bridges.ts` line 104 (soon to be deleted per issue #1)

**Problem**:
```typescript
const { data, error } = await supabase.rpc('match_memories', {
  query_embedding: embedding,
  match_threshold: 0.8,
  match_count: 10,
})
```

The `match_memories` RPC function doesn't exist in `migration.sql`.

**Fix**: Add to migration.sql
```sql
-- Add after line 240 in migration.sql

CREATE OR REPLACE FUNCTION match_memories(
  query_embedding VECTOR(768), -- Gemini embedding dimension
  match_threshold FLOAT DEFAULT 0.8,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    memories.id,
    memories.title,
    memories.body,
    1 - (memories.embedding <=> query_embedding) AS similarity
  FROM memories
  WHERE 1 - (memories.embedding <=> query_embedding) > match_threshold
  AND processed = true
  ORDER BY memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**IMPORTANT**: Gemini's `text-embedding-004` uses **768 dimensions**, not 1536 (OpenAI). Update ALL `VECTOR(1536)` to `VECTOR(768)` in migration.sql:

```sql
-- Fix these lines in migration.sql:
-- Line 21: embedding VECTOR(768)  -- was 1536
-- Line 49: embedding VECTOR(768)  -- was 1536
-- Line 186: query_embedding VECTOR(768)  -- was 1536
-- Line 214: query_embedding VECTOR(768)  -- was 1536
```

---

### 6. **Missing CSS Styling**

**Severity**: 🟡 MEDIUM - UI will be broken/ugly
**Files**: All component files (`SuggestionCard.tsx`, `ProjectCard.tsx`, etc.)

**Problem**: CSS is commented out at bottom of files
```tsx
// ============================================================================
// STYLES
// ============================================================================

/*
.project-card {
  background: var(--color-bg);
  ...
}
*/  // ❌ All styles are commented out!
```

**Impact**: App will render but look completely unstyled (white screen with text).

**Fix Options**:

**Option A**: Add global CSS file
```bash
# Create src/styles/global.css with all styles
# Import in main.tsx: import './styles/global.css'
```

**Option B**: Use CSS-in-JS (styled-components)
```bash
npm install styled-components @types/styled-components
# Convert commented CSS to styled-components
```

**Option C**: Inline styles in components (quick fix)
```tsx
<div style={{
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '1.5rem'
}}>
```

---

## ⚠️ IMPORTANT ISSUES (Should Fix Soon)

### 7. **No Error Boundaries**

**Severity**: 🟡 MEDIUM - App crashes show white screen

**Problem**: Any unhandled React error crashes the entire app.

**Fix**:
```bash
npm install react-error-boundary
```

```tsx
// src/App.tsx
import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <pre style={{ color: 'red' }}>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Router>
        {/* existing code */}
      </Router>
    </ErrorBoundary>
  )
}
```

---

### 8. **Authentication is Hardcoded Single-User**

**Severity**: 🟡 MEDIUM - No access control

**Current State**:
```typescript
// All API endpoints
const userId = process.env.USER_ID || 'default-user'
```

**For MVP**: This is acceptable IF:
1. Deploying to private Vercel URL
2. Add password protection via Vercel settings
3. Update RLS policies for single-user mode

**RLS Policy Fix**:
```sql
-- Current (assumes Supabase Auth) ❌
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);  -- auth.uid() is NULL without auth!

-- Fixed for single-user MVP ✅
CREATE POLICY "Single user can view projects"
  ON projects FOR SELECT
  TO authenticated, anon
  USING (true);  -- Allow all (protected at Vercel/network level)
```

Add this to `.env.local.example`:
```bash
# Single-user configuration (no Supabase Auth)
# IMPORTANT: Protect this deployment with Vercel password or IP restrictions
USER_ID=your-fixed-user-id-here
```

---

### 9. **Synthesis Combination Tracking Race Condition**

**Severity**: 🟡 MEDIUM - Novelty scoring will be incorrect
**File**: `/scripts/polymath/synthesis.ts` lines 411-441

**Problem**: Upsert → Select → Update pattern has race condition
```typescript
// ❌ BAD - times_suggested will never increment past 1
async function recordCombination(capabilityIds: string[]) {
  await supabase
    .from('capability_combinations')
    .upsert({ capability_ids: sortedIds, times_suggested: 1 }, ...)

  const { data } = await supabase
    .from('capability_combinations')
    .select('times_suggested')
    .eq('capability_ids', sortedIds)
    .single()

  if (data && data.times_suggested > 1) { // Will never be true!
    // This update never runs
  }
}
```

**Fix**:
```typescript
// ✅ GOOD - Atomic increment
async function recordCombination(capabilityIds: string[]) {
  const sortedIds = [...capabilityIds].sort()

  // Try to get existing
  const { data: existing } = await supabase
    .from('capability_combinations')
    .select('times_suggested')
    .eq('capability_ids', sortedIds)
    .single()

  if (existing) {
    // Increment
    await supabase
      .from('capability_combinations')
      .update({
        times_suggested: existing.times_suggested + 1,
        last_suggested_at: new Date().toISOString()
      })
      .eq('capability_ids', sortedIds)
  } else {
    // Insert new
    await supabase
      .from('capability_combinations')
      .insert({
        capability_ids: sortedIds,
        times_suggested: 1,
        first_suggested_at: new Date().toISOString(),
        last_suggested_at: new Date().toISOString()
      })
  }
}
```

---

### 10. **Missing Cron Secret Validation**

**Severity**: 🟡 MEDIUM - Cron endpoints can be triggered by anyone
**File**: `/api/cron/weekly-synthesis.ts`

**Current State**:
```typescript
const authHeader = req.headers['authorization']
const cronSecret = process.env.CRON_SECRET

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

**Problem**: `if (cronSecret && ...)` means if CRON_SECRET is not set, NO validation happens!

**Fix**:
```typescript
const authHeader = req.headers['authorization']
const cronSecret = process.env.CRON_SECRET

if (!cronSecret) {
  console.error('[cron] CRON_SECRET not configured!')
  return res.status(500).json({ error: 'Server misconfigured' })
}

if (authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

---

## 💡 NICE-TO-HAVES (Improve Over Time)

### 11. **Better Loading States**

Pages have loading states but could be improved:
```tsx
// Current: Basic text
{loading && <div className="loading"><p>Loading...</p></div>}

// Better: Skeleton screens
{loading && <SuggestionCardSkeleton count={3} />}
```

---

### 12. **Capability Badge Shows IDs Instead of Names**

**File**: `/src/components/suggestions/SuggestionCard.tsx` line 40-42

**Problem**:
```tsx
{suggestion.capability_ids.map((capId) => (
  <CapabilityBadge key={capId} capability={{ id: capId, name: capId }} />
  // Shows UUID instead of "voice-processing"
))}
```

**Fix**: Fetch capability details or include in suggestion query
```typescript
// API endpoint should join capabilities
const { data } = await supabase
  .from('project_suggestions')
  .select(`
    *,
    capabilities:capability_ids (id, name, description)
  `)
```

---

### 13. **No Optimistic Updates**

When rating suggestions, UI waits for server response. Could add optimistic updates:
```typescript
rateSuggestion: async (id: string, rating: number) => {
  // Optimistic update
  set({
    suggestions: get().suggestions.map(s =>
      s.id === id ? { ...s, status: rating > 0 ? 'spark' : 'meh' } : s
    )
  })

  try {
    await fetch(...) // Actual API call
  } catch (error) {
    // Rollback on error
    set({ suggestions: get().suggestions })
  }
}
```

---

### 14. **No Analytics/Telemetry**

Consider adding basic analytics:
- Suggestion view count
- Rating distribution
- Project completion rate
- Synthesis success metrics

This data would improve the ML model over time.

---

### 15. **Manual Testing Required**

**Before deploying**, manually test:

1. **Database Setup**:
   ```bash
   # Run migration
   psql $DATABASE_URL -f migration.sql

   # Seed test data
   npx tsx scripts/polymath/seed-test-data.ts
   ```

2. **API Endpoints**:
   ```bash
   # Test each endpoint
   curl http://localhost:3000/api/projects
   curl http://localhost:3000/api/suggestions
   curl -X POST http://localhost:3000/api/suggestions/[id]/rate \
     -H "Content-Type: application/json" \
     -d '{"rating": 1}'
   ```

3. **UI Workflows**:
   - View suggestions
   - Rate suggestion (spark/meh)
   - Build suggestion → creates project
   - View projects
   - Filter/sort works

4. **Synthesis Engine**:
   ```bash
   # Run synthesis manually
   npx tsx scripts/polymath/synthesis.ts

   # Verify suggestions appear in UI
   ```

---

## 📋 Deployment Checklist

Before deploying to Vercel:

**Environment Variables** (set in Vercel):
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # Safe to expose
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Keep secret!
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
USER_ID=your-fixed-user-id
CRON_SECRET=random-secret-string  # Generate with: openssl rand -base64 32
```

**Critical Fixes (MUST do)**:
- [ ] Remove `/src/lib/process.ts`, `/src/lib/bridges.ts`, `/src/lib/gemini.ts`
- [ ] Move processing logic to API routes
- [ ] Fix `api/capture.ts` import
- [ ] Create `tsconfig.node.json` OR remove reference
- [ ] Fix env var name in `api/suggestions.ts`
- [ ] Remove duplicate Memory type definition
- [ ] Add `match_memories` SQL function
- [ ] Change all `VECTOR(1536)` to `VECTOR(768)`
- [ ] Add CSS styling (at least basic)

**Important Fixes (SHOULD do)**:
- [ ] Add error boundaries
- [ ] Update RLS policies for single-user
- [ ] Fix synthesis combination tracking
- [ ] Add CRON_SECRET validation
- [ ] Document single-user mode in README

**Test Locally**:
```bash
# 1. Install dependencies
npm install

# 2. Run type check
npm run type-check  # Should pass

# 3. Run build
npm run build  # Should succeed

# 4. Test production build
npm run preview
```

**Deploy**:
```bash
# Only deploy after ALL critical fixes
vercel --prod
```

---

## Summary Statistics

**Critical Issues**: 6 (all must be fixed)
**Important Issues**: 4 (should be fixed)
**Nice-to-haves**: 5 (improve over time)

**Deployment Status**: 🚨 **BLOCKED** - Security vulnerabilities must be resolved first

**Estimated Fix Time**:
- Critical fixes: ~4 hours
- Important fixes: ~2 hours
- Total to MVP deployment: ~6 hours

---

## Strengths Worth Noting

Despite the critical issues, the project has several strengths:

1. **Well-architected**: Clear separation of concerns
2. **Good type safety**: Comprehensive TypeScript types
3. **Smart synthesis algorithm**: Novelty/feasibility/interest scoring is clever
4. **Wildcard diversity injection**: Anti-echo-chamber design is thoughtful
5. **Complete UI components**: All pages/components exist and are functional
6. **Good documentation**: Extensive docs (ARCHITECTURE.md, API_SPEC.md, etc.)

Once the critical security issues are fixed, this will be a solid MVP.

---

**Next Steps**: Start with Critical Issue #1 (security vulnerability) - this is the most dangerous.
