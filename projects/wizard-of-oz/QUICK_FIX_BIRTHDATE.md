# Quick Fix: Birthdate Error

## The Problem

You're seeing "Failed to save birthdate" because the database column doesn't exist yet in production.

## The Solution (2 minutes)

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project: https://supabase.com/dashboard/project/_
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Paste this SQL:

```sql
-- Add birthdate to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS baby_birthdate DATE;

-- Add comment to document the metadata structure
COMMENT ON COLUMN photos.metadata IS 'JSONB field for extensible metadata. Current fields: { note: string (optional memory note) }';
```

5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"

### Option 2: Using the Migration File

If you have Supabase CLI set up:

```bash
cd projects/wizard-of-oz
supabase db push
```

## Verify It Worked

1. Refresh your app
2. Go to Settings
3. Try setting the birthdate again
4. Should work now! ✅

## What This Does

- Adds `baby_birthdate` column to `user_settings` table
- Safe to run multiple times (uses `IF NOT EXISTS`)
- Doesn't affect existing data

---

**After this is done, the age display feature will work perfectly!**
