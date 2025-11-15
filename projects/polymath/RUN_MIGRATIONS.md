# 🚀 Run These Migrations Now

Your Supabase project: **https://nxkysxgaujdimrubjiln.supabase.co**

## Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/nxkysxgaujdimrubjiln/sql/new
2. You'll need to run 2 SQL files

---

## Step 2: Run Memory Onboarding Migration

**File: `migration-memory-onboarding.sql`**

Copy the entire contents and paste into SQL editor, then click "Run"

This creates:
- `memory_prompts` table
- `memory_responses` table
- `user_prompt_status` table
- `project_notes` table
- Helper functions (`get_memory_progress`, `has_unlocked_projects`)

---

## Step 3: Seed Template Prompts

**File: `scripts/seed-memory-prompts.sql`**

Copy the entire contents and paste into SQL editor, then click "Run"

This inserts:
- 40 memory prompts
- 10 required (priority 1-10)
- 30 optional

---

## Step 4: Verify Installation

Run this query:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('memory_prompts', 'memory_responses', 'user_prompt_status', 'project_notes');
```

**Expected result:** 4 rows

```sql
-- Check prompt count
SELECT
  COUNT(*) FILTER (WHERE is_required = true) as required_prompts,
  COUNT(*) as total_prompts
FROM memory_prompts;
```

**Expected result:**
- required_prompts: 10
- total_prompts: 40

---

## ✅ After Migrations Complete

Tell me and I'll:
1. Build the project
2. Deploy to Vercel
3. Test the onboarding flow

---

**Ready when you are!** 🎯
