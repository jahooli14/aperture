# Variables and Decisions Needed

Before deploying the Idea Engine, please provide the following:

---

## 1. API Keys

### Gemini API Key
**Where to get it:** https://aistudio.google.com/app/apikey

```
GEMINI_API_KEY=your-key-here
```

### Anthropic API Key
**Where to get it:** https://console.anthropic.com/settings/keys

```
ANTHROPIC_API_KEY=your-key-here
```

---

## 2. User Configuration

### Supabase User ID
**How to get it:**
1. Go to Polymath's Supabase Dashboard
2. Authentication > Users
3. Copy your user ID (UUID format)

```
IDEA_ENGINE_USER_ID=your-uuid-here
```

### Generate Secret Token
**For GitHub Actions authentication:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
IDEA_ENGINE_SECRET=generated-secret-here
```

---

## 3. Idea Delivery Method

**How do you want to receive approved ideas?**

Choose one or more:

### Option A: Website Only
- ✅ Already built: `/ideas` page
- No additional setup needed
- You check manually when you want

### Option B: Email Digest
**Frequency:**
- [ ] After each Opus review (2x/week: Mon/Thu)
- [ ] Daily summary (once per day)
- [ ] Weekly summary (once per week)

**Format:**
- [ ] Just titles of approved ideas
- [ ] Full descriptions
- [ ] Only frontier blocks (FAS > 0.7)
- [ ] All pending ideas awaiting review

**Your email:**
```
YOUR_EMAIL=your-email@example.com
```

**Email service to use:**
- [ ] Resend (recommended, free tier)
- [ ] SendGrid
- [ ] AWS SES
- [ ] Other: _____________

### Option C: Slack/Discord Notification
**Which service:**
- [ ] Slack
- [ ] Discord
- [ ] Other: _____________

**Webhook URL:**
```
NOTIFICATION_WEBHOOK_URL=your-webhook-url-here
```

**When to notify:**
- [ ] New approved idea
- [ ] New frontier block created
- [ ] After each Opus review
- [ ] Daily summary

### Option D: Custom Integration
**Describe what you want:**
```
(e.g., "Add approved ideas to a Notion database",
"Post to my personal blog via API", etc.)
```

---

## 4. Vercel Domain

**Your Polymath/Idea Engine Vercel domain:**
```
VERCEL_DOMAIN=your-project.vercel.app
```

If you don't have this yet:
1. Deploy Polymath to Vercel
2. Copy the domain from Vercel dashboard

---

## 5. Generation Schedule Preferences

### Generation Frequency
**Current:** 1 agent every 50 minutes (~29 ideas/day)

Do you want to change this?
- [ ] Keep as-is (50 min intervals)
- [ ] Faster: Every 30 min (~48 ideas/day, $4/mo)
- [ ] Slower: Every 2 hours (~12 ideas/day, $1/mo)
- [ ] Custom: Every _____ minutes

### Review Frequency
**Current:** 2x/week (Mon/Thu 9am UTC)

Do you want to change this?
- [ ] Keep as-is (2x/week)
- [ ] More frequent: Daily (7x/week, $6/mo)
- [ ] Less frequent: Weekly (1x/week, $0.85/mo)
- [ ] Custom: _____________

---

## 6. Pre-filter Tuning

### Pass Rate
**Current:** 33% of generated ideas pass pre-filter

Do you want to change this?
- [ ] Keep as-is (33%)
- [ ] More selective: 20% pass (fewer, higher quality)
- [ ] Less selective: 50% pass (more volume)

### Deduplication Threshold
**Current:** 0.88 similarity = duplicate

Do you want to change this?
- [ ] Keep as-is (0.88 = strict)
- [ ] Stricter: 0.90 (fewer duplicates)
- [ ] Looser: 0.85 (more diverse ideas)

---

## 7. Embedding Service (Optional)

**Current state:** Using placeholder embeddings (deduplication won't work properly)

**Do you want real embeddings?**
- [ ] No, placeholder is fine for now
- [ ] Yes, I'll set up a Python service (sentence-transformers)
- [ ] Yes, use OpenAI embeddings API (costs ~$0.50/mo extra)

If yes, provide:
```
EMBEDDING_SERVICE_URL=your-service-url (if using Python service)
OPENAI_API_KEY=your-key (if using OpenAI)
```

---

## 8. Additional Features (Optional)

### Frontier Block Spawning
**Do you want automatic follow-up generation for high-FAS ideas?**
- [ ] Yes, spawn 3 mutations when frontier block is created
- [ ] No, keep it manual for now

### Dashboard Metrics
**Do you want a metrics dashboard?**
- [ ] Yes, show me:
  - [ ] Approval rate over time
  - [ ] Mode entropy (collapse detection)
  - [ ] Domain pair heatmap
  - [ ] Lineage tree visualization
- [ ] No, just the ideas list is fine

### Export
**Do you want to export ideas to other tools?**
- [ ] Notion database
- [ ] Obsidian vault
- [ ] JSON/CSV download
- [ ] Other: _____________

---

## Summary Checklist

Before deployment, you need:

**Required:**
- [ ] Gemini API key
- [ ] Anthropic API key
- [ ] Supabase user ID
- [ ] Generated secret token
- [ ] Vercel domain

**Delivery Method (choose at least one):**
- [ ] Website only
- [ ] Email digest (+ email address + service)
- [ ] Slack/Discord (+ webhook URL)
- [ ] Custom integration (+ description)

**Optional:**
- [ ] Adjust generation/review frequency
- [ ] Tune pre-filter pass rate
- [ ] Set up real embeddings
- [ ] Enable frontier block spawning
- [ ] Add metrics dashboard
- [ ] Set up exports

---

## Next Steps

1. Fill out the required variables above
2. Provide your delivery preferences
3. Run the setup steps in SETUP.md
4. Test the system with manual triggers
5. Let it run for 24-48 hours
6. Review first batch of approved ideas

---

**Once you provide these, I can:**
- Set up the delivery system (email/Slack/etc.)
- Configure the exact cadence you want
- Add any optional features
- Help with troubleshooting

Let me know what you decide!
