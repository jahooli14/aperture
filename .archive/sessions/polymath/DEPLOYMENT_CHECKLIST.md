# 🚀 Deployment Checklist

> **Step-by-step guide to deploy Polymath to production**

---

## Prerequisites

- [ ] Supabase account (https://supabase.com)
- [ ] Vercel account (https://vercel.com)
- [ ] Gemini API key (https://makersuite.google.com/app/apikey)
- [ ] Anthropic API key (https://console.anthropic.com) - Optional for synthesis

---

## Step 1: Database Setup (15 min)

### 1.1 Create Supabase Project
- [ ] Go to https://supabase.com/dashboard
- [ ] Click "New Project"
- [ ] Name: "Polymath" (or your choice)
- [ ] Choose region (closest to you)
- [ ] Set strong database password
- [ ] Wait for project to initialize (~2 min)

### 1.2 Enable pgvector Extension
- [ ] In Supabase dashboard → SQL Editor
- [ ] Run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.3 Run Database Migration
- [ ] Copy entire contents of `scripts/migration.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify: 6 new tables created
  - `capabilities`
  - `projects`
  - `project_suggestions`
  - `suggestion_ratings`
  - `node_strengths`
  - `capability_combinations`

### 1.4 Get Database Credentials
- [ ] Go to Settings → API
- [ ] Copy:
  - Project URL: `https://xxxxx.supabase.co`
  - Anon/Public Key: `eyJxxx...`
  - Service Role Key: `eyJxxx...` (keep secret!)

---

## Step 2: Local Testing (30 min)

### 2.1 Install Dependencies
```bash
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath
npm install
```

### 2.2 Configure Environment
- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Fill in Supabase credentials
- [ ] Add Gemini API key
- [ ] Add Anthropic API key (optional)
- [ ] Set USER_ID (create user in Supabase Auth or use UUID)

### 2.3 Seed Test Data
```bash
npx tsx scripts/polymath/seed-test-data.ts
```

Expected output:
```
🌱 Seeding test data...
✅ Inserted 8 capabilities
✅ Inserted 4 project suggestions
✅ Test data seeded successfully!
```

### 2.4 Run Dev Server
```bash
npm run dev
```

- [ ] Open http://localhost:5173
- [ ] Verify home page loads
- [ ] Navigate to /suggestions
- [ ] Verify 4 test suggestions appear
- [ ] Test rating a suggestion (👍)
- [ ] Navigate to /projects
- [ ] Verify empty state shows

### 2.5 Test Build
```bash
npm run build
```

- [ ] Build completes without errors
- [ ] Check `dist/` folder created

---

## Step 3: Vercel Deployment (5 min)

> **Note**: If you previously deployed MemoryOS, the environment variables are already set. Just redeploy!

### 3.1 Check Existing Deployment

If you have a `memory-os` Vercel project:
- [ ] All environment variables already configured
- [ ] Just need to redeploy from `polymath` folder

### 3.2 Option A: Update Existing Project (Recommended)

```bash
# Navigate to polymath folder
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath

# Link to existing Vercel project
vercel link
```

Choose:
- Link to existing project: **Yes**
- Select your project: `memory-os` (or whatever you named it)

```bash
# Deploy
vercel --prod
```

### 3.3 Option B: New Project

If starting fresh or want separate project:

```bash
vercel link
```

Choose:
- Link to existing: **No**
- Project name: `polymath`

Then add environment variables (same as before):
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_KEY
vercel env add GEMINI_API_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add USER_ID
```

```bash
vercel --prod
```

### 3.4 Verify Deployment
- [ ] Deployment succeeds
- [ ] Note deployment URL
- [ ] Open URL in browser
- [ ] Verify site loads with new Polymath branding

### 3.4 Verify Cron Jobs
- [ ] Go to Vercel Dashboard → Project → Settings → Cron Jobs
- [ ] Verify 2 cron jobs registered:
  - `weekly-synthesis` - Every Monday 09:00 UTC
  - `strengthen-nodes` - Every day 00:00 UTC

---

## Step 4: Capability Scanning (15 min)

### 4.1 Run Capability Scanner
```bash
npx tsx scripts/polymath/capability-scanner.ts
```

Expected output:
```
🔍 Starting capability scan...
✅ Scanned Wizard of Oz capabilities (6 found)
✅ Scanned Polymath capabilities (7 found)
✅ Scanned other capabilities (5 found)
📊 Total: 18 capabilities inserted
```

### 4.2 Verify in Supabase
- [ ] Go to Supabase → Table Editor → `capabilities`
- [ ] Verify 18+ rows exist
- [ ] Check embeddings are populated

---

## Step 5: AI Synthesis (15 min)

### 5.1 Run Synthesis Manually
```bash
npx tsx scripts/polymath/synthesis.ts
```

Expected output:
```
🧠 Starting synthesis...
📊 Found 18 capabilities
💭 Found 5 recent interests
🔄 Generating 10 project suggestions...
✅ Generated 10 suggestions
🎲 Injected diversity at position 3
✅ Synthesis complete!
```

### 5.2 Verify Suggestions
- [ ] Go to your deployed site
- [ ] Navigate to /suggestions
- [ ] Verify 10 new suggestions appear (4 test + 10 real = 14 total)
- [ ] Check wild card (🎲) appears on 3rd suggestion
- [ ] Verify point scores make sense

---

## Step 6: Audiopen Integration (10 min)

### 6.1 Configure Audiopen Webhook
- [ ] Go to Audiopen settings
- [ ] Add webhook URL: `https://your-domain.vercel.app/api/capture`
- [ ] Test with a voice note

### 6.2 Verify Interest Extraction
- [ ] Record 3-5 voice notes about different topics
- [ ] Wait ~1 minute for processing
- [ ] Go to Supabase → `entities` table
- [ ] Verify entities extracted from voice notes

---

## Step 7: Testing & Monitoring (20 min)

### 7.1 End-to-End Test
- [ ] Record voice note mentioning an interest
- [ ] Wait for Monday 09:00 UTC (or trigger synthesis manually)
- [ ] Check /suggestions for new ideas
- [ ] Rate a suggestion (👍 Spark)
- [ ] Build a project from suggestion (💡)
- [ ] Check /projects for new project
- [ ] Make git commit to project
- [ ] Wait for daily cron (00:00 UTC) or trigger manually
- [ ] Verify capability strengths updated

### 7.2 Monitor Cron Jobs
- [ ] Vercel Dashboard → Deployments → Functions
- [ ] Check cron function logs
- [ ] Verify they run successfully

### 7.3 Check Database
- [ ] Supabase → Table Editor
- [ ] Verify data populating:
  - `memories` (from voice notes)
  - `entities` (extracted interests)
  - `capabilities` (from scanner)
  - `project_suggestions` (from synthesis)
  - `projects` (from builds)
  - `node_strengths` (from git activity)

---

## Step 8: Domain Setup (Optional - 10 min)

### 8.1 Add Custom Domain
- [ ] Vercel Dashboard → Project → Settings → Domains
- [ ] Add domain: `polymath.yourdomain.com`
- [ ] Update DNS records (provided by Vercel)
- [ ] Wait for SSL certificate (auto)

### 8.2 Update Audiopen
- [ ] Update webhook URL to custom domain
- [ ] Test voice note capture

---

## Troubleshooting

### Database Issues
**Problem**: Tables not created
**Solution**: Check SQL editor for errors, re-run migration

**Problem**: RLS blocking queries
**Solution**: Verify `user_id` in env matches auth user

### API Issues
**Problem**: 500 errors on suggestions endpoint
**Solution**: Check Vercel function logs, verify env vars set

**Problem**: Embeddings failing
**Solution**: Verify GEMINI_API_KEY is valid, check quota

### Cron Job Issues
**Problem**: Synthesis not running
**Solution**: Check Vercel cron logs, manually trigger to test

**Problem**: Node strengthening not working
**Solution**: Verify git commits detected, check function logs

---

## Costs

### Estimated Monthly Costs
- **Supabase**: Free tier (500MB database, 50K API requests)
- **Vercel**: Free tier (100GB bandwidth, unlimited functions)
- **Gemini API**: ~$0.10/week for embeddings (2,000 embed calls)
- **Anthropic API**: ~$0.10/week for synthesis (10 suggestions/week)

**Total**: ~$0.80/month (essentially free on free tiers)

---

## Post-Deployment

### Weekly
- [ ] Check /suggestions for new ideas
- [ ] Rate suggestions (👍 👎)
- [ ] Build interesting projects (💡)

### Monthly
- [ ] Review database size (Supabase dashboard)
- [ ] Check function usage (Vercel dashboard)
- [ ] Review API costs (Gemini/Anthropic dashboards)

### As Needed
- [ ] Scan for new capabilities when adding features
- [ ] Manual synthesis if want more suggestions
- [ ] Update capability descriptions for better suggestions

---

## Success Criteria

✅ Database migrated (6 tables)
✅ Test data loaded
✅ Local dev server works
✅ Build completes
✅ Deployed to Vercel
✅ Cron jobs registered
✅ Capabilities scanned
✅ Synthesis generates suggestions
✅ Audiopen webhook configured
✅ Voice notes → interests → suggestions pipeline working

---

**Time to deploy**: ~2 hours total
**Status**: Production-ready
**Support**: See troubleshooting section or check logs

🚀 **Ready to discover novel project ideas!**
