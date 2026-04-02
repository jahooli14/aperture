# Idea Engine - Quick Start

**Your Configuration:**
- Email: dmahorgan@gmail.com
- User ID: 55f8dc70-8317-4b79-b8c4-0de2f8b30534
- Gemini API Key: AIzaSyBPr5AXChvouiNghgU-wNjis2s_fj1QfqQ
- Budget: $10/month (optimized for max throughput)

---

## What You're Getting

**Generation:**
- **Every 11 minutes** (131 runs/day)
- **~43 ideas/day** pass pre-filter
- Gemini 3.1 Flash-Lite for generation
- **Gemini 3 Flash for pre-filter** (better quality scoring)

**Review:**
- **3x daily** (8am, 2pm, 8pm UTC)
- **Gemini 3.1 Pro** for review
- ~14 ideas per review batch
- Faster evolutionary feedback

**Email:**
- **Daily at 8:30am UTC** (3:30am EST / 12:30am PST)
- Beautiful HTML digest with:
  - Last 24h stats (generated/approved/rejected)
  - All approved ideas with full descriptions
  - Spark ideas
  - All-time progress metrics
  - Latest frontier blocks

**Cost: ~$10/month**

---

## Setup Steps (15 minutes)

### 1. Get Resend API Key (for email)

1. Go to https://resend.com/signup
2. Sign up (free tier: 100 emails/day, 3,000/month)
3. Verify your email
4. Go to API Keys
5. Create new API key
6. Copy it (starts with `re_`)

---

### 2. Set Environment Variables in Vercel

Go to: https://vercel.com/your-team/polymath/settings/environment-variables

Add these:

```bash
# Gemini API (already have)
GEMINI_API_KEY=AIzaSyBPr5AXChvouiNghgU-wNjis2s_fj1QfqQ

# User ID
IDEA_ENGINE_USER_ID=55f8dc70-8317-4b79-b8c4-0de2f8b30534

# Secret (generate new one)
IDEA_ENGINE_SECRET=<run command below>

# Resend API Key (from step 1)
RESEND_API_KEY=re_your_key_here
```

**Generate secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3. Add GitHub Secrets

Go to: https://github.com/your-username/Aperture/settings/secrets/actions

Add:
```
VERCEL_DOMAIN=your-polymath-domain.vercel.app
IDEA_ENGINE_SECRET=<same as above>
```

---

### 4. Run SQL Migration

1. Go to Polymath Supabase: https://supabase.com/dashboard/project/your-project
2. SQL Editor → New Query
3. Copy/paste contents of: `projects/idea-engine/supabase/migrations/20260402000001_create_idea_engine_schema.sql`
4. Run it (creates 11 tables with `ie_` prefix)

---

### 5. Seed Domains (Optional but Recommended)

In Supabase SQL Editor, run:

```sql
-- This populates the ie_domains table
-- Copy from config/domains.json and format as SQL INSERT
-- Or just let the system work with empty domains table initially
```

---

### 6. Deploy

```bash
cd ~/Aperture/projects/polymath
git add .
git commit -m "Add idea-engine with email digest"
git push
```

Vercel will auto-deploy. Wait ~2 minutes.

---

### 7. Test It

**Test generation:**
```bash
curl -X POST https://your-domain.vercel.app/api/idea-engine/generate \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json"
```

Should return:
```json
{"success": true, "passed_filter": true, "stored": true, ...}
```

**Test email digest:**
```bash
curl -X POST https://your-domain.vercel.app/api/idea-engine/send-digest \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json"
```

Check dmahorgan@gmail.com for email!

---

### 8. Wait for First Batch

- **First ideas:** Within 11 minutes
- **First review:** Next 8am/2pm/8pm UTC
- **First email:** Tomorrow at 8:30am UTC

---

## What Happens Next

### Hour 1-24 (Cold Start)
- System generates ~131 ideas
- Pre-filter passes ~43 ideas
- First review happens at next 8/2/8 UTC slot
- Gemini 3.1 Pro reviews ~14 ideas per batch
- First frontier blocks created (if FAS > 0.7)

### Day 2 (First Email)
- You wake up to email digest at 8:30am UTC
- See overnight approvals, rejections, stats
- System starts learning rejection patterns

### Week 1 (Learning Phase)
- ~300 ideas generated
- ~100 reviewed
- ~20-40 approved
- Rejection patterns emerge
- Domain sampler adjusts weights

### Month 1 (Evolved)
- ~3,900 ideas generated
- ~1,300 reviewed
- Approval rate trending up
- 5-10 frontier blocks created
- System avoids bad patterns
- Builds on successful ideas

---

## Monitoring

### Check System Health

**View ideas:**
```
https://your-domain.vercel.app/ideas
```

**Check mode entropy (should be >0.6):**
```sql
SELECT calculate_mode_entropy('55f8dc70-8317-4b79-b8c4-0de2f8b30534');
```

**View frontier blocks:**
```sql
SELECT concept_name, frontier_advancement_score, spawn_count
FROM ie_frontier_blocks
WHERE user_id = '55f8dc70-8317-4b79-b8c4-0de2f8b30534'
ORDER BY frontier_advancement_score DESC;
```

### GitHub Actions

Check: https://github.com/your-username/Aperture/actions

You should see:
- "Idea Engine - Generate" running every 11 min
- "Idea Engine - Opus Review" running 3x/day
- "Idea Engine - Daily Email Digest" running at 8:30am UTC

---

## Cost Breakdown (Optimized for $10/month)

| Component | Usage | Monthly Cost |
|-----------|-------|--------------|
| Generation (Flash-Lite) | 3,930 calls | $0.69 |
| Pre-filter (Flash) | 3,930 calls | $1.40 |
| Review (3.1 Pro, 3x/day) | 90 reviews × 44 ideas | $6.34 |
| Email (Resend) | 30 emails | $0 (free tier) |
| Infrastructure (Vercel + Supabase + GitHub Actions) | | $0 (free tiers) |
| **Total** | | **~$8.43/month** |

**Room for:**
- Frontier block spawning (+$1-2)
- Real embeddings API later (+$0.50)
- Overage buffer

---

## Troubleshooting

**"No ideas in email"**
- Wait 24 hours for first batch
- Check `/ideas` page on website
- Verify GitHub Actions are running

**"Email not received"**
- Check spam folder
- Verify Resend API key in Vercel
- Check Vercel function logs

**"Generation not working"**
- Verify Gemini API key is correct
- Check Vercel environment variables
- Test with manual curl

**"Review failing"**
- Check if pending ideas exist in database
- Verify Gemini 3.1 Pro is accessible
- Check Vercel function logs

---

## Next Steps

1. ✅ Complete setup (15 min)
2. ⏰ Wait for first email (tomorrow 8:30am UTC)
3. 📊 Monitor progress on `/ideas` page
4. 📧 Check daily emails
5. 🎯 Watch frontier blocks emerge (~1 week)
6. 📈 See approval rate improve (~2 weeks)

---

**You're all set!** The system will:
- Generate 131 ideas/day
- Review 3x/day with Gemini 3.1 Pro
- Email you every morning at 8:30am UTC
- Learn and evolve over time
- Create frontier blocks for breakthrough ideas
- Cost ~$10/month

Check your email tomorrow morning! 📧
