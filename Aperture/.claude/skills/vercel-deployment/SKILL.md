---
name: vercel-deployment
description: Vercel deployment workflows, configuration patterns, environment variable management, and production deployment procedures for Aperture projects
---

# Vercel Deployment

## Purpose

Provides deployment workflows, Vercel configuration patterns, and production deployment procedures for Aperture projects hosted on Vercel.

## When to Use

Activate when:
- Deploying to production
- Configuring Vercel settings
- Managing environment variables
- Debugging deployment issues
- Checking production logs
- User asks "how do I deploy?" or mentions Vercel

## Deployment Overview

**Platform:** Vercel
**Auto-Deploy:** From `main` branch
**Build Command:** `npm run build`
**Output Directory:** `dist`
**Framework:** Vite

## Critical Deployment Rule

**ALL CHANGES MUST BE ON `main` BRANCH**

Vercel only auto-deploys from the `main` branch. Feature branches will NOT trigger deployments.

## Deployment Workflow

### Standard Deployment

```bash
# 1. Ensure on main branch
git checkout main

# 2. Verify build works locally
cd projects/wizard-of-oz
npm run build

# 3. Commit changes
git add .
git commit -m "feat: description"

# 4. Push to main (triggers deployment)
git push origin main
```

### Pre-Deployment Checklist

Before pushing to `main`:

- [ ] `npm run build` succeeds locally
- [ ] `npm run typecheck` passes
- [ ] Manual testing completed
- [ ] Environment variables verified (if changed)
- [ ] No console errors in dev mode
- [ ] Tested on mobile (if UI changes)

## Environment Variables

### Required Variables

Configure in Vercel Dashboard → Project Settings → Environment Variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Adding New Variables

1. Go to Vercel Dashboard
2. Select project
3. Settings → Environment Variables
4. Add new variable
5. Select environments (Production, Preview, Development)
6. **Redeploy** to apply changes

**Important:** Environment variable changes require a redeploy to take effect.

### Variable Best Practices

- **Prefix:** All client-side variables must start with `VITE_`
- **Secrets:** Never commit secrets to git
- **Documentation:** Document required variables in DEPLOYMENT.md
- **Validation:** Verify variables are set before deploying

## Vercel Configuration

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Purpose:**
- `rewrites`: Enable client-side routing (SPA mode)
- Ensures all routes serve `index.html`

### Build Settings

**Build Command:** `npm run build` (from project root)
**Install Command:** `npm install`
**Output Directory:** `dist`
**Node Version:** 18.x (auto-detected)

## Monitoring Deployments

### Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. View deployments list
4. Click deployment for details

### Deployment Status

**Building:** Deployment in progress
**Ready:** Deployment successful
**Error:** Build failed (check logs)

### Checking Logs

**Via Dashboard:**
1. Click on deployment
2. View "Build Logs" tab
3. Check for errors

**Via CLI (optional):**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# View logs
vercel logs
```

## Common Deployment Issues

### Build Failures

**Issue:** TypeScript errors
```
Solution:
1. Run npm run typecheck locally
2. Fix TypeScript errors
3. Push fix to main
```

**Issue:** Missing dependencies
```
Solution:
1. Verify package.json is committed
2. Check lock file is committed
3. Clear Vercel build cache (Dashboard → Settings)
```

**Issue:** Environment variables not working
```
Solution:
1. Verify variables are set in Vercel Dashboard
2. Ensure VITE_ prefix for client variables
3. Trigger new deployment after adding variables
```

### Runtime Errors

**Issue:** 404 on routes
```
Solution:
- Verify vercel.json rewrites are configured
- Check output directory is correct
```

**Issue:** Blank page / white screen
```
Solution:
1. Check browser console for errors
2. Verify Supabase environment variables
3. Review production logs
4. Test build locally with npm run preview
```

**Issue:** API calls failing
```
Solution:
1. Check Supabase URL is correct
2. Verify CORS settings in Supabase
3. Confirm RLS policies allow access
4. Review network tab in browser dev tools
```

## Rollback Procedure

### Via Vercel Dashboard

1. Go to Deployments
2. Find last working deployment
3. Click "..." menu
4. Select "Promote to Production"

### Via Git

```bash
# Find last working commit
git log --oneline

# Revert to that commit
git revert <commit-hash>

# Or reset (careful!)
git reset --hard <commit-hash>
git push origin main --force
```

**Prefer:** Vercel dashboard rollback (safer, instant)

## Performance Optimization

### Build Optimization

**Current settings:**
- Code splitting enabled
- Tree shaking for unused code
- Minification enabled
- Source maps generated

### Vercel Edge Network

- Global CDN automatically enabled
- Automatic HTTPS
- Brotli compression
- HTTP/2 support

## Custom Domains (if applicable)

### Adding Custom Domain

1. Vercel Dashboard → Domains
2. Add domain
3. Update DNS records
4. Wait for verification

### SSL Certificates

- Automatic SSL via Let's Encrypt
- Auto-renewal
- HTTPS enforced by default

## Deployment Scripts

### Manual Deployment Helper

```bash
./.claude/skills/vercel-deployment/deploy.sh
```

This script:
1. Checks you're on main branch
2. Runs build test
3. Commits and pushes
4. Monitors deployment status

## Integration with Other Skills

**With wizard-of-oz:**
- Use project-specific build commands
- Follow deployment checklist

**With development-workflow:**
- Ensure build passes before deploying
- Use type checking before push

**With session-management:**
- Update NEXT_SESSION.md after successful deploys
- Document deployment issues if any

## Best Practices

### DO:
- ✅ Test builds locally first
- ✅ Commit to main branch only
- ✅ Verify environment variables
- ✅ Monitor deployment completion
- ✅ Test in production after deploy

### DON'T:
- ❌ Push broken builds
- ❌ Use feature branches (for Aperture)
- ❌ Commit secrets to git
- ❌ Skip local testing
- ❌ Deploy without checking environment variables

## Quick Reference

### Deploy Now
```bash
git add .
git commit -m "feat: description"
git push origin main
```

### Check Status
- Dashboard: https://vercel.com/dashboard
- Or use: `vercel ls` (with CLI)

### View Logs
- Dashboard → Deployment → Logs
- Or use: `vercel logs`

### Rollback
- Dashboard → Deployments → Promote old deployment

## Success Criteria

Deployment is successful when:
- ✅ Build completes without errors
- ✅ Deployment shows "Ready" status
- ✅ Production site loads correctly
- ✅ No console errors in production
- ✅ All features work as expected
- ✅ Environment variables are applied
