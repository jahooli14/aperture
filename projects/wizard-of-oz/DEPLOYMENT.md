# Wizard of Oz - Deployment Notes

## Vercel Deployment

### ⚠️ CRITICAL: Main Branch Requirement

**ALL changes MUST be committed to the `main` branch for Vercel to automatically redeploy.**

Vercel is configured to deploy from the `main` branch only. Changes on other branches will not trigger deployments.

### Deployment Workflow

1. Make your changes locally
2. Test thoroughly with `npm run dev`
3. Build locally to verify: `npm run build`
4. Commit changes: `git add . && git commit -m "your message"`
5. **Push to main**: `git push origin main` ← This triggers Vercel deployment
6. Monitor deployment at Vercel dashboard

### Deployment Configuration

- **Framework**: Vite + React + TypeScript
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: Auto-detected from package.json engines field
- **Environment Variables**: Set in Vercel dashboard
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Post-Deployment Checks

After pushing to main, verify:
- [ ] Vercel build succeeds (check dashboard)
- [ ] Deployment preview works
- [ ] Production site updates
- [ ] No console errors
- [ ] Environment variables are set correctly

### Rollback

If deployment fails:
1. Check Vercel build logs
2. Revert commit: `git revert HEAD`
3. Push revert: `git push origin main`
4. Fix issues locally, then re-deploy

---

**Remember**: No feature branches for this project. All work happens on `main` with immediate Vercel deployments.
