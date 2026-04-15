# Deployment

## Vercel (All Projects)

Push to `main` branch = auto-deploy.

```bash
npm run build         # Verify build works
git push origin main  # Deploy
```

## Environment Variables

Set in Vercel Dashboard > Project > Settings > Environment Variables.

Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` (if using AI)

## Troubleshooting

1. Build fails → Run `npm run build` locally first
2. 500 errors → Check Vercel function logs
3. Missing env vars → Verify in Vercel dashboard
