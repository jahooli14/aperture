# 🧪 Testing Guide - MemoryOS + Polymath

> **Quick validation steps to verify the integration works**

## Prerequisites

```bash
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/memory-os
```

---

## Step 1: Install Dependencies (5 min)

```bash
npm install
```

**Expected output**: Should install new packages without errors
- `@anthropic-ai/sdk`
- `openai`
- `react-router-dom`
- `tsx`

**Verify**:
```bash
npm list @anthropic-ai/sdk openai tsx
```

---

## Step 2: Database Migration (10 min)

1. Open Supabase SQL editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy entire contents of `scripts/migration.sql`
3. Paste and run

**Expected output**: 6 tables created
- `projects`
- `capabilities`
- `project_suggestions`
- `suggestion_ratings`
- `node_strengths`
- `capability_combinations`

**Verify in Supabase**:
- Table Editor → Should see 6 new tables
- Each table should have RLS policies enabled

---

## Step 3: Environment Variables

Add to `.env.local`:
```bash
# Existing MemoryOS vars
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIza...

# New Polymath vars
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
USER_ID=your-supabase-user-id
CRON_SECRET=some-random-secret  # Optional for production
```

**Get your USER_ID**:
```sql
-- Run in Supabase SQL editor
SELECT id FROM auth.users LIMIT 1;
```

---

## Step 4: Seed Test Data (5 min)

```bash
npx tsx scripts/polymath/seed-test-data.ts
```

**Expected output**:
```
🌱 Seeding test data...
✅ Inserted 8 capabilities
✅ Inserted 4 project suggestions
✅ Test data seeded successfully!
```

**Verify in Supabase**:
- Table Editor → `capabilities` → Should have 8 rows
- Table Editor → `project_suggestions` → Should have 4 rows

**Test suggestions should include**:
1. "MemoryOS Voice Playground" (68 pts)
2. "Baby Face Journey Timeline" (65 pts)
3. "Vercel Function Health Monitor" (71 pts) 🎲 Wild Card
4. "Personal API Gateway" (58 pts)

---

## Step 5: Capability Scanner (Optional - 10 min)

**Note**: This requires real codebase paths and will actually scan your Aperture repo.

```bash
npx tsx scripts/polymath/capability-scanner.ts
```

**Expected output**:
```
🔍 Starting capability scan...
✅ Scanned Wizard of Oz capabilities (6 found)
✅ Scanned MemoryOS capabilities (7 found)
✅ Scanned Vercel capabilities (5 found)
📊 Total: 18 capabilities inserted
```

**Verify in Supabase**:
- Table Editor → `capabilities` → Should have 18+ rows (8 test + real ones)

---

## Step 6: Type Checking (2 min)

```bash
npx tsc --noEmit
```

**Expected**: No type errors (or only pre-existing ones)

---

## Step 7: Build Check (5 min)

```bash
npm run build
```

**Expected**: Build succeeds
- Components compile
- No import errors
- Types are valid

---

## Step 8: API Endpoint Tests (10 min)

### Test Projects Endpoint

```bash
# Start dev server
npm run dev

# In another terminal, test API
curl http://localhost:5173/api/projects
```

**Expected**: Returns empty array or existing projects
```json
{
  "projects": [],
  "total": 0
}
```

### Test Suggestions Endpoint

```bash
curl http://localhost:5173/api/suggestions
```

**Expected**: Returns 4 test suggestions
```json
{
  "suggestions": [
    {
      "id": "...",
      "title": "MemoryOS Voice Playground",
      "total_points": 68,
      "is_wildcard": false,
      ...
    },
    ...
  ],
  "total": 4
}
```

---

## Step 9: Synthesis Test (Optional - 15 min)

**Warning**: This uses real AI APIs and will cost ~$0.10

```bash
npx tsx scripts/polymath/synthesis.ts
```

**Expected output**:
```
🧠 Starting synthesis...
📊 Found 8 capabilities
💭 Found 5 recent interests
🔄 Generating 10 project suggestions...
✅ Generated 10 suggestions
🎲 Injected diversity at position 3
✅ Synthesis complete!
```

**Verify in Supabase**:
- Table Editor → `project_suggestions` → Should have 14 rows (4 test + 10 new)
- New suggestions should have `status = 'pending'`
- One should have `is_wildcard = true`

---

## Common Issues

### TypeScript Errors

**Problem**: `Cannot find module '../../types'`
**Solution**: Ensure `src/types.ts` includes all Polymath types (should be ~1000 lines)

### Database Errors

**Problem**: `relation "capabilities" does not exist`
**Solution**: Run migration.sql in Supabase SQL editor

### Import Errors

**Problem**: `Module not found: Can't resolve '@anthropic-ai/sdk'`
**Solution**: Run `npm install` again

### Empty Suggestions

**Problem**: `GET /api/suggestions` returns empty array
**Solution**: Run seed script: `npx tsx scripts/polymath/seed-test-data.ts`

---

## Success Criteria

✅ All dependencies installed
✅ Database migration complete (6 tables)
✅ Test data seeded (4 suggestions visible in Supabase)
✅ No TypeScript errors
✅ Build succeeds
✅ API endpoints return data

---

## Next Steps After Testing

Once testing passes:

1. **Create UI Pages** (Weekend project)
   - `src/pages/ProjectsPage.tsx`
   - `src/pages/SuggestionsPage.tsx`
   - `src/pages/AllIdeasPage.tsx`

2. **Add Routing** (30 min)
   - Update `src/App.tsx` with react-router-dom
   - Add navigation

3. **Create Stores** (1 hour)
   - `src/stores/useProjectStore.ts`
   - `src/stores/useSuggestionStore.ts`

4. **Deploy** (15 min)
   - Add env vars to Vercel
   - Deploy
   - Test cron jobs

**Full roadmap**: See `../polymath/ROADMAP.md`

---

**Testing Time**: ~1 hour total
**Integration Status**: ✅ Ready to test
