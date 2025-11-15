# Memory Onboarding Setup Guide

## 1. Database Setup

### Run Migrations in Supabase

1. Open your Supabase project SQL Editor
2. Run these migrations in order:

#### Step 1: Memory Onboarding Schema
```sql
-- Copy and paste contents of migration-memory-onboarding.sql
```

#### Step 2: Seed Template Prompts
```sql
-- Copy and paste contents of scripts/seed-memory-prompts.sql
```

#### Step 3: Verify Installation
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('memory_prompts', 'memory_responses', 'user_prompt_status', 'project_notes');
-- Should return 4 rows

-- Check prompt count
SELECT COUNT(*) FROM memory_prompts WHERE is_required = true;
-- Should return: 10

SELECT COUNT(*) FROM memory_prompts;
-- Should return: 40
```

---

## 2. Environment Variables

Add to `.env.local`:

```bash
# Gemini API (required for gap detection & embeddings)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get Gemini API key from: https://aistudio.google.com/app/apikey

---

## 3. Test the System

### Initialize User Status

For existing users, run this SQL to initialize their prompt status:

```sql
-- Replace 'your-user-id' with actual user ID
INSERT INTO user_prompt_status (user_id, prompt_id, status)
SELECT 'your-user-id', id, 'pending'
FROM memory_prompts
WHERE is_required = true
ON CONFLICT (user_id, prompt_id) DO NOTHING;
```

### Test API Endpoints

```bash
# Start dev server
npm run dev

# Test GET /api/memory-prompts
curl -H "x-user-id: your-user-id" http://localhost:3000/api/memory-prompts

# Should return:
# {
#   "required": [...10 prompts...],
#   "suggested": [],
#   "optional": [...30 prompts...],
#   "progress": {
#     "completed_required": 0,
#     "total_required": 10,
#     ...
#   }
# }
```

### Test UI

1. Navigate to `/memories`
2. Click "Foundational" tab
3. You should see 10 required prompts
4. Click first prompt → Opens full-screen modal
5. Enter 3+ bullets → Submit
6. Progress bar should update
7. After 10 prompts → "Projects unlocked!" message

---

## 4. Features to Test

### ✅ Foundational Prompts
- [ ] See 10 prompts in order
- [ ] Click to open full-screen modal
- [ ] Enter 3+ bullets (validated)
- [ ] Submit updates progress
- [ ] Prompts unlock sequentially
- [ ] Progress bar shows completion

### ✅ AI Gap Detection
- [ ] After submitting memory, check "My Memories" tab
- [ ] "Suggested Prompts" section appears
- [ ] AI-generated follow-ups based on your responses
- [ ] Can add or dismiss suggestions

### ✅ Quality Validation
- [ ] Try submitting <3 bullets → Error
- [ ] Try submitting short bullets → Error
- [ ] Try vague responses → AI quality check fails
- [ ] Specific responses → Accepted

### ✅ Projects Unlock
- [ ] Complete 10 prompts
- [ ] "Projects unlocked!" appears
- [ ] Navigate to `/projects` or `/suggestions`
- [ ] Should work normally

---

## 5. Troubleshooting

### "Failed to fetch prompts"
- Check Supabase connection
- Verify migrations ran successfully
- Check RLS policies enabled

### "Unauthorized"
- Verify user authentication
- Check `x-user-id` header passed correctly
- Ensure auth context working

### "Failed to generate embedding"
- Check `GEMINI_API_KEY` in `.env.local`
- Verify API key is valid
- Check API quota not exceeded

### "Quality check failed"
- Response too vague
- Bullets too short (<10 chars)
- Less than 3 bullets
- Try being more specific

---

## 6. What's Next

Once setup complete:

1. **Complete onboarding** - Fill out 10 foundational prompts
2. **Try voice notes** - Audiopen integration still works
3. **Browse suggestions** - AI uses memories for synthesis
4. **Track projects** - Dormant resurfacing (coming soon)
5. **Node strengthening** - Git activity tracking (coming soon)

---

## Files Overview

| File | Purpose |
|------|---------|
| `migration-memory-onboarding.sql` | Database schema |
| `scripts/seed-memory-prompts.sql` | 40 template prompts |
| `lib/gap-detection.ts` | AI follow-up generation |
| `lib/validate-bullets.ts` | Quality validation |
| `lib/embeddings.ts` | Vector embeddings |
| `api/memory-prompts.ts` | GET prompts endpoint |
| `api/memory-responses.ts` | POST responses endpoint |
| `src/stores/useOnboardingStore.ts` | State management |
| `src/components/onboarding/FoundationalPrompts.tsx` | 10 prompts UI |
| `src/components/onboarding/PromptModal.tsx` | Full-screen entry |
| `src/components/onboarding/SuggestedPrompts.tsx` | AI follow-ups |
| `src/pages/MemoriesPage.tsx` | Updated with tabs |

---

**Setup complete!** 🎉 Start capturing structured memories.
