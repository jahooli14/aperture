# Milestones Feature Setup

The milestones feature requires a database migration to be applied to your Supabase project.

## Quick Fix

If you're seeing an error about `milestone_achievements table does not exist`, follow these steps:

### 1. Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

### 2. Run the Migration

Copy the entire contents of `supabase/migrations/006_add_milestone_tracking.sql` and paste it into the SQL editor, then click "Run".

The migration will create:
- `milestone_achievements` table
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates

### 3. Verify the Migration

Run this command to check if the migration was applied successfully:

```bash
npm run check-migrations
```

Or manually verify in Supabase:
1. Go to Table Editor in your Supabase dashboard
2. Look for the `milestone_achievements` table
3. It should have these columns:
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users)
   - `milestone_id` (text)
   - `achieved_date` (date)
   - `photo_id` (uuid, nullable)
   - `notes` (text, nullable)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

### 4. Reload the App

After running the migration, reload your app and the milestones feature should work!

## Troubleshooting

### "Permission denied" error
Make sure you're running the SQL as a user with admin privileges. Use the SQL Editor in the Supabase dashboard (not via the API).

### "Relation already exists" error
The migration has already been applied. The feature should work. Try reloading the app.

### Still seeing errors?
1. Check the browser console for detailed error messages
2. Verify your Supabase connection in `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Make sure you're logged in to the app with a valid account

## What the Migration Does

The migration creates a table to store milestone achievements with:
- **User isolation**: Each user can only see their own milestone achievements
- **Photo linking**: Optional link to a photo that captures the milestone
- **Notes**: Add context about when/how the milestone was achieved
- **Audit trail**: Automatic timestamps for when records are created/updated
- **Data integrity**: Unique constraint ensures each milestone can only be marked once per user

## Development vs Production

- **Local development**: Run the migration manually via Supabase dashboard
- **Production**: The migration should be applied to your production database the same way

There's no automatic migration system yet, so migrations must be run manually in the SQL editor.
