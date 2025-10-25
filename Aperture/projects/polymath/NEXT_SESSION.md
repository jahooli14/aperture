# Next Session - Polymath Issues to Fix

## 🐛 Critical Bugs

### 1. Voice Capture Stop Button Not Saving
**Issue**: When you stop recording on the voice capture (both on HomePage and Thoughts page), nothing gets saved.

**Where to look**:
- `src/components/VoiceInput.tsx` - Check the stop recording handler
- `src/pages/HomePage.tsx` line 103-124 - `handleVoiceCapture` function
- `src/pages/MemoriesPage.tsx` line 143-180 - `handleVoiceCapture` function
- Endpoint: `POST /api/memories?capture=true` with `{ transcript }`

**What to check**:
- Is the transcript being passed correctly from VoiceInput to the handlers?
- Is the API call actually being made?
- Check browser console for errors
- Verify Gemini 2.5 Flash is parsing correctly in `api/memories.ts` line 80-181

---

### 2. Project Creation Still Failing
**Issue**: Even after all the fixes (RLS disabled, type changed to 'personal', VITE_USER_ID added), project creation still fails.

**What we fixed so far**:
- ✅ Disabled RLS on projects table
- ✅ Changed type from 'creative' to 'personal'
- ✅ Added `VITE_USER_ID` to Vercel env vars (all environments)
- ✅ Updated TypeScript types

**Where to look**:
- `src/components/projects/CreateProjectDialog.tsx` - The form
- `src/stores/useProjectStore.ts` line 71-89 - `createProject` function
- Browser console for the actual error message
- Check if `import.meta.env.VITE_USER_ID` is available in production

**Debugging steps**:
1. Open browser console on mobile or desktop
2. Try creating a project
3. Look for the actual error in console
4. Check Network tab to see the request/response
5. Verify the request body has all required fields:
   - `user_id`: "f2404e61-2010-46c8-8edd-b8a3e702f0fb"
   - `title`: string
   - `description`: string
   - `type`: "personal"
   - `status`: "active"
   - `metadata`: object

**Possible issues**:
- `VITE_USER_ID` not deployed yet (check Vercel dashboard)
- Database schema has other required fields we don't know about
- Need to use the `/api/projects` endpoint instead of direct Supabase client

---

## 🔍 How to Debug

### Check if VITE_USER_ID is deployed:
```bash
# In browser console on live site:
console.log(import.meta.env.VITE_USER_ID)
// Should output: "f2404e61-2010-46c8-8edd-b8a3e702f0fb"
```

### Check actual error for project creation:
```javascript
// In browser console, try manually:
const { createClient } = window.supabase || {}
// Check the actual error object
```

### Test voice capture manually:
```javascript
// Check if handleVoiceCapture is being called
// Add console.log in VoiceInput.tsx onTranscript callback
```

---

## 📝 Files to Review Tomorrow

1. **Voice Capture**:
   - `src/components/VoiceInput.tsx`
   - `api/memories.ts` (handleCapture function)

2. **Project Creation**:
   - `src/stores/useProjectStore.ts`
   - `src/components/projects/CreateProjectDialog.tsx`
   - Check if we should use `/api/projects` endpoint instead of Supabase client

---

## ✅ What's Working

- Gemini 2.5 Flash integration for parsing
- Thoughts page UI with Quick Capture button
- Simplified project form (3 fields)
- Build passes successfully
- All TypeScript types updated correctly

---

## 💡 Possible Solutions to Try

### For Voice Capture:
- Check if `autoSubmit` prop is working in VoiceInput
- Verify the transcript is not empty when stop is clicked
- Add console.logs to track the flow

### For Project Creation:
- Switch to using `/api/projects` endpoint instead of direct Supabase
- Check database for other required columns (like `last_active`, `updated_at`)
- Verify user_id format is correct UUID

---

**Last updated**: 2025-10-25 21:40 UTC
**Branch**: main
**Last commit**: 40197b2 (fix ProjectType in types and EditProjectDialog)
