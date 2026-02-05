# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment app |
| **Polymath** | `projects/polymath/` | Production | Voice-to-memory knowledge graph |
| **Analogue** | `projects/analogue/` | Active | Mobile manuscript editing IDE |
| **Agentic Swarm** | `agentic-swarm/` | Active | Multi-agent task orchestration |

## Commands

```bash
cd projects/wizard-of-oz && npm run dev   # Pupils
cd projects/polymath && npm run dev       # Polymath
cd projects/analogue && npm run dev       # Analogue
cd agentic-swarm && npm run dev           # Agentic Swarm
```

## Skills

Use `/skill` for complex workflows:
- `session-start-hook` - Set up dev environment hooks

## Quick Reference

- **Deploy**: Push to `main` branch (Vercel auto-deploys)
- **Env vars**: Set in Vercel dashboard
- **Style**: TypeScript strict, functional React, no `any` types

## Session Start

1. Check `NEXT_SESSION.md` in the relevant project directory for current status
2. Each project has its own `CLAUDE.md` — read it when working in that project
3. State what you're building and why (2 sentences) at session start

## Session End (ALWAYS do this)

1. Update the project's `NEXT_SESSION.md` with: completed, next steps, blockers
2. Run `npm run build` to verify nothing's broken
3. If a new pattern or mistake was learned, update memory files
