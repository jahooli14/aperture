# MemoryOS Setup Guide

## 1. Database Setup (Supabase)

### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Save URL and keys

### Run Migrations
```sql
-- Run schema.sql first
-- Then run migrations.sql
```

## 2. Environment Variables

Create `.env`:
```bash
cp .env.example .env
```

Fill in:
- `VITE_SUPABASE_URL` - From Supabase project settings
- `VITE_SUPABASE_ANON_KEY` - From Supabase API settings (anon/public)
- `SUPABASE_SERVICE_ROLE_KEY` - From Supabase API settings (service_role, **keep secret**)
- `GEMINI_API_KEY` - From Google AI Studio

## 3. Install Dependencies

```bash
npm install
```

## 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Set Environment Variables in Vercel
Add all env vars from `.env` to Vercel dashboard.

## 5. Configure Audiopen Webhook

1. Go to Audiopen settings → Integrations
2. Enable "Automatic Webhook"
3. Set webhook URL: `https://your-app.vercel.app/api/capture`
4. Add processing prompt (see README.md)

## 6. Test Webhook

Record a test note in Audiopen. After 4 minutes:

1. Check Vercel logs: `vercel logs`
2. Check Supabase: `select * from memories;`
3. Manually trigger processing:
   ```bash
   curl -X POST https://your-app.vercel.app/api/process \
     -H "Content-Type: application/json" \
     -d '{"memory_id": "uuid-from-database"}'
   ```

## 7. Local Development

```bash
npm run dev
```

Open http://localhost:5173

### Test Webhook Locally

Use ngrok or similar:
```bash
ngrok http 3000
# Set Audiopen webhook to ngrok URL
```

## Troubleshooting

**Webhook not receiving data:**
- Check Audiopen webhook URL is correct
- Verify it's https://
- Check Vercel function logs

**Processing fails:**
- Check GEMINI_API_KEY is valid
- Check Gemini quota (text-embedding-004 has free tier limits)
- Review logs: `vercel logs --follow`

**No bridges found:**
- Normal for first few memories
- Bridges require at least 2 processed memories
- Check entities are being extracted (review memory in DB)

**Vector search error:**
- Ensure migrations.sql was run (match_memories function)
- Check embedding dimension is 768 (Gemini text-embedding-004)
