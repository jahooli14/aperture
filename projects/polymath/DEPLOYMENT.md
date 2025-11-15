# Polymath Deployment Guide

> Step-by-step deployment checklist for MemoryOS + Polymath

## Prerequisites

- ✅ MemoryOS already deployed on Vercel
- ✅ Supabase instance running
- ✅ Audiopen webhook configured
- ✅ Environment variables set

## Phase 1: Database Migration

### 1. Run Migration SQL

**Via Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Create new query
5. Paste contents of `migration.sql`
6. Run query
7. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('projects', 'capabilities', 'project_suggestions', 'suggestion_ratings', 'node_strengths', 'capability_combinations');
   ```

**Expected Output:** 6 tables

### 2. Verify RLS Policies

```sql
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('projects', 'capabilities', 'project_suggestions', 'suggestion_ratings');
```

**Expected:** Multiple policies per table

### 3. Test Insertions

```sql
-- Test project insert
INSERT INTO projects (title, description, type, user_id)
VALUES ('Test Project', 'Testing deployment', 'personal', auth.uid())
RETURNING *;

-- Should return the inserted project
```

---

## Phase 2: Populate Capabilities

### 1. Add New Dependencies

**In `projects/memory-os/package.json`:**
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.68.0"
    // ... existing dependencies
  }
}
```

**Install:**
```bash
cd projects/memory-os
npm install
```

### 2. Add Environment Variables

**In Vercel Dashboard:**
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
USER_ID=<your-supabase-user-id>
APERTURE_PATH=/var/task/projects
```

**Get USER_ID:**
```sql
SELECT id FROM auth.users LIMIT 1;
```

### 3. Run Capability Scanner

**Locally first:**
```bash
cd projects/memory-os
npx tsx ../polymath/scripts/capability-scanner.ts
```

**Expected output:**
```
🔍 Starting capability scan...
📁 Scanning memory-os...
  ✓ voice-processing
  ✓ embeddings
  ...
✅ Successfully populated 20+ capabilities
```

**Verify in Supabase:**
```sql
SELECT name, strength, source_project FROM capabilities ORDER BY strength DESC;
```

---

## Phase 3: Deploy Code

### 1. Copy Polymath Scripts to MemoryOS

```bash
cd projects
cp -r polymath/scripts memory-os/scripts/polymath
```

### 2. Add API Endpoints

Create these files in `projects/memory-os/api/`:

- `api/projects.ts` - Projects CRUD
- `api/suggestions.ts` - Suggestions list
- `api/suggestions/[id]/rate.ts` - Rating endpoint
- `api/suggestions/[id]/build.ts` - Build project
- `api/synthesis/run.ts` - Manual synthesis
- `api/synthesis/strengthen-nodes.ts` - Node strengthening
- `api/capabilities.ts` - Capabilities list
- `api/capabilities/scan.ts` - Capability scanner
- `api/interests.ts` - Interests list

**Template (api/projects.ts):**
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('last_active', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ projects: data, total: data.length })
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('projects')
      .insert(req.body)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ project: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
```

### 3. Add Cron Configuration

**Update `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/synthesis/weekly",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/synthesis/strengthen-nodes",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 4. Deploy to Vercel

```bash
cd projects/memory-os
vercel --prod
```

**Or via GitHub:**
1. Push to main branch
2. Vercel auto-deploys

### 5. Verify Deployment

**Test endpoints:**
```bash
# Projects
curl https://memoryos.vercel.app/api/projects

# Capabilities
curl https://memoryos.vercel.app/api/capabilities

# Should return JSON responses
```

---

## Phase 4: Frontend Integration

### 1. Add UI Components

Copy component files to `projects/memory-os/src/components/`:
- `src/components/projects/`
- `src/components/suggestions/`
- `src/components/capabilities/`
- `src/components/interests/`

### 2. Add Pages

Copy page files to `projects/memory-os/src/pages/`:
- `src/pages/ProjectsPage.tsx`
- `src/pages/SuggestionsPage.tsx`
- `src/pages/AllIdeasPage.tsx`
- `src/pages/SuggestionDetailPage.tsx`

### 3. Add Stores

Copy store files to `projects/memory-os/src/stores/`:
- `src/stores/useProjectStore.ts`
- `src/stores/useSuggestionStore.ts`
- `src/stores/useCapabilityStore.ts`

### 4. Update Routing

**Edit `src/App.tsx`:**
```typescript
import { ProjectsPage } from './pages/ProjectsPage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { AllIdeasPage } from './pages/AllIdeasPage'
import { SuggestionDetailPage } from './pages/SuggestionDetailPage'

// In Routes:
<Route path="/projects" element={<ProjectsPage />} />
<Route path="/ideas" element={<SuggestionsPage />} />
<Route path="/ideas/all" element={<AllIdeasPage />} />
<Route path="/ideas/:id" element={<SuggestionDetailPage />} />
```

### 5. Update Nav

**Edit `src/components/shared/Nav.tsx`:**
```typescript
<Link to="/projects">Projects</Link>
<Link to="/ideas">Ideas</Link>
```

### 6. Build and Deploy

```bash
npm run build
vercel --prod
```

---

## Phase 5: Initial Data Setup

### 1. Scan Capabilities

**Trigger via API:**
```bash
curl -X POST https://memoryos.vercel.app/api/capabilities/scan \
  -H "Authorization: Bearer <your-token>"
```

**Or run script directly:**
```bash
cd projects/memory-os
npx tsx scripts/polymath/capability-scanner.ts
```

### 2. Run First Synthesis

**Via UI:**
- Go to https://memoryos.vercel.app/ideas
- Click "Generate New Ideas"

**Or via API:**
```bash
curl -X POST https://memoryos.vercel.app/api/synthesis/run \
  -H "Authorization: Bearer <your-token>"
```

**Expected:** 10 new project suggestions

### 3. Test Full Flow

1. View suggestions: https://memoryos.vercel.app/ideas
2. Rate a suggestion (👍/👎)
3. Build a suggestion (💡)
4. Check projects page: https://memoryos.vercel.app/projects
5. Verify project created

---

## Phase 6: Monitoring

### 1. Check Cron Jobs

**Vercel Dashboard:**
- Deployments → Cron Jobs
- Verify `weekly-synthesis` scheduled for Mondays 09:00 UTC
- Verify `strengthen-nodes` scheduled daily 00:00 UTC

### 2. Test Cron Endpoints Manually

```bash
# Weekly synthesis
curl https://memoryos.vercel.app/api/synthesis/weekly

# Node strengthening
curl https://memoryos.vercel.app/api/synthesis/strengthen-nodes
```

### 3. Monitor Logs

**Vercel Dashboard:**
- Deployments → Functions
- Select function
- View logs

**Look for:**
- ✅ Synthesis runs completing
- ✅ Capabilities strengthening
- ❌ Errors in synthesis
- ❌ Failed API calls

### 4. Database Monitoring

**Supabase Dashboard:**
- Database → Tables
- Check row counts:
  ```sql
  SELECT
    (SELECT COUNT(*) FROM projects) as projects,
    (SELECT COUNT(*) FROM capabilities) as capabilities,
    (SELECT COUNT(*) FROM project_suggestions) as suggestions,
    (SELECT COUNT(*) FROM suggestion_ratings) as ratings;
  ```

---

## Troubleshooting

### Issue: Migration fails

**Solution:**
```sql
-- Drop tables if exists (BE CAREFUL - data loss!)
DROP TABLE IF EXISTS suggestion_ratings CASCADE;
DROP TABLE IF EXISTS project_suggestions CASCADE;
DROP TABLE IF EXISTS capability_combinations CASCADE;
DROP TABLE IF EXISTS node_strengths CASCADE;
DROP TABLE IF EXISTS capabilities CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Re-run migration.sql
```

### Issue: Capability scan fails

**Check:**
1. OpenAI API key set correctly
2. Supabase service role key has permission
3. `APERTURE_PATH` points to correct location

**Debug:**
```bash
# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/capabilities \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

### Issue: Synthesis fails

**Check:**
1. Anthropic API key valid
2. At least 2 capabilities exist
3. At least 1 interest extracted (or run MemoryOS first)

**Debug:**
```bash
# Check capabilities count
curl https://memoryos.vercel.app/api/capabilities

# Check interests count
curl https://memoryos.vercel.app/api/interests
```

### Issue: Cron jobs not running

**Verify:**
1. `vercel.json` committed and deployed
2. Cron syntax correct (cron-job.org validator)
3. Wait for first scheduled run

**Manual trigger:**
```bash
curl https://memoryos.vercel.app/api/synthesis/weekly
```

---

## Rollback Plan

### If something breaks:

**1. Revert Vercel deployment:**
```bash
vercel rollback
```

**2. Disable Polymath routes:**
```typescript
// In App.tsx, comment out:
// <Route path="/projects" element={<ProjectsPage />} />
// <Route path="/ideas" element={<SuggestionsPage />} />
```

**3. Drop Polymath tables (if needed):**
```sql
DROP TABLE IF EXISTS suggestion_ratings CASCADE;
DROP TABLE IF EXISTS project_suggestions CASCADE;
DROP TABLE IF EXISTS capability_combinations CASCADE;
DROP TABLE IF EXISTS node_strengths CASCADE;
DROP TABLE IF EXISTS capabilities CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Revert entities table
ALTER TABLE entities DROP COLUMN IF EXISTS is_interest;
ALTER TABLE entities DROP COLUMN IF EXISTS interest_strength;
ALTER TABLE entities DROP COLUMN IF EXISTS last_mentioned;
```

**MemoryOS will continue working** - Polymath is fully additive.

---

## Post-Deployment Checklist

- [ ] Migration ran successfully
- [ ] All 6 tables exist
- [ ] RLS policies active
- [ ] Capabilities populated (20+)
- [ ] API endpoints responding
- [ ] Frontend routes working
- [ ] First synthesis completed
- [ ] Can rate suggestions
- [ ] Can build projects
- [ ] Cron jobs scheduled
- [ ] Logs show no errors

---

## Maintenance

### Weekly:
- Check synthesis runs (Mondays 09:00 UTC)
- Review new suggestions quality
- Monitor error rates

### Monthly:
- Review capability strengths
- Prune old dismissed suggestions (optional)
- Update capability scanner if new projects added

### As needed:
- Re-run capability scan when adding new Aperture projects
- Manually trigger synthesis for testing
- Adjust synthesis config (number of suggestions, weights)

---

**Next:** See `ROADMAP.md` for feature development plan
**Help:** Check logs first, then review `ARCHITECTURE.md` for implementation details
