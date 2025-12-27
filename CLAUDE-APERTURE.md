# Aperture Development Guide

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Vercel Serverless, Supabase
- **AI**: Gemini (embeddings), Claude (synthesis)
- **Deploy**: Vercel (auto-deploy on push to main)

## Code Standards

```typescript
// TypeScript: strict, no 'any'
// React: functional components, hooks
// Naming: PascalCase components, camelCase functions
// Files: <300 lines, feature-based organization
```

## Project Docs

Each project has its own documentation:
- `projects/wizard-of-oz/README.md` - Pupils setup and development
- `projects/polymath/README.md` - Polymath architecture
- `agentic-swarm/README.md` - Agent orchestration

## Common Patterns

### Error Handling
```typescript
try {
  const result = await operation()
  if (!result) throw new Error('Operation failed')
  return result
} catch (error) {
  console.error('Context:', { operation, error })
  throw error
}
```

### Supabase Queries
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('field', value)

if (error) throw error
```

### Environment Variables
```bash
# Set in Vercel dashboard, not committed
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

## Debugging

1. Check browser console for errors
2. Check Vercel function logs
3. Verify environment variables are set
4. Test locally before deploying

## Deployment

```bash
npm run build          # Test build locally
git push origin main   # Triggers Vercel deploy
```

Build must pass locally before pushing.
