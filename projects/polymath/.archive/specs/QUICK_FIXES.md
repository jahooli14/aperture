# Quick Fixes Reference Card

**STOP**: Do NOT deploy until these are fixed!

---

## 🔥 Critical Fix #1: Security Vulnerability (30 min)

**Delete these files** (they expose service keys to browsers):
```bash
rm src/lib/process.ts
rm src/lib/bridges.ts
rm src/lib/gemini.ts
```

**Create**: `api/lib/process.ts` (move logic here)
```typescript
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Copy all logic from deleted src/lib/process.ts here
export async function processMemory(memoryId: string) {
  // ... existing logic
}

// Copy all logic from deleted src/lib/gemini.ts here
export async function extractMetadata(title: string, body: string, transcript?: string) {
  // ... existing logic
}

export async function generateEmbedding(text: string) {
  // ... existing logic
}

// Copy all logic from deleted src/lib/bridges.ts here
export async function findBridges(memory: any, embedding: number[]) {
  // ... existing logic
}

export async function storeBridges(memoryId: string, candidates: any[]) {
  // ... existing logic
}
```

**Fix**: `api/capture.ts` line 59
```typescript
// BEFORE ❌
const { processMemory } = await import('../src/lib/process')

// AFTER ✅
const { processMemory } = await import('./lib/process')
```

**Fix**: `api/process.ts` line 2
```typescript
// BEFORE ❌
import { processMemory } from '../src/lib/process'

// AFTER ✅
import { processMemory } from './lib/process'
```

---

## 🔧 Critical Fix #2: TypeScript Config (1 min)

**Edit**: `tsconfig.json` - Delete line 24:
```json
{
  "include": ["src"]
  // DELETE THIS LINE: "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## 🔧 Critical Fix #3: Env Var Name (1 min)

**Edit**: `api/suggestions.ts` line 11
```typescript
// BEFORE ❌
process.env.SUPABASE_SERVICE_KEY

// AFTER ✅
process.env.SUPABASE_SERVICE_ROLE_KEY
```

---

## 🔧 Critical Fix #4: Duplicate Types (1 min)

**Edit**: `src/types.ts`
- Delete lines 372-383 (duplicate Memory interface)
- Keep only the first Memory interface (lines 22-47)

---

## 🔧 Critical Fix #5: Missing SQL Function (5 min)

**Add to**: `migration.sql` (after line 240)
```sql
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding VECTOR(768),
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

**Find/Replace in**: `migration.sql`
- Find: `VECTOR(1536)`
- Replace: `VECTOR(768)`
- (4 occurrences on lines 21, 49, 186, 214)

---

## 🔧 Critical Fix #6: Add Basic CSS (10 min)

**Create**: `src/styles/components.css`
```css
/* Copy all commented CSS from component files */
/* See SuggestionCard.tsx line 80-187 */
/* See ProjectCard.tsx line 130-330 */
/* See App.tsx line 37-107 */
/* And paste here, removing the comment markers */
```

**Edit**: `src/main.tsx` - Add import:
```typescript
import './styles/components.css'
```

---

## ✅ Verify Fixes

Run these commands - all must pass:
```bash
npm run type-check  # No errors
npm run build       # Succeeds
npm run preview     # App loads without errors
```

---

## 🚀 Deploy Only After

- [ ] All 6 critical fixes complete
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Tested locally with `npm run preview`
- [ ] Environment variables set in Vercel
- [ ] Database migration run on Supabase

---

**Time Estimate**: ~50 minutes to fix all critical issues

**Full details**: See CRITICAL_REVIEW.md
