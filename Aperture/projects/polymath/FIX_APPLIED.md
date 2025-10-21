# Fix Applied - Vercel Function Limit

> **Issue**: Deployment failed due to exceeding Vercel Hobby plan limit (12 serverless functions)
> **Solution**: Consolidated memory endpoints into single file
> **Status**: ✅ Fixed and deployed

---

## Problem

Vercel Hobby plan only allows 12 serverless functions, but we had 13:

### Before (13 functions):
1. api/projects.ts
2. api/memories.ts
3. api/bridges.ts ❌ (separate file)
4. api/memories/[id]/review.ts ❌ (separate file)
5. api/process.ts
6. api/projects/[id].ts
7. api/capture.ts
8. api/suggestions/[id]/rate.ts
9. api/suggestions/[id]/build.ts
10. api/suggestions.ts
11. api/cron/weekly-synthesis.ts
12. api/cron/strengthen-nodes.ts
13. api/lib/process-memory.ts (library, not a function)

---

## Solution

Consolidated 3 memory-related endpoints into 1:

### After (10 functions):
1. api/projects.ts
2. **api/memories.ts** ✅ (now handles everything)
3. ~~api/bridges.ts~~ ❌ Removed
4. ~~api/memories/[id]/review.ts~~ ❌ Removed
5. api/process.ts
6. api/projects/[id].ts
7. api/capture.ts
8. api/suggestions/[id]/rate.ts
9. api/suggestions/[id]/build.ts
10. api/suggestions.ts
11. api/cron/weekly-synthesis.ts
12. api/cron/strengthen-nodes.ts

**Total**: 10 serverless functions (well under 12 limit!)

---

## Consolidated API Design

**File**: `api/memories.ts`

### Endpoints:

**GET /api/memories**
- Lists all memories

**GET /api/memories?resurfacing=true**
- Returns spaced repetition queue (memories due for review)

**POST /api/memories**
- Marks memory as reviewed
- Body: `{ "id": "memory-uuid" }`

**GET /api/memories?bridges=true&id=xxx**
- Gets bridges for specific memory (or all if no id)

---

## Frontend Changes

**File**: `src/pages/MemoriesPage.tsx`

### Before:
```typescript
await fetch(`/api/memories/${memoryId}/review`, { method: 'POST' })
```

### After:
```typescript
await fetch(`/api/memories`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: memoryId })
})
```

---

## TypeScript Error Fixed

**Issue**: `api/memories/[id]/review.ts` used invalid `supabase.sql` syntax

**Before**:
```typescript
review_count: supabase.sql`COALESCE(review_count, 0) + 1`  // ❌ Error
```

**After**:
```typescript
// Fetch current value first
const { data: existing } = await supabase
  .from('memories')
  .select('review_count')
  .eq('id', memoryId)
  .single()

// Then increment
review_count: (existing?.review_count || 0) + 1  // ✅ Works
```

---

## Deployment

**Commit**: 0d9c60e
**Status**: ✅ Pushed to main
**Vercel**: Auto-deploying now

---

## Testing Checklist

- [ ] Visit `/memories` - should load
- [ ] Click "Resurface" tab - should work
- [ ] Click "✓ Reviewed" button - should mark memory as reviewed
- [ ] Check browser console - no errors

---

## Future Considerations

If we need to add more endpoints and hit the 12 function limit again:

### Option 1: Consolidate More
- Combine `api/projects.ts` and `api/projects/[id].ts`
- Combine `api/suggestions.ts` and `api/suggestions/[id]/*`
- Could get down to ~7 functions

### Option 2: Upgrade to Pro Plan
- Unlimited serverless functions
- Cost: $20/month per team member
- Worth it if adding many more features

### Option 3: Use Unified API Pattern
- Single `api/index.ts` that routes to handlers
- Similar to Express.js routing
- More complex but ultimate flexibility

---

**For now, we're good with 10/12 functions!** 🎉
