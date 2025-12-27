# Architecture

## Principles

1. **Start Minimal** - Simplest solution first
2. **TypeScript Strict** - No `any` types
3. **Functional React** - Hooks over classes
4. **Vercel Deploy** - Push to main = deploy

## Stack

```
Frontend: React 18 + TypeScript + Vite
Backend: Vercel Serverless Functions
Database: Supabase (PostgreSQL)
AI: Gemini (embeddings), Claude (synthesis)
```

## File Structure

```
projects/
├── wizard-of-oz/     # Pupils app
├── polymath/         # Polymath app
agentic-swarm/        # Agent orchestration
```

## Patterns

- Feature-based file organization
- Co-locate tests with source
- Environment vars in Vercel dashboard
