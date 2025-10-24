# Run Daily Queue Migration

## Option 1: Supabase Dashboard (Recommended)

1. Open Supabase Dashboard: https://nxkysxgaujdimrubjiln.supabase.co
2. Go to SQL Editor
3. Copy contents of `migration-daily-queue.sql`
4. Paste and click "Run"
5. Verify success message appears

## Option 2: psql Command Line

```bash
# Set environment variable
export SUPABASE_DB_URL="postgresql://postgres:[YOUR_PASSWORD]@db.nxkysxgaujdimrubjiln.supabase.co:5432/postgres"

# Run migration
psql $SUPABASE_DB_URL < migration-daily-queue.sql
```

## What This Migration Does

1. Adds Daily Queue fields to `projects` table:
   - `energy_level` (low/moderate/high)
   - `estimated_next_step_time` (minutes)
   - `context_requirements` (array of strings)
   - `blockers` (JSON array)
   - `recently_unblocked` (boolean)

2. Creates `user_daily_context` table:
   - Stores user's current time/energy/context
   - Used for queue matching

3. Updates `projects.status` constraint to include 'abandoned'

4. Adds indexes for performance

## Verify Migration

After running, check in Supabase dashboard:

1. Go to Table Editor
2. Check `projects` table has new columns
3. Check `user_daily_context` table exists
4. Check RLS policies are enabled

## Next Steps

After migration is successful:

```bash
# Build the app
npm run build

# Deploy to Vercel
npm run deploy
# OR
git add .
git commit -m "feat: add Daily Actionable Queue"
git push
```

Then visit: https://your-app.vercel.app/today
