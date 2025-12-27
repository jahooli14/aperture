# Development

## Setup

```bash
cd projects/[project-name]
npm install
npm run dev
```

## Workflow

1. Make changes
2. Test locally: `npm run build`
3. Push to main: auto-deploys to Vercel

## Code Style

```typescript
// Components: PascalCase
function MyComponent() {}

// Functions: camelCase
function handleClick() {}

// No any types
const data: unknown = response;
```

## Debugging

1. Browser console for frontend errors
2. Vercel logs for function errors
3. Check environment variables

## Testing

```bash
npm run test        # Run tests
npm run test:watch  # Watch mode
```
