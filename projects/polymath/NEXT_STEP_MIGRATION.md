# Next Step Migration Guide

## Problem
Currently using legacy `metadata.next_step` field. Should use **first incomplete task** from `metadata.tasks[]` array instead.

## Solution
Replace all instances of `project.metadata?.next_step` with logic to get first task where `done: false`.

## Pattern to Replace

### Before (Legacy):
```typescript
const nextStep = project.metadata?.next_step
```

### After (Correct):
```typescript
const tasks = project.metadata?.tasks || []
const nextTask = tasks.find(t => !t.done)
const nextStep = nextTask?.text
```

## Files That Need Updating

✅ **DONE**: `src/pages/ProjectDetailPage.tsx` - Updated to use first incomplete task

⏳ **TODO**: Update these files:
1. `src/components/projects/ProjectCard.tsx`
2. `src/components/projects/EditProjectDialog.tsx`
3. `src/components/projects/ProjectProperties.tsx`
4. `src/pages/DailyQueuePage.tsx`
5. `src/pages/HomePage.tsx`
6. `src/pages/ProjectsPage.tsx`
7. `src/components/projects/CreateProjectDialog.tsx`
8. `api/projects.ts` (server-side logic)
9. `api/analytics.ts` (server-side logic)

## Search & Replace Strategy

### Step 1: Find all uses
```bash
grep -r "metadata?.next_step\|metadata.next_step" --include="*.tsx" --include="*.ts" src/
```

### Step 2: For each file, apply this pattern:

**Add helper at top of component:**
```typescript
// Helper function to get next step from tasks
function getNextStep(project: Project): string | undefined {
  const tasks = project.metadata?.tasks || []
  const nextTask = tasks.find(t => !t.done)
  return nextTask?.text
}
```

**Or inline:**
```typescript
const nextStep = project.metadata?.tasks?.find(t => !t.done)?.text
```

### Step 3: Update renders
```typescript
// Before
{project.metadata?.next_step && (
  <div>{project.metadata.next_step}</div>
)}

// After
{nextStep && (
  <div>{nextStep}</div>
)}
```

## Type Updates Needed

### Remove from types.ts:
```typescript
export interface ProjectMetadata {
  next_step?: string // DELETE THIS LINE
  // ... rest stays
}
```

## Database Migration (Optional)

The `next_step` field in `metadata` JSONB can stay for backward compatibility, but new code won't use it.

## Testing Checklist

After migration, verify:
- [ ] Project detail page shows first incomplete task
- [ ] HomePage shows correct next steps
- [ ] DailyQueue shows correct next steps
- [ ] ProjectCard shows correct next steps
- [ ] Completing a task updates the displayed next step
- [ ] Projects with no tasks show nothing (graceful degradation)

## Notes

- Tasks are stored as: `Task[] = { id, text, done, created_at, order }[]`
- Tasks are sorted by `order` field
- First task where `done: false` is the next step
- If all tasks done or no tasks exist, no next step shown
