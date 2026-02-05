# Pupils (wizard-of-oz)

Baby photo alignment app. Production. React 19, Vite, TypeScript, Supabase, MediaPipe.

## Key Context
- Folder is `wizard-of-oz` but app name is **Pupils** — don't rename the folder (Vercel routing depends on it)
- Eye detection runs client-side via MediaPipe Face Landmarker — no external API calls
- PWA with service worker — cache invalidation matters on every deploy
- Daily reminder cron at `/api/cron/send-reminders` (15:00 UTC)

## Known Issues
- Dependency versions MUST be pinned exactly — `^` causes React/Tailwind version drift and white screens
- Service worker can serve stale bundles — always test cache-clearing flow after deploys
- Email reminders (Resend) built but integration incomplete — see `EMAIL_REMINDERS_SETUP.md`

## Before You Push
```bash
npm run build        # ALWAYS run this first
npm run test         # Run tests if they exist for changed code
```

## Don't Do This
- Don't upgrade React or Tailwind without testing the full app flow
- Don't add new dependencies without pinning exact versions
- Don't modify service worker registration without testing cache clearing
- Don't use `any` types — use `unknown` + type guards

## Session Notes
Check `NEXT_SESSION.md` in this directory for current status.
