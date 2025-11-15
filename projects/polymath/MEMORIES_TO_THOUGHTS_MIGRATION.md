# Memories → Thoughts Terminology Migration

## Problem
App uses "memories" in many places but should consistently use "thoughts" for user-facing text.

## Scope

### What to Change
- **User-facing text**: "Memory" → "Thought", "Memories" → "Thoughts"
- **UI labels, titles, descriptions**
- **Route names** (optional): `/memories` → `/thoughts`

### What NOT to Change
- **Database tables**: `memories` table stays as-is (avoid migration)
- **API endpoints**: `/api/memories` stays (backward compatibility)
- **Type names**: `Memory` interface can stay (internal)
- **Variable names** in code (internal implementation)

## Files to Update

### High-Priority (User-Visible)
1. Page titles and headings
2. Button labels
3. Navigation labels
4. Toast/notification messages
5. Empty state messages
6. Help text

### Search Patterns

```bash
# Find user-facing "memory/memories" text
grep -r "Memory\|Memories" --include="*.tsx" src/pages/
grep -r "Memory\|Memories" --include="*.tsx" src/components/

# Focus on:
- <h1>, <h2>, <h3> tags
- Button text
- aria-label attributes
- Placeholder text
- Toast messages
```

## Example Replacements

### Before:
```typescript
<h1>My Memories</h1>
<Button>Add Memory</Button>
<p>No memories yet</p>
addToast({ title: "Memory saved" })
```

### After:
```typescript
<h1>My Thoughts</h1>
<Button>Add Thought</Button>
<p>No thoughts yet</p>
addToast({ title: "Thought saved" })
```

## Files Likely Affected

### Pages
- `src/pages/MemoriesPage.tsx` - Title, empty states
- `src/pages/HomePage.tsx` - Navigation labels
- `src/pages/DailyQueuePage.tsx` - Context labels

### Components
- Navigation components
- Memory/thought cards
- Create/edit dialogs
- Empty state components

### Routes (Optional - Lower Priority)
If updating routes:
```typescript
// src/App.tsx or routes config
<Route path="/thoughts" element={<MemoriesPage />} />
// Add redirect for backward compat
<Route path="/memories" element={<Navigate to="/thoughts" />} />
```

## Implementation Strategy

### Phase 1: User-Facing Text (Safe, No Breaking Changes)
1. Update page titles/headings
2. Update button labels
3. Update empty states
4. Update toast messages

### Phase 2: Routes (Optional, Requires Redirects)
1. Add new `/thoughts` route
2. Keep `/memories` as redirect
3. Update navigation links

### Phase 3: Code Cleanup (Future, Low Priority)
1. Rename components (MemoryCard → ThoughtCard)
2. Rename files
3. Update variable names

## Testing Checklist

- [ ] All user-visible "Memory" text changed to "Thought"
- [ ] Navigation still works
- [ ] No broken links
- [ ] Toast messages use "Thought"
- [ ] Empty states say "thoughts"
- [ ] Help text/descriptions updated

## Notes

- This is primarily a **cosmetic change** for better UX
- Database schema stays unchanged (avoid migrations)
- API endpoints stay unchanged (backward compatibility)
- Focus on user-visible text first, code refactoring later
