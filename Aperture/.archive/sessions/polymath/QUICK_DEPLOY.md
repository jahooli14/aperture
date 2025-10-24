# ⚡ Quick Deploy - You're Already Set Up!

> **Since you had MemoryOS configured, you're 90% done**

---

## What's Already Done ✅

From your previous MemoryOS setup:
- ✅ Supabase project created
- ✅ Environment variables set
- ✅ Vercel deployment configured
- ✅ API keys (Gemini, Anthropic) configured

---

## Quick Deploy (5 min)

### 1. Database Migration (2 min)

The only NEW thing is 6 Polymath tables:

```bash
# Copy scripts/migration.sql to Supabase SQL editor and run
```

Creates:
- `capabilities`
- `projects`
- `project_suggestions`
- `suggestion_ratings`
- `node_strengths`
- `capability_combinations`

### 2. Redeploy (3 min)

```bash
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath

# Link to existing Vercel project
vercel link
# Choose: Link to existing → Select "memory-os" project

# Deploy
vercel --prod
```

That's it! Your existing env vars work perfectly.

---

## Test It (5 min)

### Seed Test Data
```bash
npx tsx scripts/polymath/seed-test-data.ts
```

### Visit Your Site
Go to your Vercel URL → You'll see:
- 🎨 Polymath branding (not MemoryOS)
- New Suggestions page
- New Projects page
- 4 test suggestions ready to rate

---

## What Changed From MemoryOS

**Before**: MemoryOS + Polymath (integrated)
**Now**: Just Polymath (MemoryOS features included)

**Database**: Same Supabase project, just added 6 tables
**Deployment**: Same Vercel project, new UI
**APIs**: Same endpoints, just rebranded
**Env Vars**: Exactly the same (no changes needed!)

---

## Total Time

- Database migration: 2 min
- Redeploy: 3 min
- **Total: 5 minutes**

No new API keys, no new services, no new configuration! ⚡

---

**Already done?** Run `npm run dev` locally to see it! 🚀
