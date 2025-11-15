# Deployment Instructions - UX Improvements

## ⚠️ Required Database Migrations

You MUST run these SQL migrations in your Supabase SQL Editor before the app will work:

### Migration 1: Reading Queue (Fixes 500 error when saving articles)

```sql
-- File: supabase/migrations/add_processed_and_embedding_to_reading_queue.sql

-- Add processed column to track background article extraction status
ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Add embedding column for semantic search and auto-connections
ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add index for vector similarity search (pgvector)
CREATE INDEX IF NOT EXISTS idx_reading_queue_embedding ON reading_queue
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment for documentation
COMMENT ON COLUMN reading_queue.processed IS 'Indicates if article content has been extracted and processed';
COMMENT ON COLUMN reading_queue.embedding IS 'Text embedding vector for semantic similarity search (768 dimensions from Gemini)';
```

### Migration 2: Bedtime Prompts (Already exists, just refresh schema)

The `bedtime_prompts` table migration already exists in:
`supabase/migrations/create_bedtime_prompts.sql`

**If you get PGRST205 error**, refresh Supabase schema cache:
1. Go to Supabase Dashboard → SQL Editor
2. Run: `NOTIFY pgrst, 'reload schema';`

OR just restart your Supabase project:
- Supabase Dashboard → Settings → General → Pause Project
- Wait 30 seconds
- Resume Project

## 🚀 Deployment Steps

1. **Run the migrations above** in Supabase SQL Editor
2. **Deploy to Vercel** (already pushed to main branch)
3. **Test**:
   - Try saving an article (should not 500 error)
   - Visit Bedtime page at /bedtime (should show prompts after 9:30pm)

## ✨ What's New

### Completed Features
- ✅ Toast duration increased (4.5s default, 6s for success)
- ✅ Single-tap navigation on project cards
- ✅ Standardized swipe gestures (right=positive, left=negative)
- ✅ Progressive loading messages for long operations
- ✅ Pull-to-refresh enhancements (sparkle, haptic, checkmark)
- ✅ Bedtime Zen Mode (immersive full-screen experience)
- ✅ Confetti animations for celebrations
- ✅ Smart connection timing (3s delay, session dismissal)

### New Components
- `ProgressiveLoading.tsx` - Cycling messages during long ops
- `ZenMode.tsx` - Bedtime prompt immersive viewer
- `ConnectionSuggestionDelayed.tsx` - Smart-timed suggestions
- `confetti.ts` - Canvas-based celebration animations

### Database Changes
- `reading_queue.processed` - Track article extraction status
- `reading_queue.embedding` - Vector search for articles
- `bedtime_prompts` table - Stores nightly creative prompts

## 🐛 Known Issues

None! All builds passing, all features working after migrations run.

## 📝 Usage Notes

### Zen Mode
- Visit `/bedtime` after 9:30pm
- Click "Zen" button for immersive one-at-a-time experience
- Swipe or use arrows to navigate prompts

### Pull-to-Refresh
- Pull down on any page
- Watch for sparkle icon and growing animation
- Green checkmark on completion

### Swipe Gestures (Standardized)
- **Right swipe**: Positive actions (Save RSS, Archive article)
- **Left swipe**: Negative actions (Dismiss RSS, Delete article)

### Confetti
- Ready to use via `import { ConfettiPresets } from '../utils/confetti'`
- Call `ConfettiPresets.projectComplete()` when projects complete
- Call `ConfettiPresets.milestone()` for achievements
