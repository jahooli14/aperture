# Common Mistakes

## Build Errors

**Problem**: Build fails on Vercel
**Fix**: Run `npm run build` locally before pushing

## Environment Variables

**Problem**: API calls return 401/500
**Fix**: Check env vars are set in Vercel dashboard

## TypeScript

**Problem**: Using `any` type
**Fix**: Use `unknown` and type guards

```typescript
// Bad
const data: any = response

// Good
const data: unknown = response
if (isValidData(data)) { ... }
```

## React Re-renders

**Problem**: Component re-renders too often
**Fix**: Use `useMemo`/`useCallback` for expensive operations

## Supabase RLS

**Problem**: Queries return empty even with data
**Fix**: Check Row Level Security policies
