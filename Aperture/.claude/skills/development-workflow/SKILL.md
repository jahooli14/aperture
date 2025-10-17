---
name: development-workflow
description: Common development workflows, build processes, testing patterns, and local development setup for Aperture projects including npm commands and environment configuration
---

# Development Workflow

## Purpose

Provides standard development workflows, build processes, testing patterns, and common commands for working on Aperture projects.

## When to Use

Activate when:
- Setting up local development environment
- Running development server
- Building or testing code
- Debugging build or runtime issues
- User asks "how do I run/build/test this?"

## Common Development Commands

### Wizard of Oz Project

```bash
# Navigate to project
cd projects/wizard-of-oz

# Install dependencies
npm install

# Development
npm run dev          # Start dev server (http://localhost:5173)
npm run typecheck    # TypeScript validation
npm run lint         # Code linting

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Quick script access
./.claude/skills/wizard-of-oz/common-tasks.sh [command]
```

## Development Server

### Starting Development

```bash
cd projects/wizard-of-oz
npm run dev
```

Server runs on `http://localhost:5173` and automatically opens in browser.

**Features:**
- Hot module replacement (HMR)
- Instant updates on file changes
- Error overlay in browser
- React Fast Refresh

### Environment Variables

Create `.env.local` in project root:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: Development overrides
VITE_DEBUG=true
```

**Important:** Environment variables must be prefixed with `VITE_` to be accessible in client code.

## Build Process

### Local Build Testing

```bash
cd projects/wizard-of-oz

# Type checking first
npm run typecheck

# Then build
npm run build
```

**Build output:** `dist/` directory

### Build Verification

After building, test the production build locally:

```bash
npm run preview
```

This starts a local server serving the production build.

## Testing Strategy

### Type Checking

```bash
npm run typecheck
```

Validates TypeScript without building. Faster than full build for checking errors.

### Manual Testing Checklist

**Upload Flow:**
- [ ] Camera input works on mobile
- [ ] Gallery input works on mobile/desktop
- [ ] File validation (image types only)
- [ ] Upload progress indication
- [ ] Success/error states

**Photo Display:**
- [ ] Calendar shows correct dates
- [ ] Gallery renders all photos
- [ ] Processing status accurate
- [ ] Error states handled

**Navigation:**
- [ ] Calendar month navigation
- [ ] Photo detail view
- [ ] Back navigation works

## Code Quality

### Pre-Commit Checklist

Before committing code:

```bash
# 1. Type check
npm run typecheck

# 2. Build test
npm run build

# 3. Visual review
git diff

# 4. Commit
git add .
git commit -m "type(scope): description"
```

### Code Style

**TypeScript:**
- NO `any` types - use `unknown`
- Interfaces over types for props
- Strict type safety enabled

**React:**
- Functional components with hooks
- Handler prefix: `handleClick`, `handleSubmit`
- File size: Keep under 200-300 lines

**Naming:**
- Components: PascalCase (`PhotoCard.tsx`)
- Directories: kebab-case (`wizard-of-oz/`)
- Hooks: camelCase with `use` prefix (`usePhotoStore`)
- Utils: camelCase (`formatDate`)

## Common Issues & Fixes

### Build Failures

**Issue:** TypeScript errors
```bash
# Check errors
npm run typecheck

# Common fixes:
# - Add missing type imports
# - Fix type mismatches
# - Update interface definitions
```

**Issue:** Missing dependencies
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue:** Environment variables not working
```bash
# Verify:
# 1. Variables prefixed with VITE_
# 2. .env.local exists in project root
# 3. Dev server restarted after adding vars
```

### Development Server Issues

**Issue:** Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Then restart
npm run dev
```

**Issue:** Hot reload not working
```bash
# Restart dev server
# OR
# Hard refresh browser (Cmd+Shift+R)
```

### Runtime Errors

**Issue:** Supabase connection failed
- Check environment variables set correctly
- Verify Supabase project is active
- Check network connectivity
- Review browser console for details

**Issue:** Photo upload fails
- Check file size limits
- Verify Supabase storage bucket exists
- Check RLS policies on photos table
- Review network tab in dev tools

## Performance Optimization

### Development Mode

**Tips for faster development:**
- Use `npm run typecheck` instead of full builds
- Keep dev tools open for instant feedback
- Use React DevTools for component debugging
- Enable source maps for better debugging

### Build Optimization

**Current optimizations:**
- Code splitting by route
- Tree shaking for unused code
- Minification and compression
- Optimized image loading

## Debugging Techniques

### Browser DevTools

**Console:**
- Check for JavaScript errors
- Review API call logs
- Monitor state changes

**Network Tab:**
- Verify API requests
- Check response status codes
- Monitor upload progress
- Review timing

**React DevTools:**
- Inspect component tree
- View component props/state
- Profile render performance

### Logging Strategy

```typescript
// Development logging
if (import.meta.env.DEV) {
  console.log('Debug info:', data)
}

// Error logging (always)
console.error('Error context:', {
  operation: 'uploadPhoto',
  fileName: file.name,
  error: error.message
})
```

## Git Workflow

### Branch Strategy

**Aperture uses main-only:**
- All development on `main` branch
- Vercel auto-deploys from `main`
- No feature branches for this project

### Commit Messages

Format: `type(scope): description`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```bash
git commit -m "feat(upload): add gallery photo selection"
git commit -m "fix(calendar): correct month navigation"
git commit -m "docs(readme): update setup instructions"
```

## Quick Reference Scripts

Use the helper script for common tasks:

```bash
./.claude/skills/development-workflow/dev-commands.sh [command]

# Available commands:
# - dev          Start development server
# - build        Build for production
# - test         Run type checking and build
# - preview      Preview production build
# - clean        Clean and reinstall dependencies
# - status       Check project status
```

## Additional Resources

**Related Skills:**
- `wizard-of-oz` - Project-specific patterns
- `vercel-deployment` - Deployment workflows
- `session-management` - Session continuity

**Documentation:**
- `projects/wizard-of-oz/DEPLOYMENT.md` - Deployment guide
- `CLAUDE-APERTURE.md` - Aperture patterns
- `NEXT_SESSION.md` - Current status

## Best Practices

### DO:
- ✅ Run `typecheck` before committing
- ✅ Test builds locally before deploying
- ✅ Use environment variables for config
- ✅ Commit small, logical changes
- ✅ Write clear commit messages

### DON'T:
- ❌ Commit without testing build
- ❌ Push directly without local verification
- ❌ Skip type checking
- ❌ Commit broken code
- ❌ Mix multiple concerns in one commit

## Success Criteria

Code is ready to commit when:
- ✅ `npm run typecheck` passes
- ✅ `npm run build` succeeds
- ✅ Manual testing completed
- ✅ No console errors
- ✅ Changes match intention
