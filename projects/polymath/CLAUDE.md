# Polymath

Voice-to-memory knowledge graph. Production. React 18, Vite, Capacitor, Supabase, D3, Dexie.

## Key Context
- Offline-first architecture using Dexie (IndexedDB) with Supabase sync
- Capacitor for mobile/desktop builds
- 3D knowledge graph visualization with D3/Three.js/React Force Graph
- Google Generative AI for memory synthesis
- Strict CSP headers in vercel.json — update CSP when adding new external APIs

## Known Issues
- **Background sync is broken**: Event tag mismatch — `sync-voice-notes` in registration vs `sync-captures` in service worker listener. Fix: align the tags.
- Service worker is intentionally flaky in development — don't chase dev-mode SW bugs
- Article caching for read-later is incomplete

## Before You Push
```bash
npm run build        # Includes API TypeScript compilation
npm run type-check   # TypeScript only check
```

## Useful Commands
```bash
npm run seed             # Seed test data
npm run synthesize       # Run memory synthesis
npm run strengthen       # Node strengthening
npm run backfill:embeddings  # Backfill embeddings
```

## Don't Do This
- Don't forget to update CSP headers when adding external API calls
- Don't assume service worker works in dev mode
- Don't modify Capacitor config without testing on both web and mobile
- Don't use React 19 features — this project is on React 18

## Architecture Docs
- `IMPLEMENTATION_PLAN.md` — current roadmap
- `EVOLUTION_ROADMAP.md` — long-term vision
- `READ_LATER_OPTIMIZATION_PLAN.md` — article caching strategy
