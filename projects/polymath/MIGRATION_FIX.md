# Migration Fix: Add image_urls Column

## Issue

The Polymath app is experiencing errors when creating memories:

```
Database insert error: {
  code: 'PGRST204',
  details: null,
  hint: null,
  message: "Could not find the 'image_urls' column of 'memories' in the schema cache"
}
```

## Root Cause

The migration file `supabase/migrations/20251210000001_add_image_urls_and_storage.sql` exists in the codebase but hasn't been applied to the production Supabase database.

## Solution

### Option 1: Apply Migration via Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your Polymath project
3. Navigate to **SQL Editor** → **New query**
4. Copy and paste the SQL below
5. Click **Run**

```sql
-- Add image_urls to memories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'image_urls') THEN
    ALTER TABLE "public"."memories" ADD COLUMN "image_urls" text[] DEFAULT NULL;
  END IF;
END $$;

-- Create storage bucket for thought images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('thought-images', 'thought-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for storage (drop first to avoid conflicts/duplicates)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Re-create policies (targeted at specific bucket)
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'thought-images' );

CREATE POLICY "Authenticated Upload"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'thought-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Delete"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'thought-images' AND auth.role() = 'authenticated' );
```

### Option 2: Use Migration Script (If .env.local is configured)

```bash
cd projects/polymath
tsx scripts/run-migration.ts supabase/migrations/20251210000001_add_image_urls_and_storage.sql
```

## Verification

After applying the migration, verify it worked by:

1. Creating a new memory via the API
2. Checking that the error no longer occurs
3. Verifying the `image_urls` column exists:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'memories' AND column_name = 'image_urls';
```

## Files Affected

- `api/memories.ts` - Uses `image_urls` field (lines 275, 374, 1210, 1222)
- `src/types.ts` - Defines `image_urls: string[] | null` in Memory interface (line 67)
- `supabase/migrations/20251210000001_add_image_urls_and_storage.sql` - Migration file

## Status

- [x] Issue identified
- [ ] Migration applied to production database
- [ ] Verified fix works
