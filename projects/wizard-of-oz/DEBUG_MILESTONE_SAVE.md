# Debug Milestone Save Issue

## Steps to Debug

### 1. Open Browser Console
1. Open the Pupils app in production
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Try to save a milestone

### 2. Check What Error Appears

Look for error messages. Common issues:

#### A. "relation does not exist"
**Cause:** Migration not run
**Fix:** Run `supabase/migrations/006_add_milestone_tracking.sql` in Supabase SQL Editor

#### B. "new row violates row-level security policy"
**Cause:** RLS policies not set correctly
**Fix:** Check RLS policies in Supabase dashboard

#### C. "null value in column violates not-null constraint"
**Cause:** Required field missing
**Check:** Ensure `milestone_id`, `user_id`, `achieved_date` are present

#### D. "invalid input syntax for type uuid"
**Cause:** `photo_id` is empty string instead of null
**Fix:** Already fixed in latest code

### 3. Check Network Tab
1. Open Network tab in DevTools
2. Try to save milestone
3. Look for POST request to `/rest/v1/milestone_achievements`
4. Click on it and check:
   - **Request Payload:** What data is being sent?
   - **Response:** What error is returned?

### 4. Check Database Directly
Go to Supabase → Table Editor → milestone_achievements

**Does the table exist?**
- NO → Run migration
- YES → Continue

**Try manual insert:**
```sql
INSERT INTO milestone_achievements (
  user_id,
  milestone_id,
  achieved_date,
  photo_id,
  notes
) VALUES (
  'your-user-id-here',
  'social-smile',
  '2025-01-01',
  null,
  'Test note'
);
```

If this fails, check the error message.

### 5. Check RLS Policies
Go to Supabase → Authentication → Policies → milestone_achievements

You should have 4 policies:
1. `Users can view their own milestone achievements` (SELECT)
2. `Users can insert their own milestone achievements` (INSERT)
3. `Users can update their own milestone achievements` (UPDATE)
4. `Users can delete their own milestone achievements` (DELETE)

**INSERT policy should be:**
```sql
WITH CHECK (auth.uid() = user_id)
```

### 6. Check User Authentication
In browser console, run:
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);
```

If `user` is null, you're not authenticated.

### 7. Common Fixes

#### If photo_id is causing issues:
The latest code already handles this, but verify the payload shows:
```json
{
  "photo_id": null  // not "" or undefined
}
```

#### If notes is causing issues:
Should be:
```json
{
  "notes": null  // not "" for empty notes
}
```

## Quick Test
To test if the issue is with optional fields:

1. Fill in ALL fields (including photo and notes)
2. Try to save
3. If it works → The issue is with null handling
4. If it doesn't → The issue is elsewhere (migration/RLS/auth)

## Report Back
Please share:
1. Console error message (full text)
2. Network request payload
3. Network response
4. Whether the table exists in Supabase
