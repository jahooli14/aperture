# Deployment Guide

> **Philosophy**: Automate the boring stuff. Make deployments boring (in a good way).

## Overview

Our default deployment strategy: **Vercel** for frontend + serverless functions, **Supabase** for backend services.

**Why?**
- Zero-config for Next.js/Vite projects
- Automatic HTTPS and CDN
- Preview deployments for every PR
- Generous free tier
- Seamless integration

---

## Standard Deployment Flow

### wizard-of-oz Example

```
git push origin main
    ↓
GitHub detects push
    ↓
Vercel auto-deploys
    ↓
Production live in ~2 minutes
```

---

## Initial Setup (Per Project)

### 1. Vercel Configuration

**Option A: GitHub Integration** (Recommended)
1. Push code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import repository
5. Add environment variables (see project's `.env.example`)
6. Deploy

**Option B: Vercel CLI**
```bash
npm i -g vercel
cd projects/wizard-of-oz
vercel
# Follow prompts
```

### 2. Environment Variables

**Required for every project**:
- Copy from `.env.example`
- Add to Vercel dashboard (Settings → Environment Variables)
- Separate values for Production, Preview, Development

**wizard-of-oz example**:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # Secret, production only
GEMINI_API_KEY=AIzaSyXXX...          # Secret, production only
```

### 3. Domain Setup (Optional)

**Custom domain**:
1. Vercel dashboard → Domains
2. Add custom domain
3. Update DNS (Vercel provides instructions)
4. HTTPS automatically provisioned

---

## Deployment Environments

### Production
- **Branch**: `main`
- **URL**: `your-project.vercel.app` or custom domain
- **Trigger**: Push to `main` or manual deploy
- **Environment**: Production environment variables

### Preview (Staging)
- **Branch**: Any branch with PR
- **URL**: Unique URL per PR (`your-project-git-feature-name.vercel.app`)
- **Trigger**: Push to any branch with open PR
- **Environment**: Preview environment variables
- **Purpose**: Test changes before merging

### Development
- **Local only**
- **URL**: `http://localhost:5173` (Vite) or `http://localhost:3000` (Next.js)
- **Environment**: `.env.local` or `.env`

---

## Automated Workflows (CI/CD)

### 1. Automatic Deployments

Already configured with Vercel GitHub integration:
- ✅ Every push to `main` → Production deployment
- ✅ Every PR → Preview deployment
- ✅ Comment with preview URL added to PR

### 2. Automated Commit Messages

Use `/commit` slash command (see `.claude/commands/commit.md`):

```bash
git add .
# In Claude: /commit
```

Generates Conventional Commits:
```
feat(auth): add email magic link authentication

- Implement Supabase Auth integration
- Add AuthForm component
- Handle magic link redirects

Generated with Claude Code
```

### 3. Automated PR Reviews

**Setup**: Install [Claude Code GitHub App](https://github.com/apps/claude-code)

**Configuration**: Create `.github/claude-code-review.yml`:
```yaml
focus:
  - logic errors
  - security vulnerabilities
  - performance issues
  - potential bugs

ignore:
  - style nitpicks
  - minor formatting
  - personal preferences

verbosity: concise

auto_approve_minor: false
```

**Result**: Claude automatically reviews every PR with AI-powered analysis.

### 4. Automated Changelogs (Future)

**Placeholder**: Implement when we have regular releases.

**Approach**:
```yaml
# .github/workflows/changelog.yml
on:
  release:
    types: [published]

jobs:
  generate-changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate changelog
        run: |
          # Collect commits since last release
          # Pass to Claude via API
          # Generate categorized changelog
          # Update CHANGELOG.md
```

---

## Vercel-Specific Configuration

### vercel.json

```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "VITE_SUPABASE_URL": "@supabase-url",
    "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key"
  },
  "build": {
    "env": {
      "NODE_VERSION": "20"
    }
  }
}
```

**Key settings**:
- `maxDuration`: Max execution time for serverless functions (seconds)
- `env`: Environment variables (use Vercel CLI to set values: `vercel env add`)

### Build Configuration

Vercel auto-detects framework (Vite, Next.js), but you can override:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

---

## Monitoring & Debugging

### Vercel Logs

Access logs:
1. Vercel dashboard → Deployments → [Select deployment]
2. Click "View Function Logs"
3. Real-time tail or historical search

### Error Tracking

**Recommended**: Integrate Sentry for production error tracking.

**Setup** (placeholder for when needed):
```bash
npm install @sentry/nextjs
# Or for Vite: npm install @sentry/react
```

```typescript
// sentry.config.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

---

## Rollback Strategy

### Instant Rollback
Vercel keeps all previous deployments:

1. Vercel dashboard → Deployments
2. Find stable previous deployment
3. Click "..." → "Promote to Production"
4. Instant rollback (no rebuild needed)

### Git Rollback
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin main --force  # Careful!
```

---

## Security Best Practices

### Environment Variables
- ✅ **DO**: Store secrets in Vercel environment variables
- ✅ **DO**: Use different values for Preview vs Production
- ❌ **DON'T**: Commit secrets to `.env` files
- ❌ **DON'T**: Expose service keys in client-side code

### API Keys
- ✅ **DO**: Restrict API keys by domain (if possible)
- ✅ **DO**: Use separate keys for production vs development
- ✅ **DO**: Rotate keys periodically
- ❌ **DON'T**: Use production keys in preview deployments

### Database Access
- ✅ **DO**: Use Row Level Security (Supabase RLS)
- ✅ **DO**: Use service role key only in serverless functions
- ❌ **DON'T**: Expose service role key to client

---

## Deployment Checklist

Before deploying a new project:

- [ ] **Environment variables** set in Vercel
- [ ] **Secrets** not committed to git (check `.gitignore`)
- [ ] **Database migrations** run (if applicable)
- [ ] **API endpoints** tested locally
- [ ] **Build** succeeds locally (`npm run build`)
- [ ] **Tests** pass (`npm run test`)
- [ ] **README.md** updated with setup instructions
- [ ] **Custom domain** configured (if applicable)

Before deploying a feature:

- [ ] **Tests** pass locally
- [ ] **Manual QA** completed
- [ ] **Breaking changes** documented
- [ ] **Database migrations** prepared (if needed)
- [ ] **Feature flags** configured (if using)

---

## Performance Optimization

### Vercel Edge Functions (Advanced)

For latency-sensitive operations:

```typescript
// api/hello.ts
export const config = {
  runtime: 'edge', // Run at edge locations (faster)
};

export default async function handler(req: Request) {
  return new Response('Hello from the edge!');
}
```

**Use cases**:
- Authentication checks
- A/B testing logic
- Redirects based on geo-location
- Simple API proxies

### CDN & Caching

Vercel automatically caches static assets. For dynamic content:

```typescript
// Set cache headers
export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  // ...
}
```

---

## Cost Management

### Free Tier Limits (Vercel)
- 100GB bandwidth/month
- 100 serverless function executions/day
- Unlimited preview deployments
- 1 concurrent build

### When to Upgrade
Monitor usage in Vercel dashboard:
- **Bandwidth**: If > 90GB/month consistently
- **Function executions**: If hitting daily limit
- **Builds**: If hitting queue delays

---

## Troubleshooting

### Build Failures

**Common issues**:
1. **Environment variables missing**: Check Vercel dashboard
2. **TypeScript errors**: Run `npm run typecheck` locally
3. **Dependency issues**: Clear cache, reinstall (`npm ci`)
4. **Build timeout**: Optimize build process or upgrade plan

### Runtime Errors

**Check**:
1. **Function logs**: Vercel dashboard → Function Logs
2. **Environment variables**: Correct for environment (Preview vs Production)
3. **External services**: Supabase, APIs reachable from Vercel IPs
4. **Timeout**: Function exceeds maxDuration (default 10s, max 60s)

### Slow Performance

**Investigate**:
1. **Bundle size**: Run `npm run build` and check output size
2. **Cold starts**: Serverless functions need warmup (first request slower)
3. **Database queries**: Optimize with indexes, caching
4. **External API calls**: Add caching layer

---

## Future Enhancements (Placeholders)

### 🔮 Blue-Green Deployments
**When**: We need zero-downtime deployments with instant rollback
**Approach**: Use Vercel's preview URLs + DNS switching

### 🔮 Canary Releases
**When**: We want to test changes on small percentage of users
**Approach**: Vercel Edge Config + custom routing logic

### 🔮 Automated E2E Tests
**When**: Manual QA becomes bottleneck
**Approach**: GitHub Actions + Playwright + Preview deployments

### 🔮 Performance Monitoring
**When**: We need detailed performance insights
**Tools**: Vercel Analytics, Sentry Performance, Lighthouse CI

---

**Last Updated**: 2025-10-10
**Current Projects**: wizard-of-oz (deployed to Vercel)
**Next Review**: After deploying second project
