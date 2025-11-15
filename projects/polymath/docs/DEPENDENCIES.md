# Polymath Dependencies

> NPM packages to add to MemoryOS for Polymath functionality

## New Dependencies to Install

Add these to `projects/memory-os/package.json`:

### Production Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.68.0"
  }
}
```

**Existing dependencies (already in MemoryOS):**
- `@google/generative-ai` - For entity extraction (MemoryOS)
- `@supabase/supabase-js` - Database client
- `react` - Frontend framework
- `react-dom` - React DOM rendering
- `react-router-dom` - Routing (needs to be added if not present)
- `zustand` - State management

### Dev Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0"
  }
}
```

**Existing dev dependencies (already in MemoryOS):**
- `@types/react`
- `@types/react-dom`
- `@vercel/node`
- `@vitejs/plugin-react`
- `typescript`
- `vite`

---

## Installation Commands

### Full Installation

```bash
cd projects/memory-os

# Add production dependencies
npm install @anthropic-ai/sdk openai

# Add dev dependencies
npm install --save-dev @types/node tsx

# Add routing if missing
npm install react-router-dom
npm install --save-dev @types/react-router-dom
```

### Verify Installation

```bash
npm list @anthropic-ai/sdk openai
# Should show installed versions
```

---

## Package Details

### @anthropic-ai/sdk

**Purpose:** Claude API for synthesis and project idea generation
**Used in:** `scripts/polymath/synthesis.ts`
**License:** MIT
**Size:** ~50KB

**Usage:**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: '...' }]
})
```

### openai

**Purpose:** OpenAI API for embeddings (semantic search)
**Used in:** `scripts/polymath/capability-scanner.ts`, `scripts/polymath/synthesis.ts`
**License:** Apache-2.0
**Size:** ~200KB

**Usage:**
```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'text to embed',
})
```

### react-router-dom

**Purpose:** Client-side routing for multiple pages
**Used in:** `src/App.tsx`, all page components
**License:** MIT
**Size:** ~70KB

**Usage:**
```typescript
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

<BrowserRouter>
  <Routes>
    <Route path="/projects" element={<ProjectsPage />} />
  </Routes>
</BrowserRouter>
```

### tsx

**Purpose:** Run TypeScript files directly (for scripts)
**Used in:** CLI execution of synthesis, capability scanner, node strengthening
**License:** MIT
**Size:** ~15MB (dev only)

**Usage:**
```bash
npx tsx scripts/polymath/synthesis.ts
```

---

## Environment Variables Required

Add these to Vercel dashboard and `.env` file:

```bash
# Existing (from MemoryOS)
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# New for Polymath
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
USER_ID=<your-supabase-user-id>
APERTURE_PATH=/var/task/projects  # For Vercel deployment
```

### Get API Keys

**Anthropic (Claude):**
1. Go to https://console.anthropic.com/
2. Create API key
3. Copy `sk-ant-...`

**OpenAI (Embeddings):**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy `sk-...`

**User ID:**
```sql
-- Run in Supabase SQL editor
SELECT id FROM auth.users LIMIT 1;
```

---

## Bundle Size Impact

**Before Polymath (MemoryOS only):**
- Production bundle: ~200KB gzipped

**After Polymath:**
- Production bundle: ~450KB gzipped (estimated)
- Increase: ~250KB

**Breakdown:**
- @anthropic-ai/sdk: ~50KB
- openai: ~200KB
- New UI components: ~50KB
- Zustand stores: ~20KB
- React Router: ~70KB
- Total: ~390KB (minus existing dependencies)

**Optimization:**
- Use code splitting for Polymath routes
- Lazy load suggestion detail page
- Bundle Anthropic/OpenAI only in API routes (not frontend)

---

## TypeScript Types

**Included in packages:**
- ✅ `@anthropic-ai/sdk` has built-in types
- ✅ `openai` has built-in types
- ✅ `react-router-dom` needs `@types/react-router-dom`

**Custom types:**
Add to `src/types.ts`:

```typescript
export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  type: 'personal' | 'technical' | 'meta'
  status: 'active' | 'dormant' | 'completed' | 'archived'
  last_active: string
  created_at: string
  updated_at: string
  metadata: Record<string, any>
}

export interface Capability {
  id: string
  name: string
  description: string
  source_project: string
  code_references: Array<{
    file: string
    function?: string
    line?: number
  }>
  strength: number
  last_used: string | null
  created_at: string
  updated_at: string
}

export interface ProjectSuggestion {
  id: string
  user_id: string
  title: string
  description: string
  synthesis_reasoning: string
  novelty_score: number
  feasibility_score: number
  interest_score: number
  total_points: number
  capability_ids: string[]
  memory_ids: string[]
  is_wildcard: boolean
  suggested_at: string
  status: 'pending' | 'rated' | 'built' | 'dismissed' | 'saved'
  built_project_id: string | null
  metadata: Record<string, any>
}

export interface SuggestionRating {
  id: string
  suggestion_id: string
  user_id: string
  rating: -1 | 1 | 2
  feedback: string | null
  rated_at: string
}

export interface Interest {
  id: string
  name: string
  type: string
  strength: number
  mentions: number
  last_mentioned: string | null
}

export interface NodeStrength {
  id: string
  node_type: 'capability' | 'interest' | 'project'
  node_id: string
  strength: number
  activity_count: number
  last_activity: string | null
  created_at: string
  updated_at: string
}
```

---

## Compatibility

**Node.js:** Requires Node 18+ (for native fetch in Anthropic SDK)
**Vercel:** Automatically uses Node 18+ runtime

**Check:**
```bash
node --version
# Should be v18.x or higher
```

**Update if needed:**
```bash
# via nvm
nvm install 18
nvm use 18
```

---

## Security Considerations

**API Keys:**
- Never commit API keys to git
- Use `.env` files (gitignored)
- Set in Vercel dashboard for production
- Rotate keys if compromised

**Service Role Key:**
- Only use in backend API routes
- Never expose to frontend
- Required for RLS bypass in synthesis

**Rate Limiting:**
- Anthropic: 50 requests/min (Tier 1)
- OpenAI: 3,500 requests/min (free tier)
- Monitor usage to avoid overages

---

## Cost Estimates

**Anthropic (Claude Sonnet 4):**
- Input: $3 / million tokens
- Output: $15 / million tokens
- Weekly synthesis: ~10K tokens = $0.10/week = $5/year

**OpenAI (Embeddings):**
- text-embedding-3-small: $0.02 / million tokens
- Capability scanning (one-time): ~5K tokens = $0.0001
- Ongoing: negligible

**Total estimated cost:**
- Setup: < $0.01
- Monthly: ~$0.50
- Yearly: ~$6

---

## Alternatives Considered

### For Synthesis (instead of Claude):
- ❌ GPT-4: More expensive ($30/M tokens)
- ❌ Gemini: Free but lower quality for creative synthesis
- ✅ Claude Sonnet 4: Best balance of cost/quality

### For Embeddings (instead of OpenAI):
- ❌ Cohere: Similar cost, but OpenAI has better ecosystem
- ❌ HuggingFace: Free but requires hosting
- ✅ OpenAI: Simple API, good quality

---

## Installation Checklist

- [ ] Install `@anthropic-ai/sdk`
- [ ] Install `openai`
- [ ] Install `react-router-dom` (if missing)
- [ ] Install `@types/node`
- [ ] Install `tsx`
- [ ] Add environment variables to `.env`
- [ ] Add environment variables to Vercel
- [ ] Test imports work
- [ ] Verify Node version >= 18
- [ ] Run `npm audit` to check for vulnerabilities

---

**See also:** `DEPLOYMENT.md` for deployment steps
